# BigQuery Data Update Specification

## Feature Overview
Update all Supabase tables with the most recent available data from BigQuery using a 60-day pull to capture any missing dates and ensure data completeness.

## Objectives
1. Identify and fill data gaps in Supabase tables
2. Sync the last 60 days of data from BigQuery to ensure complete coverage
3. Update all materialized views and dependent data structures
4. Ensure data integrity and consistency across the system

## Technical Requirements

### Data Sources
- **BigQuery Dataset**: `dataclient_amzatlas_agency_85`
- **Target Tables**:
  - `sqp.asin_performance_data`
  - `sqp.search_query_performance`

### Sync Configuration
- **Date Range**: Last 60 days from current date
- **Batch Size**: Process data in weekly batches to avoid timeouts
- **Error Handling**: Implement retry logic and comprehensive error logging

### Data Validation
- Verify row counts match between source and destination
- Ensure date coverage is complete with no gaps
- Validate data types and constraints
- Update sync_log with detailed results

### Affected Components
- BigQuery sync scripts
- Supabase tables and views
- Dashboard APIs
- Keyword analysis features
- Refresh monitor system

## Implementation Approach
1. Use existing sync infrastructure with modified date range
2. Leverage batch processing to handle large data volumes
3. Implement comprehensive validation and logging
4. Test thoroughly before and after sync

## Success Criteria
- All data from the last 60 days is successfully synced
- No data gaps exist in the target date range
- All materialized views are updated
- Dashboard and application features work correctly with new data
- Sync_log contains complete audit trail