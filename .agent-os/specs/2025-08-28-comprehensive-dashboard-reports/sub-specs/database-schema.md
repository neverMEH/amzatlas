# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-28-comprehensive-dashboard-reports/spec.md

## Schema Overview

The period-over-period reporting system builds on existing BigQuery-synced tables (`search_query_performance` and `asin_performance_data`) and requires new materialized views and optimized table structures to support efficient time-based comparisons and aggregations, with brand-level filtering and grouping as a core requirement.

## Existing Tables (From BigQuery - DO NOT MODIFY STRUCTURE)

### 1. search_query_performance
- Primary table containing search query metrics
- Synced weekly from BigQuery
- Contains: asin, search_query, start_date, end_date, impression/click/purchase metrics

### 2. asin_performance_data  
- ASIN-level performance data
- Synced weekly from BigQuery
- Contains: asin, start_date, end_date, product_title (used for brand extraction)

## New Tables

### 1. brands table
```sql
CREATE TABLE IF NOT EXISTS sqp.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL UNIQUE,
  normalized_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  parent_brand_id UUID REFERENCES sqp.brands(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_brands_normalized ON sqp.brands(normalized_name);
CREATE INDEX idx_brands_parent ON sqp.brands(parent_brand_id) WHERE parent_brand_id IS NOT NULL;
```

### 2. asin_brand_mapping table
```sql
CREATE TABLE IF NOT EXISTS sqp.asin_brand_mapping (
  asin VARCHAR(20) PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES sqp.brands(id),
  product_title TEXT NOT NULL,
  extraction_method VARCHAR(50) NOT NULL CHECK (extraction_method IN ('automatic', 'manual', 'override')),
  confidence_score DECIMAL(3,2),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_asin_brand_mapping_brand ON sqp.asin_brand_mapping(brand_id);
CREATE INDEX idx_asin_brand_confidence ON sqp.asin_brand_mapping(confidence_score) WHERE extraction_method = 'automatic';
```

## New Materialized Views

### 1. brand_performance_summary
```sql
CREATE MATERIALIZED VIEW sqp.brand_performance_summary AS
WITH brand_metrics AS (
  SELECT 
    b.id as brand_id,
    b.brand_name,
    b.display_name,
    DATE_TRUNC('week', sqp.start_date) as week_start,
    DATE_TRUNC('month', sqp.start_date) as month_start,
    SUM(sqp.search_query_volume) as total_search_volume,
    SUM(sqp.asin_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    COUNT(DISTINCT sqp.asin) as active_asins,
    COUNT(DISTINCT sqp.search_query) as unique_queries,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    AVG(sqp.asin_median_purchase_price) as avg_purchase_price
  FROM sqp.search_query_performance sqp
  JOIN sqp.asin_brand_mapping abm ON sqp.asin = abm.asin
  JOIN sqp.brands b ON abm.brand_id = b.id
  WHERE b.is_active = true
  GROUP BY b.id, b.brand_name, b.display_name, week_start, month_start
)
SELECT 
  *,
  -- Calculate conversion funnel rates
  CASE WHEN total_impressions > 0 THEN total_clicks::decimal / total_impressions ELSE 0 END as click_rate,
  CASE WHEN total_clicks > 0 THEN total_cart_adds::decimal / total_clicks ELSE 0 END as cart_add_rate,
  CASE WHEN total_cart_adds > 0 THEN total_purchases::decimal / total_cart_adds ELSE 0 END as purchase_rate,
  -- Period-over-period comparisons
  LAG(total_search_volume) OVER (PARTITION BY brand_id ORDER BY week_start) as prev_week_volume,
  LAG(total_purchases) OVER (PARTITION BY brand_id ORDER BY week_start) as prev_week_purchases
FROM brand_metrics;

CREATE INDEX idx_brand_performance_summary ON sqp.brand_performance_summary(brand_id, week_start);
CREATE INDEX idx_brand_performance_dates ON sqp.brand_performance_summary(week_start, month_start);
```

### 2. period_performance_summary
```sql
CREATE MATERIALIZED VIEW sqp.period_performance_summary AS
WITH period_data AS (
  SELECT 
    sqp.asin,
    abm.brand_id,
    DATE_TRUNC('week', sqp.start_date) as week_start,
    DATE_TRUNC('month', sqp.start_date) as month_start,
    DATE_TRUNC('quarter', sqp.start_date) as quarter_start,
    DATE_TRUNC('year', sqp.start_date) as year_start,
    SUM(sqp.search_query_volume) as total_search_volume,
    SUM(sqp.asin_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    AVG(sqp.asin_click_share) as avg_click_share,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    AVG(sqp.asin_median_click_price) as avg_click_price,
    AVG(sqp.asin_median_cart_add_price) as avg_cart_add_price,
    AVG(sqp.asin_median_purchase_price) as avg_purchase_price
  FROM sqp.search_query_performance sqp
  LEFT JOIN sqp.asin_brand_mapping abm ON sqp.asin = abm.asin
  GROUP BY sqp.asin, abm.brand_id, week_start, month_start, quarter_start, year_start
)
SELECT 
  asin,
  brand_id,
  week_start,
  month_start,
  quarter_start,
  year_start,
  total_search_volume,
  total_impressions,
  total_clicks,
  total_cart_adds,
  total_purchases,
  -- Calculate period-over-period changes
  LAG(total_search_volume) OVER (PARTITION BY asin ORDER BY week_start) as prev_week_search_volume,
  LAG(total_search_volume, 4) OVER (PARTITION BY asin ORDER BY week_start) as prev_month_search_volume,
  LAG(total_search_volume, 13) OVER (PARTITION BY asin ORDER BY week_start) as prev_quarter_search_volume,
  LAG(total_search_volume, 52) OVER (PARTITION BY asin ORDER BY week_start) as prev_year_search_volume,
  -- Conversion rates
  CASE WHEN total_impressions > 0 THEN total_clicks::decimal / total_impressions ELSE 0 END as click_rate,
  CASE WHEN total_clicks > 0 THEN total_cart_adds::decimal / total_clicks ELSE 0 END as cart_add_rate,
  CASE WHEN total_cart_adds > 0 THEN total_purchases::decimal / total_cart_adds ELSE 0 END as purchase_rate,
  -- Share metrics
  avg_impression_share,
  avg_click_share,
  avg_cart_add_share,
  avg_purchase_share,
  -- Pricing
  avg_click_price,
  avg_cart_add_price,
  avg_purchase_price
FROM period_data;

CREATE INDEX idx_period_performance_asin_week ON sqp.period_performance_summary(asin, week_start);
CREATE INDEX idx_period_performance_brand ON sqp.period_performance_summary(brand_id, week_start);
CREATE INDEX idx_period_performance_dates ON sqp.period_performance_summary(week_start, month_start, quarter_start, year_start);
```

### 3. query_trend_analysis
```sql
CREATE MATERIALIZED VIEW sqp.query_trend_analysis AS
WITH query_metrics AS (
  SELECT 
    sqp.search_query,
    sqp.asin,
    abm.brand_id,
    DATE_TRUNC('week', sqp.start_date) as period_start,
    'week' as period_type,
    SUM(sqp.search_query_volume) as query_volume,
    AVG(sqp.search_query_score) as avg_query_score,
    SUM(sqp.asin_impression_count) as impressions,
    SUM(sqp.asin_click_count) as clicks,
    SUM(sqp.asin_cart_add_count) as cart_adds,
    SUM(sqp.asin_purchase_count) as purchases
  FROM sqp.search_query_performance sqp
  LEFT JOIN sqp.asin_brand_mapping abm ON sqp.asin = abm.asin
  GROUP BY sqp.search_query, sqp.asin, abm.brand_id, period_start
  
  UNION ALL
  
  SELECT 
    sqp.search_query,
    sqp.asin,
    abm.brand_id,
    DATE_TRUNC('month', sqp.start_date) as period_start,
    'month' as period_type,
    SUM(sqp.search_query_volume) as query_volume,
    AVG(sqp.search_query_score) as avg_query_score,
    SUM(sqp.asin_impression_count) as impressions,
    SUM(sqp.asin_click_count) as clicks,
    SUM(sqp.asin_cart_add_count) as cart_adds,
    SUM(sqp.asin_purchase_count) as purchases
  FROM sqp.search_query_performance sqp
  LEFT JOIN sqp.asin_brand_mapping abm ON sqp.asin = abm.asin
  GROUP BY sqp.search_query, sqp.asin, abm.brand_id, period_start
)
SELECT 
  *,
  -- Period-over-period changes
  LAG(query_volume) OVER (PARTITION BY search_query, asin, period_type ORDER BY period_start) as prev_period_volume,
  LAG(avg_query_score) OVER (PARTITION BY search_query, asin, period_type ORDER BY period_start) as prev_period_score,
  -- Calculate growth rates
  CASE 
    WHEN LAG(query_volume) OVER (PARTITION BY search_query, asin, period_type ORDER BY period_start) > 0
    THEN ((query_volume - LAG(query_volume) OVER (PARTITION BY search_query, asin, period_type ORDER BY period_start))::decimal / 
          LAG(query_volume) OVER (PARTITION BY search_query, asin, period_type ORDER BY period_start)) * 100
    ELSE NULL 
  END as volume_growth_rate
FROM query_metrics;

CREATE INDEX idx_query_trend_search ON sqp.query_trend_analysis(search_query, period_type, period_start);
CREATE INDEX idx_query_trend_asin ON sqp.query_trend_analysis(asin, period_type, period_start);
CREATE INDEX idx_query_trend_brand ON sqp.query_trend_analysis(brand_id, period_type, period_start);
```

### 4. keyword_trend_analysis
```sql
CREATE MATERIALIZED VIEW sqp.keyword_trend_analysis AS
WITH keyword_weekly_metrics AS (
  SELECT
    DATE_TRUNC('week', sqp.start_date) as week,
    sqp.asin,
    abm.brand_id,
    sqp.search_query as keyword,
    SUM(sqp.search_query_volume) as weekly_volume,
    AVG(sqp.search_query_score) as avg_score,
    SUM(sqp.asin_impression_count) as impressions,
    AVG(sqp.asin_impression_share) as impression_share,
    SUM(sqp.asin_click_count) as clicks,
    AVG(sqp.asin_click_share) as click_share,
    SUM(sqp.asin_cart_add_count) as cart_adds,
    SUM(sqp.asin_purchase_count) as purchases,
    AVG(sqp.asin_purchase_share) as purchase_share,
    AVG(sqp.asin_median_purchase_price) as avg_price,
    SUM(sqp.asin_purchase_count * sqp.asin_median_purchase_price) as revenue
  FROM sqp.search_query_performance sqp
  LEFT JOIN sqp.asin_brand_mapping abm ON sqp.asin = abm.asin
  GROUP BY week, sqp.asin, abm.brand_id, sqp.search_query
),
with_rolling_calcs AS (
  SELECT
    *,
    -- 6-week rolling averages
    AVG(weekly_volume) OVER (
      PARTITION BY asin, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_volume,
    STDDEV(weekly_volume) OVER (
      PARTITION BY asin, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_stddev,
    AVG(revenue) OVER (
      PARTITION BY asin, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_revenue,
    -- Period comparisons
    LAG(weekly_volume, 1) OVER (PARTITION BY asin, keyword ORDER BY week) as prev_week_volume,
    LAG(weekly_volume, 6) OVER (PARTITION BY asin, keyword ORDER BY week) as six_weeks_ago_volume
  FROM keyword_weekly_metrics
)
SELECT
  week,
  asin,
  brand_id,
  keyword,
  weekly_volume,
  rolling_6w_volume,
  rolling_6w_stddev,
  -- Z-score for anomaly detection
  CASE 
    WHEN rolling_6w_stddev > 0 
    THEN (weekly_volume - rolling_6w_volume) / rolling_6w_stddev 
    ELSE 0 
  END as volume_z_score,
  -- Period changes
  CASE 
    WHEN rolling_6w_volume > 0 
    THEN (weekly_volume - rolling_6w_volume) / rolling_6w_volume * 100 
    ELSE NULL 
  END as volume_vs_6w_trend_pct,
  CASE 
    WHEN prev_week_volume > 0 
    THEN (weekly_volume - prev_week_volume) / prev_week_volume * 100 
    ELSE NULL 
  END as wow_change_pct,
  CASE 
    WHEN six_weeks_ago_volume > 0 
    THEN (weekly_volume - six_weeks_ago_volume) / six_weeks_ago_volume * 100 
    ELSE NULL 
  END as six_week_change_pct,
  -- Trend classification
  CASE
    WHEN weekly_volume > rolling_6w_volume * 1.2 
      AND (weekly_volume - six_weeks_ago_volume) / NULLIF(six_weeks_ago_volume, 0) > 0.2 THEN 'EMERGING'
    WHEN weekly_volume < rolling_6w_volume * 0.8 
      AND (weekly_volume - six_weeks_ago_volume) / NULLIF(six_weeks_ago_volume, 0) < -0.2 THEN 'DECLINING'
    WHEN ABS((weekly_volume - rolling_6w_volume) / NULLIF(rolling_6w_volume, 0)) < 0.1 THEN 'STABLE'
    ELSE 'VOLATILE'
  END as trend_status,
  -- Metrics
  avg_score,
  impression_share,
  click_share,
  purchase_share,
  revenue,
  rolling_6w_revenue,
  purchases,
  -- Conversion rates
  CASE WHEN impressions > 0 THEN clicks::decimal / impressions ELSE 0 END as ctr,
  CASE WHEN clicks > 0 THEN purchases::decimal / clicks ELSE 0 END as conversion_rate
FROM with_rolling_calcs;

CREATE INDEX idx_keyword_trend_week ON sqp.keyword_trend_analysis(week, brand_id);
CREATE INDEX idx_keyword_trend_asin ON sqp.keyword_trend_analysis(asin, week);
CREATE INDEX idx_keyword_trend_keyword ON sqp.keyword_trend_analysis(keyword, brand_id, week);
CREATE INDEX idx_keyword_trend_zscore ON sqp.keyword_trend_analysis(volume_z_score) WHERE ABS(volume_z_score) > 2;
```

### 5. product_type_keyword_trends
```sql
CREATE MATERIALIZED VIEW sqp.product_type_keyword_trends AS
WITH product_type_mapping AS (
  -- Extract product type from ASIN or product title
  -- This is a placeholder - adjust based on your actual product categorization
  SELECT DISTINCT
    asin,
    CASE
      -- Add your actual product type logic here
      WHEN product_title ILIKE '%headphone%' OR product_title ILIKE '%earphone%' THEN 'Audio'
      WHEN product_title ILIKE '%laptop%' OR product_title ILIKE '%computer%' THEN 'Computers'
      WHEN product_title ILIKE '%phone%' OR product_title ILIKE '%mobile%' THEN 'Mobile'
      ELSE 'Other'
    END as product_type
  FROM sqp.asin_performance_data
),
product_type_weekly AS (
  SELECT
    DATE_TRUNC('week', sqp.start_date) as week,
    pt.product_type,
    abm.brand_id,
    sqp.search_query as keyword,
    COUNT(DISTINCT sqp.asin) as asin_count,
    SUM(sqp.search_query_volume) as weekly_volume,
    AVG(sqp.search_query_score) as avg_score,
    SUM(sqp.asin_impression_count) as product_impressions,
    SUM(sqp.total_query_impression_count) as total_market_impressions,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    SUM(sqp.asin_click_count) as clicks,
    AVG(sqp.asin_click_share) as avg_click_share,
    SUM(sqp.asin_cart_add_count) as cart_adds,
    SUM(sqp.asin_purchase_count) as purchases,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    SUM(sqp.asin_purchase_count * sqp.asin_median_purchase_price) as revenue
  FROM sqp.search_query_performance sqp
  JOIN product_type_mapping pt ON sqp.asin = pt.asin
  LEFT JOIN sqp.asin_brand_mapping abm ON sqp.asin = abm.asin
  GROUP BY week, pt.product_type, abm.brand_id, sqp.search_query
),
with_rolling AS (
  SELECT
    *,
    -- 6-week rolling calculations
    AVG(weekly_volume) OVER (
      PARTITION BY product_type, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_volume,
    STDDEV(weekly_volume) OVER (
      PARTITION BY product_type, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_stddev,
    AVG(revenue) OVER (
      PARTITION BY product_type, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_revenue,
    -- Market share rolling average
    AVG(product_impressions::decimal / NULLIF(total_market_impressions, 0)) OVER (
      PARTITION BY product_type, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_market_share,
    -- Period comparisons
    LAG(weekly_volume, 1) OVER (PARTITION BY product_type, keyword ORDER BY week) as prev_week_volume,
    LAG(weekly_volume, 6) OVER (PARTITION BY product_type, keyword ORDER BY week) as six_weeks_ago_volume
  FROM product_type_weekly
)
SELECT
  week,
  product_type,
  brand_id,
  keyword,
  asin_count,
  weekly_volume,
  rolling_6w_volume,
  -- Z-score for anomaly detection
  CASE 
    WHEN rolling_6w_stddev > 0 
    THEN (weekly_volume - rolling_6w_volume) / rolling_6w_stddev 
    ELSE 0 
  END as volume_z_score,
  -- Trend classification
  CASE
    WHEN ABS((weekly_volume - rolling_6w_volume) / NULLIF(rolling_6w_stddev, 0)) > 2 THEN 'ANOMALY'
    WHEN weekly_volume > rolling_6w_volume * 1.15 THEN 'GROWTH'
    WHEN weekly_volume < rolling_6w_volume * 0.85 THEN 'DECLINE'
    ELSE 'STABLE'
  END as trend_status,
  -- Market metrics
  ROUND(product_impressions::decimal / NULLIF(total_market_impressions, 0) * 100, 2) as current_market_share,
  ROUND(rolling_6w_market_share * 100, 2) as avg_6w_market_share,
  -- Performance metrics
  revenue,
  rolling_6w_revenue,
  avg_impression_share,
  avg_click_share,
  avg_purchase_share,
  -- Conversion funnel
  CASE WHEN product_impressions > 0 THEN clicks::decimal / product_impressions ELSE 0 END as ctr,
  CASE WHEN clicks > 0 THEN cart_adds::decimal / clicks ELSE 0 END as add_to_cart_rate,
  CASE WHEN cart_adds > 0 THEN purchases::decimal / cart_adds ELSE 0 END as cart_conversion_rate
FROM with_rolling;

CREATE INDEX idx_product_type_trends_week ON sqp.product_type_keyword_trends(week, product_type);
CREATE INDEX idx_product_type_trends_brand ON sqp.product_type_keyword_trends(brand_id, week);
CREATE INDEX idx_product_type_trends_keyword ON sqp.product_type_keyword_trends(keyword, product_type);
```

### 6. brand_keyword_performance
```sql
CREATE MATERIALIZED VIEW sqp.brand_keyword_performance AS
WITH brand_weekly AS (
  SELECT
    DATE_TRUNC('week', sqp.start_date) as week,
    b.id as brand_id,
    b.brand_name,
    sqp.search_query as keyword,
    COUNT(DISTINCT sqp.asin) as asin_count,
    SUM(sqp.search_query_volume) as weekly_volume,
    AVG(sqp.search_query_score) as avg_score,
    SUM(sqp.asin_impression_count) as brand_impressions,
    SUM(sqp.total_query_impression_count) as total_market_impressions,
    SUM(sqp.asin_click_count) as brand_clicks,
    SUM(sqp.total_click_count) as total_market_clicks,
    SUM(sqp.asin_purchase_count) as brand_purchases,
    SUM(sqp.total_purchase_count) as total_market_purchases,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    AVG(sqp.asin_click_share) as avg_click_share,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    SUM(sqp.asin_purchase_count * sqp.asin_median_purchase_price) as brand_revenue
  FROM sqp.search_query_performance sqp
  JOIN sqp.asin_brand_mapping abm ON sqp.asin = abm.asin
  JOIN sqp.brands b ON abm.brand_id = b.id
  WHERE b.is_active = true
  GROUP BY week, b.id, b.brand_name, sqp.search_query
),
with_rolling AS (
  SELECT
    *,
    -- 6-week rolling metrics
    AVG(weekly_volume) OVER (
      PARTITION BY brand_id, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_volume,
    AVG(brand_revenue) OVER (
      PARTITION BY brand_id, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_revenue,
    -- Market share metrics
    AVG(brand_impressions::decimal / NULLIF(total_market_impressions, 0)) OVER (
      PARTITION BY brand_id, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_imp_market_share,
    AVG(brand_purchases::decimal / NULLIF(total_market_purchases, 0)) OVER (
      PARTITION BY brand_id, keyword
      ORDER BY week
      ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
    ) as rolling_6w_purchase_market_share,
    -- Period comparisons
    LAG(weekly_volume, 1) OVER (PARTITION BY brand_id, keyword ORDER BY week) as prev_week_volume,
    LAG(brand_revenue, 1) OVER (PARTITION BY brand_id, keyword ORDER BY week) as prev_week_revenue,
    LAG(weekly_volume, 6) OVER (PARTITION BY brand_id, keyword ORDER BY week) as six_weeks_ago_volume
  FROM brand_weekly
)
SELECT
  week,
  brand_id,
  brand_name,
  keyword,
  asin_count,
  weekly_volume,
  rolling_6w_volume,
  -- Trend calculations
  CASE 
    WHEN rolling_6w_volume > 0 
    THEN (weekly_volume - rolling_6w_volume) / rolling_6w_volume * 100 
    ELSE NULL 
  END as volume_vs_trend_pct,
  CASE 
    WHEN prev_week_volume > 0 
    THEN (weekly_volume - prev_week_volume) / prev_week_volume * 100 
    ELSE NULL 
  END as wow_change_pct,
  CASE 
    WHEN six_weeks_ago_volume > 0 
    THEN (weekly_volume - six_weeks_ago_volume) / six_weeks_ago_volume * 100 
    ELSE NULL 
  END as six_week_growth_pct,
  -- Market share metrics
  ROUND(brand_impressions::decimal / NULLIF(total_market_impressions, 0) * 100, 2) as impression_market_share,
  ROUND(rolling_6w_imp_market_share * 100, 2) as avg_6w_imp_market_share,
  ROUND(brand_purchases::decimal / NULLIF(total_market_purchases, 0) * 100, 2) as purchase_market_share,
  ROUND(rolling_6w_purchase_market_share * 100, 2) as avg_6w_purchase_market_share,
  -- Revenue metrics
  brand_revenue,
  rolling_6w_revenue,
  CASE 
    WHEN rolling_6w_revenue > 0 
    THEN (brand_revenue - rolling_6w_revenue) / rolling_6w_revenue * 100 
    ELSE NULL 
  END as revenue_vs_trend_pct,
  -- Performance classification
  CASE
    WHEN (weekly_volume - rolling_6w_volume) / NULLIF(rolling_6w_volume, 0) > 0.2
      AND (brand_revenue - rolling_6w_revenue) / NULLIF(rolling_6w_revenue, 0) > 0.15 THEN 'STAR_PERFORMER'
    WHEN (weekly_volume - rolling_6w_volume) / NULLIF(rolling_6w_volume, 0) > 0.1 THEN 'GROWING'
    WHEN (weekly_volume - rolling_6w_volume) / NULLIF(rolling_6w_volume, 0) < -0.2 THEN 'DECLINING'
    ELSE 'STABLE'
  END as performance_category,
  -- Share metrics
  avg_impression_share,
  avg_click_share,
  avg_purchase_share,
  -- Efficiency metrics
  CASE WHEN brand_impressions > 0 THEN brand_clicks::decimal / brand_impressions ELSE 0 END as brand_ctr,
  CASE WHEN brand_clicks > 0 THEN brand_purchases::decimal / brand_clicks ELSE 0 END as brand_conversion_rate,
  CASE WHEN brand_purchases > 0 THEN brand_revenue / brand_purchases ELSE 0 END as avg_order_value
FROM with_rolling;

CREATE INDEX idx_brand_keyword_week ON sqp.brand_keyword_performance(week, brand_id);
CREATE INDEX idx_brand_keyword_keyword ON sqp.brand_keyword_performance(keyword, brand_id);
CREATE INDEX idx_brand_keyword_perf ON sqp.brand_keyword_performance(performance_category, brand_id);
```

### 7. funnel_conversion_analysis
```sql
CREATE MATERIALIZED VIEW sqp.funnel_conversion_analysis AS
SELECT 
  DATE_TRUNC('week', start_date) as period,
  'week' as period_type,
  asin,
  -- Funnel metrics
  SUM(total_query_impression_count) as total_impressions,
  SUM(total_click_count) as total_clicks,
  SUM(total_cart_add_count) as total_cart_adds,
  SUM(total_purchase_count) as total_purchases,
  SUM(asin_impression_count) as asin_impressions,
  SUM(asin_click_count) as asin_clicks,
  SUM(asin_cart_add_count) as asin_cart_adds,
  SUM(asin_purchase_count) as asin_purchases,
  -- Conversion rates
  CASE WHEN SUM(total_query_impression_count) > 0 
    THEN SUM(total_click_count)::decimal / SUM(total_query_impression_count) 
    ELSE 0 END as total_click_rate,
  CASE WHEN SUM(total_click_count) > 0 
    THEN SUM(total_cart_add_count)::decimal / SUM(total_click_count) 
    ELSE 0 END as total_cart_add_rate,
  CASE WHEN SUM(total_cart_add_count) > 0 
    THEN SUM(total_purchase_count)::decimal / SUM(total_cart_add_count) 
    ELSE 0 END as total_purchase_rate,
  -- ASIN conversion rates  
  CASE WHEN SUM(asin_impression_count) > 0 
    THEN SUM(asin_click_count)::decimal / SUM(asin_impression_count) 
    ELSE 0 END as asin_click_rate,
  CASE WHEN SUM(asin_click_count) > 0 
    THEN SUM(asin_cart_add_count)::decimal / SUM(asin_click_count) 
    ELSE 0 END as asin_cart_add_rate,
  CASE WHEN SUM(asin_cart_add_count) > 0 
    THEN SUM(asin_purchase_count)::decimal / SUM(asin_cart_add_count) 
    ELSE 0 END as asin_purchase_rate
FROM sqp.search_query_performance
GROUP BY period, asin

UNION ALL

-- Monthly aggregation
SELECT 
  DATE_TRUNC('month', start_date) as period,
  'month' as period_type,
  -- (same metrics as above)
  asin,
  SUM(total_query_impression_count) as total_impressions,
  SUM(total_click_count) as total_clicks,
  SUM(total_cart_add_count) as total_cart_adds,
  SUM(total_purchase_count) as total_purchases,
  SUM(asin_impression_count) as asin_impressions,
  SUM(asin_click_count) as asin_clicks,
  SUM(asin_cart_add_count) as asin_cart_adds,
  SUM(asin_purchase_count) as asin_purchases,
  CASE WHEN SUM(total_query_impression_count) > 0 
    THEN SUM(total_click_count)::decimal / SUM(total_query_impression_count) 
    ELSE 0 END as total_click_rate,
  CASE WHEN SUM(total_click_count) > 0 
    THEN SUM(total_cart_add_count)::decimal / SUM(total_click_count) 
    ELSE 0 END as total_cart_add_rate,
  CASE WHEN SUM(total_cart_add_count) > 0 
    THEN SUM(total_purchase_count)::decimal / SUM(total_cart_add_count) 
    ELSE 0 END as total_purchase_rate,
  CASE WHEN SUM(asin_impression_count) > 0 
    THEN SUM(asin_click_count)::decimal / SUM(asin_impression_count) 
    ELSE 0 END as asin_click_rate,
  CASE WHEN SUM(asin_click_count) > 0 
    THEN SUM(asin_cart_add_count)::decimal / SUM(asin_click_count) 
    ELSE 0 END as asin_cart_add_rate,
  CASE WHEN SUM(asin_cart_add_count) > 0 
    THEN SUM(asin_purchase_count)::decimal / SUM(asin_cart_add_count) 
    ELSE 0 END as asin_purchase_rate
FROM sqp.search_query_performance
GROUP BY period, asin;

CREATE INDEX idx_funnel_conversion_period ON sqp.funnel_conversion_analysis(period, period_type, asin);
```

### 4. shipping_impact_analysis
```sql
CREATE MATERIALIZED VIEW sqp.shipping_impact_analysis AS
SELECT 
  DATE_TRUNC('month', start_date) as period,
  asin,
  -- Shipping speed breakdowns
  SUM(same_day_shipping_clicks) as same_day_clicks,
  SUM(one_day_shipping_clicks) as one_day_clicks,
  SUM(two_day_shipping_clicks) as two_day_clicks,
  SUM(same_day_shipping_cart_adds) as same_day_cart_adds,
  SUM(one_day_shipping_cart_adds) as one_day_cart_adds,
  SUM(two_day_shipping_cart_adds) as two_day_cart_adds,
  SUM(same_day_shipping_purchases) as same_day_purchases,
  SUM(one_day_shipping_purchases) as one_day_purchases,
  SUM(two_day_shipping_purchases) as two_day_purchases,
  -- Calculate conversion rates by shipping speed
  CASE WHEN SUM(same_day_shipping_clicks) > 0 
    THEN SUM(same_day_shipping_purchases)::decimal / SUM(same_day_shipping_clicks) 
    ELSE 0 END as same_day_conversion_rate,
  CASE WHEN SUM(one_day_shipping_clicks) > 0 
    THEN SUM(one_day_shipping_purchases)::decimal / SUM(one_day_shipping_clicks) 
    ELSE 0 END as one_day_conversion_rate,
  CASE WHEN SUM(two_day_shipping_clicks) > 0 
    THEN SUM(two_day_shipping_purchases)::decimal / SUM(two_day_shipping_clicks) 
    ELSE 0 END as two_day_conversion_rate,
  -- Price analysis by shipping speed
  AVG(CASE WHEN same_day_shipping_purchases > 0 THEN asin_median_purchase_price END) as same_day_avg_price,
  AVG(CASE WHEN one_day_shipping_purchases > 0 THEN asin_median_purchase_price END) as one_day_avg_price,
  AVG(CASE WHEN two_day_shipping_purchases > 0 THEN asin_median_purchase_price END) as two_day_avg_price
FROM sqp.search_query_performance
GROUP BY period, asin;

CREATE INDEX idx_shipping_impact_period ON sqp.shipping_impact_analysis(period, asin);
```

## Index Optimizations for Existing Tables

### 1. Add indexes to search_query_performance (non-invasive)
```sql
-- Create indexes for period queries without modifying table structure
CREATE INDEX IF NOT EXISTS idx_sqp_start_date ON sqp.search_query_performance(start_date);
CREATE INDEX IF NOT EXISTS idx_sqp_asin_date ON sqp.search_query_performance(asin, start_date);
CREATE INDEX IF NOT EXISTS idx_sqp_query_asin ON sqp.search_query_performance(search_query, asin);

-- Create expression indexes for period grouping
CREATE INDEX IF NOT EXISTS idx_sqp_week ON sqp.search_query_performance(DATE_TRUNC('week', start_date), asin);
CREATE INDEX IF NOT EXISTS idx_sqp_month ON sqp.search_query_performance(DATE_TRUNC('month', start_date), asin);
CREATE INDEX IF NOT EXISTS idx_sqp_quarter ON sqp.search_query_performance(DATE_TRUNC('quarter', start_date), asin);
```

### 2. Add indexes to asin_performance_data (non-invasive)
```sql
-- Create indexes for brand extraction and date queries
CREATE INDEX IF NOT EXISTS idx_apd_asin ON sqp.asin_performance_data(asin);
CREATE INDEX IF NOT EXISTS idx_apd_start_date ON sqp.asin_performance_data(start_date);
CREATE INDEX IF NOT EXISTS idx_apd_asin_date ON sqp.asin_performance_data(asin, start_date);
```

### 3. Create product_type_mapping table
```sql
CREATE TABLE IF NOT EXISTS sqp.product_type_mapping (
  asin VARCHAR(20) PRIMARY KEY,
  product_type VARCHAR(100) NOT NULL,
  product_category VARCHAR(100),
  extraction_method VARCHAR(50) NOT NULL CHECK (extraction_method IN ('automatic', 'manual')),
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_type_mapping_type ON sqp.product_type_mapping(product_type);
```

### 4. Create report_configurations table
```sql
CREATE TABLE IF NOT EXISTS sqp.report_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  config JSONB NOT NULL,
  schedule_cron VARCHAR(100),
  email_recipients TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_report_config_active ON sqp.report_configurations(is_active, report_type);
```

### 5. Create report_history table
```sql
CREATE TABLE IF NOT EXISTS sqp.report_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_configuration_id UUID REFERENCES sqp.report_configurations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url TEXT,
  error_message TEXT,
  metrics_summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_report_history_status ON sqp.report_history(status, created_at DESC);
CREATE INDEX idx_report_history_period ON sqp.report_history(period_start, period_end, period_type);
```

## Brand Extraction Functions

### 1. Extract brand from product title
```sql
CREATE OR REPLACE FUNCTION sqp.extract_brand_from_title(product_title TEXT)
RETURNS TEXT AS $$
DECLARE
  brand_name TEXT;
  common_patterns TEXT[] := ARRAY[
    '^([A-Z][A-Za-z0-9\-&\s]+)\s+(?:by|from|Brand:|®|™)',  -- "Brand by", "Brand from", etc.
    '^([A-Z][A-Za-z0-9\-&]+)\s+[A-Z]',                     -- Brand followed by product name
    '^([A-Z][A-Za-z0-9\-&]+)\s*[-–—]',                     -- Brand followed by dash
    '^([A-Z][A-Za-z0-9\-&]+)\s*\|',                        -- Brand followed by pipe
    '^([A-Z][A-Za-z0-9\-&]+)\s*:',                         -- Brand followed by colon
    '^\[([A-Z][A-Za-z0-9\-&\s]+)\]'                        -- Brand in brackets
  ];
  pattern TEXT;
BEGIN
  -- Clean the title
  product_title := TRIM(product_title);
  
  -- Try each pattern
  FOREACH pattern IN ARRAY common_patterns LOOP
    brand_name := (regexp_match(product_title, pattern))[1];
    IF brand_name IS NOT NULL THEN
      RETURN TRIM(brand_name);
    END IF;
  END LOOP;
  
  -- Fallback: First word if it starts with capital letter
  brand_name := (regexp_match(product_title, '^([A-Z][A-Za-z0-9\-&]+)'))[1];
  RETURN COALESCE(TRIM(brand_name), 'Unknown');
END;
$$ LANGUAGE plpgsql;
```

### 2. Normalize brand name
```sql
CREATE OR REPLACE FUNCTION sqp.normalize_brand_name(brand_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove special characters, convert to lowercase, trim spaces
  RETURN LOWER(TRIM(regexp_replace(brand_name, '[^A-Za-z0-9\s]', '', 'g')));
END;
$$ LANGUAGE plpgsql;
```

## Migration Scripts

### Initial Population of Product Type Mapping
```sql
-- Function to extract product type from product title
CREATE OR REPLACE FUNCTION sqp.extract_product_type(product_title TEXT)
RETURNS TEXT AS $$
DECLARE
  title_lower TEXT;
  product_type TEXT;
BEGIN
  title_lower := LOWER(product_title);
  
  -- Define product type mappings based on keywords
  -- Customize this based on your actual product catalog
  IF title_lower ~ '(headphone|earphone|earbud|airpod)' THEN
    product_type := 'Audio';
  ELSIF title_lower ~ '(laptop|notebook|computer|desktop|chromebook)' THEN
    product_type := 'Computers';
  ELSIF title_lower ~ '(phone|mobile|smartphone|iphone|android)' THEN
    product_type := 'Mobile Devices';
  ELSIF title_lower ~ '(tablet|ipad|kindle)' THEN
    product_type := 'Tablets';
  ELSIF title_lower ~ '(camera|webcam|gopro)' THEN
    product_type := 'Cameras';
  ELSIF title_lower ~ '(speaker|soundbar|echo|alexa)' THEN
    product_type := 'Speakers';
  ELSIF title_lower ~ '(watch|smartwatch|fitness tracker)' THEN
    product_type := 'Wearables';
  ELSIF title_lower ~ '(tv|television|monitor|display)' THEN
    product_type := 'Displays';
  ELSIF title_lower ~ '(router|modem|network|wifi)' THEN
    product_type := 'Networking';
  ELSIF title_lower ~ '(keyboard|mouse|controller|gamepad)' THEN
    product_type := 'Accessories';
  ELSE
    product_type := 'Other';
  END IF;
  
  RETURN product_type;
END;
$$ LANGUAGE plpgsql;

-- Populate product type mapping
INSERT INTO sqp.product_type_mapping (asin, product_type, extraction_method, confidence_score)
SELECT 
  asin,
  sqp.extract_product_type(product_title) as product_type,
  'automatic' as extraction_method,
  0.75 as confidence_score
FROM sqp.asin_performance_data
WHERE product_title IS NOT NULL
ON CONFLICT (asin) DO NOTHING;
```

### Initial Population of Brand Tables
```sql
-- Step 1: Extract and insert unique brands from existing ASIN data
INSERT INTO sqp.brands (brand_name, normalized_name, display_name)
SELECT DISTINCT ON (normalized_name)
  extracted_brand as brand_name,
  sqp.normalize_brand_name(extracted_brand) as normalized_name,
  extracted_brand as display_name
FROM (
  SELECT DISTINCT 
    sqp.extract_brand_from_title(product_title) as extracted_brand,
    product_title
  FROM sqp.asin_performance_data
  WHERE product_title IS NOT NULL
) extracted
WHERE extracted_brand != 'Unknown'
ON CONFLICT (brand_name) DO NOTHING;

-- Step 2: Map ASINs to brands based on product titles
INSERT INTO sqp.asin_brand_mapping (asin, brand_id, product_title, extraction_method, confidence_score)
SELECT 
  apd.asin,
  b.id as brand_id,
  apd.product_title,
  'automatic' as extraction_method,
  0.75 as confidence_score  -- Default confidence for automatic extraction
FROM sqp.asin_performance_data apd
JOIN sqp.brands b ON b.brand_name = sqp.extract_brand_from_title(apd.product_title)
WHERE apd.product_title IS NOT NULL
ON CONFLICT (asin) DO NOTHING;

-- Step 3: Handle unmapped ASINs (assign to 'Unknown' brand)
INSERT INTO sqp.brands (brand_name, normalized_name, display_name)
VALUES ('Unknown', 'unknown', 'Unknown Brand')
ON CONFLICT (brand_name) DO NOTHING;

INSERT INTO sqp.asin_brand_mapping (asin, brand_id, product_title, extraction_method, confidence_score)
SELECT 
  apd.asin,
  (SELECT id FROM sqp.brands WHERE brand_name = 'Unknown'),
  COALESCE(apd.product_title, 'No title available'),
  'automatic',
  0.0
FROM sqp.asin_performance_data apd
WHERE NOT EXISTS (
  SELECT 1 FROM sqp.asin_brand_mapping abm WHERE abm.asin = apd.asin
)
ON CONFLICT (asin) DO NOTHING;
```

### Weekly Update Process
```sql
-- Function to update brands for new ASINs after BigQuery sync
CREATE OR REPLACE FUNCTION sqp.update_brand_mappings()
RETURNS void AS $$
DECLARE
  new_asins_count INTEGER;
BEGIN
  -- Count new ASINs that need brand mapping
  SELECT COUNT(DISTINCT apd.asin) INTO new_asins_count
  FROM sqp.asin_performance_data apd
  LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
  WHERE abm.asin IS NULL;
  
  IF new_asins_count > 0 THEN
    RAISE NOTICE 'Found % new ASINs to map to brands', new_asins_count;
    
    -- Extract and insert any new brands
    INSERT INTO sqp.brands (brand_name, normalized_name, display_name)
    SELECT DISTINCT ON (normalized_name)
      extracted_brand as brand_name,
      sqp.normalize_brand_name(extracted_brand) as normalized_name,
      extracted_brand as display_name
    FROM (
      SELECT DISTINCT 
        sqp.extract_brand_from_title(apd.product_title) as extracted_brand
      FROM sqp.asin_performance_data apd
      LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
      WHERE abm.asin IS NULL
        AND apd.product_title IS NOT NULL
    ) new_brands
    WHERE extracted_brand != 'Unknown'
    ON CONFLICT (brand_name) DO NOTHING;
    
    -- Map new ASINs to brands
    INSERT INTO sqp.asin_brand_mapping (asin, brand_id, product_title, extraction_method, confidence_score)
    SELECT 
      apd.asin,
      COALESCE(b.id, (SELECT id FROM sqp.brands WHERE brand_name = 'Unknown')),
      apd.product_title,
      'automatic',
      CASE WHEN b.id IS NOT NULL THEN 0.75 ELSE 0.0 END
    FROM sqp.asin_performance_data apd
    LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
    LEFT JOIN sqp.brands b ON b.brand_name = sqp.extract_brand_from_title(apd.product_title)
    WHERE abm.asin IS NULL
    ON CONFLICT (asin) DO NOTHING;
  END IF;
  
  -- Refresh all materialized views
  PERFORM sqp.refresh_period_views();
  
  RAISE NOTICE 'Brand mappings and materialized views updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Weekly sync procedure (to be called after BigQuery sync completes)
CREATE OR REPLACE FUNCTION sqp.weekly_data_update()
RETURNS void AS $$
BEGIN
  -- Step 1: BigQuery sync happens (handled by existing sync process)
  -- Step 2: Update brand mappings for any new ASINs
  PERFORM sqp.update_brand_mappings();
  -- Step 3: Refresh materialized views for period calculations
  PERFORM sqp.refresh_period_views();
  -- Step 4: Clean up old report history (optional)
  DELETE FROM sqp.report_history 
  WHERE created_at < NOW() - INTERVAL '90 days' 
    AND status = 'completed';
END;
$$ LANGUAGE plpgsql;
```

### Refresh Strategy for Materialized Views
```sql
-- Create function to refresh all period views
CREATE OR REPLACE FUNCTION sqp.refresh_period_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.brand_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.period_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.query_trend_analysis;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.keyword_trend_analysis;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.product_type_keyword_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.brand_keyword_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.funnel_conversion_analysis;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.shipping_impact_analysis;
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly refresh after BigQuery sync (requires pg_cron extension)
-- Assumes BigQuery sync happens Sunday nights at 2 AM
-- SELECT cron.schedule('weekly-brand-update', '0 3 * * 0', 'SELECT sqp.weekly_data_update();');
```

## Rationale

### Materialized Views
- **Performance**: Pre-calculated aggregations eliminate expensive period calculations at query time
- **Flexibility**: Multiple period types (week/month/quarter/year) in single views
- **Scalability**: CONCURRENTLY refresh allows continuous availability during updates

### Indexing Strategy
- **Composite Indexes**: Optimize for common query patterns (period + asin)
- **Generated Columns**: Speed up period-based filtering without computation
- **Covering Indexes**: Include frequently accessed columns to avoid table lookups

### Data Integrity
- **Check Constraints**: Ensure valid values for report types and statuses
- **Foreign Keys**: Maintain referential integrity for report configurations
- **JSONB Storage**: Flexible schema for report configurations and summaries