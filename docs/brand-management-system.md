# Brand Management System Documentation

## Overview

This document describes the comprehensive brand management system implemented for SQP Intelligence, which enables automatic ASIN-to-brand mapping based on product titles extracted from BigQuery.

## Implementation Date
- **Date**: August 29, 2025
- **Branch**: main
- **Key Commits**: 
  - `2778a1c` - feat: Add comprehensive brand management system with automatic ASIN matching
  - `be3da59` - fix: Resolve TypeScript error in nested-data-transformer

## Key Features

### 1. Product Title Extraction
- Modified BigQuery sync to include `Product Name` and `Client Name` fields
- Successfully populated 2,556 ASINs with product titles from BigQuery
- Added `product_title` column to `asin_performance_data` table

### 2. Automatic Brand Matching
- Created RPC functions for brand management:
  - `match_asins_to_brand()` - Matches ASINs to existing brands based on patterns
  - `create_brand_and_match()` - Creates new brands and automatically matches ASINs
- Pattern-based matching with confidence scores (0.9 for start matches, 0.7 for contains)
- Support for multiple match patterns per brand

### 3. Schema Access Resolution
- Discovered Supabase API limitation: only `public` and `graphql_public` schemas are accessible
- Changed from `sqp` schema to `public` schema in Supabase client configuration
- Created migration for public views (026) to expose sqp tables through public schema

### 4. Brand Data Cleanup
- Cleaned up incorrect brand entries (product names mistakenly identified as brands)
- Properly configured "Work Sharp" as the primary brand with 83 ASIN mappings
- Removed duplicate and incorrect brand entries

## Database Changes

### Migrations Added
1. **025_add_post_sync_brand_extraction.sql**
   - Adds trigger for automatic brand extraction after data sync
   - Extracts brands when product_title is inserted/updated

2. **026_create_public_views_for_sqp_tables.sql**
   - Creates public schema views for sqp tables
   - Enables API access to sqp schema data
   - Includes INSTEAD OF triggers for INSERT/UPDATE/DELETE operations

3. **027_add_brand_matching_functions.sql**
   - Adds RPC functions for brand matching
   - No triggers (due to view limitations)

### Table Modifications
- `asin_performance_data`: Added `product_title` column
- `asin_brand_mapping`: Stores ASIN-to-brand relationships
- `brands`: Stores brand information with normalized names

## CLI Tools Created

### 1. Brand Management
- `add-brand.ts` - Add new brands with automatic ASIN matching
  ```bash
  npx tsx src/scripts/add-brand.ts "Spyderco" --display-name "Spyderco Knives"
  npx tsx src/scripts/add-brand.ts "Benchmade" --patterns "BENCHMADE" "Bench Made"
  npx tsx src/scripts/add-brand.ts "Kershaw" --dry-run
  ```

### 2. Data Management
- `update-product-titles.ts` - Sync product titles from BigQuery
- `cleanup-brands.ts` - Remove incorrect brand entries
- `extract-brands.ts` - Extract brands from product titles
- `test-brand-functions.ts` - Test RPC functions

### 3. Sync Scripts
- `sync-all-data-no-logging.ts` - Sync data without logging (avoids schema issues)
- Multiple test scripts for verifying product data sync

## Code Changes

### Modified Files
1. **src/lib/supabase/sync/nested-bigquery-to-supabase.ts**
   - Added Product Name and Client Name to query
   - Updated transformToNestedStructure to preserve product data

2. **src/lib/supabase/sync/nested-data-transformer.ts**
   - Modified insertASINPerformance to handle product titles
   - Fixed upsert issues by implementing select-then-update pattern

3. **src/config/supabase.config.ts**
   - Changed schema from 'sqp' to 'public' to resolve API access issues

### New Components
- `SqpSyncLogger` - Handles sync logging with schema awareness
- Comprehensive test suite for product data extraction

## Current Status

### Data Statistics
- **Total Brands**: 1 (Work Sharp)
- **ASIN-Brand Mappings**: 83
- **ASINs with Product Titles**: 2,556
- **Brand Hierarchy Records**: 5

### Pending Actions
1. Apply migration 027 in Supabase SQL editor
2. Set up regular sync schedule
3. Add additional brands using the CLI tools

## Usage Examples

### Adding a New Brand
```bash
# Add a brand with automatic matching
npx tsx src/scripts/add-brand.ts "Spyderco" --display-name "Spyderco Knives"

# Preview matches without creating
npx tsx src/scripts/add-brand.ts "Kershaw" --dry-run
```

### Manual Brand Matching
```typescript
// Using Supabase client
const { data } = await supabase.rpc('match_asins_to_brand', {
  p_brand_name: 'Work Sharp',
  p_match_patterns: ['Work Sharp', 'WorkSharp', 'WORK SHARP']
});
```

### Creating Brand with Patterns
```typescript
const { data } = await supabase.rpc('create_brand_and_match', {
  p_brand_name: 'Benchmade',
  p_display_name: 'Benchmade Knives',
  p_match_patterns: ['Benchmade', 'BENCHMADE', 'Bench Made']
});
```

## Technical Considerations

### Schema Limitations
- Supabase PostgREST API only exposes `public` and `graphql_public` schemas
- Workaround: Use public views with INSTEAD OF triggers
- Alternative: Direct database connections bypass this limitation

### Performance Optimizations
- Added indexes on product_title and brand_name columns
- Batch processing for large ASIN sets
- Connection pooling for BigQuery operations

### Error Handling
- Graceful handling of duplicate key violations
- Confidence score comparison for conflicting mappings
- Comprehensive error logging throughout sync process

## Future Enhancements

1. **Automatic Sync Scheduling**
   - Implement cron job or Railway scheduled tasks
   - Regular updates of product titles and brand mappings

2. **Brand Hierarchy Management**
   - Support for parent/child brand relationships
   - Brand consolidation features

3. **Frontend Integration**
   - Brand performance dashboards
   - Brand comparison reports
   - ASIN-brand mapping management UI

4. **Advanced Matching**
   - ML-based brand extraction
   - Fuzzy matching algorithms
   - Brand alias support

## Troubleshooting

### Common Issues
1. **Schema Access Errors**: Ensure using public schema in Supabase client
2. **Upsert Failures**: Check for unique constraints on tables
3. **Missing Product Titles**: Run `update-product-titles.ts` to sync from BigQuery
4. **Brand Not Matching**: Verify patterns and check confidence scores

### Debug Commands
```bash
# Test brand functions
npx tsx src/scripts/test-brand-functions.ts

# Verify product titles
npx tsx src/scripts/test-product-sync.ts

# Check brand mappings
npx tsx -r dotenv/config -e "/* query code */"
```

## References
- Original requirements: Extract brand information from product titles
- Solution: Pattern-based matching with manual override capabilities
- Result: Automated system for brand management with 83 successfully mapped ASINs