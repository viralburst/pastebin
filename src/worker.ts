import { KVStorage, MockStorage } from './core/storage';
import { InMemoryAnalytics, KVAnalytics } from './core/analytics';
import { CreateHandler } from './handlers/create';
import { ViewHandler } from './handlers/view';
import { ResponseUtils, SanitizationUtils, PerformanceUtils } from './core/utils';
import { CONFIG } from './config/constants';

// Define the environment interface for Cloudflare Workers
interface Env {
  PASTES_KV: KVNamespace;
  ANALYTICS_KV?: KVNamespace;
  ENVIRONMENT?: string;
}

// Main request handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Initialize storage and analytics
      const storage = env.PASTES_KV ? new KVStorage(env.PASTES_KV) : new MockStorage();
      const analytics = env.ANALYTICS_KV 
        ? new KVAnalytics(env.ANALYTICS_KV)
        : new InMemoryAnalytics();

      // Create handlers
      const createHandler = new CreateHandler(storage, analytics);
      const viewHandler = new ViewHandler(storage, analytics);

      // CORS preflight
      if (method === 'OPTIONS') {
        return ResponseUtils.corsPrelight();
      }

      // Route requests
      switch (true) {
        // Home page
        case method === 'GET' && path === '/':
          return await handleHomePage(analytics);

        // Create paste
        case method === 'POST' && path === '/create':
          const createContentType = request.headers.get('content-type') || '';
          if (createContentType.includes('multipart/form-data') || createContentType.includes('application/x-www-form-urlencoded')) {
            return await createHandler.handleFormData(request);
          }
          return await createHandler.handle(request);

        // Create paste via form (alternative endpoint)
        case method === 'POST' && path === '/':
          const contentType = request.headers.get('content-type') || '';
          if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            return await createHandler.handleFormData(request);
          }
          return await createHandler.handle(request);

        // View paste
        case method === 'GET' && path.startsWith('/s/'):
          return await viewHandler.handle(request);

        // HEAD request for paste metadata
        case method === 'HEAD' && path.startsWith('/s/'):
          return await viewHandler.handleHead(request);

        // Preview paste (API endpoint)
        case method === 'GET' && path.startsWith('/preview/'):
          const previewId = path.split('/')[2];
          return await viewHandler.handlePreview(request, previewId);

        // Handle form submissions for paste actions (including delete)
        case method === 'POST' && path.startsWith('/s/'):
          return await viewHandler.handle(request);

        // Delete/expire paste manually (API endpoint)
        case method === 'DELETE' && path.startsWith('/s/'):
          const deleteId = path.split('/')[2];
          return await viewHandler.handleDelete(request, deleteId);

        // Download paste in various formats
        case method === 'GET' && path.startsWith('/download/'):
          const downloadId = path.split('/')[2];
          const format = url.searchParams.get('format') || 'auto';
          return await handleDownload(request, downloadId, format, storage);

        // HEAD request for download metadata
        case method === 'HEAD' && path.startsWith('/download/'):
          const headDownloadId = path.split('/')[2];
          const headFormat = url.searchParams.get('format') || 'auto';
          return await handleDownloadHead(request, headDownloadId, headFormat, storage);

        // Success page
        case method === 'GET' && path === '/success':
          return await handleSuccessPage(url);

        // API endpoints
        case method === 'GET' && path === '/api/stats':
          return await handleStatsAPI(analytics);

        case method === 'GET' && path === '/api/health':
          return await handleHealthCheck();

        case method === 'GET' && path === '/api/config':
          return await handleConfigAPI();

        // Service Worker
        case method === 'GET' && path === '/sw.js':
          return await handleServiceWorker();

        // Static assets
        case method === 'GET' && path.startsWith('/styles/'):
          return await handleStaticAsset(path);

        case method === 'GET' && path.startsWith('/scripts/'):
          return await handleStaticAsset(path);

        // 404 for all other routes
        default:
          return ResponseUtils.notFound();
      }

    } catch (error) {
      console.error('Worker error:', error);
      
      // Try to track the error if possible
      try {
        const clientIP = SanitizationUtils.extractClientIP(request);
        const analytics = env.ANALYTICS_KV 
          ? new KVAnalytics(env.ANALYTICS_KV)
          : new InMemoryAnalytics();
        await analytics.trackError('worker_error', clientIP);
      } catch {
        // Ignore analytics errors in error handler
      }

      return ResponseUtils.error('Internal server error', 500);
    }
  },

  // Scheduled handler for cleanup tasks
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled event triggered:', event.scheduledTime);
    
    try {
      // Cleanup analytics data older than retention period
      if (env.ANALYTICS_KV) {
        const analytics = new KVAnalytics(env.ANALYTICS_KV);
        await analytics.cleanup?.(CONFIG.ANALYTICS.RETENTION_DAYS);
      }
      
      console.log('Scheduled cleanup completed');
    } catch (error) {
      console.error('Scheduled cleanup error:', error);
    }
  }
};

// Handle home page
async function handleHomePage(analytics: any): Promise<Response> {
  try {
    const stats = CONFIG.UI.SHOW_STATS ? await analytics.getStats() : null;
    const html = PerformanceUtils.minifyHTML(generateHomePage(stats));
    return PerformanceUtils.addPerformanceHeaders(ResponseUtils.html(html));
  } catch (error) {
    console.error('Error loading home page:', error);
    const html = PerformanceUtils.minifyHTML(generateHomePage(null));
    return PerformanceUtils.addPerformanceHeaders(ResponseUtils.html(html));
  }
}

// Handle success page
async function handleSuccessPage(url: URL): Promise<Response> {
  const shareUrl = url.searchParams.get('url');
  const pasteId = url.searchParams.get('id');
  
  if (!shareUrl || !pasteId) {
    return ResponseUtils.notFound('Invalid success page parameters');
  }
  
  return ResponseUtils.html(generateSuccessPage(shareUrl, pasteId));
}

// Handle stats API
async function handleStatsAPI(analytics: any): Promise<Response> {
  try {
    const stats = await analytics.getStats();
    return ResponseUtils.success(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    return ResponseUtils.error('Failed to get stats', 500);
  }
}

// Handle health check
async function handleHealthCheck(): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: {
      storage: true,
      analytics: true,
      security: CONFIG.SECURITY.SUSPICIOUS_PATTERNS_ENABLED,
    }
  };
  
  return ResponseUtils.success(health);
}

// Handle config API (public configuration)
async function handleConfigAPI(): Promise<Response> {
  const publicConfig = {
    maxContentSize: CONFIG.MAX_CONTENT_SIZE,
    maxTitleLength: CONFIG.MAX_TITLE_LENGTH,
    supportedLanguages: CONFIG.SUPPORTED_LANGUAGES,
    expiryOptions: Object.entries(CONFIG.EXPIRY_OPTIONS).map(([key, seconds]) => ({
      value: key,
      seconds,
      label: formatDuration(seconds)
    })),
    features: {
      syntaxHighlighting: CONFIG.UI.ENABLE_SYNTAX_HIGHLIGHTING,
      analytics: CONFIG.UI.SHOW_STATS,
    }
  };
  
  return ResponseUtils.success(publicConfig);
}

// Handle download requests
async function handleDownload(request: Request, pasteId: string, format: string, storage: any): Promise<Response> {
  try {
    // Get the paste data
    const paste = await storage.getPaste(pasteId);
    if (!paste) {
      return ResponseUtils.notFound('Paste not found');
    }

    // Check if paste has expired
    if (paste.expiresAt && new Date(paste.expiresAt) < new Date()) {
      return ResponseUtils.notFound('Paste has expired');
    }

    const title = paste.title || 'paste';
    const content = paste.content;
    const language = paste.language || '';
    const createdAt = paste.createdAt;

    let fileContent = content;
    let extension = '.txt';
    let mimeType = 'text/plain';
    
    // Determine format and content
    if (format === 'auto') {
      extension = getFileExtension(language);
      fileContent = content;
    } else if (format === 'txt') {
      extension = '.txt';
      fileContent = content;
    } else if (format === 'md') {
      extension = '.md';
      mimeType = 'text/markdown';
      // Format as Markdown with metadata
      fileContent = `# ${title}

**Created:** ${new Date(createdAt).toLocaleString()}  
**Language:** ${language || 'Auto-detected'}  
**Size:** ${content.length.toLocaleString()} characters

---

\`\`\`${language || ''}
${content}
\`\`\`
`;
    }
    
    const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + extension;
    
    return new Response(fileContent, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileContent.length.toString(),
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    return ResponseUtils.error('Failed to download paste', 500);
  }
}

// Handle HEAD requests for download metadata
async function handleDownloadHead(request: Request, pasteId: string, format: string, storage: any): Promise<Response> {
  try {
    // Get the paste data
    const paste = await storage.getPaste(pasteId);
    if (!paste) {
      return new Response(null, { status: 404 });
    }

    // Check if paste has expired
    if (paste.expiresAt && new Date(paste.expiresAt) < new Date()) {
      return new Response(null, { status: 404 });
    }

    const title = paste.title || 'paste';
    const content = paste.content;
    const language = paste.language || '';

    let extension = '.txt';
    let mimeType = 'text/plain';
    let contentLength = content.length;
    
    // Determine format and content
    if (format === 'auto') {
      extension = getFileExtension(language);
      mimeType = 'text/plain';
    } else if (format === 'txt') {
      extension = '.txt';
      mimeType = 'text/plain';
    } else if (format === 'md') {
      extension = '.md';
      mimeType = 'text/markdown';
      // Calculate length of markdown content
      const mdContent = `# ${title}

**Created:** ${new Date(paste.createdAt).toLocaleString()}  
**Language:** ${language || 'Auto-detected'}  
**Size:** ${content.length.toLocaleString()} characters

---

\`\`\`${language || ''}
${content}
\`\`\`
`;
      contentLength = mdContent.length;
    }
    
    const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + extension;
    
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': contentLength.toString(),
      }
    });

  } catch (error) {
    console.error('Download HEAD error:', error);
    return new Response(null, { status: 500 });
  }
}

// Helper function to get file extension based on language
function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    javascript: '.js', typescript: '.ts', python: '.py', java: '.java',
    sql: '.sql', shell: '.sh', bash: '.sh', css: '.css', html: '.html',
    xml: '.xml', json: '.json', yaml: '.yml', markdown: '.md', go: '.go',
    rust: '.rs', cpp: '.cpp', c: '.c', php: '.php', ruby: '.rb',
    swift: '.swift', kotlin: '.kt', scala: '.scala', r: '.r'
  };
  return extensions[language] || '.txt';
}

// Handle service worker
async function handleServiceWorker(): Promise<Response> {
  const serviceWorkerCode = `
    const CACHE_NAME = 'pastebin-v1';
    const STATIC_ASSETS = [
      '/',
      '/api/config',
      '/api/health'
    ];

    self.addEventListener('install', event => {
      event.waitUntil(
        caches.open(CACHE_NAME)
          .then(cache => cache.addAll(STATIC_ASSETS))
          .then(() => self.skipWaiting())
      );
    });

    self.addEventListener('activate', event => {
      event.waitUntil(
        caches.keys().then(cacheNames => 
          Promise.all(
            cacheNames.map(cacheName => {
              if (cacheName !== CACHE_NAME) {
                return caches.delete(cacheName);
              }
            })
          )
        ).then(() => self.clients.claim())
      );
    });

    self.addEventListener('fetch', event => {
      if (event.request.method !== 'GET') return;
      
      event.respondWith(
        caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            return fetch(event.request);
          })
      );
    });
  `;

  return ResponseUtils.javascript(serviceWorkerCode.trim());
}

// Handle static assets (basic implementation)
async function handleStaticAsset(path: string): Promise<Response> {
  // In production, you'd typically serve these from KV or external CDN
  // For now, return a 404
  return ResponseUtils.notFound('Static asset not found');
}

// Generate home page HTML
function generateHomePage(stats: any): string {
  const statsDisplay = stats ? `
    <div class="stats-section">
      <h3>📊 Usage Statistics</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-number">${stats.totalShares.toLocaleString()}</span>
          <span class="stat-label">Total Shares</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">${stats.totalViews.toLocaleString()}</span>
          <span class="stat-label">Total Views</span>
        </div>
        ${stats.uniqueVisitors ? `
        <div class="stat-item">
          <span class="stat-number">${stats.uniqueVisitors.toLocaleString()}</span>
          <span class="stat-label">Unique Visitors</span>
        </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  const expiryOptions = Object.entries(CONFIG.EXPIRY_OPTIONS)
    .map(([key, seconds]) => `<option value="${key}">${formatDuration(seconds)}</option>`)
    .join('');

  const languageOptions = CONFIG.SUPPORTED_LANGUAGES
    .filter(lang => lang !== 'text')
    .map(lang => `<option value="${lang}">${lang.charAt(0).toUpperCase() + lang.slice(1)}</option>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${PerformanceUtils.generatePreloadLinks()}
  <title>🔐 Secure Paste Share</title>
  <meta name="description" content="Create secure share links with flexible viewing options">
  ${PerformanceUtils.inlineCriticalCSS()}
  <style>
    :root {
      --primary-color: #667eea;
      --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --secondary-color: #2c3e50;
      --success-color: #28a745;
      --danger-color: #e74c3c;
      --warning-color: #ffa726;
      --light-bg: #f8f9fa;
      --border-color: #e1e8ed;
      --text-color: #2c3e50;
      --text-muted: #6c757d;
      --border-radius: 8px;
      --shadow: 0 4px 12px rgba(0,0,0,0.1);
      --transition: all 0.3s ease;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--primary-gradient);
      min-height: 100vh;
      padding: 20px;
      color: var(--text-color);
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .hero {
      background: var(--primary-gradient);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }

    .hero h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      font-weight: 700;
    }

    .hero p {
      font-size: 1.2em;
      opacity: 0.9;
    }

    .content {
      padding: 40px 30px;
    }

    .paste-form {
      margin-bottom: 40px;
    }

    .form-group {
      margin-bottom: 25px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    label {
      display: block;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 8px;
      font-size: 1.1em;
    }

    input, select, textarea {
      width: 100%;
      padding: 15px;
      border: 2px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 16px;
      transition: var(--transition);
      font-family: inherit;
    }

    input:focus, select:focus, textarea:focus {
      border-color: var(--primary-color);
      outline: none;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    textarea {
      font-family: 'Monaco', 'Menlo', monospace;
      resize: vertical;
      min-height: 200px;
      line-height: 1.5;
    }

    .btn {
      display: inline-block;
      padding: 18px 24px;
      border: none;
      border-radius: var(--border-radius);
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      transition: var(--transition);
      user-select: none;
      width: 100%;
      background: var(--primary-gradient);
      color: white;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .features {
      background: var(--light-bg);
      padding: 30px;
      border-radius: var(--border-radius);
      margin-top: 30px;
    }

    .features h3 {
      color: var(--text-color);
      margin-bottom: 20px;
    }

    .features ul {
      list-style: none;
    }

    .features li {
      padding: 8px 0;
      color: var(--text-muted);
      font-weight: 500;
    }

    .stats-section {
      margin-top: 30px;
      padding: 30px;
      background: var(--light-bg);
      border-radius: var(--border-radius);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .stat-item {
      text-align: center;
      padding: 20px;
      background: white;
      border-radius: var(--border-radius);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .stat-number {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary-color);
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .character-counter {
      font-size: 0.9em;
      color: var(--text-muted);
      margin-top: 5px;
      text-align: right;
    }

    .form-help {
      display: block;
      margin-top: 8px;
      font-size: 0.9em;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .form-help strong {
      color: var(--text-color);
    }

    .github-link {
      position: absolute;
      top: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.9);
      color: #333;
      text-decoration: none;
      padding: 12px 18px;
      border-radius: 25px;
      font-weight: 700;
      font-size: 0.95rem;
      transition: var(--transition);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
    }

    .github-link:hover {
      background: rgba(255, 255, 255, 1);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
      border-color: var(--primary-color);
    }

    .github-icon {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .hero {
      position: relative;
    }

    .open-source-notice {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 25px 30px;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .open-source-notice h4 {
      margin-bottom: 10px;
      font-size: 1.2rem;
      font-weight: 700;
    }

    .open-source-notice p {
      margin: 0;
      opacity: 0.9;
      font-size: 0.95rem;
    }

    .open-source-notice a {
      color: white;
      text-decoration: underline;
      font-weight: 600;
    }

    .open-source-notice a:hover {
      text-decoration: none;
    }

    @media (max-width: 768px) {
      .container {
        margin: 10px;
        border-radius: 12px;
      }
      
      .hero h1 {
        font-size: 2rem;
      }
      
      .form-row {
        grid-template-columns: 1fr;
      }

      .github-link {
        position: static;
        margin: 0 auto 20px auto;
        width: fit-content;
      }

      .hero {
        padding: 30px 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="hero">
      <a href="https://github.com/viralburst/pastebin" target="_blank" rel="noopener noreferrer" class="github-link" title="View source code on GitHub">
        <svg class="github-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        Open Source
      </a>
      <h1>🔐 Secure Paste Share</h1>
      <p>Create secure share links with flexible viewing options</p>
    </header>
    
    <div class="open-source-notice">
      <h4>🚀 Open Source & Available for Developers</h4>
      <p>This secure pastebin is open source and available on <a href="https://github.com/viralburst/pastebin" target="_blank" rel="noopener noreferrer">GitHub</a>. Deploy your own instance or contribute to the project!</p>
    </div>
    
    <main class="content">
      <form id="pasteForm" class="paste-form" action="/create" method="post" enctype="application/x-www-form-urlencoded">
        <div class="form-group">
          <label for="title">📝 Title (optional)</label>
          <input type="text" id="title" name="title" placeholder="My secret data..." maxlength="${CONFIG.MAX_TITLE_LENGTH}">
        </div>
        
        <div class="form-group">
          <label for="content">📄 Content *</label>
          <textarea id="content" name="content" required placeholder="Paste your sensitive data here..."></textarea>
          <div class="character-counter" id="charCounter">0 / ${CONFIG.MAX_CONTENT_SIZE.toLocaleString()} characters</div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="language">🗣️ Language</label>
            <select id="language" name="language">
              <option value="">Auto-detect</option>
              <option value="text">Plain Text</option>
              ${languageOptions}
            </select>
          </div>
          
          <div class="form-group">
            <label for="expires">⏰ Expires In</label>
            <select id="expires" name="expires">
              ${expiryOptions}
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="viewMode">🔒 View Mode</label>
          <select id="viewMode" name="viewMode">
            <option value="one-time">🔥 One-time view (most secure)</option>
            <option value="multi-view">👁️ Multiple views until expiry</option>
          </select>
          <small class="form-help">
            <strong>One-time view:</strong> Paste is deleted after first access (maximum security)<br>
            <strong>Multiple views:</strong> Paste can be accessed multiple times until expiration
          </small>
        </div>
        
        <button type="submit" class="btn" id="submitButton">
          🚀 Create Secure Share Link
        </button>
        
        <!-- Hidden field to indicate form submission -->
        <input type="hidden" name="form_submit" value="1">
      </form>

      <div class="features">
        <h3>🛡️ Security Features</h3>
        <ul>
          <li>✅ One-time or multi-view options</li>
          <li>✅ Automatic expiration</li>
          <li>✅ No permanent storage</li>
          <li>✅ Secure random IDs</li>
          <li>✅ Content validation</li>
          <li>✅ Rate limiting protection</li>
        </ul>
      </div>

      ${statsDisplay}
    </main>
    
    <footer style="background: var(--light-bg); padding: 20px 30px; text-align: center; border-top: 1px solid var(--border-color);">
      <p style="color: var(--text-muted); margin: 0; font-size: 0.9rem;">
        ❤️ Made with love • 
        <a href="https://github.com/viralburst/pastebin" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: none; font-weight: 600;">
          <svg style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px; fill: currentColor;" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Open Source on GitHub
        </a>
        • Available for developers
      </p>
    </footer>
  </div>

  <script>
    // Test if JavaScript is working at all
    console.log('🚀 JavaScript started loading!');
    
    // Service Worker for offline caching and performance
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => 
        console.log('Service Worker registration failed:', err)
      );
    }

    const form = document.getElementById('pasteForm');
    const contentTextarea = document.getElementById('content');
    const charCounter = document.getElementById('charCounter');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Add immediate debugging
    console.log('JavaScript is loading...');
    console.log('Form element:', form);
    console.log('Content textarea:', contentTextarea);
    console.log('Submit button:', submitBtn);

    // Character counter
    function updateCharCounter() {
      const length = contentTextarea.value.length;
      const maxLength = ${CONFIG.MAX_CONTENT_SIZE};
      charCounter.textContent = length.toLocaleString() + ' / ' + maxLength.toLocaleString() + ' characters';
      charCounter.style.color = length > maxLength * 0.9 ? '#e74c3c' : '#6c757d';
      
      // Only disable if content is too long, not if empty (for better UX)
      submitBtn.disabled = length > maxLength;
      console.log('Button disabled:', submitBtn.disabled, 'Content length:', length);
    }

    contentTextarea.addEventListener('input', updateCharCounter);
    updateCharCounter();

    // Auto-resize textarea
    contentTextarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });

    // Prefetch critical resources
    const prefetchLinks = ['/api/config', '/api/health'];
    prefetchLinks.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });

    // Form submission with performance tracking and better error handling
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Form submission intercepted by JavaScript');
      
      const submitButton = e.target.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      const startTime = performance.now();
      
      submitButton.disabled = true;
      submitButton.textContent = '⏳ Creating...';

      try {
        // Validate content before submission
        const content = document.getElementById('content').value.trim();
        if (!content) {
          throw new Error('Content cannot be empty');
        }

        const formData = {
          title: document.getElementById('title').value.trim(),
          content: content,
          language: document.getElementById('language').value,
          expires: document.getElementById('expires').value,
          oneTimeView: document.getElementById('viewMode').value === 'one-time'
        };

        console.log('Submitting form data:', formData);

        const response = await fetch('/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('Response data:', result);
        
        const endTime = performance.now();
        console.log('Paste creation took ' + (endTime - startTime) + ' milliseconds.');

        if (response.ok && result.success) {
          // Redirect to success page with URL in query params
          const successUrl = new URL('/success', window.location.origin);
          successUrl.searchParams.set('url', result.data.shareUrl);
          successUrl.searchParams.set('id', result.data.id);
          console.log('Redirecting to:', successUrl.toString());
          window.location.href = successUrl.toString();
        } else {
          throw new Error(result.error || 'Unknown error occurred');
        }
      } catch (error) {
        console.error('Form submission error:', error);
        alert('Error creating paste: ' + error.message);
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    });

    // Add a fallback click handler in case the form event doesn't work
    submitBtn.addEventListener('click', function(e) {
      console.log('Submit button clicked');
      // If the form event handler is working, this will be redundant
      // If not, this will provide a fallback
    });
  </script>
</body>
</html>`;
}

// Generate success page HTML
function generateSuccessPage(shareUrl: string, pasteId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>✅ Share Link Created - Secure Paste Share</title>
  <meta name="description" content="Your secure share link has been created">
  <style>
    :root {
      --primary-color: #28a745;
      --primary-gradient: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      --secondary-color: #2c3e50;
      --light-bg: #f8f9fa;
      --border-color: #e1e8ed;
      --text-color: #2c3e50;
      --text-muted: #6c757d;
      --border-radius: 8px;
      --shadow: 0 4px 12px rgba(0,0,0,0.1);
      --transition: all 0.3s ease;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--primary-gradient);
      min-height: 100vh;
      padding: 20px;
      color: var(--text-color);
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .hero {
      background: var(--primary-gradient);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }

    .hero h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      font-weight: 700;
    }

    .content {
      padding: 40px 30px;
    }

    .share-url-container {
      background: var(--light-bg);
      border: 2px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 20px;
      margin-bottom: 30px;
    }

    .share-url {
      font-family: Monaco, monospace;
      font-size: 16px;
      word-break: break-all;
      background: white;
      padding: 15px;
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      margin-bottom: 15px;
    }

    .btn {
      display: inline-block;
      padding: 12px 20px;
      border: none;
      border-radius: var(--border-radius);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      text-align: center;
      transition: var(--transition);
      user-select: none;
      margin: 5px;
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
    }

    .btn-secondary {
      background: var(--secondary-color);
      color: white;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: var(--border-radius);
      padding: 20px;
      margin-bottom: 30px;
    }

    .warning h3 {
      color: #856404;
      margin-bottom: 10px;
    }

    .warning p {
      color: #856404;
      margin-bottom: 0;
    }

    .button-group {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .no-js-warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      color: #856404;
      padding: 12px 16px;
      border-radius: var(--border-radius);
      font-size: 0.9rem;
      margin: 10px 0;
      text-align: center;
    }

    @media (max-width: 768px) {
      .container {
        margin: 10px;
      }
      
      .button-group {
        flex-direction: column;
      }
      
      .btn {
        width: 100%;
        margin: 5px 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="hero">
      <h1>✅ Success!</h1>
      <p>Your secure share link is ready</p>
    </header>
    
    <main class="content">
      <div class="share-url-container">
        <label for="shareUrl" style="font-weight: 600; margin-bottom: 10px; display: block;">🔗 Share Link:</label>
        <div class="share-url" id="shareUrl">${shareUrl}</div>
        <div class="button-group">
          <button class="btn btn-primary" onclick="copyToClipboard()">📋 Copy Link</button>
          <button class="btn btn-secondary" onclick="previewPaste('${pasteId}')">👁️ Preview</button>
        </div>
        <noscript>
          <div class="no-js-warning">
            ⚠️ JavaScript is disabled. Copy and preview require JavaScript. You can manually copy the link above or visit it directly.
          </div>
        </noscript>
      </div>

      <div class="warning">
        <h3>⚠️ Important Reminder</h3>
        <p>This link will only work <strong>once</strong>. After someone views it, the paste will be automatically deleted for security.</p>
      </div>

      <div class="button-group">
        <a href="/" class="btn btn-primary">🆕 Create Another</a>
      </div>
    </main>
    
    <footer style="background: var(--light-bg); padding: 15px 20px; text-align: center; border-top: 1px solid var(--border-color); font-size: 0.85rem;">
      <p style="color: var(--text-muted); margin: 0;">
        <a href="https://github.com/viralburst/pastebin" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: none; font-weight: 600;">
          <svg style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px; fill: currentColor;" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Open Source
        </a>
        • Available for developers
      </p>
    </footer>
  </div>

  <script>
    async function copyToClipboard() {
      const shareUrl = document.getElementById('shareUrl').textContent;
      
      try {
        await navigator.clipboard.writeText(shareUrl);
        
        // Visual feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.style.background = '#28a745';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
        }, 2000);
        
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        alert('Link copied to clipboard!');
      }
    }

    // Preview paste function (uses preview API that doesn't consume the paste)
    async function previewPaste(pasteId) {
      try {
        const response = await fetch('/preview/' + pasteId);
        const result = await response.json();
        
        if (response.ok && result.success) {
          // Open preview in a new window with simple content
          const preview = result.data.preview;
          const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
          
          const html = '<!DOCTYPE html><html><head><title>Preview: ' + preview.title + '</title>' +
            '<style>body{font-family:system-ui;padding:20px;background:#f5f5f5}' +
            '.container{max-width:800px;margin:0 auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}' +
            '.header{border-bottom:1px solid #eee;padding-bottom:15px;margin-bottom:20px}' +
            '.title{color:#333;margin-bottom:5px}.meta{color:#666;font-size:0.9em}' +
            '.content{background:#f8f9fa;padding:20px;border-radius:4px;border-left:4px solid #667eea}' +
            'pre{white-space:pre-wrap;margin:0;font-family:Monaco,monospace}' +
            '.warning{background:#fff3cd;border:1px solid #ffeaa7;padding:15px;border-radius:4px;margin-top:20px;color:#856404}' +
            '</style></head><body><div class="container"><div class="header">' +
            '<h1 class="title">📋 ' + preview.title + '</h1>' +
            '<div class="meta">Size: ' + preview.size + ' bytes • Language: ' + preview.language + ' • ' +
            'Created: ' + new Date(preview.createdAt).toLocaleString() +
            (preview.truncated ? ' • (Preview - content truncated)' : '') + '</div></div>' +
            '<div class="content"><pre>' + preview.content + '</pre></div>' +
            (preview.truncated ? '<div class="warning"><strong>Note:</strong> This is a preview showing the first 500 characters. The full content will be available when you share the link.</div>' : '') +
            '</div></body></html>';
            
          previewWindow.document.write(html);
          previewWindow.document.close();
        } else {
          alert('Failed to load preview: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Failed to load preview: ' + error.message);
      }
    }

    // Auto-select the URL for easy copying
    document.getElementById('shareUrl').addEventListener('click', function() {
      const range = document.createRange();
      range.selectNode(this);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
  </script>
</body>
</html>`;
}

// Utility function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
  return `${Math.floor(seconds / 604800)} weeks`;
} 