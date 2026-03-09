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

    // Handle POST request for updating URLs
    if (path === "/api/update-urls" && request.method === "POST") {
      try {
        const newConfigs = await request.json();
        this.urlsToPing = newConfigs;
        return new Response(JSON.stringify({ 
          success: true, 
          message: "✅ URLs updated successfully",
          urls: this.urlsToPing
        }), {
          status: 200,
          headers: { 
            "Content-Type": "application/json; charset=UTF-8",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "❌ Failed to update URLs",
          error: error.message
        }), {
          status: 400,
          headers: { "Content-Type": "application/json; charset=UTF-8" }
        });
      }
    }

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
        urls: this.urlsToPing,
        status: "active"
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
    const urlsList = this.urlsToPing.map((config, index) => 
      `<li class="url-item" data-index="${index}">
        <div class="url-header">
          <input type="text" class="url-name-input" value="${config.name}" placeholder="Name" data-field="name">
          <select class="method-select" data-field="method">
            <option value="GET" ${config.method === 'GET' ? 'selected' : ''}>GET</option>
            <option value="POST" ${config.method === 'POST' ? 'selected' : ''}>POST</option>
            <option value="HEAD" ${config.method === 'HEAD' ? 'selected' : ''}>HEAD</option>
            <option value="PUT" ${config.method === 'PUT' ? 'selected' : ''}>PUT</option>
            <option value="DELETE" ${config.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
          </select>
        </div>
        <div class="url-details">
          <input type="url" class="url-link-input" value="${config.url}" placeholder="https://..." data-field="url">
          <input type="text" class="expected-input" value="${Array.isArray(config.expectedStatus) ? config.expectedStatus.join(', ') : config.expectedStatus}" placeholder="Expected status (e.g., 200 or 200, 204)" data-field="expected">
        </div>
        <button class="delete-btn" onclick="deleteUrl(${index})">🗑️ Delete</button>
      </li>`
    ).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
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
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      margin: 0;
    }
    
    .container {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 0;
      padding: 16px;
      box-shadow: none;
      color: #333;
      width: 100%;
      height: 100vh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    /* Hide scrollbar but keep functionality */
    .container::-webkit-scrollbar {
      width: 0;
      background: transparent;
    }
    
    h1 { 
      font-size: 20px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      position: sticky;
      top: 0;
      background: rgba(255, 255, 255, 0.95);
      z-index: 10;
      backdrop-filter: blur(10px);
    }
    
    .live-badge {
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 50px;
      font-size: 12px;
      margin-left: auto;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 16px 0;
      position: sticky;
      top: 60px;
      background: rgba(255, 255, 255, 0.95);
      z-index: 9;
      padding: 8px 0;
      backdrop-filter: blur(10px);
    }
    
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 8px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    
    .stat-card .number {
      font-size: 24px;
      font-weight: bold;
      display: block;
      line-height: 1.2;
    }
    
    .stat-card .label {
      font-size: 11px;
      opacity: 0.9;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 20px 0 12px 0;
    }
    
    .section-header h3 {
      font-size: 16px;
      color: #667eea;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .add-btn {
      background: #28a745;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 25px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    
    .url-list {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 8px;
      margin: 8px 0;
    }
    
    .url-item { 
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      list-style: none;
    }
    
    .url-item:last-child {
      border-bottom: none;
    }
    
    .url-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .url-name-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      background: white;
    }
    
    .method-select {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 13px;
      background: white;
      min-width: 70px;
    }
    
    .url-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .url-link-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 13px;
      background: white;
    }
    
    .expected-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 13px;
      background: white;
    }
    
    .delete-btn {
      background: #dc3545;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      margin-top: 8px;
      cursor: pointer;
    }
    
    .api-section {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 12px;
      margin: 20px 0;
    }
    
    .api-endpoint {
      background: white;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      border: 1px solid #e0e0e0;
    }
    
    .endpoint-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    
    .method-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      min-width: 45px;
      text-align: center;
      color: white;
    }
    
    .method-badge.get { background: #28a745; }
    .method-badge.post { background: #667eea; }
    
    .endpoint-link {
      background: #f1f3f5;
      padding: 6px 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      color: #0066cc;
      text-decoration: none;
      word-break: break-all;
      flex: 1;
    }
    
    .endpoint-link:active {
      background: #e0e0e0;
    }
    
    .endpoint-desc {
      font-size: 13px;
      color: #666;
      padding-left: 53px;
    }
    
    .save-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 14px;
      font-weight: 600;
      width: 100%;
      margin: 16px 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .footer {
      margin-top: 20px;
      text-align: center;
      color: #666;
      font-size: 12px;
      padding: 12px 0;
    }
    
    /* Full screen fit */
    html, body {
      height: 100%;
      overflow: hidden;
    }
    
    .container {
      height: 100vh;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      🔍 @VAIBHAVSATPUTE URL Pinger Monitor 
      <span class="live-badge">🚀 Live</span>
    </h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <span class="number" id="totalUrls">${this.urlsToPing.length}</span>
        <span class="label">📌 Configured</span>
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

    <div class="section-header">
      <h3><span>📋</span> Monitored URLs:</h3>
      <button class="add-btn" onclick="addNewUrl()">➕ Add URL</button>
    </div>

    <ul class="url-list" id="urlList">
      ${urlsList}
    </ul>

    <button class="save-btn" onclick="saveAllChanges()">
      💾 Save All Changes
    </button>

    <div class="section-header">
      <h3><span>🔌</span> API Endpoints:</h3>
    </div>

    <div class="api-section">
      <div class="api-endpoint">
        <div class="endpoint-row">
          <span class="method-badge get">GET</span>
          <a href="/api/stats" class="endpoint-link" target="_blank">/api/stats</a>
        </div>
        <div class="endpoint-desc">
          📊 View today's statistics
        </div>
      </div>
      
      <div class="api-endpoint">
        <div class="endpoint-row">
          <span class="method-badge post">POST</span>
          <a href="#" class="endpoint-link" onclick="triggerPing(); return false;">/api/ping</a>
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

  <script>
    // Global functions for URL management
    window.addNewUrl = function() {
      const urlList = document.getElementById('urlList');
      const newItem = document.createElement('li');
      newItem.className = 'url-item';
      newItem.innerHTML = \`
        <div class="url-header">
          <input type="text" class="url-name-input" value="New URL" placeholder="Name">
          <select class="method-select">
            <option value="GET" selected>GET</option>
            <option value="POST">POST</option>
            <option value="HEAD">HEAD</option>
          </select>
        </div>
        <div class="url-details">
          <input type="url" class="url-link-input" value="https://" placeholder="https://...">
          <input type="text" class="expected-input" value="200" placeholder="Expected status">
        </div>
        <button class="delete-btn" onclick="this.closest('.url-item').remove()">🗑️ Delete</button>
      \`;
      urlList.appendChild(newItem);
    };

    window.deleteUrl = function(index) {
      const items = document.querySelectorAll('.url-item');
      if (items[index]) {
        items[index].remove();
      }
    };

    window.saveAllChanges = function() {
      const items = document.querySelectorAll('.url-item');
      const updatedUrls = [];
      
      items.forEach(item => {
        const name = item.querySelector('.url-name-input')?.value || '';
        const method = item.querySelector('.method-select')?.value || 'GET';
        const url = item.querySelector('.url-link-input')?.value || '';
        const expected = item.querySelector('.expected-input')?.value || '200';
        
        // Parse expected status (can be single or comma-separated)
        let expectedStatus;
        if (expected.includes(',')) {
          expectedStatus = expected.split(',').map(s => parseInt(s.trim()));
        } else {
          expectedStatus = parseInt(expected);
        }
        
        updatedUrls.push({
          name: name,
          method: method,
          url: url,
          expectedStatus: expectedStatus,
          timeout: 10000,
          headers: {
            "User-Agent": "URL-Pinger/1.0"
          }
        });
      });

      // Send to server
      fetch('/api/update-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedUrls)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert('✅ URLs updated successfully!');
          location.reload();
        } else {
          alert('❌ Failed to update URLs');
        }
      })
      .catch(error => {
        alert('❌ Error: ' + error.message);
      });
    };

    window.triggerPing = function() {
      fetch('/api/ping', {
        method: 'POST'
      })
      .then(response => response.json())
      .then(data => {
        alert(data.message + ' at ' + new Date(data.timestamp).toLocaleTimeString());
      })
      .catch(error => {
        alert('❌ Failed to trigger ping');
      });
    };

    // Make API stats link open in new tab properly
    document.querySelectorAll('.endpoint-link[target="_blank"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(link.href, '_blank');
      });
    });
  </script>
</body>
</html>
    `;
  }
}