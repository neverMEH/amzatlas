# Tables Affected by ASIN Column Length Issue

## Core Tables with ASIN Columns (Currently VARCHAR(10))

### sqp Schema Tables:
1. **sqp.asin_performance_data** - Main ASIN performance metrics table
2. **sqp.search_query_performance** - Search query data by ASIN
3. **sqp.daily_sqp_data** - Daily aggregated data
4. **sqp.weekly_summary** - Weekly aggregations
5. **sqp.monthly_summary** - Monthly aggregations
6. **sqp.quarterly_summary** - Quarterly aggregations
7. **sqp.yearly_summary** - Yearly aggregations

### Tables Already Fixed (VARCHAR(20)):
1. **sqp.brands** - Brand management table (already VARCHAR(20))
2. **sqp.asin_brand_mapping** - ASIN to brand mapping (already VARCHAR(20))
3. **sqp.product_type_mapping** - Product type mapping (already VARCHAR(20))

## Dependent Views

### Public Schema Views:
1. **public.asin_performance_data** - View on sqp.asin_performance_data
2. **public.search_performance_summary** - View joining multiple tables
3. **public.asin_performance_by_brand** - View with brand performance metrics

### sqp Schema Views:
1. **sqp.brand_search_query_metrics** - Materialized view for brand metrics
2. **sqp.anomaly_current_alerts** - Current anomaly alerts
3. **sqp.rolling_average_current** - Rolling averages
4. **sqp.trend_classification_current** - Trend classification

## Migration Strategy

The migration needs to:
1. Drop all dependent views (they reference the ASIN columns)
2. Alter all ASIN columns from VARCHAR(10) to VARCHAR(20)
3. Recreate all views with proper permissions

## Verification Queries

To check current state:
```sql
-- Check ASIN column sizes
SELECT table_schema, table_name, column_name, character_maximum_length
FROM information_schema.columns
WHERE column_name = 'asin'
  AND table_schema IN ('sqp', 'public')
ORDER BY table_schema, table_name;
```

To find long ASINs that would fail:
```sql
-- Check for ASINs longer than 10 characters
SELECT COUNT(*) as long_asin_count
FROM sqp.asin_performance_data
WHERE LENGTH(asin) > 10;
```