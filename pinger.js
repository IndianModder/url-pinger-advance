export default {
  urlsToPing: [
    {
      url: "https://moon-userbot-qkda.onrender.com",
      name: "@vaibhavsatpute",
      method: "GET",
      expectedStatus: 200,
      timeout: 10000,
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
          "Content-Type": "text/html; charset=UTF-8"
        }
      });
    }

    if (path === "/api/stats") {
      return new Response(JSON.stringify({
        timestamp: new Date().toISOString(),
        totalUrls: this.urlsToPing.length,
        status: "active",
        message: "📊 Statistics endpoint - Add KV storage for persistent stats"
      }, null, 2), {
        status: 200,
        headers: { 
          "Content-Type": "application/json; charset=UTF-8",
          "Access-Control-Allow-Origin": "*"
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
          "Content-Type": "application/json; charset=UTF-8"
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
      `<li class="url-item">
        <div class="url-header">
          <strong class="url-name">${config.name || config.url}</strong>
          <span class="badge method">${config.method || 'GET'}</span>
        </div>
        <div class="url-details">
          <span class="url-link">${config.url}</span>
          ${config.expectedStatus ? `<span class="badge expected">Expected: ${Array.isArray(config.expectedStatus) ? config.expectedStatus.join(' or ') : config.expectedStatus}</span>` : ''}
        </div>
      </li>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
  <title>🔍 URL Pinger Monitor</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 10px;
    }
    
    .container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      color: #333;
      max-width: 800px;
      margin: 0 auto;
    }
    
    h1 { 
      font-size: 24px;
      color: #333;
      border-bottom: 3px solid #667eea;
      padding-bottom: 15px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    h1 span {
      background: #667eea;
      color: white;
      padding: 5px 15px;
      border-radius: 50px;
      font-size: 14px;
      margin-left: auto;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }
    
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 10px;
      border-radius: 15px;
      text-align: center;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }
    
    .stat-card .number {
      font-size: 32px;
      font-weight: bold;
      display: block;
      line-height: 1.2;
    }
    
    .stat-card .label {
      font-size: 13px;
      opacity: 0.9;
      word-break: break-word;
    }
    
    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 25px 0 15px 0;
      color: #667eea;
      font-size: 18px;
    }
    
    .section-title h3 {
      font-size: 18px;
    }
    
    .url-list {
      background: #f8f9fa;
      border-radius: 15px;
      padding: 5px;
      margin: 15px 0;
    }
    
    .url-item { 
      padding: 15px; 
      border-bottom: 1px solid #e0e0e0;
      list-style: none;
    }
    
    .url-item:last-child {
      border-bottom: none;
    }
    
    .url-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .url-name {
      font-size: 16px;
      color: #333;
      word-break: break-word;
    }
    
    .url-details {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .url-link {
      font-size: 13px;
      color: #666;
      word-break: break-all;
      flex: 1;
    }
    
    .badge { 
      padding: 4px 10px; 
      border-radius: 20px; 
      font-size: 11px;
      font-weight: 600;
      display: inline-block;
    }
    
    .badge.method { 
      background: #667eea; 
      color: white; 
    }
    
    .badge.expected { 
      background: #28a745; 
      color: white;
    }
    
    .api-section {
      background: #f8f9fa;
      border-radius: 15px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .api-endpoint {
      background: white;
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 12px;
      border: 1px solid #e0e0e0;
    }
    
    .api-endpoint:last-child {
      margin-bottom: 0;
    }
    
    .endpoint-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 8px;
    }
    
    .method-badge {
      background: #333;
      color: white;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      min-width: 45px;
      text-align: center;
    }
    
    .method-badge.get { background: #28a745; }
    .method-badge.post { background: #667eea; }
    
    .endpoint-path {
      background: #f1f3f5;
      padding: 6px 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      color: #333;
      word-break: break-all;
      flex: 1;
    }
    
    .endpoint-desc {
      font-size: 14px;
      color: #666;
      padding-left: 63px;
    }
    
    .footer {
      margin-top: 30px;
      text-align: center;
      color: #666;
      font-size: 13px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
    }
    
    .footer p {
      margin: 5px 0;
    }
    
    @media (max-width: 480px) {
      .container {
        padding: 15px;
      }
      
      h1 {
        font-size: 20px;
      }
      
      h1 span {
        font-size: 12px;
        padding: 4px 10px;
      }
      
      .stat-card .number {
        font-size: 28px;
      }
      
      .stat-card .label {
        font-size: 11px;
      }
      
      .endpoint-desc {
        padding-left: 0;
      }
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

    <div class="section-title">
      <span>📋</span>
      <h3>Monitored URLs:</h3>
    </div>

    <ul class="url-list">
      ${urlsList || '<li style="text-align: center; padding: 20px;">❌ No URLs configured</li>'}
    </ul>

    <div class="section-title">
      <span>🔌</span>
      <h3>API Endpoints:</h3>
    </div>

    <div class="api-section">
      <div class="api-endpoint">
        <div class="endpoint-row">
          <span class="method-badge get">GET</span>
          <span class="endpoint-path">/api/stats</span>
        </div>
        <div class="endpoint-desc">
          📊 View today's statistics
        </div>
      </div>
      
      <div class="api-endpoint">
        <div class="endpoint-row">
          <span class="method-badge post">POST</span>
          <span class="endpoint-path">/api/ping</span>
        </div>
        <div class="endpoint-desc">
          🔄 Trigger manual ping cycle
        </div>
      </div>
    </div>

    <div class="footer">
      <p>⏱️ Last Check: ${new Date().toLocaleString()}</p>
      <p>Made with ❤️ by @vaibhavsatpute</p>
    </div>
  </div>
</body>
</html>
    `;
  }
};