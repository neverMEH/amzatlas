export * from './client';
export * from './connection-pool';
export * from './errors';
export * from './permissions';
export * from './types';
export * from './queries/sqp-query-builder';
export * from './extractors/sqp-data-extractor';
export * from './validators/data-validator';

import { BigQueryClient } from './client';
import { BigQueryConnectionPool } from './connection-pool';
import { BigQueryPermissionsManager } from './permissions';
import { getBigQueryConfig, getPoolConfig, Environment } from '@/config/bigquery.config';

let defaultPool: BigQueryConnectionPool | null = null;
let defaultPermissionsManager: BigQueryPermissionsManager | null = null;

/**
 * Initialize BigQuery infrastructure for the application
 */
export const initializeBigQuery = (env?: Environment): {
  pool: BigQueryConnectionPool;
  permissions: BigQueryPermissionsManager;
} => {
  const bigqueryConfig = getBigQueryConfig(env);
  const poolConfig = getPoolConfig(env);

  // Create connection pool
  if (!defaultPool) {
    defaultPool = new BigQueryConnectionPool(bigqueryConfig, poolConfig);
  }

  // Create permissions manager with a client from the pool
  if (!defaultPermissionsManager) {
    // Use a dedicated client for permissions management
    const permissionsClient = new BigQueryClient(bigqueryConfig);
    defaultPermissionsManager = new BigQueryPermissionsManager(permissionsClient);
  }

  return {
    pool: defaultPool,
    permissions: defaultPermissionsManager,
  };
};

/**
 * Get the default connection pool (initializes if needed)
 */
export const getDefaultPool = (env?: Environment): BigQueryConnectionPool => {
  if (!defaultPool) {
    initializeBigQuery(env);
  }
  return defaultPool!;
};

/**
 * Get the default permissions manager (initializes if needed)
 */
export const getDefaultPermissionsManager = (env?: Environment): BigQueryPermissionsManager => {
  if (!defaultPermissionsManager) {
    initializeBigQuery(env);
  }
  return defaultPermissionsManager!;
};

/**
 * Execute a query using the connection pool
 */
export const executeQuery = async <T = any>(
  query: string,
  params?: Record<string, any>
): Promise<T[]> => {
  const pool = getDefaultPool();
  return pool.withClient((client) => client.query<T>(query, params));
};

/**
 * Estimate query cost using the connection pool
 */
export const estimateQueryCost = async (query: string) => {
  const pool = getDefaultPool();
  return pool.withClient((client) => client.estimateQueryCost(query));
};

/**
 * Cleanup all BigQuery resources
 */
export const cleanupBigQuery = (): void => {
  if (defaultPool) {
    defaultPool.close();
    defaultPool = null;
  }
  
  if (defaultPermissionsManager) {
    // Close the dedicated permissions client
    (defaultPermissionsManager as any).client.close();
    defaultPermissionsManager = null;
  }
};

// Ensure cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', cleanupBigQuery);
  process.on('SIGINT', cleanupBigQuery);
  process.on('SIGTERM', cleanupBigQuery);
}