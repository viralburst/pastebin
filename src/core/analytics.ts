export interface AnalyticsEvent {
  type: 'paste_created' | 'paste_viewed' | 'paste_expired' | 'error';
  timestamp: string;
  clientIP?: string;
  pasteId?: string;
  language?: string;
  size?: number;
  error?: string;
  userAgent?: string;
  referer?: string;
  country?: string;
}

export interface AnalyticsStats {
  totalShares: number;
  totalViews: number;
  totalExpired?: number;
  totalErrors?: number;
  uniqueVisitors?: number;
  languages: Record<string, number>;
  dailyStats: Record<string, { shares: number; views: number; errors?: number }>;
  hourlyStats?: Record<string, { shares: number; views: number }>;
  topLanguages: Array<{ language: string; count: number; percentage: number }>;
  avgPasteSize?: number;
  geography?: Record<string, number>;
  trends?: {
    sharesGrowth: number;
    viewsGrowth: number;
    popularHours: number[];
  };
}

export interface AnalyticsConfig {
  retentionDays: number;
  trackGeography: boolean;
  trackUserAgent: boolean;
  aggregateHourly: boolean;
  maxStoredEvents: number;
}

export interface IAnalytics {
  trackPasteCreated(
    language: string,
    size: number,
    clientIP: string,
    metadata?: Partial<AnalyticsEvent>
  ): Promise<void>;
  trackPasteViewed(
    pasteId: string,
    clientIP: string,
    metadata?: Partial<AnalyticsEvent>
  ): Promise<void>;
  trackPasteExpired(pasteId: string): Promise<void>;
  trackError(error: string, clientIP?: string, metadata?: Partial<AnalyticsEvent>): Promise<void>;
  getStats(days?: number): Promise<AnalyticsStats>;
  getDetailedStats?(startDate: Date, endDate: Date): Promise<AnalyticsStats>;
  cleanup?(olderThanDays: number): Promise<void>;
}

export class AnalyticsError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

// Enhanced in-memory analytics for development/testing
export class InMemoryAnalytics implements IAnalytics {
  private events: AnalyticsEvent[] = [];
  private config: AnalyticsConfig;

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      retentionDays: 30,
      trackGeography: false,
      trackUserAgent: false,
      aggregateHourly: true,
      maxStoredEvents: 10000,
      ...config,
    };
  }

  async trackPasteCreated(
    language: string,
    size: number,
    clientIP: string,
    metadata: Partial<AnalyticsEvent> = {},
  ): Promise<void> {
    const event: AnalyticsEvent = {
      type: 'paste_created',
      timestamp: new Date().toISOString(),
      clientIP: this.hashIP(clientIP),
      language,
      size,
      ...metadata,
    };

    this.addEvent(event);
  }

  async trackPasteViewed(
    pasteId: string,
    clientIP: string,
    metadata: Partial<AnalyticsEvent> = {},
  ): Promise<void> {
    const event: AnalyticsEvent = {
      type: 'paste_viewed',
      timestamp: new Date().toISOString(),
      clientIP: this.hashIP(clientIP),
      pasteId: this.hashId(pasteId),
      ...metadata,
    };

    this.addEvent(event);
  }

  async trackPasteExpired(pasteId: string): Promise<void> {
    const event: AnalyticsEvent = {
      type: 'paste_expired',
      timestamp: new Date().toISOString(),
      pasteId: this.hashId(pasteId),
    };

    this.addEvent(event);
  }

  async trackError(
    error: string,
    clientIP?: string,
    metadata: Partial<AnalyticsEvent> = {},
  ): Promise<void> {
    const event: AnalyticsEvent = {
      type: 'error',
      timestamp: new Date().toISOString(),
      error,
      ...metadata,
    };

    if (clientIP) {
      event.clientIP = this.hashIP(clientIP);
    }

    this.addEvent(event);
  }

  async getStats(days = 7): Promise<AnalyticsStats> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEvents = this.events.filter(event => new Date(event.timestamp) >= cutoffDate);

    const stats = this.calculateStats(recentEvents);
    return stats;
  }

  private addEvent(event: AnalyticsEvent): void {
    this.events.push(event);

    // Cleanup old events if we exceed max storage
    if (this.events.length > this.config.maxStoredEvents) {
      const cutoff = this.events.length - this.config.maxStoredEvents;
      this.events = this.events.slice(cutoff);
    }

    // Remove events older than retention period
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);

    this.events = this.events.filter(event => new Date(event.timestamp) >= retentionDate);
  }

  private calculateStats(events: AnalyticsEvent[]): AnalyticsStats {
    const stats: AnalyticsStats = {
      totalShares: 0,
      totalViews: 0,
      totalExpired: 0,
      totalErrors: 0,
      uniqueVisitors: 0,
      languages: {},
      dailyStats: {},
      hourlyStats: {},
      topLanguages: [],
      avgPasteSize: 0,
    };

    // Count unique IPs for visitors
    const uniqueIPs = new Set<string>();
    const pasteSizes: number[] = [];
    const languageCounts: Record<string, number> = {};

    // Process events
    for (const event of events) {
      if (event.clientIP) {
        uniqueIPs.add(event.clientIP);
      }

      const date = new Date(event.timestamp);
      const dayKey = date.toISOString().split('T')[0];
      const hourKey = `${dayKey}-${date.getHours().toString().padStart(2, '0')}`;

      // Initialize day stats if not exists
      if (!stats.dailyStats[dayKey]) {
        stats.dailyStats[dayKey] = { shares: 0, views: 0, errors: 0 };
      }

      // Initialize hour stats if not exists
      if (this.config.aggregateHourly && !stats.hourlyStats![hourKey]) {
        stats.hourlyStats![hourKey] = { shares: 0, views: 0 };
      }

      const dayStats = stats.dailyStats[dayKey];
      const hourStats = stats.hourlyStats![hourKey];

      switch (event.type) {
      case 'paste_created':
        stats.totalShares++;
        dayStats.shares++;
        if (this.config.aggregateHourly && hourStats) {
          hourStats.shares++;
        }

        if (event.language) {
          languageCounts[event.language] = (languageCounts[event.language] || 0) + 1;
        }

        if (event.size) {
          pasteSizes.push(event.size);
        }
        break;

      case 'paste_viewed':
        stats.totalViews++;
        dayStats.views++;
        if (this.config.aggregateHourly && hourStats) {
          hourStats.views++;
        }
        break;

      case 'paste_expired':
          stats.totalExpired!++;
        break;

      case 'error':
          stats.totalErrors!++;
        if (dayStats.errors !== undefined) {
          dayStats.errors++;
        }
        break;
      }
    }

    // Set calculated values
    stats.uniqueVisitors = uniqueIPs.size;
    stats.languages = languageCounts;

    if (pasteSizes.length > 0) {
      stats.avgPasteSize = Math.round(
        pasteSizes.reduce((sum, size) => sum + size, 0) / pasteSizes.length,
      );
    }

    // Calculate top languages with percentages
    const totalLanguageUses = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);
    stats.topLanguages = Object.entries(languageCounts)
      .map(([language, count]) => ({
        language,
        count,
        percentage: Math.round((count / totalLanguageUses) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate trends (simplified)
    stats.trends = this.calculateTrends(events);

    return stats;
  }

  private calculateTrends(events: AnalyticsEvent[]): AnalyticsStats['trends'] {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const todayEvents = events.filter(e => new Date(e.timestamp) >= yesterday);
    const yesterdayEvents = events.filter(e => {
      const eventDate = new Date(e.timestamp);
      return (
        eventDate >= new Date(yesterday.getTime() - 24 * 60 * 60 * 1000) && eventDate < yesterday
      );
    });

    const todayShares = todayEvents.filter(e => e.type === 'paste_created').length;
    const yesterdayShares = yesterdayEvents.filter(e => e.type === 'paste_created').length;
    const todayViews = todayEvents.filter(e => e.type === 'paste_viewed').length;
    const yesterdayViews = yesterdayEvents.filter(e => e.type === 'paste_viewed').length;

    const sharesGrowth =
      yesterdayShares > 0 ? ((todayShares - yesterdayShares) / yesterdayShares) * 100 : 0;
    const viewsGrowth =
      yesterdayViews > 0 ? ((todayViews - yesterdayViews) / yesterdayViews) * 100 : 0;

    // Find popular hours (hours with most activity)
    const hourlyActivity: Record<number, number> = {};
    for (const event of events) {
      const hour = new Date(event.timestamp).getHours();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    }

    const popularHours = Object.entries(hourlyActivity)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    return {
      sharesGrowth: Math.round(sharesGrowth),
      viewsGrowth: Math.round(viewsGrowth),
      popularHours,
    };
  }

  // Hash IP for privacy
  private hashIP(ip: string): string {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      const char = ip.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `ip_${Math.abs(hash).toString(16)}`;
  }

  // Hash paste ID for privacy
  private hashId(id: string): string {
    return `paste_${id.substring(0, 4)}***`;
  }
}

// KV-based analytics for production
export class KVAnalytics implements IAnalytics {
  private kv: KVNamespace;
  private config: AnalyticsConfig;

  constructor(kv: KVNamespace, config: Partial<AnalyticsConfig> = {}) {
    this.kv = kv;
    this.config = {
      retentionDays: 30,
      trackGeography: false,
      trackUserAgent: false,
      aggregateHourly: true,
      maxStoredEvents: 50000,
      ...config,
    };
  }

  async trackPasteCreated(
    language: string,
    size: number,
    clientIP: string,
    metadata: Partial<AnalyticsEvent> = {},
  ): Promise<void> {
    try {
      const today = this.getDateKey();
      const hour = this.getHourKey();

      // Increment daily counters
      await Promise.all([
        this.incrementCounter(`analytics:daily:${today}:shares`),
        this.incrementCounter(`analytics:daily:${today}:total`),
        this.incrementCounter(`analytics:language:${language}`),
        this.incrementCounter('analytics:total:shares'),
        this.config.aggregateHourly
          ? this.incrementCounter(`analytics:hourly:${hour}:shares`)
          : Promise.resolve(),
      ]);

      // Track paste size (store sample for average calculation)
      await this.addToSample('analytics:sizes', size.toString());

      // Store event for detailed analytics (with TTL)
      const event: AnalyticsEvent = {
        type: 'paste_created',
        timestamp: new Date().toISOString(),
        language,
        size,
        ...metadata,
      };

      const eventKey = `analytics:event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const ttlSeconds = this.config.retentionDays * 24 * 60 * 60;
      await this.kv.put(eventKey, JSON.stringify(event), {
        expirationTtl: ttlSeconds,
      });
    } catch (error) {
      console.error('Failed to track paste creation:', error);
      throw new AnalyticsError('Failed to track paste creation', 'TRACK_CREATE_FAILED');
    }
  }

  async trackPasteViewed(
    pasteId: string,
    clientIP: string,
    metadata: Partial<AnalyticsEvent> = {},
  ): Promise<void> {
    try {
      const today = this.getDateKey();
      const hour = this.getHourKey();

      // Increment daily counters
      await Promise.all([
        this.incrementCounter(`analytics:daily:${today}:views`),
        this.incrementCounter(`analytics:daily:${today}:total`),
        this.incrementCounter('analytics:total:views'),
        this.config.aggregateHourly
          ? this.incrementCounter(`analytics:hourly:${hour}:views`)
          : Promise.resolve(),
      ]);

      // Store event
      const event: AnalyticsEvent = {
        type: 'paste_viewed',
        timestamp: new Date().toISOString(),
        pasteId: `${pasteId.substring(0, 4)}***`, // Partial ID for privacy
        ...metadata,
      };

      const eventKey = `analytics:event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const ttlSeconds = this.config.retentionDays * 24 * 60 * 60;
      await this.kv.put(eventKey, JSON.stringify(event), {
        expirationTtl: ttlSeconds,
      });
    } catch (error) {
      console.error('Failed to track paste view:', error);
      throw new AnalyticsError('Failed to track paste view', 'TRACK_VIEW_FAILED');
    }
  }

  async trackPasteExpired(pasteId: string): Promise<void> {
    try {
      await this.incrementCounter('analytics:total:expired');

      const event: AnalyticsEvent = {
        type: 'paste_expired',
        timestamp: new Date().toISOString(),
        pasteId: `${pasteId.substring(0, 4)}***`,
      };

      const eventKey = `analytics:event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const ttlSeconds = this.config.retentionDays * 24 * 60 * 60;
      await this.kv.put(eventKey, JSON.stringify(event), {
        expirationTtl: ttlSeconds,
      });
    } catch (error) {
      console.error('Failed to track paste expiry:', error);
    }
  }

  async trackError(
    error: string,
    clientIP?: string,
    metadata: Partial<AnalyticsEvent> = {},
  ): Promise<void> {
    try {
      const today = this.getDateKey();
      await Promise.all([
        this.incrementCounter(`analytics:daily:${today}:errors`),
        this.incrementCounter('analytics:total:errors'),
      ]);

      const event: AnalyticsEvent = {
        type: 'error',
        timestamp: new Date().toISOString(),
        error,
        ...metadata,
      };

      const eventKey = `analytics:event:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const ttlSeconds = this.config.retentionDays * 24 * 60 * 60;
      await this.kv.put(eventKey, JSON.stringify(event), {
        expirationTtl: ttlSeconds,
      });
    } catch (error) {
      console.error('Failed to track error:', error);
    }
  }

  async getStats(days = 7): Promise<AnalyticsStats> {
    try {
      // Get total counters
      const [totalShares, totalViews, totalExpired, totalErrors] = await Promise.all([
        this.getCounter('analytics:total:shares'),
        this.getCounter('analytics:total:views'),
        this.getCounter('analytics:total:expired'),
        this.getCounter('analytics:total:errors'),
      ]);

      // Get language stats
      const languages = await this.getLanguageStats();

      // Get daily stats for the specified period
      const dailyStats = await this.getDailyStats(days);

      // Get sample sizes for average calculation
      const avgPasteSize = await this.getAveragePasteSize();

      const stats: AnalyticsStats = {
        totalShares,
        totalViews,
        totalExpired,
        totalErrors,
        languages,
        dailyStats,
        topLanguages: this.calculateTopLanguages(languages),
        avgPasteSize,
      };

      return stats;
    } catch (error) {
      console.error('Failed to get analytics stats:', error);
      throw new AnalyticsError('Failed to get analytics stats', 'GET_STATS_FAILED');
    }
  }

  // Helper methods
  private async incrementCounter(key: string): Promise<void> {
    const current = await this.kv.get(key);
    const value = current ? parseInt(current) + 1 : 1;
    await this.kv.put(key, value.toString());
  }

  private async getCounter(key: string): Promise<number> {
    const value = await this.kv.get(key);
    return value ? parseInt(value) : 0;
  }

  private async addToSample(key: string, value: string): Promise<void> {
    // Store up to 1000 samples for average calculation
    const current = await this.kv.get(key);
    let samples: string[] = current ? JSON.parse(current) : [];

    samples.push(value);
    if (samples.length > 1000) {
      samples = samples.slice(-1000); // Keep only last 1000 samples
    }

    await this.kv.put(key, JSON.stringify(samples));
  }

  private async getLanguageStats(): Promise<Record<string, number>> {
    const languages: Record<string, number> = {};

    // This is a simplified version - in practice, you'd need to iterate through KV keys
    // with a prefix pattern like "analytics:language:"
    try {
      const list = await this.kv.list({ prefix: 'analytics:language:' });

      for (const key of list.keys) {
        const language = key.name.replace('analytics:language:', '');
        const count = await this.getCounter(key.name);
        if (count > 0) {
          languages[language] = count;
        }
      }
    } catch (error) {
      console.error('Failed to get language stats:', error);
    }

    return languages;
  }

  private async getDailyStats(
    days: number,
  ): Promise<Record<string, { shares: number; views: number; errors?: number }>> {
    const dailyStats: Record<string, { shares: number; views: number; errors?: number }> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      const [shares, views, errors] = await Promise.all([
        this.getCounter(`analytics:daily:${dateKey}:shares`),
        this.getCounter(`analytics:daily:${dateKey}:views`),
        this.getCounter(`analytics:daily:${dateKey}:errors`),
      ]);

      dailyStats[dateKey] = { shares, views, errors };
    }

    return dailyStats;
  }

  private async getAveragePasteSize(): Promise<number> {
    try {
      const samplesData = await this.kv.get('analytics:sizes');
      if (!samplesData) return 0;

      const samples: string[] = JSON.parse(samplesData);
      if (samples.length === 0) return 0;

      const total = samples.reduce((sum, size) => sum + parseInt(size), 0);
      return Math.round(total / samples.length);
    } catch {
      return 0;
    }
  }

  private calculateTopLanguages(
    languages: Record<string, number>,
  ): Array<{ language: string; count: number; percentage: number }> {
    const total = Object.values(languages).reduce((sum, count) => sum + count, 0);

    return Object.entries(languages)
      .map(([language, count]) => ({
        language,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getDateKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getHourKey(): string {
    const now = new Date();
    return `${this.getDateKey()}-${now.getHours().toString().padStart(2, '0')}`;
  }

  // Cleanup old data
  async cleanup(olderThanDays: number): Promise<void> {
    // Implementation would depend on specific cleanup strategy
    // This is a placeholder for cleaning up old analytics data
    console.log(`Cleaning up analytics data older than ${olderThanDays} days`);
  }
}
