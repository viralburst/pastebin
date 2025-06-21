export interface PasteData {
  id: string;
  title: string;
  content: string;
  language: string;
  createdAt: string; // ISO string
  expiresAt?: string; // ISO string
  consumed: boolean;
  size: number;
  clientIP?: string; // Optional for analytics
  oneTimeView: boolean; // Whether paste should be consumed after first view
}

export interface CreatePasteInput {
  title: string;
  content: string;
  language: string;
  expiresAt?: string;
  size: number;
  consumed?: boolean;
  oneTimeView: boolean;
}

export interface IStorage {
  createPaste(data: CreatePasteInput): Promise<PasteData>;
  getPaste(id: string): Promise<PasteData | null>;
  consumePaste(id: string): Promise<PasteData | null>;
  deletePaste(id: string): Promise<void>;
  listPastes?(limit?: number, cursor?: string): Promise<{ pastes: PasteData[]; cursor?: string }>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// Implementation using Cloudflare KV
export class KVStorage implements IStorage {
  private kv: KVNamespace;

  constructor(kvNamespace: KVNamespace) {
    this.kv = kvNamespace;
  }

  // Helper: generate secure ID with collision detection
  private async generateId(length = 12): Promise<string> {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      const id = Array.from(array)
        .map(b => chars[b % chars.length])
        .join('');

      // Check if ID already exists
      const existing = await this.kv.get(id);
      if (!existing) {
        return id;
      }
      attempts++;
    }

    throw new StorageError('Unable to generate unique ID', 'ID_GENERATION_FAILED');
  }

  // Create a paste with TTL if expiresAt provided
  async createPaste(data: CreatePasteInput): Promise<PasteData> {
    try {
      const id = await this.generateId();
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
        oneTimeView: data.oneTimeView,
      };

      // Use KV put with TTL if expiresAt: calculate TTL in seconds
      if (paste.expiresAt) {
        const now = Date.now();
        const expMs = new Date(paste.expiresAt).getTime();
        const ttlSec = Math.max(0, Math.floor((expMs - now) / 1000));

        if (ttlSec <= 0) {
          throw new StorageError('Paste expiration is in the past', 'INVALID_EXPIRY');
        }

        await this.kv.put(id, JSON.stringify(paste), { expirationTtl: ttlSec });
      } else {
        await this.kv.put(id, JSON.stringify(paste));
      }

      return paste;
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError('Failed to create paste', 'CREATE_FAILED');
    }
  }

  async getPaste(id: string): Promise<PasteData | null> {
    try {
      const value = await this.kv.get(id);
      if (!value) return null;

      const paste: PasteData = JSON.parse(value);

      // Check if expired (backup check)
      if (paste.expiresAt && new Date(paste.expiresAt) <= new Date()) {
        await this.kv.delete(id);
        return null;
      }

      return paste;
    } catch (error) {
      console.error('Error getting paste:', error);
      return null;
    }
  }

  async consumePaste(id: string): Promise<PasteData | null> {
    try {
      // Fetch the paste
      const raw = await this.kv.get(id);
      if (!raw) return null;

      let paste: PasteData;
      try {
        paste = JSON.parse(raw);
      } catch {
        return null;
      }

      // Check if already consumed
      if (paste.consumed) {
        return null;
      }

      // Check if expired
      if (paste.expiresAt && new Date(paste.expiresAt) <= new Date()) {
        await this.kv.delete(id);
        return null;
      }

      // Delete the paste (consume it)
      await this.kv.delete(id);

      return paste;
    } catch (error) {
      console.error('Error consuming paste:', error);
      return null;
    }
  }

  async deletePaste(id: string): Promise<void> {
    try {
      await this.kv.delete(id);
    } catch {
      throw new StorageError('Failed to delete paste', 'DELETE_FAILED');
    }
  }

  // Optional: List pastes for admin purposes
  async listPastes(limit = 10, cursor?: string): Promise<{ pastes: PasteData[]; cursor?: string }> {
    try {
      const result = await this.kv.list({ limit, cursor });
      const pastes: PasteData[] = [];

      for (const key of result.keys) {
        const value = await this.kv.get(key.name);
        if (value) {
          try {
            const paste = JSON.parse(value);
            pastes.push(paste);
          } catch {
            // Skip invalid entries
          }
        }
      }

      return {
        pastes,
        cursor: result.list_complete ? undefined : result.cursor,
      };
    } catch {
      throw new StorageError('Failed to list pastes', 'LIST_FAILED');
    }
  }
}

// Mock storage for testing
export class MockStorage implements IStorage {
  private pastes = new Map<string, PasteData>();
  private idCounter = 0;

  async createPaste(data: CreatePasteInput): Promise<PasteData> {
    const id = `paste_${++this.idCounter}`;
    const paste: PasteData = {
      id,
      title: data.title,
      content: data.content,
      language: data.language,
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt,
      consumed: false,
      size: data.size,
      oneTimeView: data.oneTimeView,
    };

    this.pastes.set(id, paste);
    return paste;
  }

  async getPaste(id: string): Promise<PasteData | null> {
    return this.pastes.get(id) || null;
  }

  async consumePaste(id: string): Promise<PasteData | null> {
    const paste = this.pastes.get(id);
    if (!paste || paste.consumed) return null;

    this.pastes.delete(id);
    return paste;
  }

  async deletePaste(id: string): Promise<void> {
    this.pastes.delete(id);
  }
}
