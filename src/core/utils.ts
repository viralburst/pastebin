// Language detection based on patterns and file extensions
export class LanguageDetector {
  private static patterns: Record<string, { patterns: RegExp[]; weight: number }> = {
    json: {
      patterns: [/^\s*[\{\[]/, /"[\w-]+"\s*:\s*/, /^\s*\{.*\}\s*$/s],
      weight: 0.9
    },
    javascript: {
      patterns: [
        /function\s+\w+\s*\(/,
        /const\s+\w+\s*=/,
        /=>\s*\{/,
        /require\s*\(/,
        /import\s+.*\s+from/,
        /export\s+(default\s+)?/,
        /console\.(log|error|warn)/,
        /document\./,
        /window\./
      ],
      weight: 0.8
    },
    typescript: {
      patterns: [
        /interface\s+\w+/,
        /type\s+\w+\s*=/,
        /:\s*(string|number|boolean|object)/,
        /enum\s+\w+/,
        /implements\s+\w+/,
        /extends\s+\w+/
      ],
      weight: 0.85
    },
    python: {
      patterns: [
        /def\s+\w+\s*\(/,
        /import\s+\w+/,
        /from\s+\w+\s+import/,
        /print\s*\(/,
        /if\s+__name__\s*==\s*['"']__main__['"']/,
        /class\s+\w+.*:/,
        /elif\s+/,
        /^\s*#.*$/m
      ],
      weight: 0.8
    },
    java: {
      patterns: [
        /public\s+class\s+\w+/,
        /public\s+static\s+void\s+main/,
        /System\.out\.print/,
        /import\s+java\./,
        /@Override/,
        /throws\s+\w+/
      ],
      weight: 0.8
    },
    sql: {
      patterns: [
        /SELECT\s+.*\s+FROM/i,
        /INSERT\s+INTO/i,
        /CREATE\s+TABLE/i,
        /UPDATE\s+.*\s+SET/i,
        /DELETE\s+FROM/i,
        /ALTER\s+TABLE/i,
        /DROP\s+TABLE/i
      ],
      weight: 0.9
    },
    shell: {
      patterns: [
        /^#!/,
        /\$\w+/,
        /echo\s+/,
        /grep\s+/,
        /awk\s+/,
        /sed\s+/,
        /chmod\s+/,
        /sudo\s+/
      ],
      weight: 0.7
    },
    css: {
      patterns: [
        /\w+\s*\{[^}]*\}/,
        /@media/,
        /\.\w+\s*\{/,
        /#\w+\s*\{/,
        /@import/,
        /@keyframes/,
        /:\s*\w+\s*;/
      ],
      weight: 0.8
    },
    html: {
      patterns: [
        /<html/i,
        /<head/i,
        /<body/i,
        /<div/i,
        /<script/i,
        /<style/i,
        /<!DOCTYPE/i,
        /<meta/i
      ],
      weight: 0.9
    },
    xml: {
      patterns: [
        /<\?xml/i,
        /<\/\w+>/,
        /<\w+[^>]*\/>/,
        /<!\[CDATA\[/,
        /xmlns:/
      ],
      weight: 0.8
    },
    markdown: {
      patterns: [
        /^#{1,6}\s+/m,
        /\*\*.*\*\*/,
        /__.*__/,
        /\[.*\]\(.*\)/,
        /```[\w]*\n/,
        /^\s*[-*+]\s+/m,
        /^\s*\d+\.\s+/m
      ],
      weight: 0.7
    },
    yaml: {
      patterns: [
        /^---$/m,
        /^\w+:\s*$/m,
        /^\s*[-*]\s+\w+:/m,
        /^[\w-]+:\s+[|>]/m
      ],
      weight: 0.8
    },
    dockerfile: {
      patterns: [
        /^FROM\s+/m,
        /^RUN\s+/m,
        /^COPY\s+/m,
        /^ADD\s+/m,
        /^WORKDIR\s+/m,
        /^EXPOSE\s+/m,
        /^CMD\s+/m,
        /^ENTRYPOINT\s+/m
      ],
      weight: 0.9
    }
  };

  static detect(content: string, filename?: string): string {
    // First check filename extension
    if (filename) {
      const ext = this.getFileExtension(filename);
      const langFromExt = this.getLanguageFromExtension(ext);
      if (langFromExt) {
        return langFromExt;
      }
    }

    const scores: Record<string, number> = {};
    const contentLength = content.length;
    
    // Avoid processing very large files for pattern matching
    const sampleContent = contentLength > 10000 ? content.substring(0, 10000) : content;
    
    for (const [lang, { patterns, weight }] of Object.entries(this.patterns)) {
      let score = 0;
      let matchCount = 0;
      
      for (const pattern of patterns) {
        const matches = sampleContent.match(pattern);
        if (matches) {
          matchCount++;
          score += matches.length * weight;
        }
      }
      
      // Normalize score by content length and pattern count
      if (matchCount > 0) {
        scores[lang] = score / Math.max(1, Math.log10(contentLength)) * (matchCount / patterns.length);
      }
    }
    
    if (Object.keys(scores).length === 0) {
      return 'text';
    }
    
    // Return language with highest score
    const bestMatch = Object.entries(scores).reduce((prev, curr) => 
      curr[1] > prev[1] ? curr : prev
    );
    
    return bestMatch[0];
  }

  private static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private static getLanguageFromExtension(ext: string): string | null {
    const extensionMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
      'css': 'css',
      'html': 'html',
      'htm': 'html',
      'xml': 'xml',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'json': 'json',
      'dockerfile': 'dockerfile'
    };
    
    return extensionMap[ext] || null;
  }
}

// Time utilities with improved formatting
export class TimeUtils {
  // Return ISO string after adding seconds
  static getExpiryDate(seconds: number): string {
    if (seconds <= 0) {
      throw new Error('Expiry seconds must be positive');
    }
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  // Format expiry duration in human-friendly form
  static formatExpiry(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
    return `${Math.floor(seconds / 604800)} weeks`;
  }

  // Parse human-readable time to seconds
  static parseTimeString(timeStr: string): number | null {
    const patterns = [
      { regex: /^(\d+)s$/, multiplier: 1 },
      { regex: /^(\d+)m$/, multiplier: 60 },
      { regex: /^(\d+)h$/, multiplier: 3600 },
      { regex: /^(\d+)d$/, multiplier: 86400 },
      { regex: /^(\d+)w$/, multiplier: 604800 }
    ];

    const cleaned = timeStr.toLowerCase().trim();
    
    for (const { regex, multiplier } of patterns) {
      const match = cleaned.match(regex);
      if (match) {
        return parseInt(match[1]) * multiplier;
      }
    }
    
    return null;
  }

  // Check if a date is expired
  static isExpired(expiryDate: string): boolean {
    return new Date(expiryDate) <= new Date();
  }

  // Get time remaining until expiry
  static getTimeRemaining(expiryDate: string): { 
    expired: boolean; 
    seconds: number; 
    formatted: string 
  } {
    const now = Date.now();
    const expiry = new Date(expiryDate).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) {
      return { expired: true, seconds: 0, formatted: 'Expired' };
    }
    
    return { 
      expired: false, 
      seconds: Math.floor(diff / 1000), 
      formatted: this.formatExpiry(Math.floor(diff / 1000)) 
    };
  }
}

// Response utilities with enhanced security headers and CORS handling
export class ResponseUtils {
  private static securityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };

  private static corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };

  static json(data: unknown, status = 200, additionalHeaders: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 
        ...this.securityHeaders,
        ...this.corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        ...additionalHeaders
      },
    });
  }

  static html(content: string, status = 200, additionalHeaders: Record<string, string> = {}): Response {
    return new Response(content, {
      status,
      headers: { 
        ...this.securityHeaders,
        ...this.corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        ...additionalHeaders
      },
    });
  }

  static text(content: string, status = 200, additionalHeaders: Record<string, string> = {}): Response {
    return new Response(content, {
      status,
      headers: { 
        ...this.securityHeaders,
        ...this.corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        ...additionalHeaders
      },
    });
  }

  static css(content: string, status = 200): Response {
    return new Response(content, {
      status,
      headers: { 
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000',
        ...this.securityHeaders
      },
    });
  }

  static javascript(content: string, status = 200): Response {
    return new Response(content, {
      status,
      headers: { 
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000',
        ...this.securityHeaders
      },
    });
  }

  static error(message: string, status = 400, details?: any): Response {
    const errorResponse = {
      success: false,
      error: message,
      status,
      timestamp: new Date().toISOString(),
      ...(details && { details })
    };
    
    return this.json(errorResponse, status);
  }

  static success(data: any, message?: string): Response {
    return this.json({
      success: true,
      data,
      ...(message && { message }),
      timestamp: new Date().toISOString()
    });
  }

  static redirect(url: string, status = 302): Response {
    return new Response(null, {
      status,
      headers: {
        'Location': url,
        ...this.securityHeaders
      }
    });
  }

  static notFound(message = 'Resource not found'): Response {
    return this.error(message, 404);
  }

  static methodNotAllowed(allowed: string[] = ['GET', 'POST']): Response {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        'Allow': allowed.join(', '),
        ...this.securityHeaders
      }
    });
  }

  static rateLimit(retryAfter = 60): Response {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        ...this.securityHeaders,
        ...this.corsHeaders
      }
    });
  }

  // Handle CORS preflight requests
  static corsPrelight(): Response {
    return new Response(null, {
      status: 204,
      headers: this.corsHeaders
    });
  }
}

// URL utilities
export class URLUtils {
  static extractPasteId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
      
      // Handle /s/{id} format
      if (pathParts.length === 2 && pathParts[0] === 's') {
        return pathParts[1];
      }
      
      return null;
    } catch {
      return null;
    }
  }

  static buildShareUrl(baseUrl: string, pasteId: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}/s/${pasteId}`;
  }

  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Input sanitization utilities
export class SanitizationUtils {
  // Sanitize filename for safe storage
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100);
  }

  // Sanitize user input for safe display
  static sanitizeUserInput(input: string, maxLength = 1000): string {
    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control characters
  }

  // Extract client IP with proper header handling
  static extractClientIP(request: Request): string {
    const cfConnectingIP = request.headers.get('CF-Connecting-IP');
    const xForwardedFor = request.headers.get('X-Forwarded-For');
    const xRealIP = request.headers.get('X-Real-IP');
    
    // Cloudflare provides the real client IP
    if (cfConnectingIP) {
      return cfConnectingIP;
    }
    
    // Fallback to other headers
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return xForwardedFor.split(',')[0].trim();
    }
    
    if (xRealIP) {
      return xRealIP;
    }
    
    return 'unknown';
  }

  // Validate and sanitize language input
  static sanitizeLanguage(language: string, supportedLanguages: string[]): string {
    const cleaned = language.toLowerCase().trim();
    return supportedLanguages.includes(cleaned) ? cleaned : 'text';
  }
}

// Performance utilities
export class PerformanceUtils {
  // Simple performance timer
  static timer(name: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      console.log(`${name}: ${duration}ms`);
      return duration;
    };
  }

  // Debounce function calls
  static debounce<T extends (...args: any[]) => void>(
    func: T, 
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number | undefined;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait) as any;
    };
  }

  // Throttle function calls
  static throttle<T extends (...args: any[]) => void>(
    func: T, 
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Minify HTML by removing unnecessary whitespace while preserving content in <pre> tags
  static minifyHTML(html: string): string {
    // First, extract and preserve content inside <pre> tags
    const preTags: string[] = [];
    let htmlWithPlaceholders = html.replace(/<pre[^>]*>[\s\S]*?<\/pre>/g, (match) => {
      const index = preTags.length;
      preTags.push(match);
      return `__PRE_PLACEHOLDER_${index}__`;
    });

    // Minify the HTML (excluding pre tag content)
    htmlWithPlaceholders = htmlWithPlaceholders
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/>\s+</g, '><') // Remove spaces between tags
      .replace(/\s+$/gm, '') // Remove trailing spaces
      .replace(/^\s+/gm, '') // Remove leading spaces
      .trim();

    // Restore the original pre tag content
    preTags.forEach((preContent, index) => {
      htmlWithPlaceholders = htmlWithPlaceholders.replace(
        `__PRE_PLACEHOLDER_${index}__`,
        preContent
      );
    });

    return htmlWithPlaceholders;
  }

  // Add performance headers to responses
  static addPerformanceHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    
    // Enable compression
    headers.set('Content-Encoding', 'gzip');
    
    // Cache static content
    if (response.url && (response.url.includes('/styles/') || response.url.includes('/scripts/'))) {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    } else {
      headers.set('Cache-Control', 'no-cache, must-revalidate'); // Dynamic content
    }
    
    // Security and performance headers
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Performance hints
    headers.set('Server-Timing', 'cloudflare');
    headers.set('Accept-Encoding', 'gzip, deflate, br');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  // Preload critical resources
  static generatePreloadLinks(): string {
    return `
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link rel="dns-prefetch" href="//cloudflare.com">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
      <meta name="color-scheme" content="light dark">
    `;
  }

  // Critical CSS inlining
  static inlineCriticalCSS(): string {
    return `
      <style>
        /* Critical above-the-fold CSS */
        :root{--primary-gradient:linear-gradient(135deg,#667eea 0%,#764ba2 100%);--primary-color:#667eea;--text-color:#2c3e50;--border-radius:8px}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--primary-gradient);min-height:100vh;color:var(--text-color)}
        .container{max-width:900px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden}
        .hero{background:var(--primary-gradient);color:#fff;padding:40px 30px;text-align:center}
        .hero h1{font-size:2.5rem;margin-bottom:10px;font-weight:700}
      </style>
    `;
  }
} 