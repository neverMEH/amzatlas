import { BigQuery, Table, TableMetadata, Query } from '@google-cloud/bigquery';
import { getBigQueryConfig } from '@/config/bigquery.config';
import { 
  BigQueryError, 
  BigQueryTableNotFoundError, 
  BigQueryPermissionError,
  BigQueryRateLimitError 
} from './errors';
import { TableLifecycleConfig, TableField, TableStatistics, TableInfo } from './types';

interface CreateTableOptions {
  partitioning?: {
    type: 'DAY' | 'HOUR' | 'MONTH' | 'YEAR';
    field: string;
    expirationMs?: number;
  };
  clustering?: string[];
  description?: string;
  expirationTime?: string;
  maxRetries?: number;
}

interface CreateMaterializedViewOptions {
  enableRefresh?: boolean;
  refreshIntervalMinutes?: number;
  partitioning?: {
    field: string;
    type: 'DAY' | 'HOUR' | 'MONTH' | 'YEAR';
  };
}

export class BigQueryTableManager {
  private client: BigQuery | null = null;
  private closed = false;
  private config = getBigQueryConfig();

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    if (this.closed) {
      throw new Error('Client is closed');
    }

    try {
      const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
        ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        : undefined;

      this.client = new BigQuery({
        projectId: this.config.projectId,
        credentials,
        location: this.config.location,
      });
    } catch (error) {
      throw new BigQueryError('Failed to initialize BigQuery client', 'CLIENT_INIT_ERROR', error);
    }
  }

  private ensureClient(): BigQuery {
    if (this.closed) {
      throw new Error('Client is closed');
    }
    if (!this.client) {
      throw new BigQueryError('BigQuery client not initialized', 'CLIENT_NOT_INITIALIZED');
    }
    return this.client;
  }

  async createTable(
    tableId: string,
    schema: TableField[],
    options: CreateTableOptions = {}
  ): Promise<void> {
    const client = this.ensureClient();
    const dataset = client.dataset(this.config.dataset);
    const { maxRetries = 3 } = options;

    const tableOptions: any = {
      schema: { fields: schema },
    };

    if (options.partitioning) {
      tableOptions.timePartitioning = {
        type: options.partitioning.type,
        field: options.partitioning.field,
        ...(options.partitioning.expirationMs && { 
          expirationMS: options.partitioning.expirationMs 
        }),
      };
    }

    if (options.clustering) {
      tableOptions.clustering = { fields: options.clustering };
    }

    if (options.description) {
      tableOptions.description = options.description;
    }

    if (options.expirationTime) {
      tableOptions.expirationTime = options.expirationTime;
    }

    let retries = 0;
    let lastError: any;

    while (retries <= maxRetries) {
      try {
        await dataset.createTable(tableId, tableOptions);
        return;
      } catch (error: any) {
        lastError = error;
        
        if (error.code === 403 || error.message?.includes('Permission denied')) {
          throw new BigQueryPermissionError(`Permission denied creating table ${tableId}`, error);
        }
        
        if (error.code === 429) {
          if (retries < maxRetries) {
            retries++;
            await this.sleep(Math.pow(2, retries) * 1000);
            continue;
          } else {
            throw new BigQueryRateLimitError(`Failed after ${maxRetries} retries`, lastError);
          }
        }
        
        throw new BigQueryError(`Failed to create table ${tableId}`, 'CREATE_TABLE_ERROR', error);
      }
    }
  }

  async createTableIfNotExists(
    tableId: string,
    schema: TableField[],
    options?: CreateTableOptions
  ): Promise<boolean> {
    const client = this.ensureClient();
    const table = client.dataset(this.config.dataset).table(tableId);
    
    const [exists] = await table.exists();
    if (exists) {
      return false;
    }

    await this.createTable(tableId, schema, options);
    return true;
  }

  async updateTableSchema(tableId: string, newFields: TableField[]): Promise<void> {
    const client = this.ensureClient();
    const table = client.dataset(this.config.dataset).table(tableId);
    
    const [metadata] = await table.get();
    const existingFields = metadata.schema?.fields || [];
    
    // Check for duplicate fields
    for (const newField of newFields) {
      if (existingFields.some(f => f.name === newField.name)) {
        throw new BigQueryError(`Field "${newField.name}" already exists in table ${tableId}`, 'DUPLICATE_FIELD');
      }
    }

    const updatedSchema = {
      schema: {
        fields: [...existingFields, ...newFields],
      },
    };

    try {
      await table.setMetadata(updatedSchema);
    } catch (error) {
      throw new BigQueryError(`Failed to update schema for table ${tableId}`, 'UPDATE_SCHEMA_ERROR', error);
    }
  }

  async deleteTable(tableId: string, options: { force?: boolean } = {}): Promise<void> {
    const client = this.ensureClient();
    const table = client.dataset(this.config.dataset).table(tableId);
    
    const [exists] = await table.exists();
    if (!exists) {
      throw new BigQueryTableNotFoundError(`Table ${tableId} not found`);
    }

    try {
      await table.delete();
    } catch (error: any) {
      if (options.force && error.message?.includes('Table has data')) {
        // Force delete using DROP TABLE query
        const query = `DROP TABLE IF EXISTS \`${this.config.projectId}.${this.config.dataset}.${tableId}\``;
        await client.query(query);
      } else {
        throw new BigQueryError(`Failed to delete table ${tableId}`, 'DELETE_TABLE_ERROR', error);
      }
    }
  }

  async setTableExpiration(tableId: string, expirationDays: number): Promise<void> {
    const client = this.ensureClient();
    const table = client.dataset(this.config.dataset).table(tableId);
    
    const expirationTime = new Date();
    expirationTime.setDate(expirationTime.getDate() + expirationDays);
    
    try {
      await table.setMetadata({
        expirationTime: expirationTime.toISOString(),
      });
    } catch (error) {
      throw new BigQueryError(`Failed to set expiration for table ${tableId}`, 'SET_EXPIRATION_ERROR', error);
    }
  }

  async archiveOldData(
    sourceTableId: string,
    archiveTableId: string,
    cutoffDate: string
  ): Promise<void> {
    const client = this.ensureClient();
    const dataset = this.config.dataset;
    const project = this.config.projectId;
    
    // Create archive table and insert old data
    const archiveQuery = `
      CREATE TABLE IF NOT EXISTS \`${project}.${dataset}.${archiveTableId}\`
      PARTITION BY DATE(created_at)
      CLUSTER BY id
      AS 
      SELECT * FROM \`${project}.${dataset}.${sourceTableId}\`
      WHERE created_at < '${cutoffDate}'
    `;
    
    // Delete archived data from source
    const deleteQuery = `
      DELETE FROM \`${project}.${dataset}.${sourceTableId}\`
      WHERE created_at < '${cutoffDate}'
    `;
    
    try {
      await client.query(archiveQuery);
      await client.query(deleteQuery);
    } catch (error) {
      throw new BigQueryError('Failed to archive old data', 'ARCHIVE_ERROR', error);
    }
  }

  async applyLifecyclePolicy(config: TableLifecycleConfig): Promise<void> {
    const client = this.ensureClient();
    const table = client.dataset(this.config.dataset).table(config.tableId);
    
    const updates: Partial<TableMetadata> = {};
    
    // Set table expiration
    if (config.retentionDays) {
      const expirationTime = new Date();
      expirationTime.setDate(expirationTime.getDate() + config.retentionDays);
      updates.expirationTime = expirationTime.toISOString();
    }
    
    if (Object.keys(updates).length > 0) {
      await table.setMetadata(updates);
    }
    
    // Set partition expiration in a separate call
    if (config.partitionExpirationDays) {
      const [metadata] = await table.get();
      if (metadata.timePartitioning) {
        await table.setMetadata({
          timePartitioning: {
            ...metadata.timePartitioning,
            expirationMS: config.partitionExpirationDays * 24 * 60 * 60 * 1000,
          },
        });
      }
    }
    
    // Schedule archival if configured
    if (config.archiveAfterDays && config.archiveTableId) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.archiveAfterDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      await this.archiveOldData(
        config.tableId,
        config.archiveTableId,
        cutoffDateStr
      );
    }
  }

  async getTableStatistics(tableId: string): Promise<TableStatistics> {
    const client = this.ensureClient();
    const query = `
      SELECT
        size_bytes,
        row_count,
        TIMESTAMP_MILLIS(last_modified_time) as modified_time
      FROM \`${this.config.projectId}.${this.config.dataset}.__TABLES__\`
      WHERE table_id = '${tableId}'
    `;
    
    const [rows] = await client.query(query);
    if (rows.length === 0) {
      throw new BigQueryTableNotFoundError(`Table ${tableId} not found`);
    }
    
    const row = rows[0];
    const sizeBytes = parseInt(row.size_bytes);
    
    return {
      sizeBytes,
      sizeMB: sizeBytes / (1024 * 1024),
      sizeGB: sizeBytes / (1024 * 1024 * 1024),
      rowCount: parseInt(row.row_count),
      lastModified: new Date(row.modified_time),
    };
  }

  async listTablesWithLifecycle(): Promise<TableInfo[]> {
    const client = this.ensureClient();
    const query = `
      SELECT
        table_id as table_name,
        TIMESTAMP_MILLIS(creation_time) as creation_time,
        TIMESTAMP_MILLIS(expiration_time) as expiration_time,
        size_bytes,
        row_count
      FROM \`${this.config.projectId}.${this.config.dataset}.__TABLES__\`
      ORDER BY creation_time DESC
    `;
    
    const [rows] = await client.query(query);
    
    return rows.map(row => ({
      tableId: row.table_name,
      createdAt: new Date(row.creation_time.value),
      expiresAt: row.expiration_time ? new Date(row.expiration_time.value) : null,
      sizeBytes: parseInt(row.size_bytes),
      rowCount: parseInt(row.row_count),
    }));
  }

  async cleanupExpiredTables(): Promise<{ deletedTables: string[] }> {
    const client = this.ensureClient();
    
    // Find expired tables
    const query = `
      SELECT table_id
      FROM \`${this.config.projectId}.${this.config.dataset}.__TABLES__\`
      WHERE expiration_time IS NOT NULL 
        AND TIMESTAMP_MILLIS(expiration_time) < CURRENT_TIMESTAMP()
    `;
    
    const [rows] = await client.query(query);
    const deletedTables: string[] = [];
    
    for (const row of rows) {
      try {
        await this.deleteTable(row.table_id);
        deletedTables.push(row.table_id);
      } catch (error) {
        console.error(`Failed to delete expired table ${row.table_id}:`, error);
      }
    }
    
    return { deletedTables };
  }

  async createMaterializedView(
    viewName: string,
    query: string,
    options: CreateMaterializedViewOptions = {}
  ): Promise<void> {
    const client = this.ensureClient();
    const { enableRefresh = true, refreshIntervalMinutes = 60 } = options;
    
    let createViewQuery = `
      CREATE MATERIALIZED VIEW \`${this.config.projectId}.${this.config.dataset}.${viewName}\`
    `;
    
    if (options.partitioning) {
      createViewQuery += `
      PARTITION BY ${options.partitioning.type}(${options.partitioning.field})
      `;
    }
    
    createViewQuery += `
      OPTIONS (
        enable_refresh = ${enableRefresh},
        refresh_interval_minutes = ${refreshIntervalMinutes}
      )
      AS ${query}
    `;
    
    try {
      await client.query(createViewQuery);
    } catch (error) {
      throw new BigQueryError(`Failed to create materialized view ${viewName}`, 'CREATE_VIEW_ERROR', error);
    }
  }

  async refreshMaterializedView(viewName: string): Promise<void> {
    const client = this.ensureClient();
    const query = `
      CALL BQ.REFRESH_MATERIALIZED_VIEW(
        '${this.config.projectId}.${this.config.dataset}.${viewName}'
      )
    `;
    
    try {
      await client.query(query);
    } catch (error) {
      throw new BigQueryError(`Failed to refresh materialized view ${viewName}`, 'REFRESH_VIEW_ERROR', error);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  close(): void {
    this.closed = true;
    this.client = null;
  }

  isClosed(): boolean {
    return this.closed;
  }
}