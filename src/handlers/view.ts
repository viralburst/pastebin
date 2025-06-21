import { IStorage, PasteData } from '../core/storage';
import { IAnalytics } from '../core/analytics';
import { ResponseUtils, SanitizationUtils, TimeUtils, PerformanceUtils } from '../core/utils';
import { SecurityManager } from '../core/security';
import { ErrorTemplate } from '../ui/templates/error';
import { CONFIG } from '../config/constants';

export interface ViewPasteResponse {
  success: true;
  paste: {
    id: string;
    title: string;
    content: string;
    language: string;
    size: number;
    createdAt: string;
    consumed: boolean;
  };
}

export class ViewHandler {
  private storage: IStorage;
  private analytics: IAnalytics;
  private security: SecurityManager;

  constructor(storage: IStorage, analytics: IAnalytics) {
    this.storage = storage;
    this.analytics = analytics;
    this.security = new SecurityManager();
  }

  async handle(request: Request, pasteId?: string): Promise<Response> {
    // Handle form-based DELETE requests (HTML forms can only use GET/POST)
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        try {
          const formData = await request.formData();
          const method = formData.get('_method');
          if (method === 'DELETE') {
            return this.handleDelete(request, pasteId);
          }
          // If it's a POST request with form data but not a DELETE, return error
          return ResponseUtils.error('Invalid form submission', 400);
        } catch (error) {
          console.error('Failed to parse form data:', error);
          return ResponseUtils.error('Invalid form data', 400);
        }
      }
      // If it's a POST request but not form data, return error
      return ResponseUtils.error('POST requests must use form data', 400);
    }
    try {
      const clientIP = SanitizationUtils.extractClientIP(request);

      // Rate limiting check (if enabled)
      if (CONFIG.SECURITY.RATE_LIMITING_ENABLED) {
        const rateLimitResult = this.security.validateRateLimit(clientIP, 'view');
        if (!rateLimitResult.valid) {
          return ResponseUtils.rateLimit(60);
        }
      }

      // Extract paste ID from URL if not provided
      if (!pasteId) {
        pasteId = this.extractPasteIdFromUrl(request.url) || undefined;
      }

      if (!pasteId) {
        return ResponseUtils.html(ErrorTemplate.notFound());
      }

      // Sanitize paste ID
      const sanitizedId = this.sanitizePasteId(pasteId);
      if (!sanitizedId) {
        return ResponseUtils.html(ErrorTemplate.notFound());
      }
      pasteId = sanitizedId;

      // Check if this is an API request
      const acceptHeader = request.headers.get('accept');
      const isApiRequest = acceptHeader?.includes('application/json');

      // First, check if paste exists and is not expired
      const paste = await this.storage.getPaste(pasteId);
      if (!paste) {
        return isApiRequest
          ? ResponseUtils.notFound('Paste not found or has already been viewed')
          : ResponseUtils.html(ErrorTemplate.notFound());
      }

      // Check if paste is expired
      if (paste.expiresAt && TimeUtils.isExpired(paste.expiresAt)) {
        // Clean up expired paste
        await this.storage.deletePaste(pasteId);
        return isApiRequest
          ? ResponseUtils.error('Paste has expired', 410)
          : ResponseUtils.html(ErrorTemplate.expired());
      }

      // Check if already consumed
      if (paste.consumed) {
        return isApiRequest
          ? ResponseUtils.notFound('Paste not found or has already been viewed')
          : ResponseUtils.html(ErrorTemplate.notFound());
      }

      let viewedPaste: PasteData;

      // Consume the paste if it's set for one-time view
      if (paste.oneTimeView) {
        const consumedPaste = await this.storage.consumePaste(pasteId);
        if (!consumedPaste) {
          // Race condition - someone else consumed it first
          return isApiRequest
            ? ResponseUtils.notFound('Paste not found or has already been viewed')
            : ResponseUtils.html(ErrorTemplate.notFound());
        }
        viewedPaste = consumedPaste;
      } else {
        // For multi-view pastes, just return the paste without consuming
        viewedPaste = paste;
      }

      // Track analytics
      try {
        await this.analytics.trackPasteViewed(viewedPaste.id, clientIP);
      } catch (error) {
        console.warn('Failed to track paste view:', error);
        // Don't fail the request if analytics fails
      }

      // Return appropriate response format
      if (isApiRequest) {
        const response: ViewPasteResponse = {
          success: true,
          paste: {
            id: viewedPaste.id,
            title: viewedPaste.title,
            content: viewedPaste.content,
            language: viewedPaste.language,
            size: viewedPaste.size,
            createdAt: viewedPaste.createdAt,
            consumed: viewedPaste.oneTimeView, // Mark as consumed if it was one-time view
          },
        };
        return ResponseUtils.success(response, 'Paste retrieved successfully');
      } else {
        // Return beautiful HTML view
        const html = PerformanceUtils.minifyHTML(this.generateViewHTML(viewedPaste));
        return PerformanceUtils.addPerformanceHeaders(ResponseUtils.html(html));
      }
    } catch (error) {
      console.error('ViewHandler error:', error);

      // Track error in analytics
      try {
        const clientIP = SanitizationUtils.extractClientIP(request);
        await this.analytics.trackError('paste_view_failed', clientIP);
      } catch {
        // Ignore analytics errors
      }

      const acceptHeader = request.headers.get('accept');
      const isApiRequest = acceptHeader?.includes('application/json');

      return isApiRequest
        ? ResponseUtils.error('Failed to retrieve paste', 500)
        : ResponseUtils.html(ErrorTemplate.serverError());
    }
  }

  // Handle HEAD requests for paste existence check
  async handleHead(request: Request, pasteId?: string): Promise<Response> {
    try {
      if (!pasteId) {
        pasteId = this.extractPasteIdFromUrl(request.url);
      }

      if (!pasteId) {
        return new Response(null, { status: 404 });
      }

      pasteId = this.sanitizePasteId(pasteId);
      if (!pasteId) {
        return new Response(null, { status: 404 });
      }

      const paste = await this.storage.getPaste(pasteId);
      if (!paste || paste.consumed) {
        return new Response(null, { status: 404 });
      }

      if (paste.expiresAt && TimeUtils.isExpired(paste.expiresAt)) {
        await this.storage.deletePaste(pasteId);
        return new Response(null, { status: 410 }); // Gone
      }

      // Return metadata in headers
      const headers = new Headers();
      headers.set('X-Paste-Language', paste.language);
      headers.set('X-Paste-Size', paste.size.toString());
      headers.set('X-Paste-Created', paste.createdAt);
      if (paste.expiresAt) {
        headers.set('X-Paste-Expires', paste.expiresAt);
        const remaining = TimeUtils.getTimeRemaining(paste.expiresAt);
        headers.set('X-Paste-TTL', remaining.seconds.toString());
      }

      return new Response(null, { status: 200, headers });
    } catch (error) {
      console.error('ViewHandler HEAD error:', error);
      return new Response(null, { status: 500 });
    }
  }

  // Handle manual deletion/expiration of paste
  async handleDelete(request: Request, pasteId?: string): Promise<Response> {
    try {
      const clientIP = SanitizationUtils.extractClientIP(request);

      // Rate limiting check (if enabled)
      if (CONFIG.SECURITY.RATE_LIMITING_ENABLED) {
        const rateLimitResult = this.security.validateRateLimit(clientIP, 'view');
        if (!rateLimitResult.valid) {
          return ResponseUtils.rateLimit(60);
        }
      }

      // Extract paste ID from URL if not provided
      if (!pasteId) {
        pasteId = this.extractPasteIdFromUrl(request.url) || undefined;
      }

      if (!pasteId) {
        return ResponseUtils.notFound('Paste ID not provided');
      }

      // Sanitize paste ID
      const sanitizedId = this.sanitizePasteId(pasteId);
      if (!sanitizedId) {
        return ResponseUtils.notFound('Invalid paste ID');
      }
      pasteId = sanitizedId;

      // Check if paste exists before deletion
      const paste = await this.storage.getPaste(pasteId);
      if (!paste) {
        return ResponseUtils.notFound('Paste not found or already deleted');
      }

      // Delete the paste
      await this.storage.deletePaste(pasteId);

      // Track analytics
      try {
        await this.analytics.trackError('paste_manually_deleted', clientIP);
      } catch (error) {
        console.warn('Failed to track manual deletion:', error);
      }

      // Check if this is a form submission (redirect) or API request (JSON)
      const acceptHeader = request.headers.get('accept');
      const isApiRequest = acceptHeader?.includes('application/json');

      if (isApiRequest) {
        return ResponseUtils.success(
          {
            success: true,
            message: 'Paste deleted successfully',
          },
          'Paste deleted successfully'
        );
      } else {
        // Form submission - redirect to success page
        const html = this.generateDeleteSuccessHTML();
        return ResponseUtils.html(html);
      }
    } catch (error) {
      console.error('ViewHandler delete error:', error);

      // Track error in analytics
      try {
        const clientIP = SanitizationUtils.extractClientIP(request);
        await this.analytics.trackError('paste_delete_failed', clientIP);
      } catch {
        // Ignore analytics errors
      }

      return ResponseUtils.error('Failed to delete paste', 500);
    }
  }

  // Handle paste preview (first 500 characters without consuming)
  async handlePreview(request: Request, pasteId?: string): Promise<Response> {
    try {
      if (!pasteId) {
        pasteId = this.extractPasteIdFromUrl(request.url);
      }

      if (!pasteId) {
        return ResponseUtils.notFound('Paste not found');
      }

      pasteId = this.sanitizePasteId(pasteId);
      if (!pasteId) {
        return ResponseUtils.notFound('Invalid paste ID');
      }

      const paste = await this.storage.getPaste(pasteId);
      if (!paste || paste.consumed) {
        return ResponseUtils.notFound('Paste not found or has already been viewed');
      }

      if (paste.expiresAt && TimeUtils.isExpired(paste.expiresAt)) {
        await this.storage.deletePaste(pasteId);
        return ResponseUtils.error('Paste has expired', 410);
      }

      // Return preview (first 500 characters)
      const previewLength = 500;
      const preview =
        paste.content.length > previewLength
          ? `${paste.content.substring(0, previewLength)}...`
          : paste.content;

      const response = {
        success: true,
        preview: {
          id: paste.id,
          title: paste.title,
          content: preview,
          language: paste.language,
          size: paste.size,
          createdAt: paste.createdAt,
          truncated: paste.content.length > previewLength,
          fullSize: paste.content.length,
          expiresAt: paste.expiresAt,
        },
      };

      return ResponseUtils.success(response, 'Paste preview retrieved successfully');
    } catch (error) {
      console.error('ViewHandler preview error:', error);
      return ResponseUtils.error('Failed to retrieve paste preview', 500);
    }
  }

  private extractPasteIdFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

      // Handle different URL patterns:
      // /paste123 -> paste123
      // /s/paste123 -> paste123 (main pattern)
      // /v/paste123 -> paste123
      // /view/paste123 -> paste123
      if (pathParts.length === 1) {
        return pathParts[0];
      } else if (
        pathParts.length === 2 &&
        ['s', 'v', 'view', 'p', 'paste'].includes(pathParts[0])
      ) {
        return pathParts[1];
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  private sanitizePasteId(pasteId: string | undefined): string | undefined {
    if (!pasteId) return undefined;

    // Remove any non-alphanumeric characters and limit length
    const sanitized = pasteId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);

    // Must be at least 8 characters and at most 20
    if (sanitized.length < 8 || sanitized.length > 20) {
      return undefined;
    }

    return sanitized;
  }

  // Static method to get metadata without consuming
  static async getMetadata(
    storage: IStorage,
    pasteId: string
  ): Promise<{
    exists: boolean;
    expired?: boolean;
    consumed?: boolean;
    metadata?: {
      language: string;
      size: number;
      createdAt: string;
      expiresAt?: string;
      timeRemaining?: number;
    };
  }> {
    try {
      const paste = await storage.getPaste(pasteId);
      if (!paste) {
        return { exists: false };
      }

      if (paste.consumed) {
        return { exists: true, consumed: true };
      }

      if (paste.expiresAt && TimeUtils.isExpired(paste.expiresAt)) {
        return { exists: true, expired: true };
      }

      const timeRemaining = paste.expiresAt
        ? TimeUtils.getTimeRemaining(paste.expiresAt).seconds
        : undefined;

      return {
        exists: true,
        expired: false,
        consumed: false,
        metadata: {
          language: paste.language,
          size: paste.size,
          createdAt: paste.createdAt,
          expiresAt: paste.expiresAt,
          timeRemaining,
        },
      };
    } catch (error) {
      console.error('Failed to get paste metadata:', error);
      return { exists: false };
    }
  }

  private generateViewHTML(paste: PasteData): string {
    const escapedTitle = this.escapeHtml(paste.title);
    const escapedContent = this.escapeHtml(paste.content);
    const formattedDate = new Date(paste.createdAt).toLocaleString();
    const languageLabel = paste.language.charAt(0).toUpperCase() + paste.language.slice(1);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 ${escapedTitle} - Secure Paste Share</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="View a secure paste with ${paste.oneTimeView ? 'one-time' : 'multiple'} viewing">
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
      max-width: 1000px;
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

    .meta-section {
      background: var(--light-bg);
      padding: 20px 30px;
      border-bottom: 1px solid var(--border-color);
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: var(--text-muted);
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 30px;
      background: var(--light-bg);
      border-bottom: 1px solid var(--border-color);
    }

    .language-badge {
      background: var(--primary-color);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 600;
    }

          .btn-group {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
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
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
    }

    .btn-secondary {
      background: var(--secondary-color);
      color: white;
    }

    .btn-danger {
      background: var(--danger-color);
      color: white;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .code-container {
      position: relative;
      background: #1e1e1e;
      color: #d4d4d4;
    }

    .code-content {
      padding: 30px;
      overflow-x: auto;
      max-height: 600px;
      overflow-y: auto;
    }

    .code-content pre {
      margin: 0;
      font-family: Monaco, 'Menlo', monospace;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: var(--border-radius);
      padding: 20px 30px;
      text-align: center;
    }

    .warning h3 {
      color: #856404;
      margin-bottom: 10px;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .warning p {
      color: #856404;
      margin-bottom: 0;
    }

    .content {
      padding: 40px 30px;
    }

    .button-group {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: var(--success-color);
      color: white;
      border-radius: var(--border-radius);
      box-shadow: var(--shadow);
      z-index: 1000;
      opacity: 0;
      transform: translateX(100%);
      transition: var(--transition);
    }

    .notification.show {
      opacity: 1;
      transform: translateX(0);
    }

          .no-js-warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 0.9rem;
        margin: 5px 0;
        display: inline-block;
      }

      .content-selectable {
        user-select: all;
        -webkit-user-select: all;
        -moz-user-select: all;
        -ms-user-select: all;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px dashed transparent;
        border-radius: 4px;
        padding: 8px;
        margin: -8px;
      }

      .content-selectable:hover {
        background-color: rgba(102, 126, 234, 0.05);
        border-color: rgba(102, 126, 234, 0.3);
      }

      .content-selectable:focus {
        outline: none;
        background-color: rgba(102, 126, 234, 0.1);
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
      }

      .select-instructions {
        background: #e3f2fd;
        border: 1px solid #90caf9;
        color: #1565c0;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 0.9rem;
        margin: 10px 0;
        text-align: center;
      }

      kbd {
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-radius: 3px;
        padding: 2px 6px;
        font-family: monospace;
        font-size: 0.85em;
        color: #333;
        box-shadow: 0 1px 1px rgba(0,0,0,0.1);
      }

      .no-js-copy-instructions {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 16px;
        margin: 12px 0;
        font-size: 14px;
      }

      .no-js-copy-instructions p {
        margin: 0 0 8px 0;
        color: #495057;
      }

      .no-js-copy-instructions ol {
        margin: 0;
        padding-left: 20px;
      }

      .no-js-copy-instructions li {
        margin: 4px 0;
        color: #6c757d;
      }

    @media (max-width: 768px) {
      .container {
        margin: 10px;
        border-radius: 12px;
      }
      
      .hero h1 {
        font-size: 2rem;
      }
      
      .meta-grid {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      
      .toolbar {
        flex-direction: column;
        gap: 15px;
        align-items: stretch;
      }
      
      .btn-group, .button-group {
        flex-direction: column;
      }
      
      .btn {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="hero">
      <h1>🔐 ${escapedTitle}</h1>
      <p>Secure paste • ${paste.oneTimeView ? 'One-time view' : 'Multi-view'} • Auto-expiring</p>
    </header>
    
    <div class="meta-section">
      <div class="meta-grid">
        <div class="meta-item">
          <span>📅</span>
          <span>Created: ${formattedDate}</span>
        </div>
        <div class="meta-item">
          <span>📏</span>
          <span>Size: ${this.formatBytes(paste.size)}</span>
        </div>
        <div class="meta-item">
          <span>📄</span>
          <span>Lines: ${paste.content.split('\n').length}</span>
        </div>
        <div class="meta-item">
          <span>🗣️</span>
          <span>Language: ${languageLabel}</span>
        </div>
        <div class="meta-item">
          <span>${paste.oneTimeView ? '🔥' : '👁️'}</span>
          <span>View Mode: ${paste.oneTimeView ? 'One-time only' : 'Multiple views'}</span>
        </div>
      </div>
    </div>

    <style>
      .download-buttons {
        display: flex;
        gap: 5px;
        align-items: center;
      }
      
      .btn-outline {
        background: transparent;
        border: 2px solid var(--secondary-color);
        color: var(--secondary-color);
        padding: 8px 12px;
        min-width: auto;
      }
      
      .btn-outline:hover {
        background: var(--secondary-color);
        color: white;
      }
      
      @media (max-width: 768px) {
        .download-buttons {
          flex-direction: column;
          gap: 10px;
        }
        
        .btn-outline {
          width: 100%;
          padding: 12px 20px;
        }
      }
    </style>

    <div class="toolbar">
      <div class="language-badge">
        ${languageLabel}
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="
          const el = document.getElementById('content');
          const text = el.textContent;
          navigator.clipboard.writeText(text).then(() => {
            this.textContent = '✅ Copied!';
            setTimeout(() => this.textContent = '📋 Copy', 2000);
          }).catch(() => {
            el.select();
            document.execCommand('copy');
            this.textContent = '✅ Copied!';
            setTimeout(() => this.textContent = '📋 Copy', 2000);
          });">
          📋 Copy
        </button>
        <noscript>
          <div class="no-js-copy-instructions">
            <p><strong>📋 To copy:</strong> Click the code below, then press <kbd>Ctrl+A</kbd> to select all, then <kbd>Ctrl+C</kbd> to copy.</p>
          </div>
        </noscript>
${
  paste.oneTimeView
    ? ''
    : `
        <div class="download-buttons">
          <a href="/download/${paste.id}?format=auto" class="btn btn-secondary" download>
            💾 Download
          </a>
          <a href="/download/${paste.id}?format=txt" class="btn btn-outline" download title="Download as TXT">
            📝
          </a>
          <a href="/download/${paste.id}?format=md" class="btn btn-outline" download title="Download as Markdown">
            📋
          </a>
        </div>`
}
${
  paste.oneTimeView
    ? ''
    : `
        <form method="POST" action="/s/${paste.id}" style="display: inline;">
          <input type="hidden" name="_method" value="DELETE">
          <button type="submit" class="btn btn-danger" title="Delete this paste now" onclick="return confirm('Are you sure you want to delete this paste? This action cannot be undone.')">
            🗑️ Delete Now
          </button>
        </form>
        <noscript>
          <form method="POST" action="/s/${paste.id}" style="display: inline;">
            <input type="hidden" name="_method" value="DELETE">
            <button type="submit" class="btn btn-danger" title="Delete this paste now">
              🗑️ Delete Now (No confirmation without JS)
            </button>
          </form>
        </noscript>`
}
      </div>
    </div>

    <div class="code-container">
      <div class="code-content">
        <pre id="content" class="content-selectable" tabindex="0" title="Click to select all content">${escapedContent}</pre>
      </div>
    </div>
    
    <noscript>
      <div class="select-instructions">
        💡 <strong>How to copy:</strong> Click on the code above to select it, then press <kbd>Ctrl+C</kbd> (or <kbd>Cmd+C</kbd> on Mac) to copy.
      </div>
    </noscript>

    <div class="warning">
      <h3>
        ${paste.oneTimeView ? '🔥 This paste has been destroyed' : '👁️ Multiple view mode'}
      </h3>
      <p>${
        paste.oneTimeView
          ? 'For security reasons, this paste can only be viewed <strong>once</strong>. After someone views it, the paste is automatically deleted for security. <strong>Downloads are not available</strong> - please copy the content if needed.'
          : 'This paste allows multiple views until expiration. It will be automatically deleted when it expires.'
      }</p>
    </div>

    <main class="content">
      <div class="button-group">
        <a href="/" class="btn btn-primary">✨ Create New Paste</a>
        <button class="btn btn-secondary" onclick="window.print()">🖨️ Print</button>
${
  paste.oneTimeView
    ? ''
    : `
        <form method="POST" action="/s/${paste.id}" style="display: inline;">
          <input type="hidden" name="_method" value="DELETE">
          <button type="submit" class="btn btn-danger" onclick="return confirm('Are you sure you want to delete this paste? This action cannot be undone.')">🗑️ Delete This Paste</button>
        </form>`
}
        <noscript>
          <div class="no-js-warning">
            ⚠️ ${paste.oneTimeView ? 'This paste has been automatically deleted for security.' : 'Print and delete require JavaScript or use the "Delete Now" button above.'}
          </div>
        </noscript>
      </div>
    </main>
  </div>

  <script>
    // Simple click-to-select for the content area
    document.getElementById('content').onclick = function() {
      const range = document.createRange();
      range.selectNodeContents(this);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    };
  </script>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m] || m);
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  }

  private generateDeleteSuccessHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paste Deleted - Secure Pastebin</title>
  <style>
    :root {
      --primary-color: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      --success-color: #28a745;
      --border-radius: 8px;
      --shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      --transition: all 0.3s ease;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--primary-color);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      padding: 3rem;
      border-radius: 16px;
      text-align: center;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }

    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    h1 {
      color: #2c3e50;
      margin-bottom: 1rem;
      font-size: 2rem;
    }

    p {
      color: #6c757d;
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }

    .btn {
      display: inline-block;
      background: var(--primary-color);
      color: white;
      padding: 12px 24px;
      border-radius: var(--border-radius);
      text-decoration: none;
      font-weight: 600;
      transition: var(--transition);
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🗑️</div>
    <h1>Paste Deleted</h1>
    <p>This paste has been permanently deleted and is no longer accessible.</p>
    <a href="/" class="btn">✨ Create New Paste</a>
  </div>
</body>
</html>`;
  }
}
