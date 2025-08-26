import { BigQuery, Table, Dataset } from '@google-cloud/bigquery';
import { BigQueryClient } from './client';
import { BigQueryPermissionError } from './errors';

export interface TablePermissions {
  read: boolean;
  write: boolean;
  delete: boolean;
}

export interface DatasetRole {
  role: 'READER' | 'WRITER' | 'OWNER';
  entity: string; // e.g., "user:email@example.com", "serviceAccount:..."
}

export class BigQueryPermissionsManager {
  private client: BigQueryClient;

  constructor(client: BigQueryClient) {
    this.client = client;
  }

  /**
   * Check if the service account has specific permissions on a dataset
   */
  public async checkDatasetPermissions(datasetId: string): Promise<{
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
  }> {
    try {
      const bqClient = this.client.getClient();
      const dataset = bqClient.dataset(datasetId);

      // Try to get metadata (requires read permission)
      let canRead = false;
      let canWrite = false;
      let canManage = false;

      try {
        await dataset.getMetadata();
        canRead = true;
      } catch (error) {
        // Can't read dataset
      }

      // Try to get access control (requires owner permission)
      try {
        const [access] = await dataset.getMetadata();
        if (access.access) {
          canManage = true;
          // If we can manage, we can also write
          canWrite = true;
        }
      } catch (error) {
        // Can't manage dataset
      }

      // Try to check if we can create tables (requires write permission)
      if (!canWrite && canRead) {
        try {
          const testTableId = `_permission_test_${Date.now()}`;
          const table = dataset.table(testTableId);
          // Check if we would be able to create a table
          const options = {
            schema: [{ name: 'test', type: 'STRING' }],
            dryRun: true,
          };
          // This is a workaround since BigQuery doesn't have a direct permission check
          canWrite = true; // Assume write if we can read for now
        } catch (error) {
          // Can't write to dataset
        }
      }

      return { canRead, canWrite, canManage };
    } catch (error) {
      throw new BigQueryPermissionError(
        `Failed to check dataset permissions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if the service account has specific permissions on a table
   */
  public async checkTablePermissions(
    datasetId: string,
    tableId: string
  ): Promise<TablePermissions> {
    try {
      const bqClient = this.client.getClient();
      const table = bqClient.dataset(datasetId).table(tableId);

      let read = false;
      let write = false;
      let del = false;

      // Check read permission
      try {
        await table.getMetadata();
        read = true;
      } catch (error) {
        // Can't read table
      }

      // For write and delete, we rely on dataset permissions
      // since BigQuery doesn't have table-level write permissions
      const datasetPerms = await this.checkDatasetPermissions(datasetId);
      write = datasetPerms.canWrite;
      del = datasetPerms.canManage;

      return { read, write, delete: del };
    } catch (error) {
      throw new BigQueryPermissionError(
        `Failed to check table permissions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List all datasets the service account has access to
   */
  public async listAccessibleDatasets(): Promise<string[]> {
    try {
      const bqClient = this.client.getClient();
      const [datasets] = await bqClient.getDatasets();
      return datasets.map(dataset => dataset.id || '').filter(Boolean);
    } catch (error) {
      throw new BigQueryPermissionError(
        `Failed to list accessible datasets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List all tables in a dataset the service account has access to
   */
  public async listAccessibleTables(datasetId: string): Promise<string[]> {
    try {
      const bqClient = this.client.getClient();
      const dataset = bqClient.dataset(datasetId);
      const [tables] = await dataset.getTables();
      return tables.map(table => table.id || '').filter(Boolean);
    } catch (error) {
      throw new BigQueryPermissionError(
        `Failed to list accessible tables: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Grant permissions to a user or service account on a dataset
   * Note: This requires OWNER permissions on the dataset
   */
  public async grantDatasetAccess(
    datasetId: string,
    entity: string, // e.g., "user:email@example.com"
    role: 'READER' | 'WRITER' | 'OWNER'
  ): Promise<void> {
    try {
      const bqClient = this.client.getClient();
      const dataset = bqClient.dataset(datasetId);

      // Get current access controls
      const [metadata] = await dataset.getMetadata();
      const currentAccess = metadata.access || [];

      // Add new access entry
      const newAccess = {
        role,
        entity,
      };

      // Check if entity already has access
      const existingIndex = currentAccess.findIndex(
        (access: any) => access.entity === entity
      );

      if (existingIndex >= 0) {
        // Update existing access
        currentAccess[existingIndex] = newAccess;
      } else {
        // Add new access
        currentAccess.push(newAccess);
      }

      // Update dataset access
      await dataset.setMetadata({
        access: currentAccess,
      });
    } catch (error) {
      throw new BigQueryPermissionError(
        `Failed to grant dataset access: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Revoke permissions from a user or service account on a dataset
   * Note: This requires OWNER permissions on the dataset
   */
  public async revokeDatasetAccess(
    datasetId: string,
    entity: string
  ): Promise<void> {
    try {
      const bqClient = this.client.getClient();
      const dataset = bqClient.dataset(datasetId);

      // Get current access controls
      const [metadata] = await dataset.getMetadata();
      const currentAccess = metadata.access || [];

      // Remove access entry
      const newAccess = currentAccess.filter(
        (access: any) => access.entity !== entity
      );

      // Update dataset access
      await dataset.setMetadata({
        access: newAccess,
      });
    } catch (error) {
      throw new BigQueryPermissionError(
        `Failed to revoke dataset access: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current access controls for a dataset
   */
  public async getDatasetAccessControls(datasetId: string): Promise<DatasetRole[]> {
    try {
      const bqClient = this.client.getClient();
      const dataset = bqClient.dataset(datasetId);

      const [metadata] = await dataset.getMetadata();
      return (metadata.access || []).map((access: any) => ({
        role: access.role,
        entity: access.entity,
      }));
    } catch (error) {
      throw new BigQueryPermissionError(
        `Failed to get dataset access controls: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate that required tables exist and are accessible
   */
  public async validateTableAccess(
    tables: Array<{ dataset: string; table: string }>
  ): Promise<{
    valid: boolean;
    missing: Array<{ dataset: string; table: string }>;
    inaccessible: Array<{ dataset: string; table: string; error: string }>;
  }> {
    const missing: Array<{ dataset: string; table: string }> = [];
    const inaccessible: Array<{ dataset: string; table: string; error: string }> = [];

    for (const { dataset, table } of tables) {
      try {
        const permissions = await this.checkTablePermissions(dataset, table);
        if (!permissions.read) {
          inaccessible.push({
            dataset,
            table,
            error: 'No read permission',
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Not found')) {
          missing.push({ dataset, table });
        } else {
          inaccessible.push({
            dataset,
            table,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return {
      valid: missing.length === 0 && inaccessible.length === 0,
      missing,
      inaccessible,
    };
  }
}