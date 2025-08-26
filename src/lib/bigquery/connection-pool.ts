import { BigQueryClient, BigQueryConfig } from './client';
import { BigQueryConnectionError } from './errors';

export interface PoolOptions {
  maxClients?: number;
  minClients?: number;
  idleTimeoutMs?: number;
  acquireTimeoutMs?: number;
}

interface PooledClient {
  client: BigQueryClient;
  inUse: boolean;
  lastUsed: number;
  id: string;
}

export class BigQueryConnectionPool {
  private pool: Map<string, PooledClient> = new Map();
  private config: BigQueryConfig;
  private options: Required<PoolOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(config: BigQueryConfig, options?: PoolOptions) {
    this.config = config;
    this.options = {
      maxClients: options?.maxClients ?? 10,
      minClients: options?.minClients ?? 2,
      idleTimeoutMs: options?.idleTimeoutMs ?? 300000, // 5 minutes
      acquireTimeoutMs: options?.acquireTimeoutMs ?? 30000, // 30 seconds
    };

    this.initializePool();
    this.startCleanupTask();
  }

  private initializePool(): void {
    // Create minimum number of clients
    for (let i = 0; i < this.options.minClients; i++) {
      this.createClient();
    }
  }

  private createClient(): string {
    if (this.pool.size >= this.options.maxClients) {
      throw new BigQueryConnectionError(
        `Maximum number of clients (${this.options.maxClients}) reached`
      );
    }

    const client = new BigQueryClient(this.config);
    const id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.pool.set(id, {
      client,
      inUse: false,
      lastUsed: Date.now(),
      id,
    });

    return id;
  }

  public async acquire(): Promise<BigQueryClient> {
    if (this.closed) {
      throw new BigQueryConnectionError('Connection pool is closed');
    }

    const startTime = Date.now();
    
    while (Date.now() - startTime < this.options.acquireTimeoutMs) {
      // Try to find an available client
      for (const [id, pooledClient] of this.pool) {
        if (!pooledClient.inUse) {
          pooledClient.inUse = true;
          pooledClient.lastUsed = Date.now();
          
          // Test connection before returning
          const isConnected = await pooledClient.client.testConnection();
          if (!isConnected) {
            // Remove bad connection and create a new one
            this.pool.delete(id);
            try {
              const newId = this.createClient();
              const newPooledClient = this.pool.get(newId)!;
              newPooledClient.inUse = true;
              return newPooledClient.client;
            } catch (error) {
              // If we can't create a new client, continue looking
              continue;
            }
          }
          
          return pooledClient.client;
        }
      }

      // If no client available, try to create a new one
      if (this.pool.size < this.options.maxClients) {
        const id = this.createClient();
        const pooledClient = this.pool.get(id)!;
        pooledClient.inUse = true;
        return pooledClient.client;
      }

      // Wait a bit before trying again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new BigQueryConnectionError(
      `Failed to acquire connection within ${this.options.acquireTimeoutMs}ms timeout`
    );
  }

  public release(client: BigQueryClient): void {
    for (const pooledClient of this.pool.values()) {
      if (pooledClient.client === client) {
        pooledClient.inUse = false;
        pooledClient.lastUsed = Date.now();
        return;
      }
    }
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000); // Run every 30 seconds
  }

  private cleanup(): void {
    if (this.closed) return;

    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, pooledClient] of this.pool) {
      // Don't remove clients that are in use or below minimum
      if (pooledClient.inUse || this.pool.size <= this.options.minClients) {
        continue;
      }

      // Remove idle clients
      if (now - pooledClient.lastUsed > this.options.idleTimeoutMs) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const pooledClient = this.pool.get(id);
      if (pooledClient) {
        pooledClient.client.close();
        this.pool.delete(id);
      }
    }
  }

  public getPoolStats(): {
    total: number;
    inUse: number;
    idle: number;
    maxClients: number;
  } {
    let inUse = 0;
    let idle = 0;

    for (const pooledClient of this.pool.values()) {
      if (pooledClient.inUse) {
        inUse++;
      } else {
        idle++;
      }
    }

    return {
      total: this.pool.size,
      inUse,
      idle,
      maxClients: this.options.maxClients,
    };
  }

  public async withClient<T>(
    operation: (client: BigQueryClient) => Promise<T>
  ): Promise<T> {
    const client = await this.acquire();
    try {
      return await operation(client);
    } finally {
      this.release(client);
    }
  }

  public close(): void {
    this.closed = true;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const pooledClient of this.pool.values()) {
      pooledClient.client.close();
    }

    this.pool.clear();
  }
}

// Global pool instance
let globalPool: BigQueryConnectionPool | null = null;

export const getConnectionPool = (
  config?: BigQueryConfig,
  options?: PoolOptions
): BigQueryConnectionPool => {
  if (!globalPool && config) {
    globalPool = new BigQueryConnectionPool(config, options);
  } else if (!globalPool) {
    throw new BigQueryConnectionError(
      'Connection pool not initialized. Please provide configuration.'
    );
  }
  return globalPool;
};

export const closeConnectionPool = (): void => {
  if (globalPool) {
    globalPool.close();
    globalPool = null;
  }
};