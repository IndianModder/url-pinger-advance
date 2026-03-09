// Advanced URL Pinger with Monitoring and Analytics
export default {
  // Enhanced URL configuration with options
  urlsToPing: [
    {
      url: "https://moon-userbot-qkda.onrender.com",
      name: "@vaibhavsatpute",
      method: "GET",
      expectedStatus: 200,
      timeout: 10000, // 10 seconds
      headers: {
        "User-Agent": "URL-Pinger/1.0"
      }
    },
    {
      url: "https://example2.com/api/health",
      name: "Example API",
      method: "HEAD",
      expectedStatus: [200, 204],
      timeout: 5000,
      headers: {
        "User-Agent": "URL-Pinger/1.0",
        "Accept": "application/json"
      }
    },
    // Add more URLs with their configurations
  ],

  // Store ping history in KV (if bound)
  async initialize(env) {
    this.env = env;
    this.KV = env.PING_STATS; // Optional KV namespace for persistence
  },

  async scheduled(event, env, ctx) {
    await this.initialize(env);
    
    if (!this.urlsToPing || this.urlsToPing.length === 0) {
      console.log('⚠️ No URLs configured to ping');
      await this.logEvent('warning', 'No URLs configured');
      return;
    }

    console.log(`🔄 Starting ping cycle for ${this.urlsToPing.length} URLs at ${new Date().toISOString()}`);
    
    const results = await this.pingAllUrls();
    const summary = this.generateSummary(results);
    
    // Log summary
    console.log(summary.text);
    
    // Store results if KV is available
    if (this.KV) {
      ctx.waitUntil(this.storeResults(results, summary));
    }
    
    // Send alert if critical failures
    if (summary.failed > 0 && env.ALERT_WEBHOOK) {
      ctx.waitUntil(this.sendAlert(summary, env.ALERT_WEBHOOK));
    }
  },

  async pingAllUrls() {
    const pingPromises = this.urlsToPing.map(async (config) => {
      const startTime = Date.now();
      const result = {
        config,
        timestamp: new Date().toISOString(),
        success: false,
        status: null,
        statusText: null,
        error: null,
        responseTime: null,
        responseSize: null
      };

      try {
        // Prepare fetch options
        const fetchOptions = {
          method: config.method || 'GET',
          headers: config.headers || {},
          timeout: config.timeout || 10000
        };

        // Add custom headers if needed
        if (!fetchOptions.headers['User-Agent']) {
          fetchOptions.headers['User-Agent'] = 'URL-Pinger/1.0';
        }

        // Perform the ping with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), fetchOptions.timeout);
        
        try {
          const response = await fetch(config.url, {
            ...fetchOptions,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          result.status = response.status;
          result.statusText = response.statusText;
          result.responseTime = Date.now() - startTime;
          
          // Get response size (approximate)
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();
          result.responseSize = text.length;

          // Check if status matches expected
          const expectedStatuses = Array.isArray(config.expectedStatus) 
            ? config.expectedStatus 
            : [config.expectedStatus || 200];
          
          result.success = expectedStatuses.includes(response.status);
          
          if (result.success) {
            console.log(`✅ ${config.name || config.url}: ${response.status} (${result.responseTime}ms)`);
          } else {
            console.warn(`⚠️ ${config.name || config.url}: Unexpected status ${response.status}, expected ${expectedStatuses.join(' or ')}`);
          }
          
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

      } catch (error) {
        result.error = error.name === 'AbortError' ? 'Timeout' : error.message;
        result.responseTime = Date.now() - startTime;
        
        console.error(`❌ ${config.name || config.url}: Failed - ${result.error}`);
      }

      return result;
    });

    return await Promise.all(pingPromises);
  },

  generateSummary(results) {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgResponseTime = Math.round(
      results.reduce((acc, r) => acc + (r.responseTime || 0), 0) / total
    );
    
    const text = `
📊 Ping Cycle Summary:
   Total URLs: ${total}
   ✅ Successful: ${successful}
   ❌ Failed: ${failed}
   ⚡ Avg Response: ${avgResponseTime}ms
   🕐 Time: ${new Date().toISOString()}
    `;

    return { total, successful, failed, avgResponseTime, text, results };
  },

  async storeResults(results, summary) {
    if (!this.KV) return;
    
    const today = new Date().toISOString().split('T')[0];
    const key = `stats:${today}`;
    
    try {
      // Get existing stats or create new
      let stats = await this.KV.get(key, 'json') || {
        date: today,
        totalPings: 0,
        totalSuccess: 0,
        totalFailed: 0,
        avgResponseTime: 0,
        failures: []
      };
      
      // Update stats
      stats.totalPings += summary.total;
      stats.totalSuccess += summary.successful;
      stats.totalFailed += summary.failed;
      stats.avgResponseTime = Math.round(
        (stats.avgResponseTime * (stats.totalPings - summary.total) + 
         summary.avgResponseTime * summary.total) / stats.totalPings
      );
      
      // Store failures for analysis
      summary.results
        .filter(r => !r.success && r.error)
        .forEach(r => {
          stats.failures.push({
            url: r.config.url,
            name: r.config.name,
            error: r.error,
            timestamp: r.timestamp,
            status: r.status
          });
        });
      
      // Keep only last 100 failures
      if (stats.failures.length > 100) {
        stats.failures = stats.failures.slice(-100);
      }
      
      await this.KV.put(key, JSON.stringify(stats));
      
    } catch (error) {
      console.error('Failed to store results in KV:', error);
    }
  },

  async sendAlert(summary, webhookUrl) {
    const message = {
      text: `⚠️ URL Pinger Alert - ${summary.failed} URLs failed`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*URL Pinger Alert*\n*Failed URLs:* ${summary.failed}\n*Total URLs:* ${summary.total}\n*Time:* ${new Date().toISOString()}`
          }
        }
      ]
    };
    
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  },

  async logEvent(level, message, data = {}) {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };
    console.log(JSON.stringify(logEntry));
  },

  async fetch(request, env, ctx) {
    await this.initialize(env);
    const url = new URL(request.url);
    const path = url.pathname;

    // Home page - show configured URLs
    if (path === "/") {
      const html = this.generateHomePage();
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }

    // API endpoint - get current stats
    if (path === "/api/stats" && this.KV) {
      const today = new Date().toISOString().split('T')[0];
      const stats = await this.KV.get(`stats:${today}`, 'json') || {
        message: "No stats available for today"
      };
      
      return new Response(JSON.stringify(stats, null, 2), {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // API endpoint - trigger manual ping
    if (path === "/api/ping" && request.method === "POST") {
      ctx.waitUntil(this.scheduled(null, env, ctx));
      return new Response(JSON.stringify({ 
        message: "Ping cycle triggered manually",
        timestamp: new Date().toISOString()
      }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404 });
  },

  generateHomePage() {
    const urlsList = this.urlsToPing.map(config => 
      `<li>
        <strong>${config.name || config.url}</strong> - 
        ${config.url} 
        <span class="badge">${config.method || 'GET'}</span>
        ${config.expectedStatus ? `<span class="badge expected">Expected: ${Array.isArray(config.expectedStatus) ? config.expectedStatus.join(' or ') : config.expectedStatus}</span>` : ''}
      </li>`
    ).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <title>URL Pinger Status</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    ul { list-style: none; padding: 0; }
    li { padding: 10px; border-bottom: 1px solid #eee; }
    .badge { background: #0070f3; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 8px; }
    .badge.expected { background: #28a745; }
    .footer { margin-top: 40px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h1>🔍 URL Pinger Monitor</h1>
  
  <div class="stats">
    <p><strong>Configured URLs:</strong> ${this.urlsToPing.length}</p>
    <p><strong>Cron Schedule:</strong> Every minute (* * * * *)</p>
    <p><strong>Last Check:</strong> ${new Date().toLocaleString()}</p>
  </div>

  <h2>Monitored URLs:</h2>
  <ul>
    ${urlsList || '<li>No URLs configured</li>'}
  </ul>

  <div class="footer">
    <p>API Endpoints:</p>
    <ul>
      <li><code>GET /api/stats</code> - View today's statistics (requires KV)</li>
      <li><code>POST /api/ping</code> - Trigger manual ping cycle</li>
    </ul>
  </div>
</body>
</html>
    `;
  }
};