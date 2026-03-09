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
  ],

  async scheduled(event, env, ctx) {
    if (!this.urlsToPing || this.urlsToPing.length === 0) {
      console.log('⚠️ No URLs configured to ping');
      return;
    }

    console.log(`🔄 Starting ping cycle for ${this.urlsToPing.length} URLs at ${new Date().toISOString()}`);
    
    const results = await this.pingAllUrls();
    const summary = this.generateSummary(results);
    
    console.log(summary.text);
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
        const fetchOptions = {
          method: config.method || 'GET',
          headers: config.headers || {},
          timeout: config.timeout || 10000
        };

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
          
          const expectedStatuses = Array.isArray(config.expectedStatus) 
            ? config.expectedStatus 
            : [config.expectedStatus || 200];
          
          result.success = expectedStatuses.includes(response.status);
          
          if (result.success) {
            console.log(`✅ ${config.name || config.url}: ${response.status} (${result.responseTime}ms)`);
          } else {
            console.warn(`⚠️ ${config.name || config.url}: Unexpected status ${response.status}`);
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
   ├─ 📌 Total URLs: ${total}
   ├─ ✅ Successful: ${successful}
   ├─ ❌ Failed: ${failed}
   ├─ ⚡ Avg Response: ${avgResponseTime}ms
   └─ 🕐 Time: ${new Date().toISOString()}
    `;

    return { total, successful, failed, avgResponseTime, text, results };
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/") {
      const html = this.generateHomePage();
      return new Response(html, {
        status: 200,
        headers: { 
          "Content-Type": "text/html; charset=UTF-8"  // 🔥 Important: charset UTF-8
        }
      });
    }

    if (path === "/api/ping" && request.method === "POST") {
      ctx.waitUntil(this.scheduled(null, env, ctx));
      return new Response(JSON.stringify({ 
        message: "✅ Ping cycle triggered manually",
        timestamp: new Date().toISOString()
      }), {
        status: 202,
        headers: { 
          "Content-Type": "application/json; charset=UTF-8"  // 🔥 Important
        }
      });
    }

    return new Response("❌ Not Found", { 
      status: 404,
      headers: { "Content-Type": "text/plain; charset=UTF-8" }
    });
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

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">  <!-- 🔥 YEH BOHOT IMPORTANT HAI -->
  <title>🔍 URL Pinger Monitor</title>
  <style>
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      max-width: 900px; 
      margin: 40px auto; 
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      color: #333;
    }
    h1 { 
      color: #333;
      border-bottom: 3px solid #667eea;
      padding-bottom: 10px;
    }
    h1 span {
      background: #667eea;
      color: white;
      padding: 5px 15px;
      border-radius: 50px;
      font-size: 16px;
      margin-left: 15px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    .stat-card .number {
      font-size: 36px;
      font-weight: bold;
      display: block;
    }
    .stat-card .label {
      font-size: 14px;
      opacity: 0.9;
    }
    .url-list {
      background: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      margin: 20px 0;
    }
    .url-list h3 {
      margin-top: 0;
      color: #667eea;
    }
    ul { 
      list-style: none; 
      padding: 0; 
    }
    li { 
      padding: 15px; 
      border-bottom: 1px solid #e0e0e0;
      transition: all 0.3s ease;
    }
    li:hover {
      background: white;
      transform: translateX(10px);
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    li:last-child {
      border-bottom: none;
    }
    .badge { 
      background: #667eea; 
      color: white; 
      padding: 4px 12px; 
      border-radius: 20px; 
      font-size: 12px; 
      margin-left: 10px;
      display: inline-block;
    }
    .badge.expected { 
      background: #28a745; 
    }
    .api-section {
      background: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      margin-top: 30px;
    }
    .api-section h3 {
      color: #667eea;
      margin-top: 0;
    }
    code {
      background: #333;
      color: #ffd700;
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .status-online {
      color: #28a745;
      font-weight: bold;
    }
    .status-offline {
      color: #dc3545;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      🔍 @VAIBHAVSATPUTE URL Pinger Monitor 
      <span>🚀 Live</span>
    </h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <span class="number">${this.urlsToPing.length}</span>
        <span class="label">📌 Configured URLs</span>
      </div>
      <div class="stat-card">
        <span class="number">60</span>
        <span class="label">⏰ Checks/Hour</span>
      </div>
      <div class="stat-card">
        <span class="number">1440</span>
        <span class="label">📊 Checks/Day</span>
      </div>
    </div>

    <div class="url-list">
      <h3>📋 Monitored URLs:</h3>
      <ul>
        ${urlsList || '<li style="text-align: center">❌ No URLs configured</li>'}
      </ul>
    </div>

    <div class="api-section">
      <h3>🔌 API Endpoints:</h3>
      <ul>
        <li><code>GET /api/stats</code> - 📊 View today's statistics</li>
        <li><code>POST /api/ping</code> - 🔄 Trigger manual ping cycle</li>
      </ul>
    </div>

    <div class="footer">
      <p>⚡ Last Check: ${new Date().toLocaleString()}</p>
      <p>Made with ❤️ by @vaibhavsatpute</p>
    </div>
  </div>
</body>
</html>
    `;
  }
};