export interface AppConfig {
  // Content limits
  MAX_CONTENT_SIZE: number;
  MAX_TITLE_LENGTH: number;

  // Expiration options (in seconds)
  EXPIRY_OPTIONS: Record<string, number>;
  MIN_EXPIRY: number;
  MAX_EXPIRY: number;
  DEFAULT_EXPIRY: string;

  // Supported languages
  SUPPORTED_LANGUAGES: string[];

  // Security settings
  SECURITY: {
    SUSPICIOUS_PATTERNS_ENABLED: boolean;
    STRICT_VALIDATION: boolean;
    RATE_LIMITING_ENABLED: boolean;
    MAX_REQUESTS_PER_MINUTE: number;
    MAX_REQUESTS_PER_HOUR: number;
  };

  // Analytics settings
  ANALYTICS: {
    RETENTION_DAYS: number;
    TRACK_GEOGRAPHY: boolean;
    TRACK_USER_AGENT: boolean;
    AGGREGATE_HOURLY: boolean;
  };

  // UI settings
  UI: {
    THEME: 'light' | 'dark' | 'auto';
    SHOW_STATS: boolean;
    ENABLE_SYNTAX_HIGHLIGHTING: boolean;
    DEFAULT_LANGUAGE: string;
  };

  // Performance settings
  PERFORMANCE: {
    ENABLE_COMPRESSION: boolean;
    CACHE_STATIC_ASSETS: boolean;
    CACHE_MAX_AGE: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: AppConfig = {
  MAX_CONTENT_SIZE: 1024 * 1024, // 1MB
  MAX_TITLE_LENGTH: 200,

  EXPIRY_OPTIONS: {
    '5m': 300, // 5 minutes
    '1h': 3600, // 1 hour
    '6h': 21600, // 6 hours
    '1d': 86400, // 1 day
    '1w': 604800, // 1 week
    '1m': 2592000, // 1 month (30 days)
  },
  MIN_EXPIRY: 300, // 5 minutes
  MAX_EXPIRY: 2592000, // 1 month
  DEFAULT_EXPIRY: '1d', // 1 day default

  SUPPORTED_LANGUAGES: [
    'text',
    'json',
    'javascript',
    'typescript',
    'python',
    'java',
    'sql',
    'shell',
    'bash',
    'css',
    'html',
    'xml',
    'markdown',
    'yaml',
    'dockerfile',
    'go',
    'rust',
    'cpp',
    'c',
    'php',
    'ruby',
    'swift',
    'kotlin',
    'scala',
    'r',
    'matlab',
    'powershell',
  ],

  SECURITY: {
    SUSPICIOUS_PATTERNS_ENABLED: true,
    STRICT_VALIDATION: false,
    RATE_LIMITING_ENABLED: true,
    MAX_REQUESTS_PER_MINUTE: 20,
    MAX_REQUESTS_PER_HOUR: 100,
  },

  ANALYTICS: {
    RETENTION_DAYS: 30,
    TRACK_GEOGRAPHY: false,
    TRACK_USER_AGENT: false,
    AGGREGATE_HOURLY: true,
  },

  UI: {
    THEME: 'auto',
    SHOW_STATS: true,
    ENABLE_SYNTAX_HIGHLIGHTING: true,
    DEFAULT_LANGUAGE: 'text',
  },

  PERFORMANCE: {
    ENABLE_COMPRESSION: true,
    CACHE_STATIC_ASSETS: true,
    CACHE_MAX_AGE: 31536000, // 1 year
  },
};

// Environment variable mappings
function getEnvNumber(key: string, defaultValue: number): number {
  const value = (globalThis as any).process?.env?.[key] || (globalThis as any)[key];
  return value ? parseInt(value) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = (globalThis as any).process?.env?.[key] || (globalThis as any)[key];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function getEnvString(key: string, defaultValue: string): string {
  const value = (globalThis as any).process?.env?.[key] || (globalThis as any)[key];
  return value || defaultValue;
}

// Create configuration with environment variable overrides
export const CONFIG: AppConfig = {
  MAX_CONTENT_SIZE: getEnvNumber('MAX_CONTENT_SIZE', DEFAULT_CONFIG.MAX_CONTENT_SIZE),
  MAX_TITLE_LENGTH: getEnvNumber('MAX_TITLE_LENGTH', DEFAULT_CONFIG.MAX_TITLE_LENGTH),

  EXPIRY_OPTIONS: DEFAULT_CONFIG.EXPIRY_OPTIONS,
  MIN_EXPIRY: getEnvNumber('MIN_EXPIRY', DEFAULT_CONFIG.MIN_EXPIRY),
  MAX_EXPIRY: getEnvNumber('MAX_EXPIRY', DEFAULT_CONFIG.MAX_EXPIRY),
  DEFAULT_EXPIRY: getEnvString('DEFAULT_EXPIRY', DEFAULT_CONFIG.DEFAULT_EXPIRY),

  SUPPORTED_LANGUAGES: DEFAULT_CONFIG.SUPPORTED_LANGUAGES,

  SECURITY: {
    SUSPICIOUS_PATTERNS_ENABLED: getEnvBoolean(
      'SUSPICIOUS_PATTERNS_ENABLED',
      DEFAULT_CONFIG.SECURITY.SUSPICIOUS_PATTERNS_ENABLED,
    ),
    STRICT_VALIDATION: getEnvBoolean(
      'STRICT_VALIDATION',
      DEFAULT_CONFIG.SECURITY.STRICT_VALIDATION,
    ),
    RATE_LIMITING_ENABLED: getEnvBoolean(
      'RATE_LIMITING_ENABLED',
      DEFAULT_CONFIG.SECURITY.RATE_LIMITING_ENABLED,
    ),
    MAX_REQUESTS_PER_MINUTE: getEnvNumber(
      'MAX_REQUESTS_PER_MINUTE',
      DEFAULT_CONFIG.SECURITY.MAX_REQUESTS_PER_MINUTE,
    ),
    MAX_REQUESTS_PER_HOUR: getEnvNumber(
      'MAX_REQUESTS_PER_HOUR',
      DEFAULT_CONFIG.SECURITY.MAX_REQUESTS_PER_HOUR,
    ),
  },

  ANALYTICS: {
    RETENTION_DAYS: getEnvNumber(
      'ANALYTICS_RETENTION_DAYS',
      DEFAULT_CONFIG.ANALYTICS.RETENTION_DAYS,
    ),
    TRACK_GEOGRAPHY: getEnvBoolean('TRACK_GEOGRAPHY', DEFAULT_CONFIG.ANALYTICS.TRACK_GEOGRAPHY),
    TRACK_USER_AGENT: getEnvBoolean('TRACK_USER_AGENT', DEFAULT_CONFIG.ANALYTICS.TRACK_USER_AGENT),
    AGGREGATE_HOURLY: getEnvBoolean('AGGREGATE_HOURLY', DEFAULT_CONFIG.ANALYTICS.AGGREGATE_HOURLY),
  },

  UI: {
    THEME: getEnvString('UI_THEME', DEFAULT_CONFIG.UI.THEME) as 'light' | 'dark' | 'auto',
    SHOW_STATS: getEnvBoolean('SHOW_STATS', DEFAULT_CONFIG.UI.SHOW_STATS),
    ENABLE_SYNTAX_HIGHLIGHTING: getEnvBoolean(
      'ENABLE_SYNTAX_HIGHLIGHTING',
      DEFAULT_CONFIG.UI.ENABLE_SYNTAX_HIGHLIGHTING,
    ),
    DEFAULT_LANGUAGE: getEnvString('DEFAULT_LANGUAGE', DEFAULT_CONFIG.UI.DEFAULT_LANGUAGE),
  },

  PERFORMANCE: {
    ENABLE_COMPRESSION: getEnvBoolean(
      'ENABLE_COMPRESSION',
      DEFAULT_CONFIG.PERFORMANCE.ENABLE_COMPRESSION,
    ),
    CACHE_STATIC_ASSETS: getEnvBoolean(
      'CACHE_STATIC_ASSETS',
      DEFAULT_CONFIG.PERFORMANCE.CACHE_STATIC_ASSETS,
    ),
    CACHE_MAX_AGE: getEnvNumber('CACHE_MAX_AGE', DEFAULT_CONFIG.PERFORMANCE.CACHE_MAX_AGE),
  },
};

// Validation helpers
export class ConfigValidator {
  static validateExpiry(expiryKey: string): boolean {
    return Object.keys(CONFIG.EXPIRY_OPTIONS).includes(expiryKey);
  }

  static validateLanguage(language: string): boolean {
    return CONFIG.SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  static getExpirySeconds(expiryKey: string): number {
    return (
      CONFIG.EXPIRY_OPTIONS[expiryKey] ?? CONFIG.EXPIRY_OPTIONS[CONFIG.DEFAULT_EXPIRY] ?? 86400
    );
  }

  static sanitizeLanguage(language: string): string {
    const clean = language.toLowerCase().trim();
    return CONFIG.SUPPORTED_LANGUAGES.includes(clean) ? clean : 'text';
  }

  static isValidContentSize(size: number): boolean {
    return size > 0 && size <= CONFIG.MAX_CONTENT_SIZE;
  }

  static isValidTitleLength(length: number): boolean {
    return length >= 0 && length <= CONFIG.MAX_TITLE_LENGTH;
  }
}

// Runtime configuration info
export const RUNTIME_INFO = {
  VERSION: '1.0.0',
  BUILD_TIME: new Date().toISOString(),
  FEATURES: {
    ANALYTICS: true,
    SYNTAX_HIGHLIGHTING: CONFIG.UI.ENABLE_SYNTAX_HIGHLIGHTING,
    RATE_LIMITING: CONFIG.SECURITY.RATE_LIMITING_ENABLED,
    GEOGRAPHY_TRACKING: CONFIG.ANALYTICS.TRACK_GEOGRAPHY,
  },
};

// Export for environment-specific configurations
export const ENV_CONFIGS = {
  development: {
    ...DEFAULT_CONFIG,
    SECURITY: {
      ...DEFAULT_CONFIG.SECURITY,
      RATE_LIMITING_ENABLED: false,
      STRICT_VALIDATION: false,
    },
    ANALYTICS: {
      ...DEFAULT_CONFIG.ANALYTICS,
      RETENTION_DAYS: 7,
    },
  },

  production: {
    ...DEFAULT_CONFIG,
    SECURITY: {
      ...DEFAULT_CONFIG.SECURITY,
      SUSPICIOUS_PATTERNS_ENABLED: true,
      STRICT_VALIDATION: true,
    },
    PERFORMANCE: {
      ...DEFAULT_CONFIG.PERFORMANCE,
      ENABLE_COMPRESSION: true,
      CACHE_STATIC_ASSETS: true,
    },
  },

  testing: {
    ...DEFAULT_CONFIG,
    MAX_CONTENT_SIZE: 1024, // 1KB for testing
    SECURITY: {
      ...DEFAULT_CONFIG.SECURITY,
      RATE_LIMITING_ENABLED: false,
    },
    ANALYTICS: {
      ...DEFAULT_CONFIG.ANALYTICS,
      RETENTION_DAYS: 1,
    },
  },
};

export default CONFIG;
