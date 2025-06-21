Enhanced Pastebin – Modular Blueprint

A modularized architecture for a secure, one-time-view pastebin on Cloudflare Workers, organized for clarity, maintainability, and scalability. This document includes the original blueprint structure, code snippets, and integrated improvement suggestions where appropriate.

⸻

Table of Contents
	1.	Introduction
	2.	Project Structure
	3.	Core Modules
	1.	Storage Module (core/storage.ts)
	2.	Security Module (core/security.ts)
	3.	Analytics Module (core/analytics.ts)
	4.	Utilities Module (core/utils.ts)
	4.	Handler Modules
	1.	Create Handler (handlers/create.ts)
	2.	View Handler (handlers/view.ts)
	3.	Stats Handler (handlers/stats.ts) (Optional)
	5.	UI Components & Templates
	1.	Home Template (ui/templates/home.ts)
	2.	Success Template (ui/templates/success.ts)
	3.	View Template (ui/templates/view.ts)
	4.	Error Template (ui/templates/error.ts)
	6.	Styles
	1.	Base Styles (ui/styles/base.css)
	2.	Component Styles (ui/styles/components.css)
	7.	Client Scripts (ui/scripts)
	1.	Form Script (ui/scripts/form.ts)
	2.	Clipboard Script (ui/scripts/clipboard.ts)
	3.	Share Script (ui/scripts/share.ts)
	8.	Configuration
	1.	Constants (config/constants.ts)
	2.	Wrangler Configuration (wrangler.toml)
	9.	Main Worker (worker.ts)
	10.	Scheduled/Cleanup Worker (scheduled.ts)
	11.	Build & Tooling
	12.	Testing & CI/CD
	13.	Security & Observability
	14.	Deployment & Environment
	15.	Future Extensions
	16.	Appendix: Example Code Snippets & Utilities

⸻

Introduction

This blueprint outlines a modular architecture for a secure pastebin-like service deployed on Cloudflare Workers. It focuses on:
	•	Separation of concerns: core logic, security, analytics, handlers, and UI/templates in distinct modules.
	•	Scalability & maintainability: clear interfaces, TypeScript typing, dependency injection, and Cloudflare-specific best practices (KV TTL, Durable Objects, Cron Triggers).
	•	Security: secure ID generation, content validation/sanitization, robust rate limiting, encryption at rest (optional), security headers.
	•	Observability: structured logging, metrics, health checks.
	•	Testing & CI/CD: unit/integration tests, linting, automated deployments.
	•	UX & Accessibility: clean UI, responsive design, accessibility considerations, progressive enhancement.

Throughout, improvement notes (in italics) illustrate best practices beyond the original blueprint.

⸻

Project Structure

src/
├── core/
│   ├── storage.ts          # Storage operations (KV or other providers)
│   ├── security.ts         # Security & validation utilities
│   ├── analytics.ts        # Analytics & usage tracking
│   └── utils.ts            # Utility functions (language detection, time utils, response utils)
├── handlers/
│   ├── create.ts           # Paste creation handler
│   ├── view.ts             # Paste viewing handler
│   └── stats.ts            # (Optional) Stats endpoint handler
├── ui/
│   ├── templates/
│   │   ├── home.ts         # Homepage template
│   │   ├── success.ts      # Success page template
│   │   ├── view.ts         # View page template
│   │   └── error.ts        # Error page template
│   ├── styles/
│   │   ├── base.css        # Base styles
│   │   ├── components.css  # Component styles
│   └── scripts/
│       ├── form.ts         # Form handling (TypeScript → bundled JS)
│       ├── clipboard.ts    # Clipboard operations
│       └── share.ts        # Sharing functionality
├── config/
│   ├── constants.ts        # Application constants / config from env
│   └── wrangler.toml       # Cloudflare Workers config
└── worker.ts               # Main Worker entry point

Note: Use TypeScript (.ts) for strong typing. The compiled/bundled JavaScript is deployed via Wrangler.

⸻

Core Modules

Storage Module (core/storage.ts)

Handles persistent storage of pastes. Abstracts Cloudflare KV or other providers. Implements create, get, consume (one-time view), delete, etc.

// src/core/storage.ts

export interface PasteData {
  id: string;
  title: string;
  content: string;
  language: string;
  createdAt: string;     // ISO string
  expiresAt?: string;    // ISO string
  consumed: boolean;
  size: number;
}

export interface IStorage {
  createPaste(data: Omit<PasteData, 'id' | 'createdAt' | 'consumed'> & Partial<Pick<PasteData, 'consumed'>>): Promise<PasteData>;
  getPaste(id: string): Promise<PasteData | null>;
  consumePaste(id: string): Promise<PasteData | null>;
  deletePaste(id: string): Promise<void>;
  // Additional methods if needed (e.g., list for admin)
}

// Implementation using Cloudflare KV
export class KVStorage implements IStorage {
  private kv: KVNamespace;

  constructor(kvNamespace: KVNamespace) {
    this.kv = kvNamespace;
  }

  // Helper: generate secure ID
  private generateId(length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array)
      .map((b) => chars[b % chars.length])
      .join('');
  }

  // Create a paste with TTL if expiresAt provided
  async createPaste(data: {
    title: string;
    content: string;
    language: string;
    expiresAt?: string; // ISO
    size: number;
    consumed?: boolean;
  }): Promise<PasteData> {
    const id = this.generateId();
    const createdAt = new Date().toISOString();
    const paste: PasteData = {
      id,
      title: data.title,
      content: data.content,
      language: data.language,
      createdAt,
      expiresAt: data.expiresAt,
      consumed: data.consumed ?? false,
      size: data.size,
    };

    // Use KV put with TTL if expiresAt: calculate TTL in seconds
    if (paste.expiresAt) {
      const now = Date.now();
      const expMs = new Date(paste.expiresAt).getTime();
      const ttlSec = Math.max(0, Math.floor((expMs - now) / 1000));
      if (ttlSec > 0) {
        await this.kv.put(id, JSON.stringify(paste), { expirationTtl: ttlSec });
      } else {
        // Already expired: do not store
        throw new Error('Paste expiration is in the past');
      }
    } else {
      await this.kv.put(id, JSON.stringify(paste));
    }
    return paste;
  }

  async getPaste(id: string): Promise<PasteData | null> {
    const v = await this.kv.get(id);
    if (!v) return null;
    try {
      const paste: PasteData = JSON.parse(v);
      return paste;
    } catch {
      return null;
    }
  }

  async consumePaste(id: string): Promise<PasteData | null> {
    // Fetch
    const raw = await this.kv.get(id);
    if (!raw) return null;
    let paste: PasteData;
    try {
      paste = JSON.parse(raw);
    } catch {
      return null;
    }
    if (paste.consumed) {
      return null;
    }
    // Mark consumed or delete
    // For atomic semantics, KV has no atomic get+delete. Race possible.
    // If strict one-time-view required, consider Durable Object instead.
    // For now: delete the key
    await this.kv.delete(id);
    // Optionally: mark consumed in a separate record/log if needed.
    return paste;
  }

  async deletePaste(id: string): Promise<void> {
    await this.kv.delete(id);
  }
}

Note: This implementation uses KV TTL (expirationTtl) to auto-delete expired entries and avoids manual cleanup. If very strict “one-time view” is needed, consider a Durable Object per paste. For most use-cases, the rare race condition is acceptable.
Ensure KV namespace binding in Wrangler config.

⸻

Security Module (core/security.ts)

Validates content, checks suspicious patterns, handles rate limiting (but in Workers, in-memory rate limiting is not reliable; integration with Durable Objects or Cloudflare Rate Limiting is recommended), escapes HTML.

// src/core/security.ts

export class SecurityManager {
  // Suspicious patterns to log (but avoid logging full content!)
  private suspiciousPatterns: RegExp[] = [
    /(api[_-]?key|token|secret)[\s"']*[:=][\s"']*[a-zA-Z0-9]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /sk-[a-zA-Z0-9]{48}/i,
  ];

  // Validate content non-empty, size limit
  validateContent(content: string, title = '', maxSize: number): { valid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { valid: false, error: 'Content cannot be empty' };
    }
    const encoder = new TextEncoder();
    const size = encoder.encode(content).length;
    if (size > maxSize) {
      return { valid: false, error: `Content too large (max ${maxSize} bytes)` };
    }
    // Title length check is done elsewhere
    // Check suspicious patterns (log only)
    this.checkSuspiciousContent(content, title);
    return { valid: true };
  }

  private checkSuspiciousContent(content: string, title: string) {
    const fullText = `${title} ${content}`;
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(fullText)) {
        // Log event, but avoid logging full content. Log masked info.
        console.warn(JSON.stringify({
          event: 'suspicious_content_detected',
          pattern: pattern.source,
          timestamp: new Date().toISOString(),
          // Possibly include hash of content or paste ID if available, but not raw content
        }));
        break;
      }
    }
  }

  // Escape HTML to prevent XSS
  escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Rate limiting: in-memory map is not reliable across Workers instances.
  // *Improvement*: Use Durable Object or Cloudflare Rate Limiting feature instead.
  /* Example placeholder:
  private rateLimits = new Map<string, number[]>();
  checkRateLimit(clientIP: string, action: 'create' | 'view', limitCount: number): boolean {
    // ...similar to original, but note ephemeral
  }
  */
}

Note: For robust rate limiting, integrate with Cloudflare Rate Limiting (configured outside code) or use a Durable Object to track per-IP counts with TTL. In-memory Maps reset on cold starts and don’t coordinate across instances.

⸻

Analytics Module (core/analytics.ts)

Tracks usage. In-memory storage is ephemeral; for persistence, write counters to KV or emit to external analytics.

// src/core/analytics.ts

export interface AnalyticsStats {
  totalShares: number;
  totalViews: number;
  uniqueVisitors?: number; // optional if using approximation or dropped
  languages: Record<string, number>;
  dailyStats: Record<string, { shares: number; views: number }>;
}

export interface IAnalytics {
  trackPasteCreated(language: string, clientIP: string): Promise<void>;
  trackPasteViewed(clientIP: string): Promise<void>;
  getStats(): Promise<AnalyticsStats>;
}

// Example: In-memory for development/testing; not suitable for production.
export class InMemoryAnalytics implements IAnalytics {
  private totalShares = 0;
  private totalViews = 0;
  private uniqueIps = new Set<string>();
  private languagesCount: Record<string, number> = {};
  private dailyStats = new Map<string, { shares: number; views: number }>();

  async trackPasteCreated(language: string, clientIP: string) {
    this.totalShares++;
    this.uniqueIps.add(clientIP);
    this.languagesCount[language] = (this.languagesCount[language] || 0) + 1;
    this.trackDaily('shares');
  }

  async trackPasteViewed(clientIP: string) {
    this.totalViews++;
    this.uniqueIps.add(clientIP);
    this.trackDaily('views');
  }

  private trackDaily(type: 'shares' | 'views') {
    const today = new Date().toISOString().split('T')[0];
    if (!this.dailyStats.has(today)) {
      this.dailyStats.set(today, { shares: 0, views: 0 });
    }
    const stat = this.dailyStats.get(today)!;
    stat[type]++;
  }

  async getStats(): Promise<AnalyticsStats> {
    return {
      totalShares: this.totalShares,
      totalViews: this.totalViews,
      uniqueVisitors: this.uniqueIps.size,
      languages: this.languagesCount,
      dailyStats: Object.fromEntries(this.dailyStats),
    };
  }
}

// Example: KV-based analytics counters
export class KVAnalytics implements IAnalytics {
  private kv: KVNamespace;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  private async incrementCounter(key: string): Promise<void> {
    // Atomically increment via KV: use get, parse int, put. 
    // Note: race conditions possible; consider using Durable Object or external analytics ingestion.
    const current = await this.kv.get(key);
    const val = current ? parseInt(current) : 0;
    await this.kv.put(key, String(val + 1));
  }

  async trackPasteCreated(language: string, clientIP: string) {
    // Example keys: "analytics:shares:YYYY-MM-DD", "analytics:lang:javascript"
    const today = new Date().toISOString().split('T')[0];
    await this.incrementCounter(`analytics:shares:${today}`);
    await this.incrementCounter(`analytics:lang:${language}`);
    // Tracking unique visitors requires more complex logic, e.g., storing hashed IPs with TTL.
  }

  async trackPasteViewed(clientIP: string) {
    const today = new Date().toISOString().split('T')[0];
    await this.incrementCounter(`analytics:views:${today}`);
  }

  async getStats(): Promise<AnalyticsStats> {
    // Fetch aggregated keys. KV listing might be paginated; consider limits.
    // For brevity, returning minimal skeleton. In production, build a better aggregation.
    return {
      totalShares: 0,
      totalViews: 0,
      languages: {},
      dailyStats: {},
    };
  }
}

Note: In production, consider sending events to an external analytics pipeline or use Durable Objects for counters to avoid KV race conditions and listing complexity. Approximate unique counts (e.g., HyperLogLog) can reduce storage.

⸻

Utilities Module (core/utils.ts)

Common helpers: language detection, time utilities, response utilities (CORS, security headers), etc.

// src/core/utils.ts

// Language detection based on simple regex patterns
export class LanguageDetector {
  private static patterns: Record<string, RegExp[]> = {
    json: [/^\s*[\{\[]/, /"[\w-]+"\s*:\s*".*"/],
    javascript: [/function\s+\w+\s*\(/, /const\s+\w+\s*=/, /=>\s*\{/],
    python: [/def\s+\w+\s*\(/, /import\s+\w+/, /print\s*\(/],
    sql: [/SELECT\s+.*\s+FROM/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i],
    shell: [/^#!/, /\$\w+/, /echo\s+/],
    css: [/\w+\s*\{[^}]*\}/, /@media/, /\.\w+\s*\{/],
    html: [/<html/i, /<div/, /<script/],
    markdown: [/#\s+/, /\*\*/, /`{3}/],
  };

  static detect(content: string): string {
    const scores: Record<string, number> = {};
    for (const [lang, patterns] of Object.entries(this.patterns)) {
      let score = 0;
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) score += matches.length;
      }
      if (score > 0) {
        scores[lang] = score;
      }
    }
    if (Object.keys(scores).length === 0) return 'text';
    // Return language with highest score
    return Object.entries(scores).reduce((prev, curr) => (curr[1] > prev[1] ? curr : prev))[0];
  }
}

// Time utilities
export class TimeUtils {
  // Return ISO string after adding seconds
  static getExpiryDate(seconds: number): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  // Format expiry duration in human-friendly form
  static formatExpiry(seconds: number): string {
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }
}

// Response utilities: CORS and security headers
export class ResponseUtils {
  private static commonHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self';",
  };

  static json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...this.commonHeaders, 'Content-Type': 'application/json' },
    });
  }

  static html(content: string, status = 200): Response {
    return new Response(content, {
      status,
      headers: { ...this.commonHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  static error(message: string, status = 400): Response {
    return this.json({ success: false, error: message }, status);
  }
}

Note: Ensure consistent UTC timestamps. Language detection is heuristic; if misclassifications matter, allow user override. The Content-Security-Policy can be tightened per requirements.

⸻

Handler Modules

Handlers process HTTP requests, validate input, coordinate with core modules, and return responses.

Create Handler (handlers/create.ts)

Handles POST /create. Validates input, enforces rate limiting, creates paste, tracks analytics, returns JSON with share URL and metadata.

// src/handlers/create.ts
import { Request } from '@cloudflare/workers-types';
import { IStorage, PasteData } from '../core/storage';
import { IAnalytics } from '../core/analytics';
import { SecurityManager } from '../core/security';
import { LanguageDetector, TimeUtils, ResponseUtils } from '../core/utils';
import { CONFIG } from '../config/constants';

export class CreateHandler {
  private storage: IStorage;
  private analytics: IAnalytics;
  private security: SecurityManager;

  constructor(storage: IStorage, analytics: IAnalytics) {
    this.storage = storage;
    this.analytics = analytics;
    this.security = new SecurityManager();
  }

  async handle(request: Request, clientIP: string): Promise<Response> {
    // Rate limiting should be enforced here via a robust mechanism (Durable Object or Cloudflare Rate Limiting)
    // For placeholder, skip or log warning.
    try {
      const data = await request.json();
      const titleRaw = (data.title as string | undefined) || '';
      const title = titleRaw.trim().slice(0, CONFIG.MAX_TITLE_LENGTH);
      const content = (data.content as string | undefined)?.trim() || '';
      const languageInput = (data.language as string | undefined) || '';
      const expiresInRaw = Number(data.expires_in ?? data.expires ?? CONFIG.EXPIRY_OPTIONS['1h']);
      const expiresIn = isNaN(expiresInRaw) ? CONFIG.EXPIRY_OPTIONS['1h'] : expiresInRaw;

      // Validate content
      const validation = this.security.validateContent(content, title, CONFIG.MAX_CONTENT_SIZE);
      if (!validation.valid) {
        return ResponseUtils.error(validation.error!);
      }
      // Determine language
      let language = languageInput;
      if (!language) {
        language = LanguageDetector.detect(content);
      }
      if (!CONFIG.SUPPORTED_LANGUAGES.includes(language)) {
        language = 'text';
      }

      // Compute expiry
      let expiresAt: string | undefined;
      if (expiresIn > 0) {
        // Enforce min/max expiry if desired
        expiresAt = TimeUtils.getExpiryDate(expiresIn);
      }
      const size = new TextEncoder().encode(content).length;

      // Create paste
      const paste = await this.storage.createPaste({
        title: title || 'Untitled Share',
        content,
        language,
        expiresAt,
        size,
      });

      // Track analytics (async, but do await or not based on requirement)
      await this.analytics.trackPasteCreated(paste.language, clientIP);

      // Build share URL
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;
      return ResponseUtils.json({
        success: true,
        id: paste.id,
        shareUrl: `${baseUrl}/s/${paste.id}`,
        title: paste.title,
        language: paste.language,
        expiresAt: paste.expiresAt,
        size: paste.size,
      });
    } catch (err) {
      console.error('CreateHandler error:', err);
      return ResponseUtils.error('Invalid request data', 400);
    }
  }
}

Improvement: Enforce rate limiting via Durable Object or Cloudflare Rate Limiting (outside code). Use custom error classes for validation errors. Validate expires_in within allowed options. Log structured messages.

⸻

View Handler (handlers/view.ts)

Handles GET /s/:id. Fetch paste, check existence, expiry, consume (delete) if valid, track analytics, render HTML.

// src/handlers/view.ts
import { Request } from '@cloudflare/workers-types';
import { IStorage, PasteData } from '../core/storage';
import { IAnalytics } from '../core/analytics';
import { SecurityManager } from '../core/security';
import { ResponseUtils } from '../core/utils';
import { ViewTemplate } from '../ui/templates/view';
import { ErrorTemplate } from '../ui/templates/error';

export class ViewHandler {
  private storage: IStorage;
  private analytics: IAnalytics;
  private security: SecurityManager;

  constructor(storage: IStorage, analytics: IAnalytics) {
    this.storage = storage;
    this.analytics = analytics;
    this.security = new SecurityManager();
  }

  async handle(request: Request, path: string, clientIP: string): Promise<Response> {
    try {
      const parts = path.split('/');
      const pasteId = parts[2];
      if (!pasteId) {
        return ResponseUtils.html(ErrorTemplate.notFound());
      }
      // Fetch without deleting to check expiry
      const paste = await this.storage.getPaste(pasteId);
      if (!paste || paste.consumed) {
        return ResponseUtils.html(ErrorTemplate.notFound());
      }
      const now = new Date();
      if (paste.expiresAt && new Date(paste.expiresAt) <= now) {
        // Optionally delete expired paste
        await this.storage.deletePaste(pasteId);
        return ResponseUtils.html(ErrorTemplate.expired());
      }
      // Consume paste
      const consumedPaste = await this.storage.consumePaste(pasteId);
      if (!consumedPaste) {
        return ResponseUtils.html(ErrorTemplate.notFound());
      }
      // Track analytics
      await this.analytics.trackPasteViewed(clientIP);
      // Render view with escaped content
      return ResponseUtils.html(ViewTemplate.render(consumedPaste));
    } catch (err) {
      console.error('ViewHandler error:', err);
      return ResponseUtils.html(ErrorTemplate.serverError());
    }
  }
}

Note: Consuming after checking expiry ensures expired items aren’t consumed inadvertently. Structured error handling helps debug issues. Ensure templates escape content to prevent XSS.

⸻

Stats Handler (handlers/stats.ts) (Optional)

Handles GET /stats. Returns JSON analytics.

// src/handlers/stats.ts
import { Request } from '@cloudflare/workers-types';
import { IAnalytics } from '../core/analytics';
import { ResponseUtils } from '../core/utils';

export class StatsHandler {
  private analytics: IAnalytics;

  constructor(analytics: IAnalytics) {
    this.analytics = analytics;
  }

  async handle(request: Request): Promise<Response> {
    try {
      const stats = await this.analytics.getStats();
      return ResponseUtils.json({ success: true, stats });
    } catch (err) {
      console.error('StatsHandler error:', err);
      return ResponseUtils.error('Unable to fetch stats', 500);
    }
  }
}

Note: If public, consider rate limiting or authentication. Otherwise, internal admin endpoint.

⸻

UI Components & Templates

Templates render HTML for pages. Use simple string templates or a minimal templating helper. Ensure proper escaping.

Home Template (ui/templates/home.ts)

Renders homepage with form. Optionally display stats from analytics.

// src/ui/templates/home.ts

export class HomeTemplate {
  static render(stats?: { totalShares?: number; totalViews?: number }) {
    const shares = stats?.totalShares ?? 0;
    const views = stats?.totalViews ?? 0;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔐 Secure Paste Share</title>
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/components.css">
</head>
<body>
  <div class="container">
    <header class="hero">
      <h1>🔐 Secure Paste Share</h1>
      <p>Create secure, one-time share links for sensitive data</p>
    </header>
    <main class="content">
      <form id="pasteForm" class="paste-form">
        <div class="form-group">
          <label for="title">📝 Title (optional)</label>
          <input type="text" id="title" placeholder="My secret data..." maxlength="${/*CONFIG.MAX_TITLE_LENGTH*/200}">
        </div>
        <div class="form-group">
          <label for="content">📄 Content</label>
          <textarea id="content" required placeholder="Paste your sensitive data here..."></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="language">🗣️ Language</label>
            <select id="language">
              <option value="">Auto-detect</option>
              <option value="text">Plain Text</option>
              <option value="json">JSON</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="sql">SQL</option>
              <option value="shell">Shell/Bash</option>
              <option value="css">CSS</option>
              <option value="html">HTML</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>
          <div class="form-group">
            <label for="expires">⏰ Expires In</label>
            <select id="expires">
              <option value="3600">1 hour</option>
              <option value="21600">6 hours</option>
              <option value="86400">1 day</option>
              <option value="604800">1 week</option>
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-large">
          🚀 Create Secure Share Link
        </button>
      </form>
      <div class="features">
        <h3>🛡️ Security Features</h3>
        <ul>
          <li>✅ One-time view only</li>
          <li>✅ Automatic expiration</li>
          <li>✅ No permanent storage</li>
          <li>✅ Emoji support 🎉</li>
          <li>✅ Syntax highlighting</li>
        </ul>
      </div>
      <div class="stats">
        <p>Total Shares: ${shares.toLocaleString()}</p>
        <p>Total Views: ${views.toLocaleString()}</p>
      </div>
    </main>
  </div>
  <script src="/scripts/form.js"></script>
</body>
</html>`;
  }
}

Accessibility: <html lang="en">. Add ARIA live regions for notifications in scripts. Ensure placeholders and labels are descriptive. Character counter script appended later.

⸻

Success Template (ui/templates/success.ts)

Renders success page after creation, showing share URL, metadata, countdown to expiry.

// src/ui/templates/success.ts

export interface SuccessData {
  id: string;
  shareUrl: string;
  title: string;
  language: string;
  expiresAt?: string; // ISO
  size: number;
}

export class SuccessTemplate {
  render(data: SuccessData) {
    // Compute human-friendly expiry on client via JS; here embed expiresAt
    const expiresAt = data.expiresAt ? new Date(data.expiresAt).toISOString() : null;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paste Created</title>
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/components.css">
</head>
<body>
  <div class="container">
    <div class="success-container">
      <h2>✅ Paste Created Successfully!</h2>
      <div class="paste-meta">
        <p><strong>Title:</strong> ${data.title}</p>
        <p><strong>Language:</strong> ${data.language}</p>
        <p><strong>Size:</strong> ${data.size.toLocaleString()} bytes</p>
        ${expiresAt ? `<p><strong>Expires At:</strong> <span id="expiresAt">${expiresAt}</span></p>` : ''}
      </div>
      <div class="share-section">
        <p>Share URL:</p>
        <div class="url-display">
          <input type="text" id="shareUrl" readonly value="${data.shareUrl}">
          <button id="copyBtn" class="btn btn-secondary">Copy</button>
        </div>
      </div>
      ${expiresAt ? `<p id="countdown"></p>` : ''}
      <div>
        <a href="/" class="btn btn-primary">Create Another Paste</a>
      </div>
    </div>
  </div>
  <script>
    // Clipboard copy
    document.getElementById('copyBtn')?.addEventListener('click', () => {
      const input = document.getElementById('shareUrl') as HTMLInputElement;
      input.select();
      navigator.clipboard.writeText(input.value).then(() => {
        alert('Copied to clipboard');
      });
    });
    // Countdown to expiry
    ${expiresAt ? `
    (function() {
      const expiresAt = new Date('${expiresAt}');
      const countdownEl = document.getElementById('countdown');
      function update() {
        const now = new Date();
        const diff = expiresAt.getTime() - now.getTime();
        if (diff <= 0) {
          countdownEl!.textContent = 'This link has expired.';
          clearInterval(interval);
          return;
        }
        const minutes = Math.floor(diff / 60000) % 60;
        const hours = Math.floor(diff / 3600000) % 24;
        const days = Math.floor(diff / 86400000);
        let text = 'Expires in ';
        if (days) text += days + 'd ';
        if (hours) text += hours + 'h ';
        text += minutes + 'm';
        countdownEl!.textContent = text;
      }
      update();
      const interval = setInterval(update, 60000);
    })();
    ` : ''}
  </script>
</body>
</html>`;
  }
}

Improvement: Use ARIA alerts for copy confirmation instead of alert(). For brevity, using alert. Could refine with inline notification UI.
Ensure URL is properly escaped.

⸻

View Template (ui/templates/view.ts)

Renders the paste content in <pre>, escaped, with syntax highlighting if desired.

// src/ui/templates/view.ts
import { SecurityManager } from '../../core/security';

export class ViewTemplate {
  static render(paste: {
    id: string;
    title: string;
    content: string;
    language: string;
    createdAt: string;
    expiresAt?: string;
    size: number;
  }) {
    const esc = new SecurityManager().escapeHtml(paste.content);
    // If using Prism.js or other, include appropriate CSS/JS.
    // For simplicity, render raw in <pre>
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>View Paste</title>
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/components.css">
  <!-- Optionally include syntax highlighting library -->
</head>
<body>
  <div class="container">
    <div class="content-container">
      <div class="content-header">
        <h2>${SecurityManager.prototype.escapeHtml(paste.title)}</h2>
        <span class="language-badge">${paste.language}</span>
      </div>
      <div class="paste-preview">
        <pre>${esc}</pre>
      </div>
      <div class="paste-meta">
        <p><strong>Size:</strong> ${paste.size.toLocaleString()} bytes</p>
        <p><strong>Created At:</strong> ${new Date(paste.createdAt).toLocaleString()}</p>
      </div>
      <div class="destruction-notice">
        This paste has been destroyed and cannot be viewed again.
      </div>
      <div class="action-buttons">
        <a href="/" class="btn btn-primary">Create New Paste</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}

Note: Ensure content is escaped. For syntax highlighting, include library after escaping, e.g., <script> for Prism. Could lazy-load highlighting only if language is recognized.
The destruction notice indicates one-time view.

⸻

Error Template (ui/templates/error.ts)

Renders common error pages: 404 Not Found, Expired, Server Error.

// src/ui/templates/error.ts

export class ErrorTemplate {
  static notFound() {
    return ErrorTemplate.render('Paste Not Found', 'The requested paste does not exist or has already been viewed.');
  }

  static expired() {
    return ErrorTemplate.render('Paste Expired', 'This paste has expired and is no longer available.');
  }

  static serverError() {
    return ErrorTemplate.render('Server Error', 'An unexpected error occurred. Please try again later.');
  }

  private static render(title: string, message: string) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/styles/base.css">
  <link rel="stylesheet" href="/styles/components.css">
</head>
<body>
  <div class="container">
    <div class="content-container">
      <div class="warning-box">
        <h2>${title}</h2>
        <p>${message}</p>
      </div>
      <div class="action-buttons">
        <a href="/" class="btn btn-primary">Home</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}

Templates are simple; consider extracting common header/footer if many pages share structure.

⸻

Styles

Base Styles (ui/styles/base.css)

/* ui/styles/base.css */
/* Base styles and CSS variables */
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

/* Typography */
h1, h2, h3 { font-weight: 700; }
h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }

/* Responsive design */
@media (max-width: 768px) {
  .container { margin: 10px; border-radius: 12px; }
  h1 { font-size: 2rem; }
  .form-row { grid-template-columns: 1fr; }
}

/* Utility classes */
.hidden { display: none !important; }
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
/* ...add more as needed */

Consider dark mode variables or CSS custom properties for theming. Ensure color contrast meets WCAG.

⸻

Component Styles (ui/styles/components.css)

/* ui/styles/components.css */

/* Hero section */
.hero {
  background: var(--primary-gradient);
  color: white;
  padding: 40px 30px;
  text-align: center;
}

.hero h1 { margin-bottom: 10px; }
.hero p { font-size: 1.2em; opacity: 0.9; }

/* Content area */
.content { padding: 40px 30px; }

/* Forms */
.paste-form { margin-bottom: 40px; }
.form-group { margin-bottom: 25px; }
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

/* Buttons */
.btn {
  display: inline-block;
  padding: 12px 24px;
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

.btn:hover { transform: translateY(-2px); }

.btn-primary {
  background: var(--primary-gradient);
  color: white;
}

.btn-secondary {
  background: var(--text-muted);
  color: white;
}

.btn-success {
  background: var(--success-color);
  color: white;
}

.btn-danger {
  background: var(--danger-color);
  color: white;
}

.btn-large {
  width: 100%;
  padding: 18px;
  font-size: 18px;
}

/* Features list */
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

/* Success page */
.success-container {
  padding: 40px 30px;
  text-align: center;
}

.paste-preview {
  background: var(--light-bg);
  padding: 25px;
  border-radius: var(--border-radius);
  margin: 30px 0;
  text-align: left;
}

.paste-meta {
  color: var(--text-muted);
  font-size: 0.9em;
  margin: 10px 0;
}

/* Share section */
.share-section {
  margin: 30px 0;
}

.url-display {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.url-display input {
  flex: 1;
  font-family: monospace;
  background: var(--light-bg);
}

.share-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 20px;
}

/* Content display */
.content-container {
  padding: 30px;
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color);
}

.language-badge {
  background: var(--primary-color);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 0.9em;
}

pre {
  background: var(--light-bg);
  padding: 20px;
  border-radius: var(--border-radius);
  overflow-x: auto;
  border: 1px solid var(--border-color);
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 14px;
  line-height: 1.5;
}

/* Notices and alerts */
.destruction-notice {
  background: linear-gradient(135deg, var(--danger-color) 0%, #c0392b 100%);
  color: white;
  padding: 20px;
  text-align: center;
  font-weight: 600;
  font-size: 1.1em;
}

.security-info {
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
  padding: 20px;
  margin: 20px 0;
  border-radius: var(--border-radius);
  text-align: center;
}

.warning-box {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 20px;
  border-radius: var(--border-radius);
  margin: 20px 0;
}

/* Action buttons */
.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  padding: 30px;
  border-top: 1px solid var(--border-color);
}

/* Loading states */
.loading {
  opacity: 0.6;
  pointer-events: none;
}

.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Character counter */
.character-counter {
  font-size: 0.9em;
  color: var(--text-muted);
  margin-top: 5px;
  text-align: right;
}

Ensure CSS is minified in production. Consider dark mode variables if desired.

⸻

Client Scripts (ui/scripts)

Write in TypeScript, bundle to JavaScript for deployment. Use modern APIs (Fetch, Clipboard). Ensure accessibility (focus states, ARIA).

Form Script (ui/scripts/form.ts)

Handles form submission, validation, loading states, error/success display.

// src/ui/scripts/form.ts

class PasteForm {
  private form: HTMLFormElement;
  private submitBtn: HTMLButtonElement;
  private notificationContainer: HTMLElement;

  constructor() {
    this.form = document.getElementById('pasteForm') as HTMLFormElement;
    this.submitBtn = this.form.querySelector('button[type="submit"]') as HTMLButtonElement;
    this.notificationContainer = this.form;
    this.init();
  }

  init() {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    // Auto-resize textarea
    const textarea = this.form.querySelector('#content') as HTMLTextAreaElement;
    textarea.addEventListener('input', this.autoResize.bind(this));
    // Character counter
    this.addCharacterCounter(textarea);
    // Disable submit if empty
    textarea.addEventListener('input', () => {
      this.submitBtn.disabled = textarea.value.trim().length === 0;
    });
    this.submitBtn.disabled = true;
  }

  async handleSubmit(e: Event) {
    e.preventDefault();
    this.clearNotifications();
    this.setLoading(true);

    const formData = {
      title: (this.form.querySelector('#title') as HTMLInputElement).value.trim(),
      content: (this.form.querySelector('#content') as HTMLTextAreaElement).value.trim(),
      language: (this.form.querySelector('#language') as HTMLSelectElement).value,
      expires_in: parseInt((this.form.querySelector('#expires') as HTMLSelectElement).value),
    };

    try {
      const response = await fetch('/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        this.showSuccessPage(result);
      } else {
        this.showError(result.error || 'Unknown error');
      }
    } catch (error: any) {
      this.showError('Network error: ' + error.message);
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(loading: boolean) {
    this.submitBtn.disabled = loading;
    if (loading) {
      this.submitBtn.innerHTML = '<span class="spinner"></span> Creating...';
    } else {
      this.submitBtn.innerHTML = '🚀 Create Secure Share Link';
    }
  }

  showError(message: string) {
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `❌ ${message}`;
    this.notificationContainer.insertBefore(notification, this.notificationContainer.firstChild);
    // Auto-remove after 5 seconds
    setTimeout(() => notification.remove(), 5000);
  }

  showSuccessPage(result: any) {
    // Replace body content with success page HTML
    document.body.innerHTML = new SuccessTemplate().render(result);
  }

  autoResize(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  addCharacterCounter(textarea: HTMLTextAreaElement) {
    const counter = document.createElement('div');
    counter.className = 'character-counter';
    textarea.parentNode?.appendChild(counter);

    const updateCounter = () => {
      const length = textarea.value.length;
      const maxLength = 1024 * 1024; // 1MB
      counter.textContent = `${length.toLocaleString()} / ${maxLength.toLocaleString()} characters`;
      counter.style.color = length > maxLength * 0.9 ? '#e74c3c' : '#6c757d';
    };
    textarea.addEventListener('input', updateCounter);
    updateCounter();
  }

  clearNotifications() {
    const existing = this.notificationContainer.querySelectorAll('.notification');
    existing.forEach((el) => el.remove());
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PasteForm();
});

Bundle this with a tool like esbuild or Rollup. Ensure SuccessTemplate is imported or included. Consider code-splitting if including syntax highlighting libraries.

⸻

Clipboard Script (ui/scripts/clipboard.ts)

Utility for copying text to clipboard. May be integrated into share script or templates.

// src/ui/scripts/clipboard.ts

export function copyTextToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard) {
    return Promise.reject(new Error('Clipboard API not supported'));
  }
  return navigator.clipboard.writeText(text);
}

// Usage in templates:
// copyTextToClipboard(url).then(() => show notification);


⸻

Share Script (ui/scripts/share.ts)

Utility for sharing via Web Share API or showing share buttons.

// src/ui/scripts/share.ts

export function setupShareButton(buttonId: string, url: string) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: 'Secure Paste', url });
      } catch (err) {
        console.warn('Web Share failed', err);
      }
    } else {
      // Fallback: copy URL
      try {
        await copyTextToClipboard(url);
        alert('Link copied to clipboard');
      } catch {
        alert('Unable to share; please copy the link manually.');
      }
    }
  });
}

Ensure accessibility labels on share buttons. Import copyTextToClipboard from clipboard script.

⸻

Configuration

Constants (config/constants.ts)

Holds application constants, pulled from environment variables where appropriate.

// src/config/constants.ts

export const CONFIG = {
  MAX_CONTENT_SIZE: 1024 * 1024, // 1MB
  MAX_TITLE_LENGTH: 200,
  // Expiration options (seconds)
  EXPIRY_OPTIONS: {
    '1h': 3600,
    '6h': 21600,
    '1d': 86400,
    '1w': 604800,
  },
  SUPPORTED_LANGUAGES: [
    'text', 'json', 'javascript', 'python',
    'sql', 'shell', 'css', 'html', 'markdown',
  ],
  // Rate limiting config keys, if using Durable Object or external
  // CLEANUP_INTERVAL not needed if using KV TTL + Cron Trigger
  ANALYTICS_RETENTION_DAYS: 30,
};

If reading from environment variables (e.g., via Wrangler secrets), override defaults here.

⸻

Wrangler Configuration (wrangler.toml)

Configure Worker, KV namespace bindings, scheduled triggers.

# wrangler.toml
name = "secure-paste-share"
main = "dist/worker.js"  # Built output
compatibility_date = "2025-06-21"

# Define KV namespace binding
[[kv_namespaces]]
binding = "PASTE_KV"
id = "<your-kv-namespace-id>"

# (Optional) KV for analytics
[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "<analytics-kv-id>"

# (Optional) Durable Object for rate limiting
# [[durable_objects]]
# binding = "RATE_LIMIT_DO"
# class_name = "RateLimitDO"

# Scheduled trigger for any cleanup or periodic tasks (if needed)
# E.g., run every 5 minutes
# [triggers]
# crons = ["*/5 * * * *"]

# Routes (if using custom domains)
# [routes]
# pattern = "https://example.com/*"
# zone_id = "..."

[build]
  command = "npm run build"  # e.g., builds TS to dist/
  upload_format = "service-worker"
  upload_dir = "dist"

Replace <your-kv-namespace-id> with actual IDs. If using Durable Objects for rate limiting or one-time semantics, bind here. Use scheduled triggers if performing tasks beyond KV TTL.

⸻

Main Worker (worker.ts)

Entry point for fetch events. Routes requests to handlers.

// src/worker.ts
import { KVStorage } from './core/storage';
import { InMemoryAnalytics, KVAnalytics } from './core/analytics';
import { CreateHandler } from './handlers/create';
import { ViewHandler } from './handlers/view';
import { StatsHandler } from './handlers/stats';
import { HomeTemplate } from './ui/templates/home';
import { ResponseUtils } from './core/utils';
import { CONFIG } from './config/constants';

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Bind KV namespace
    const storage = new KVStorage(env.PASTE_KV as KVNamespace);
    // Choose analytics implementation
    // const analytics = new KVAnalytics(env.ANALYTICS_KV as KVNamespace);
    const analytics = new InMemoryAnalytics(); // for dev; replace in prod

    const createHandler = new CreateHandler(storage, analytics);
    const viewHandler = new ViewHandler(storage, analytics);
    const statsHandler = new StatsHandler(analytics);

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: ResponseUtils['commonHeaders'] || {} });
    }

    try {
      if (method === 'GET' && path === '/') {
        // Render homepage with stats
        const stats = await analytics.getStats();
        return ResponseUtils.html(HomeTemplate.render(stats));
      }
      if (method === 'POST' && path === '/create') {
        return await createHandler.handle(request, clientIP);
      }
      if (method === 'GET' && path.startsWith('/s/')) {
        return await viewHandler.handle(request, path, clientIP);
      }
      if (method === 'GET' && path === '/stats') {
        return await statsHandler.handle(request);
      }
      // Static assets (styles, scripts)
      // Note: In Workers, static assets typically served via separate route or KV assets binding.
      // For simplicity, assume assets are served elsewhere or via Workers Sites.
      return ResponseUtils.error('Not Found', 404);
    } catch (err) {
      console.error('Worker error:', err);
      return ResponseUtils.error('Internal Server Error', 500);
    }
  },
};

Improvement: Instantiate analytics once per Worker, not per request; use global variables or Durable Objects. Avoid creating new InMemoryAnalytics on each request in production. For KVAnalytics, ensure KV reads/writes are efficient. Consider caching analytics reads for homepage rendering.
Static assets (CSS/JS) may be served via a separate binding (e.g., Workers Sites or KV asset binding).

⸻

Scheduled/Cleanup Worker (scheduled.ts)

If any periodic task needed beyond KV TTL, define a scheduled handler. For example, cleaning auxiliary data. If KV TTL covers paste expiration, scheduled tasks may handle analytics aggregation or other maintenance.

// src/scheduled.ts

import { KVStorage } from './core/storage';
import { CONFIG } from './config/constants';

export default {
  async scheduled(event: ScheduledEvent, env: any, ctx: any) {
    // Example: If using manual cleanup (not needed if KV TTL used)
    const storage = new KVStorage(env.PASTE_KV as KVNamespace);
    // If list and delete expired manually (not recommended for KV TTL)
    // await storage.cleanupExpired();
    // Example: Rotate analytics, purge old entries beyond retention
    // Implement as needed.
    console.log('Scheduled event triggered at', new Date().toISOString());
  },
};

Note: With KV TTL, explicit cleanup not required. Use scheduled events for analytics rollups or other tasks.

⸻

Build & Tooling
	•	TypeScript Compilation: Use tsconfig.json targeting ES2020 or appropriate.
	•	Bundler: Use esbuild, Rollup, or similar to bundle code into a single dist/worker.js. Minify for production.
	•	Linting: ESLint with TypeScript plugin; Prettier for formatting.
	•	Environment Variables: Manage secrets (e.g., encryption keys) via Wrangler secrets.
	•	Local Development: Use Miniflare to emulate Workers environment; mock KV namespaces.
	•	Static Assets: Bundle CSS/JS and upload via Workers Sites or external CDN. Configure in Wrangler.

Example package.json scripts:

{
  "scripts": {
    "build": "esbuild src/worker.ts src/scheduled.ts src/ui/scripts/form.ts --bundle --outdir=dist --platform=browser --target=es2020",
    "lint": "eslint 'src/**/*.{ts,js}'",
    "type-check": "tsc --noEmit",
    "dev": "miniflare --watch src --kv PASTE_KV --kv ANALYTICS_KV",
    "publish": "wrangler publish"
  },
  "devDependencies": {
    "esbuild": "^0.17.0",
    "typescript": "^4.0.0",
    "eslint": "^7.0.0",
    "@cloudflare/workers-types": "^4.0.0",
    "miniflare": "^2.0.0"
  }
}

Adjust bundler config for scripts in ui/scripts: bundle separately or inline. Ensure Worker code and client code are built appropriately.

⸻

Testing & CI/CD
	1.	Unit Tests
	•	Test core modules: storage (with a mock KV), security validation patterns, utils (language detection edge cases, time utils).
	•	Use Jest or similar with mocking for KVNamespace. For Durable Objects, mock state.
	2.	Integration Tests
	•	Use Miniflare to spin up local Worker, test create+view flows (e.g., via supertest-like HTTP calls).
	•	Test expiry behavior, one-time view, invalid IDs.
	3.	E2E Tests
	•	If hosting front-end, use Playwright or Puppeteer to simulate user interactions: submit paste, copy link, view paste.
	4.	Lint & Type-Check
	•	Run ESLint and tsc --noEmit in CI.
	5.	Security Scanning
	•	Dependabot or similar for dependency updates.
	6.	CI Pipeline
	•	On PR: run lint, type-check, unit tests.
	•	On merge to main: run build and publish via Wrangler (with proper environment).
	•	Use preview environments for testing.
	7.	Versioning & Changelog
	•	Tag releases, maintain CHANGELOG.md.

⸻

Security & Observability
	1.	Security Headers
	•	Implement in ResponseUtils: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
	2.	Rate Limiting
	•	Use Cloudflare Rate Limiting rules for /create and possibly view endpoints. Or Durable Object-based counters. Avoid in-memory maps.
	3.	ID Generation
	•	Use crypto.getRandomValues for secure random IDs.
	4.	Content Sanitization
	•	Escape HTML before inserting into templates. For syntax highlighting, escape then highlight.
	5.	Encryption at Rest (Optional)
	•	If storing highly sensitive data, encrypt content before storing in KV, decrypt on view. Manage keys via Wrangler secrets and Web Crypto API.
	•	Trade-off: searching or analytics on content impossible.
	6.	Logging & Monitoring
	•	Structured logs: JSON with event type, timestamp, paste ID (hashed or partial), but not full content.
	•	Emit logs to Cloudflare Logs or external aggregator.
	•	Monitor error rates, latencies.
	7.	Metrics
	•	Expose minimal /stats endpoint; consider authentication or restrict to internal.
	•	Push metrics to external service or use Cloudflare Analytics.
	8.	Health Checks
	•	Expose /healthz returning 200 OK. Use external monitor to ping.
	9.	Privacy & Compliance
	•	Document data retention (KV TTL). Ensure user awareness: paste is ephemeral, one-time.
	•	Avoid storing personal data beyond necessity.
	10.	Dependency Security
	•	Regularly audit dependencies. Keep libraries minimal.

⸻

Deployment & Environment
	1.	Wrangler Deploy
	•	Use wrangler publish with correct environment (production vs staging).
	•	Use secrets for any API keys or encryption keys: wrangler secret put KEY_NAME.
	2.	DNS & Domains
	•	Configure custom domain in Wrangler and Cloudflare dashboard.
	3.	KV Namespace Setup
	•	Create KV namespace(s) via Wrangler: wrangler kv:namespace create PASTE_KV.
	4.	Rate Limiting Rules
	•	In Cloudflare dashboard, add rate limit rules for /create endpoint to prevent abuse.
	5.	Analytics Binding
	•	If using external analytics, configure environment variables or service endpoints.
	6.	Environment Variables
	•	For different environments, manage via Wrangler environments: [env.production], [env.staging].
	7.	Monitoring & Alerts
	•	Set up alerts for Worker errors (e.g., via Logpush to external).
	8.	Rollbacks
	•	Tag previous versions so rollback possible if new deployment has issues.
	9.	Secrets & Keys
	•	Manage encryption keys, API keys as Wrangler secrets. Rotate periodically.
	10.	Documentation

	•	Provide README with setup steps: installing Wrangler, KV binding, secrets, build commands.

⸻

Future Extensions
	1.	Authentication & User Accounts
	•	Allow users to sign in (e.g., via OAuth or Cloudflare Access) to manage their pastes. Link pastes to user ID. Provide listing, manual deletion.
	2.	Password-Protected Pastes
	•	Generate random password or accept user-provided password; require password to view paste. Encrypt content under that password.
	3.	Multi-View or Limited-View Pastes
	•	Instead of one-time view, allow N views. Store counter in Durable Object or KV.
	4.	Admin Dashboard
	•	Separate dashboard to view analytics, search recent pastes (with opt-in), manage abuse.
	5.	Custom Expiry Options
	•	Allow custom expiry times beyond preset options; validate within min/max.
	6.	Notifications
	•	Optionally notify via email/webhook when paste is viewed. Requires collecting email or webhook URL at creation (privacy implications).
	7.	Internationalization (i18n)
	•	Localize UI strings; detect user locale.
	8.	Theming & Branding
	•	Light/dark mode toggle; customizable branding for deployments (e.g., white-label).
	9.	Syntax Highlighting Backend
	•	Perform syntax highlighting server-side and render static HTML; or client-side as currently.
	10.	Search Within Pastes (Admin)
	•	If allowing users to search their own pastes, index content (encrypted search is complex).
	11.	Analytics Enhancements
	•	More detailed analytics: geolocation (based on IP, with privacy considerations), device/browser stats. Use external analytics.
	12.	Rate Limiting Tiers
	•	Offer API keys for higher rate limits or paid plans.
	13.	Durable Object for One-Time Semantics
	•	If strict one-time consumption required, create a Durable Object per paste to ensure atomic operations.
	14.	Offline Support
	•	PWA enhancements: offline form caching, but sensitive data caution.
	15.	Integration
	•	Integrate with chat platforms (e.g., Slack app) to create paste directly from chat. Use API endpoints.
	16.	Mobile App
	•	Expose endpoints for mobile clients or a lightweight wrapper.

⸻

Appendix: Example Code Snippets & Utilities

Secure ID Generation

function generateId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => chars[b % chars.length])
    .join('');
}

ResponseUtils with Security Headers

export class ResponseUtils {
  private static commonHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self';",
  };

  static json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...this.commonHeaders, 'Content-Type': 'application/json' },
    });
  }
  static html(content: string, status = 200): Response {
    return new Response(content, {
      status,
      headers: { ...this.commonHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  static error(message: string, status = 400): Response {
    return this.json({ success: false, error: message }, status);
  }
}

Language Detector

export class LanguageDetector {
  private static patterns: Record<string, RegExp[]> = {
    json: [/^\s*[\{\[]/, /"[\w-]+"\s*:\s*".*"/],
    javascript: [/function\s+\w+\s*\(/, /const\s+\w+\s*=/, /=>\s*\{/],
    python: [/def\s+\w+\s*\(/, /import\s+\w+/, /print\s*\(/],
    sql: [/SELECT\s+.*\s+FROM/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i],
    shell: [/^#!/, /\$\w+/, /echo\s+/],
    css: [/\w+\s*\{[^}]*\}/, /@media/, /\.\w+\s*\{/],
    html: [/<html/i, /<div/, /<script/],
    markdown: [/#\s+/, /\*\*/, /`{3}/],
  };

  static detect(content: string): string {
    const scores: Record<string, number> = {};
    for (const [lang, patterns] of Object.entries(this.patterns)) {
      let score = 0;
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) score += matches.length;
      }
      if (score > 0) {
        scores[lang] = score;
      }
    }
    if (Object.keys(scores).length === 0) return 'text';
    return Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
}

Time Utilities

export class TimeUtils {
  static getExpiryDate(seconds: number): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }
  static formatExpiry(seconds: number): string {
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }
}


⸻

This blueprint is designed to be a comprehensive foundation. Adapt modules, integrations, and configurations based on specific requirements, scale, and security posture. Feel free to iterate: start with the minimal viable version (TypeScript, KVStorage with TTL, simple templates, basic rate limiting via Cloudflare rules), then progressively add analytics persistence, durable objects, encryption, user accounts, etc.