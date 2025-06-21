import { IStorage, CreatePasteInput } from '../core/storage';
import { IAnalytics } from '../core/analytics';
import { SecurityManager, ValidationResult } from '../core/security';
import { LanguageDetector, TimeUtils, ResponseUtils, SanitizationUtils } from '../core/utils';
import { CONFIG, ConfigValidator } from '../config/constants';

export interface CreatePasteRequest {
  title?: string;
  content: string;
  language?: string;
  expires?: string; // expiry key like '1h', '1d', etc.
  expires_in?: number; // expiry in seconds (legacy support)
  oneTimeView?: boolean; // whether paste should be consumed after first view
}

export interface CreatePasteResponse {
  success: true;
  id: string;
  shareUrl: string;
  title: string;
  language: string;
  expiresAt?: string;
  size: number;
  createdAt: string;
  warnings?: string[];
}

export class CreateHandler {
  private storage: IStorage;
  private analytics: IAnalytics;
  private security: SecurityManager;

  constructor(storage: IStorage, analytics: IAnalytics) {
    this.storage = storage;
    this.analytics = analytics;
    this.security = new SecurityManager({
      maxContentSize: CONFIG.MAX_CONTENT_SIZE,
      maxTitleLength: CONFIG.MAX_TITLE_LENGTH,
      suspiciousPatternsEnabled: CONFIG.SECURITY.SUSPICIOUS_PATTERNS_ENABLED,
      strictValidation: CONFIG.SECURITY.STRICT_VALIDATION,
    });
  }

  async handle(request: Request): Promise<Response> {
    try {
      const clientIP = SanitizationUtils.extractClientIP(request);
      
      // Rate limiting check (if enabled)
      if (CONFIG.SECURITY.RATE_LIMITING_ENABLED) {
        const rateLimitResult = this.security.validateRateLimit(clientIP, 'create');
        if (!rateLimitResult.valid) {
          return ResponseUtils.rateLimit(60);
        }
      }

      // Parse and validate request
      const requestData = await this.parseRequest(request);
      if (!requestData.success) {
        return ResponseUtils.error(requestData.error!, 400);
      }

      const { title, content, language, expirySeconds, oneTimeView } = requestData.data!;

      // Validate content and title
      const validation = this.security.validateContent(content, title);
      if (!validation.valid) {
        return ResponseUtils.error(validation.error!, 400);
      }

      // Validate expiry
      const expiryValidation = this.security.validateExpiry(expirySeconds, CONFIG.MIN_EXPIRY, CONFIG.MAX_EXPIRY);
      if (!expiryValidation.valid) {
        return ResponseUtils.error(expiryValidation.error!, 400);
      }

      // Calculate expiry date
      let expiresAt: string | undefined;
      if (expirySeconds > 0) {
        expiresAt = TimeUtils.getExpiryDate(expirySeconds);
      }

      // Calculate content size
      const size = new TextEncoder().encode(content).length;

      // Create paste data
      const pasteInput: CreatePasteInput = {
        title: title || 'Untitled Paste',
        content,
        language,
        expiresAt,
        size,
        oneTimeView,
      };

      // Store the paste
      const paste = await this.storage.createPaste(pasteInput);

      // Track analytics
      try {
        await this.analytics.trackPasteCreated(paste.language, paste.size, clientIP);
      } catch (error) {
        console.warn('Failed to track paste creation:', error);
        // Don't fail the request if analytics fails
      }

      // Build response
      const baseUrl = this.getBaseUrl(request);
      const response: CreatePasteResponse = {
        success: true,
        id: paste.id,
        shareUrl: `${baseUrl}/s/${paste.id}`,
        title: paste.title,
        language: paste.language,
        expiresAt: paste.expiresAt,
        size: paste.size,
        createdAt: paste.createdAt,
        warnings: validation.warnings,
      };

      return ResponseUtils.success(response, 'Paste created successfully');

    } catch (error) {
      console.error('CreateHandler error:', error);
      
      // Track error in analytics
      try {
        const clientIP = SanitizationUtils.extractClientIP(request);
        await this.analytics.trackError('paste_creation_failed', clientIP);
      } catch {
        // Ignore analytics errors
      }
      
      return ResponseUtils.error('Failed to create paste', 500);
    }
  }

  private async parseRequest(request: Request): Promise<{
    success: boolean;
    error?: string;
    data?: {
      title: string;
      content: string;
      language: string;
      expirySeconds: number;
      oneTimeView: boolean;
    };
  }> {
    try {
      // Check content type
      const contentType = request.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return { success: false, error: 'Content-Type must be application/json' };
      }

      const body = await request.json() as CreatePasteRequest;

      // Validate required fields
      if (!body.content) {
        return { success: false, error: 'Content is required' };
      }

      // Sanitize and validate inputs
      const title = SanitizationUtils.sanitizeUserInput(body.title || '', CONFIG.MAX_TITLE_LENGTH);
      const content = body.content.trim();
      
      if (content.length === 0) {
        return { success: false, error: 'Content cannot be empty' };
      }

      // Determine language
      let language = body.language?.toLowerCase().trim() || '';
      if (!language) {
        language = LanguageDetector.detect(content);
      }
      language = SanitizationUtils.sanitizeLanguage(language, CONFIG.SUPPORTED_LANGUAGES);

      // Determine expiry
      let expirySeconds = 0;
      
      if (body.expires) {
        // New format: '1h', '1d', etc.
        if (ConfigValidator.validateExpiry(body.expires)) {
          expirySeconds = ConfigValidator.getExpirySeconds(body.expires);
        } else {
          return { success: false, error: `Invalid expiry option: ${body.expires}` };
        }
      } else if (body.expires_in) {
        // Legacy format: seconds
        expirySeconds = body.expires_in;
      } else {
        // Default expiry
        expirySeconds = ConfigValidator.getExpirySeconds(CONFIG.DEFAULT_EXPIRY);
      }

      // Determine one-time view preference (default: true for security)
      const oneTimeView = body.oneTimeView !== false; // defaults to true

      return {
        success: true,
        data: {
          title,
          content,
          language,
          expirySeconds,
          oneTimeView,
        }
      };

    } catch (error) {
      console.error('Failed to parse request:', error);
      return { success: false, error: 'Invalid JSON in request body' };
    }
  }

  private getBaseUrl(request: Request): string {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }

  // Method to handle form data (for HTML form submissions)
  async handleFormData(request: Request): Promise<Response> {
    try {
      const formData = await request.formData();
      
      const createRequest: CreatePasteRequest = {
        title: formData.get('title')?.toString() || '',
        content: formData.get('content')?.toString() || '',
        language: formData.get('language')?.toString() || '',
        expires: formData.get('expires')?.toString() || CONFIG.DEFAULT_EXPIRY,
        oneTimeView: formData.get('viewMode')?.toString() === 'one-time',
      };

      // Convert to JSON request
      const jsonRequest = new Request(request.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': request.headers.get('user-agent') || '',
          'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
          'cf-connecting-ip': request.headers.get('cf-connecting-ip') || ''
        },
        body: JSON.stringify(createRequest)
      });

      const result = await this.handle(jsonRequest);
      
      // If this is a form submission (not AJAX), redirect to success page
      if (formData.get('form_submit')) {
        const resultJson = await result.json() as any;
        if (resultJson.success && resultJson.data) {
          const baseUrl = this.getBaseUrl(request);
          const successUrl = `${baseUrl}/success?url=${encodeURIComponent(resultJson.data.shareUrl)}&id=${resultJson.data.id}`;
          return new Response(null, {
            status: 302,
            headers: { 'Location': successUrl }
          });
        } else {
          // Return error page for form submissions
          return new Response(`
            <html>
              <head><title>Error</title></head>
              <body>
                <h1>Error</h1>
                <p>${resultJson.error || 'Unknown error occurred'}</p>
                <a href="/">← Go Back</a>
              </body>
            </html>
          `, {
            status: 400,
            headers: { 'content-type': 'text/html' }
          });
        }
      }

      return result;

    } catch (error) {
      console.error('Failed to handle form data:', error);
      return ResponseUtils.error('Invalid form data', 400);
    }
  }

  // Validation methods for API documentation/testing
  static getValidationRules() {
    return {
      title: {
        type: 'string',
        optional: true,
        maxLength: CONFIG.MAX_TITLE_LENGTH,
        description: 'Optional title for the paste'
      },
      content: {
        type: 'string',
        required: true,
        maxLength: CONFIG.MAX_CONTENT_SIZE,
        description: 'The content to be shared'
      },
      language: {
        type: 'string',
        optional: true,
        enum: CONFIG.SUPPORTED_LANGUAGES,
        description: 'Programming language for syntax highlighting'
      },
      expires: {
        type: 'string',
        optional: true,
        enum: Object.keys(CONFIG.EXPIRY_OPTIONS),
        description: 'When the paste should expire'
      }
    };
  }

  static getExpiryOptions() {
    return Object.entries(CONFIG.EXPIRY_OPTIONS).map(([key, seconds]) => ({
      value: key,
      label: TimeUtils.formatExpiry(seconds),
      seconds
    }));
  }
} 