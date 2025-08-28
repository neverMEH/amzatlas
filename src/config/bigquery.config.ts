import { BigQueryConfig } from '@/lib/bigquery/client';
import { PoolOptions } from '@/lib/bigquery/connection-pool';

export type Environment = 'development' | 'staging' | 'production' | 'test';

export interface EnvironmentConfig {
  bigquery: BigQueryConfig;
  pool: PoolOptions;
  tables: {
    sqpRaw: string;
    sqpProcessed: string;
    sqpMetrics: string;
    sqpDaily: string;
    processingLogs: string;
    sqp_weekly_summary?: string;
    sqp_monthly_summary?: string;
    sqp_quarterly_summary?: string;
    sqp_yearly_summary?: string;
    sqp_weekly_comparison?: string;
    sqp_monthly_comparison?: string;
    sqp_quarterly_comparison?: string;
    sqp_yearly_comparison?: string;
  };
}

const getEnvironment = (): Environment => {
  const env = process.env.NODE_ENV || 'development';
  if (['development', 'staging', 'production', 'test'].includes(env)) {
    return env as Environment;
  }
  return 'development';
};

const getCredentials = () => {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) {
    // Return null to indicate no credentials available
    return null;
  }
  
  try {
    return JSON.parse(credentialsJson);
  } catch (error) {
    console.error('Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON');
    return null;
  }
};

const configs: Record<Environment, EnvironmentConfig> = {
  development: {
    bigquery: {
      projectId: process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader',
      dataset: process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85',
      location: process.env.BIGQUERY_LOCATION || 'US',
      credentials: null, // Will be loaded lazily
    },
    pool: {
      maxClients: 5,
      minClients: 1,
      idleTimeoutMs: 300000, // 5 minutes
      acquireTimeoutMs: 30000, // 30 seconds
    },
    tables: {
      sqpRaw: 'seller-search_query_performance',
      sqpProcessed: 'sqp_processed_dev',
      sqpMetrics: 'sqp_metrics_dev',
      sqpDaily: 'sqp_daily_dev',
      processingLogs: 'processing_logs_dev',
    },
  },
  
  staging: {
    bigquery: {
      projectId: process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader',
      dataset: process.env.BIGQUERY_DATASET_STAGING || 'sqp_data_staging',
      location: process.env.BIGQUERY_LOCATION || 'US',
      credentials: null, // Will be loaded lazily
    },
    pool: {
      maxClients: 10,
      minClients: 2,
      idleTimeoutMs: 600000, // 10 minutes
      acquireTimeoutMs: 30000,
    },
    tables: {
      sqpRaw: 'sqp_raw_staging',
      sqpProcessed: 'sqp_processed_staging',
      sqpMetrics: 'sqp_metrics_staging',
      sqpDaily: 'sqp_daily_staging',
      processingLogs: 'processing_logs_staging',
    },
  },
  
  production: {
    bigquery: {
      projectId: process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader',
      dataset: process.env.BIGQUERY_DATASET || 'sqp_data',
      location: process.env.BIGQUERY_LOCATION || 'US',
      credentials: null, // Will be loaded lazily
    },
    pool: {
      maxClients: 20,
      minClients: 5,
      idleTimeoutMs: 900000, // 15 minutes
      acquireTimeoutMs: 60000, // 1 minute
    },
    tables: {
      sqpRaw: 'seller-search_query_performance',
      sqpProcessed: 'sqp_processed',
      sqpMetrics: 'sqp_metrics',
      sqpDaily: 'sqp_daily',
      processingLogs: 'processing_logs',
    },
  },
  
  test: {
    bigquery: {
      projectId: 'test-project',
      dataset: 'test_dataset',
      location: 'US',
      credentials: {
        type: 'service_account',
        project_id: 'test-project',
        private_key_id: 'test-key-id',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
        client_email: 'test@test-project.iam.gserviceaccount.com',
      },
    },
    pool: {
      maxClients: 3,
      minClients: 1,
      idleTimeoutMs: 60000, // 1 minute
      acquireTimeoutMs: 5000, // 5 seconds
    },
    tables: {
      sqpRaw: 'sqp_raw_test',
      sqpProcessed: 'sqp_processed_test',
      sqpMetrics: 'sqp_metrics_test',
      sqpDaily: 'sqp_daily_test',
      processingLogs: 'processing_logs_test',
    },
  },
};

export const getConfig = (env?: Environment): EnvironmentConfig => {
  const environment = env || getEnvironment();
  return configs[environment];
};

export const getBigQueryConfig = (env?: Environment): BigQueryConfig => {
  const config = getConfig(env);
  // Ensure credentials are loaded fresh each time
  return {
    ...config.bigquery,
    credentials: getCredentials()
  };
};

export const getPoolConfig = (env?: Environment): PoolOptions => {
  return getConfig(env).pool;
};

export const getTableNames = (env?: Environment) => {
  return getConfig(env).tables;
};

// Helper to build fully qualified table names
export const getFullTableName = (
  tableName: keyof EnvironmentConfig['tables'] | string,
  env?: Environment
): string => {
  const config = getConfig(env);
  const tables = config.tables;
  const tableKey = tableName as keyof EnvironmentConfig['tables'];
  
  // Check if it's a known table key
  if (tableKey in tables && tables[tableKey]) {
    return `${config.bigquery.projectId}.${config.bigquery.dataset}.${tables[tableKey]}`;
  }
  
  // Otherwise, use the table name directly
  return `${config.bigquery.projectId}.${config.bigquery.dataset}.${tableName}`;
};

// Export current environment for debugging
export const currentEnvironment = getEnvironment();