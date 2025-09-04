# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-04-brand-main-page/spec.md

## Schema Changes

### Enhanced Materialized Views for Share Metrics

Create materialized views to calculate market share metrics required by the dashboard:

```sql
-- Create materialized view for ASIN share metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.asin_share_metrics AS
WITH market_totals AS (
    SELECT 
        start_date,
        end_date,
        SUM(impressions) as total_market_impressions,
        SUM(clicks) as total_market_clicks,
        SUM(cart_adds) as total_market_cart_adds,
        SUM(purchases) as total_market_purchases
    FROM public.search_performance_summary
    GROUP BY start_date, end_date
),
asin_metrics AS (
    SELECT 
        sps.asin,
        sps.start_date,
        sps.end_date,
        SUM(sps.impressions) as asin_impressions,
        SUM(sps.clicks) as asin_clicks,
        SUM(sps.cart_adds) as asin_cart_adds,
        SUM(sps.purchases) as asin_purchases,
        CASE WHEN SUM(sps.clicks) > 0 
            THEN (SUM(sps.purchases)::numeric / SUM(sps.clicks)::numeric) * 100
            ELSE 0 
        END as asin_cvr,
        CASE WHEN SUM(sps.impressions) > 0 
            THEN (SUM(sps.clicks)::numeric / SUM(sps.impressions)::numeric) * 100
            ELSE 0 
        END as asin_ctr
    FROM public.search_performance_summary sps
    GROUP BY sps.asin, sps.start_date, sps.end_date
)
SELECT 
    am.asin,
    am.start_date,
    am.end_date,
    am.asin_impressions,
    am.asin_clicks,
    am.asin_cart_adds,
    am.asin_purchases,
    am.asin_cvr,
    am.asin_ctr,
    -- Share calculations
    ROUND((am.asin_impressions::numeric / NULLIF(mt.total_market_impressions, 0) * 100), 1) as impression_share,
    ROUND((am.asin_clicks::numeric / NULLIF(mt.total_market_clicks, 0) * 100), 1) as ctr_share,
    ROUND((am.asin_purchases::numeric / NULLIF(mt.total_market_purchases, 0) * 100), 1) as cvr_share,
    ROUND((am.asin_cart_adds::numeric / NULLIF(mt.total_market_cart_adds, 0) * 100), 1) as cart_add_share,
    ROUND((am.asin_purchases::numeric / NULLIF(mt.total_market_purchases, 0) * 100), 1) as purchase_share
FROM asin_metrics am
JOIN market_totals mt ON am.start_date = mt.start_date AND am.end_date = mt.end_date;

-- Create index for performance
CREATE INDEX idx_asin_share_metrics_asin_date ON sqp.asin_share_metrics(asin, start_date, end_date);
```

### Brand Dashboard Aggregation View

```sql
CREATE OR REPLACE VIEW sqp.brand_dashboard_data AS
SELECT 
    b.id as brand_id,
    b.display_name as brand_name,
    apd.asin,
    apd.product_title,
    -- Current period metrics
    COALESCE(asm.asin_impressions, 0) as impressions,
    COALESCE(asm.asin_clicks, 0) as clicks,
    COALESCE(asm.asin_cart_adds, 0) as cart_adds,
    COALESCE(asm.asin_purchases, 0) as purchases,
    COALESCE(asm.asin_ctr, 0) as ctr,
    COALESCE(asm.asin_cvr, 0) as cvr,
    -- Share metrics
    COALESCE(asm.impression_share, 0) as impression_share,
    COALESCE(asm.ctr_share, 0) as ctr_share,
    COALESCE(asm.cvr_share, 0) as cvr_share,
    COALESCE(asm.cart_add_share, 0) as cart_add_share,
    COALESCE(asm.purchase_share, 0) as purchase_share
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
LEFT JOIN sqp.asin_share_metrics asm ON apd.asin = asm.asin;
```

### Search Query Aggregation by Brand

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_search_query_metrics AS
SELECT 
    b.id as brand_id,
    sqp.search_query,
    SUM(sqp.impressions) as impressions,
    SUM(sqp.clicks) as clicks,
    SUM(sqp.cart_adds) as cart_adds,
    SUM(sqp.purchases) as purchases,
    CASE WHEN SUM(sqp.clicks) > 0 
        THEN ROUND((SUM(sqp.purchases)::numeric / SUM(sqp.clicks)::numeric) * 100, 1)
        ELSE 0 
    END as cvr,
    CASE WHEN SUM(sqp.impressions) > 0 
        THEN ROUND((SUM(sqp.clicks)::numeric / SUM(sqp.impressions)::numeric) * 100, 1)
        ELSE 0 
    END as ctr,
    -- Calculate share metrics at query level
    ROUND((SUM(sqp.impressions)::numeric / SUM(SUM(sqp.impressions)) OVER (PARTITION BY b.id) * 100), 1) as impression_share,
    ROUND((SUM(sqp.clicks)::numeric / SUM(SUM(sqp.clicks)) OVER (PARTITION BY b.id) * 100), 1) as ctr_share,
    ROUND((SUM(sqp.purchases)::numeric / SUM(SUM(sqp.purchases)) OVER (PARTITION BY b.id) * 100), 1) as cvr_share,
    ROUND((SUM(sqp.cart_adds)::numeric / SUM(SUM(sqp.cart_adds)) OVER (PARTITION BY b.id) * 100), 1) as cart_add_share,
    ROUND((SUM(sqp.purchases)::numeric / SUM(SUM(sqp.purchases)) OVER (PARTITION BY b.id) * 100), 1) as purchase_share
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.search_query_performance sqp ON abm.asin = sqp.asin
GROUP BY b.id, sqp.search_query;

-- Create index for performance
CREATE INDEX idx_brand_search_query_metrics_brand_id ON sqp.brand_search_query_metrics(brand_id);
```

## Migration Script

```sql
-- Migration: 031_create_brand_dashboard_views.sql

-- Create ASIN share metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.asin_share_metrics AS
[... view definition above ...]

-- Create brand dashboard data view
CREATE OR REPLACE VIEW sqp.brand_dashboard_data AS
[... view definition above ...]

-- Create brand search query metrics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_search_query_metrics AS
[... view definition above ...]

-- Grant permissions
GRANT SELECT ON sqp.asin_share_metrics TO authenticated;
GRANT SELECT ON sqp.brand_dashboard_data TO authenticated;
GRANT SELECT ON sqp.brand_search_query_metrics TO authenticated;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW sqp.asin_share_metrics;
REFRESH MATERIALIZED VIEW sqp.brand_search_query_metrics;
```

## Performance Considerations

- **Share Calculations**: Pre-calculated in materialized views for fast retrieval
- **Market Totals**: Aggregated at date level to avoid repeated calculations
- **Indexes**: Brand and ASIN-based indexes for efficient filtering
- **Refresh Strategy**: Refresh after each data sync operation

## Data Integrity

- **NULL Safety**: COALESCE and NULLIF prevent division errors
- **Percentage Precision**: ROUND to 1 decimal place for consistency
- **Zero Handling**: Returns 0 for shares when denominators are zero