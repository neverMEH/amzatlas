# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-26-bigquery-supabase-data-testing/spec.md

> Created: 2025-08-26
> Version: 1.0.0

## Technical Requirements

### Core Infrastructure Enhancement

1. **BigQueryToSupabaseSync Class Extensions**
   - Add data inspection methods to existing class
   - Implement configurable ASIN filtering with multiple strategies:
     - Random sampling (configurable sample size)
     - Top performers by revenue/sessions
     - Specific ASIN list import
     - Date range filtering
   - Enhance existing sync methods with validation hooks

2. **Data Validation Framework**
   - Row count comparison between BigQuery source and Supabase destination
   - Schema validation to ensure data type consistency
   - Statistical analysis (min/max/avg/sum) comparison
   - Missing data detection and reporting
   - Data freshness validation (timestamp comparison)

3. **Testing Interface**
   - Command-line interface for running data tests
   - Configurable test parameters (date ranges, ASIN filters, validation rules)
   - Test result reporting with pass/fail status
   - Detailed discrepancy logging

### Implementation Architecture

#### Enhanced BigQueryToSupabaseSync Class

```typescript
class BigQueryToSupabaseSync {
  // Existing methods...
  
  // New data inspection capabilities
  async inspectSourceData(options: InspectionOptions): Promise<DataInspectionResult>
  async validateSyncedData(tableName: string, filters: FilterOptions): Promise<ValidationResult>
  async compareDataSets(source: DataSet, destination: DataSet): Promise<ComparisonResult>
  
  // Enhanced filtering
  async applySyncFilters(filters: SyncFilters): Promise<FilteredDataSet>
}
```

#### Data Testing Components

1. **DataValidator Class**
   - Schema validation methods
   - Statistical comparison functions  
   - Data integrity checks
   - Custom validation rule engine

2. **TestRunner Class**
   - Test orchestration and execution
   - Result aggregation and reporting
   - Test configuration management
   - Parallel test execution support

3. **ReportGenerator Class**
   - HTML/JSON/CSV report generation
   - Visual data comparison charts
   - Executive summary generation
   - Historical test result tracking

### Data Structures

#### Configuration Types
```typescript
interface InspectionOptions {
  dateRange: { start: Date; end: Date };
  asinFilters: ASINFilterConfig;
  tables: string[];
  validationRules: ValidationRule[];
}

interface ASINFilterConfig {
  strategy: 'random' | 'top_performers' | 'specific_list' | 'date_range';
  sampleSize?: number;
  performanceMetric?: 'revenue' | 'sessions' | 'conversion_rate';
  asinList?: string[];
  minPerformanceThreshold?: number;
}

interface ValidationRule {
  name: string;
  type: 'row_count' | 'schema' | 'statistical' | 'freshness' | 'custom';
  parameters: Record<string, any>;
  threshold?: number;
}
```

#### Result Types
```typescript
interface ValidationResult {
  testId: string;
  tableName: string;
  status: 'pass' | 'fail' | 'warning';
  summary: ValidationSummary;
  details: ValidationDetail[];
  executionTime: number;
  timestamp: Date;
}

interface DataInspectionResult {
  sourceRowCount: number;
  destinationRowCount: number;
  schemaComparison: SchemaComparisonResult;
  statisticalAnalysis: StatisticalSummary;
  dataQualityMetrics: DataQualityResult;
}
```

## Approach

### Phase 1: Core Infrastructure Enhancement (Week 1)

1. **Extend Existing BigQueryToSupabaseSync Class**
   - Add data inspection methods without breaking existing functionality
   - Implement configurable ASIN filtering using existing BigQuery client
   - Enhance logging and monitoring capabilities

2. **Build Data Validation Framework**
   - Create modular validation components that work with existing schemas
   - Implement comparison algorithms for numerical and categorical data
   - Add support for custom validation rules

### Phase 2: Testing Interface Development (Week 2)

1. **Command Line Interface**
   - Build CLI using existing Node.js infrastructure
   - Integrate with current configuration management
   - Support for batch test execution

2. **Reporting System**
   - Generate comprehensive test reports
   - Create data visualization components
   - Implement historical result tracking

### Phase 3: Integration & Optimization (Week 3)

1. **Performance Optimization**
   - Leverage existing connection pooling
   - Implement parallel processing for large datasets
   - Add caching for repeated validations

2. **Production Integration**
   - Add monitoring and alerting capabilities
   - Create automated test scheduling
   - Implement rollback mechanisms for failed syncs

### Technical Integration Points

#### Leverage Existing Infrastructure

1. **BigQuery Client**
   - Use existing `@google-cloud/bigquery` connection pooling
   - Extend current query optimization patterns
   - Utilize existing authentication mechanisms

2. **Supabase Integration**
   - Build on existing `@supabase/supabase-js` admin client
   - Use current table schemas and relationships
   - Leverage existing RLS policies where applicable

3. **Data Processing**
   - Extend current period aggregation logic
   - Use existing transformation pipelines
   - Build on current error handling patterns

#### Database Schema Utilization

- **Source Tables**: Use existing BigQuery `sqp.*` schema structure
- **Destination Tables**: Work with current Supabase table definitions
- **Validation Tables**: Create minimal validation result storage using existing patterns

## External Dependencies

### No New External Dependencies Required

The implementation will use existing dependencies:

- **@google-cloud/bigquery**: Already integrated for BigQuery operations
- **@supabase/supabase-js**: Currently used for Supabase operations  
- **Node.js Built-ins**: `fs`, `path`, `crypto` for file operations and utilities
- **TypeScript**: Existing type system and compilation setup

### Infrastructure Dependencies

- **BigQuery**: Existing dataset and table access permissions
- **Supabase**: Current database connection and admin privileges
- **Authentication**: Existing service account and API key management
- **Logging**: Current logging infrastructure and error handling

### Configuration Management

Build on existing configuration patterns:
- Environment variable management
- Service account key handling
- Database connection strings
- API endpoint configurations

This approach ensures seamless integration with the existing codebase while providing robust data testing and validation capabilities without introducing additional external dependencies or infrastructure complexity.