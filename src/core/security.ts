export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface SecurityConfig {
  maxContentSize: number;
  maxTitleLength: number;
  suspiciousPatternsEnabled: boolean;
  strictValidation: boolean;
}

export class SecurityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class SecurityManager {
  private config: SecurityConfig;
  
  // Enhanced suspicious patterns with better categorization
  private suspiciousPatterns: { name: string; pattern: RegExp; severity: 'high' | 'medium' | 'low' }[] = [
    // API Keys and tokens
    { name: 'api_key', pattern: /(api[_-]?key|token|secret)[\s"']*[:=][\s"']*[a-zA-Z0-9]{20,}/i, severity: 'high' },
    { name: 'aws_key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'high' },
    { name: 'openai_key', pattern: /sk-[a-zA-Z0-9]{48}/i, severity: 'high' },
    { name: 'github_token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,255}/, severity: 'high' },
    { name: 'jwt_token', pattern: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/, severity: 'medium' },
    // Credentials
    { name: 'password', pattern: /(password|pwd|passwd)\s*[:=]\s*["']?[^\s"']{8,}/i, severity: 'medium' },
    { name: 'connection_string', pattern: /(mongodb|postgres|mysql):\/\/[^\s]+/i, severity: 'high' },
    // PII patterns
    { name: 'ssn', pattern: /\b\d{3}-?\d{2}-?\d{4}\b/, severity: 'high' },
    { name: 'credit_card', pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/, severity: 'high' },
    { name: 'email_bulk', pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*[,;\n]){5,}/g, severity: 'medium' },
  ];

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      maxContentSize: 1024 * 1024, // 1MB
      maxTitleLength: 200,
      suspiciousPatternsEnabled: true,
      strictValidation: false,
      ...config
    };
  }

  // Enhanced content validation with detailed feedback
  validateContent(content: string, title = ''): ValidationResult {
    const warnings: string[] = [];
    
    // Basic validation
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'Content cannot be empty' };
    }

    // Size validation
    const encoder = new TextEncoder();
    const contentSize = encoder.encode(content).length;
    if (contentSize > this.config.maxContentSize) {
      return { 
        valid: false, 
        error: `Content too large (${this.formatBytes(contentSize)} / ${this.formatBytes(this.config.maxContentSize)} max)` 
      };
    }

    // Title validation
    if (title.length > this.config.maxTitleLength) {
      return { 
        valid: false, 
        error: `Title too long (${title.length} / ${this.config.maxTitleLength} max characters)` 
      };
    }

    // Content quality checks
    if (this.config.strictValidation) {
      // Check for excessive whitespace (more than 50% of content)
      const whitespaceRatio = (content.length - content.replace(/\s/g, '').length) / content.length;
      if (whitespaceRatio > 0.5) {
        warnings.push('Content contains excessive whitespace');
      }

      // Check for repeated characters (more than 100 of the same character in a row)
      if (/(.)\1{100,}/.test(content)) {
        warnings.push('Content contains excessive character repetition');
      }

      // Check for very long lines (more than 1000 characters)
      const longLines = content.split('\n').filter(line => line.length > 1000);
      if (longLines.length > 0) {
        warnings.push(`Content contains ${longLines.length} very long line(s)`);
      }
    }

    // Security pattern detection
    if (this.config.suspiciousPatternsEnabled) {
      const securityWarnings = this.checkSuspiciousContent(content, title);
      warnings.push(...securityWarnings);
    }

    const result: ValidationResult = { valid: true };
    if (warnings.length > 0) {
      result.warnings = warnings;
    }
    return result;
  }

  // Enhanced suspicious content detection with structured logging
  private checkSuspiciousContent(content: string, title: string): string[] {
    const warnings: string[] = [];
    const fullText = `${title} ${content}`;
    const detectedPatterns: { name: string; severity: string; count: number }[] = [];

    for (const { name, pattern, severity } of this.suspiciousPatterns) {
      const matches = fullText.match(new RegExp(pattern, 'g'));
      if (matches) {
        detectedPatterns.push({ name, severity, count: matches.length });
        
        // Log security event with structured data (without exposing content)
        this.logSecurityEvent({
          event: 'suspicious_content_detected',
          pattern: name,
          severity,
          matchCount: matches.length,
          contentLength: content.length,
          timestamp: new Date().toISOString(),
          // Include hash of first 100 chars for correlation without exposing full content
          contentHash: this.hashString(content.substring(0, 100))
        });
        
        if (severity === 'high') {
          warnings.push(`Potentially sensitive ${name.replace('_', ' ')} detected`);
        }
      }
    }

    return warnings;
  }

  // HTML escaping with additional protections
  escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`=/]/g, (m) => map[m] || m);
  }

  // Sanitize title for safe display
  sanitizeTitle(title: string): string {
    return this.escapeHtml(title.trim().substring(0, this.config.maxTitleLength));
  }

  // Generate content hash for security logging (synchronous version)
  private hashString(input: string): string {
    // Simple hash for immediate use (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  // Generate secure content hash for security logging
  private async hashStringSecure(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  // Validate language input
  validateLanguage(language: string, supportedLanguages: string[]): string {
    const cleanLang = language.toLowerCase().trim();
    
    if (!cleanLang || !supportedLanguages.includes(cleanLang)) {
      return 'text'; // Default to text
    }
    
    return cleanLang;
  }

  // Validate expiry time
  validateExpiry(expirySeconds: number, minExpiry = 300, maxExpiry = 604800): ValidationResult {
    if (isNaN(expirySeconds) || expirySeconds < 0) {
      return { valid: false, error: 'Invalid expiry time' };
    }
    
    if (expirySeconds < minExpiry) {
      return { valid: false, error: `Minimum expiry time is ${this.formatDuration(minExpiry)}` };
    }
    
    if (expirySeconds > maxExpiry) {
      return { valid: false, error: `Maximum expiry time is ${this.formatDuration(maxExpiry)}` };
    }
    
    return { valid: true };
  }

  // Helper methods
  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private formatDuration(seconds: number): string {
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }

  private logSecurityEvent(event: any): void {
    // Structured logging for security events
    console.warn(JSON.stringify({
      ...event,
      level: 'SECURITY',
      source: 'SecurityManager'
    }));
  }

  // Rate limiting helper (placeholder - actual implementation would use Durable Objects)
  validateRateLimit(clientIP: string, action: 'create' | 'view'): ValidationResult {
    // This is a placeholder - actual rate limiting should be implemented
    // with Durable Objects or external service
    console.log(`Rate limit check for ${clientIP} - ${action}`);
    return { valid: true };
  }

  // Content type detection for additional security
  detectContentType(content: string): { type: string; confidence: number } {
    const patterns = [
      { type: 'json', pattern: /^\s*[\{\[]/, confidence: 0.8 },
      { type: 'xml', pattern: /^\s*<\?xml|^\s*<[a-zA-Z]/, confidence: 0.7 },
      { type: 'code', pattern: /function\s+\w+|class\s+\w+|import\s+/, confidence: 0.6 },
      { type: 'sql', pattern: /SELECT\s+.*FROM|INSERT\s+INTO|CREATE\s+TABLE/i, confidence: 0.7 },
      { type: 'config', pattern: /=.*\n.*=|^[a-zA-Z_]+\s*=/, confidence: 0.5 },
    ];

    for (const { type, pattern, confidence } of patterns) {
      if (pattern.test(content)) {
        return { type, confidence };
      }
    }

    return { type: 'text', confidence: 1.0 };
  }
} 