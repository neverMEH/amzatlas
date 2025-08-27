/**
 * Column mappings between BigQuery tables and expected field names
 */

export interface ColumnMapping {
  bigqueryColumn: string;
  mappedName: string;
  dataType?: string;
}

export const SQP_COLUMN_MAPPINGS: ColumnMapping[] = [
  // Core fields
  { bigqueryColumn: 'Search Query', mappedName: 'query' },
  { bigqueryColumn: 'Child ASIN', mappedName: 'asin' },
  { bigqueryColumn: 'Date', mappedName: 'query_date', dataType: 'TIMESTAMP' },
  
  // Impression metrics
  { bigqueryColumn: 'ASIN Impression Count', mappedName: 'impressions' },
  { bigqueryColumn: 'Total Query Impression Count', mappedName: 'total_impressions' },
  { bigqueryColumn: 'ASIN Impression Share', mappedName: 'impression_share' },
  
  // Click metrics
  { bigqueryColumn: 'ASIN Click Count', mappedName: 'clicks' },
  { bigqueryColumn: 'Total Click Count', mappedName: 'total_clicks' },
  { bigqueryColumn: 'ASIN Click Share', mappedName: 'click_share' },
  { bigqueryColumn: 'Total Click Rate', mappedName: 'ctr' },
  
  // Purchase metrics
  { bigqueryColumn: 'ASIN Purchase Count', mappedName: 'purchases' },
  { bigqueryColumn: 'Total Purchase Count', mappedName: 'total_purchases' },
  { bigqueryColumn: 'ASIN Purchase Share', mappedName: 'purchase_share' },
  { bigqueryColumn: 'Total Purchase Rate', mappedName: 'conversion_rate' },
  
  // Cart metrics
  { bigqueryColumn: 'ASIN Cart Add Count', mappedName: 'cart_adds' },
  { bigqueryColumn: 'Total Cart Add Count', mappedName: 'total_cart_adds' },
  { bigqueryColumn: 'ASIN Cart Add Share', mappedName: 'cart_add_share' },
  { bigqueryColumn: 'Total Cart Add Rate', mappedName: 'cart_add_rate' },
  
  // Additional fields
  { bigqueryColumn: 'Client Name', mappedName: 'client_name' },
  { bigqueryColumn: 'Marketplace', mappedName: 'marketplace' },
  { bigqueryColumn: 'Parent ASIN', mappedName: 'parent_asin' },
  { bigqueryColumn: 'Product Name', mappedName: 'product_name' },
  { bigqueryColumn: 'Category', mappedName: 'category' },
  { bigqueryColumn: 'Search Query Score', mappedName: 'query_score' },
  { bigqueryColumn: 'Search Query Volume', mappedName: 'query_volume' },
];

/**
 * Get SQL for selecting columns with aliases
 */
export function getSelectClause(mappings: ColumnMapping[]): string {
  return mappings
    .map(m => `\`${m.bigqueryColumn}\` as ${m.mappedName}`)
    .join(',\n    ');
}

/**
 * Get WHERE clause field name
 */
export function getWhereField(fieldName: string): string {
  const mapping = SQP_COLUMN_MAPPINGS.find(m => m.mappedName === fieldName);
  return mapping ? `\`${mapping.bigqueryColumn}\`` : fieldName;
}

/**
 * Transform a row from BigQuery to use mapped names
 */
export function transformRow(row: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = {};
  
  // First, copy over any fields that have mapped names
  for (const mapping of SQP_COLUMN_MAPPINGS) {
    if (row.hasOwnProperty(mapping.bigqueryColumn)) {
      transformed[mapping.mappedName] = row[mapping.bigqueryColumn];
    }
  }
  
  // Then copy over any remaining fields that weren't mapped
  for (const [key, value] of Object.entries(row)) {
    if (!SQP_COLUMN_MAPPINGS.some(m => m.bigqueryColumn === key)) {
      transformed[key] = value;
    }
  }
  
  return transformed;
}