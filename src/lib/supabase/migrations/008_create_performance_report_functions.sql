-- Migration: Create Performance Report RPC Functions
-- Description: Creates all RPC functions needed by the performance report APIs

-- 1. Year-over-Year Keyword Performance Function
CREATE OR REPLACE FUNCTION sqp.get_yoy_keyword_performance(
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    p_keywords TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_sort_by TEXT DEFAULT 'purchases_change',
    p_sort_order TEXT DEFAULT 'desc'
)
RETURNS TABLE (
    query TEXT,
    year INTEGER,
    total_impressions BIGINT,
    total_clicks BIGINT,
    total_purchases BIGINT,
    avg_ctr NUMERIC,
    avg_cvr NUMERIC,
    avg_cpc NUMERIC,
    avg_acos NUMERIC,
    yoy_impressions_change NUMERIC,
    yoy_clicks_change NUMERIC,
    yoy_purchases_change NUMERIC,
    yoy_ctr_change NUMERIC,
    yoy_cvr_change NUMERIC,
    previous_year_impressions BIGINT,
    previous_year_clicks BIGINT,
    previous_year_purchases BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH current_year_data AS (
        SELECT 
            ws.query,
            SUM(ws.total_impressions) AS total_impressions,
            SUM(ws.total_clicks) AS total_clicks,
            SUM(ws.total_purchases) AS total_purchases,
            AVG(ws.click_through_rate) AS avg_ctr,
            AVG(ws.conversion_rate) AS avg_cvr,
            AVG(ws.cost_per_click) AS avg_cpc,
            AVG(ws.acos) AS avg_acos
        FROM sqp.weekly_summary ws
        WHERE EXTRACT(YEAR FROM ws.period_end) = p_year
            AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
        GROUP BY ws.query
    ),
    previous_year_data AS (
        SELECT 
            ws.query,
            SUM(ws.total_impressions) AS total_impressions,
            SUM(ws.total_clicks) AS total_clicks,
            SUM(ws.total_purchases) AS total_purchases,
            AVG(ws.click_through_rate) AS avg_ctr,
            AVG(ws.conversion_rate) AS avg_cvr
        FROM sqp.weekly_summary ws
        WHERE EXTRACT(YEAR FROM ws.period_end) = p_year - 1
            AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
        GROUP BY ws.query
    )
    SELECT 
        c.query,
        p_year AS year,
        c.total_impressions,
        c.total_clicks,
        c.total_purchases,
        ROUND(c.avg_ctr, 4) AS avg_ctr,
        ROUND(c.avg_cvr, 4) AS avg_cvr,
        ROUND(c.avg_cpc::numeric, 2) AS avg_cpc,
        ROUND(c.avg_acos, 2) AS avg_acos,
        CASE 
            WHEN p.total_impressions > 0 THEN 
                ROUND(((c.total_impressions - p.total_impressions)::numeric / p.total_impressions) * 100, 2)
            ELSE NULL 
        END AS yoy_impressions_change,
        CASE 
            WHEN p.total_clicks > 0 THEN 
                ROUND(((c.total_clicks - p.total_clicks)::numeric / p.total_clicks) * 100, 2)
            ELSE NULL 
        END AS yoy_clicks_change,
        CASE 
            WHEN p.total_purchases > 0 THEN 
                ROUND(((c.total_purchases - p.total_purchases)::numeric / p.total_purchases) * 100, 2)
            ELSE NULL 
        END AS yoy_purchases_change,
        CASE 
            WHEN p.avg_ctr > 0 THEN 
                ROUND(((c.avg_ctr - p.avg_ctr) / p.avg_ctr) * 100, 2)
            ELSE NULL 
        END AS yoy_ctr_change,
        CASE 
            WHEN p.avg_cvr > 0 THEN 
                ROUND(((c.avg_cvr - p.avg_cvr) / p.avg_cvr) * 100, 2)
            ELSE NULL 
        END AS yoy_cvr_change,
        COALESCE(p.total_impressions, 0) AS previous_year_impressions,
        COALESCE(p.total_clicks, 0) AS previous_year_clicks,
        COALESCE(p.total_purchases, 0) AS previous_year_purchases
    FROM current_year_data c
    LEFT JOIN previous_year_data p ON c.query = p.query
    ORDER BY 
        CASE 
            WHEN p_sort_by = 'impressions_change' THEN yoy_impressions_change
            WHEN p_sort_by = 'clicks_change' THEN yoy_clicks_change
            WHEN p_sort_by = 'purchases_change' THEN yoy_purchases_change
            WHEN p_sort_by = 'ctr_change' THEN yoy_ctr_change
            WHEN p_sort_by = 'cvr_change' THEN yoy_cvr_change
            ELSE yoy_purchases_change
        END DESC NULLS LAST
    LIMIT p_limit;
END;
$$;

-- 2. CVR Gap Analysis Function
CREATE OR REPLACE FUNCTION sqp.calculate_cvr_gaps(
    p_start_date DATE,
    p_end_date DATE,
    p_keywords TEXT[] DEFAULT NULL,
    p_asin TEXT DEFAULT NULL,
    p_min_clicks INTEGER DEFAULT 50,
    p_benchmark_type TEXT DEFAULT 'market_average'
)
RETURNS TABLE (
    query TEXT,
    asin TEXT,
    total_clicks BIGINT,
    total_purchases BIGINT,
    avg_cvr NUMERIC,
    market_avg_cvr NUMERIC,
    competitor_best_cvr NUMERIC,
    category_avg_cvr NUMERIC,
    historical_avg_cvr NUMERIC,
    total_impressions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH asin_performance AS (
        SELECT 
            ws.query,
            ws.asin,
            SUM(ws.total_clicks) AS total_clicks,
            SUM(ws.total_purchases) AS total_purchases,
            SUM(ws.total_impressions) AS total_impressions,
            CASE 
                WHEN SUM(ws.total_clicks) > 0 THEN 
                    SUM(ws.total_purchases)::numeric / SUM(ws.total_clicks)
                ELSE 0 
            END AS avg_cvr
        FROM sqp.weekly_summary ws
        WHERE ws.period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
            AND (p_asin IS NULL OR ws.asin = p_asin)
        GROUP BY ws.query, ws.asin
        HAVING SUM(ws.total_clicks) >= p_min_clicks
    ),
    market_benchmarks AS (
        SELECT 
            ws.query,
            AVG(CASE 
                WHEN ws.total_clicks > 0 THEN 
                    ws.total_purchases::numeric / ws.total_clicks
                ELSE 0 
            END) AS market_avg_cvr
        FROM sqp.weekly_summary ws
        WHERE ws.period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
        GROUP BY ws.query
    ),
    competitor_benchmarks AS (
        SELECT 
            ws.query,
            MAX(CASE 
                WHEN ws.total_clicks > 0 THEN 
                    ws.total_purchases::numeric / ws.total_clicks
                ELSE 0 
            END) AS competitor_best_cvr
        FROM sqp.weekly_summary ws
        WHERE ws.period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
            AND (p_asin IS NULL OR ws.asin != p_asin)
        GROUP BY ws.query
    ),
    category_benchmarks AS (
        -- Assuming we can derive category from query patterns or have a category mapping
        SELECT 
            ws.query,
            AVG(CASE 
                WHEN ws.total_clicks > 0 THEN 
                    ws.total_purchases::numeric / ws.total_clicks
                ELSE 0 
            END) AS category_avg_cvr
        FROM sqp.weekly_summary ws
        WHERE ws.period_end BETWEEN p_start_date AND p_end_date
        GROUP BY ws.query
    ),
    historical_benchmarks AS (
        SELECT 
            ws.query,
            ws.asin,
            AVG(CASE 
                WHEN ws.total_clicks > 0 THEN 
                    ws.total_purchases::numeric / ws.total_clicks
                ELSE 0 
            END) AS historical_avg_cvr
        FROM sqp.weekly_summary ws
        WHERE ws.period_end < p_start_date
            AND ws.period_end >= p_start_date - INTERVAL '90 days'
            AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
            AND (p_asin IS NULL OR ws.asin = p_asin)
        GROUP BY ws.query, ws.asin
    )
    SELECT 
        ap.query,
        ap.asin,
        ap.total_clicks,
        ap.total_purchases,
        ROUND(ap.avg_cvr, 4) AS avg_cvr,
        ROUND(mb.market_avg_cvr, 4) AS market_avg_cvr,
        ROUND(cb.competitor_best_cvr, 4) AS competitor_best_cvr,
        ROUND(cat.category_avg_cvr, 4) AS category_avg_cvr,
        ROUND(hb.historical_avg_cvr, 4) AS historical_avg_cvr,
        ap.total_impressions
    FROM asin_performance ap
    LEFT JOIN market_benchmarks mb ON ap.query = mb.query
    LEFT JOIN competitor_benchmarks cb ON ap.query = cb.query
    LEFT JOIN category_benchmarks cat ON ap.query = cat.query
    LEFT JOIN historical_benchmarks hb ON ap.query = hb.query AND ap.asin = hb.asin;
END;
$$;

-- 3. Purchase Velocity Heatmap Function
CREATE OR REPLACE FUNCTION sqp.get_purchase_velocity_heatmap(
    p_start_date DATE,
    p_end_date DATE,
    p_keywords TEXT[] DEFAULT NULL,
    p_asins TEXT[] DEFAULT NULL,
    p_min_purchases INTEGER DEFAULT 10
)
RETURNS TABLE (
    weeks TEXT[],
    keywords TEXT[],
    velocity_matrix NUMERIC[][],
    heatmap_ready BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_weeks TEXT[];
    v_keywords TEXT[];
    v_matrix NUMERIC[][];
    v_row NUMERIC[];
    v_week TEXT;
    v_keyword TEXT;
    v_velocity NUMERIC;
BEGIN
    -- Get unique weeks
    SELECT ARRAY_AGG(DISTINCT to_char(period_end, 'YYYY-"W"IW') ORDER BY to_char(period_end, 'YYYY-"W"IW') DESC)
    INTO v_weeks
    FROM sqp.weekly_summary
    WHERE period_end BETWEEN p_start_date AND p_end_date;
    
    -- Get unique keywords
    SELECT ARRAY_AGG(DISTINCT query ORDER BY query)
    INTO v_keywords
    FROM sqp.weekly_summary
    WHERE period_end BETWEEN p_start_date AND p_end_date
        AND (p_keywords IS NULL OR query = ANY(p_keywords))
        AND (p_asins IS NULL OR asin = ANY(p_asins))
        AND total_purchases >= p_min_purchases;
    
    -- Build velocity matrix
    v_matrix := ARRAY[]::NUMERIC[][];
    
    FOREACH v_keyword IN ARRAY v_keywords LOOP
        v_row := ARRAY[]::NUMERIC[];
        
        FOREACH v_week IN ARRAY v_weeks LOOP
            SELECT 
                CASE 
                    WHEN LAG(SUM(total_purchases)) OVER (ORDER BY period_end) > 0 THEN
                        ((SUM(total_purchases) - LAG(SUM(total_purchases)) OVER (ORDER BY period_end))::numeric / 
                         LAG(SUM(total_purchases)) OVER (ORDER BY period_end)) * 100
                    ELSE 0
                END INTO v_velocity
            FROM sqp.weekly_summary
            WHERE query = v_keyword
                AND to_char(period_end, 'YYYY-"W"IW') = v_week
                AND (p_asins IS NULL OR asin = ANY(p_asins))
            GROUP BY period_end;
            
            v_row := array_append(v_row, COALESCE(v_velocity, 0));
        END LOOP;
        
        v_matrix := array_cat(v_matrix, ARRAY[v_row]);
    END LOOP;
    
    RETURN QUERY
    SELECT v_weeks, v_keywords, v_matrix, TRUE;
END;
$$;

-- 4. Share of Voice Calculation Function
CREATE OR REPLACE FUNCTION sqp.calculate_share_of_voice(
    p_start_date DATE,
    p_end_date DATE,
    p_keywords TEXT[] DEFAULT NULL,
    p_asins TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    query TEXT,
    asin TEXT,
    impression_share NUMERIC,
    click_share NUMERIC,
    purchase_share NUMERIC,
    share_of_voice_score NUMERIC,
    sov_trend TEXT,
    period_end DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH market_totals AS (
        SELECT 
            query,
            period_end,
            SUM(total_impressions) AS market_impressions,
            SUM(total_clicks) AS market_clicks,
            SUM(total_purchases) AS market_purchases
        FROM sqp.weekly_summary
        WHERE period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR query = ANY(p_keywords))
        GROUP BY query, period_end
    ),
    asin_shares AS (
        SELECT 
            ws.query,
            ws.asin,
            ws.period_end,
            CASE 
                WHEN mt.market_impressions > 0 THEN 
                    ws.total_impressions::numeric / mt.market_impressions
                ELSE 0 
            END AS impression_share,
            CASE 
                WHEN mt.market_clicks > 0 THEN 
                    ws.total_clicks::numeric / mt.market_clicks
                ELSE 0 
            END AS click_share,
            CASE 
                WHEN mt.market_purchases > 0 THEN 
                    ws.total_purchases::numeric / mt.market_purchases
                ELSE 0 
            END AS purchase_share
        FROM sqp.weekly_summary ws
        JOIN market_totals mt ON ws.query = mt.query AND ws.period_end = mt.period_end
        WHERE ws.period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
            AND (p_asins IS NULL OR ws.asin = ANY(p_asins))
    ),
    sov_scores AS (
        SELECT 
            *,
            -- Weighted SOV score: 20% impressions, 30% clicks, 50% purchases
            (impression_share * 0.2 + click_share * 0.3 + purchase_share * 0.5) AS sov_score,
            -- Calculate trend
            LAG(impression_share * 0.2 + click_share * 0.3 + purchase_share * 0.5) 
                OVER (PARTITION BY query, asin ORDER BY period_end) AS prev_sov_score
        FROM asin_shares
    )
    SELECT 
        query,
        asin,
        ROUND(impression_share, 4) AS impression_share,
        ROUND(click_share, 4) AS click_share,
        ROUND(purchase_share, 4) AS purchase_share,
        ROUND(sov_score, 4) AS share_of_voice_score,
        CASE 
            WHEN prev_sov_score IS NULL THEN 'new'
            WHEN sov_score > prev_sov_score * 1.05 THEN 'improving'
            WHEN sov_score < prev_sov_score * 0.95 THEN 'declining'
            ELSE 'stable'
        END AS sov_trend,
        period_end
    FROM sov_scores
    ORDER BY period_end DESC, sov_score DESC;
END;
$$;

-- 5. Competitor Analysis Function
CREATE OR REPLACE FUNCTION sqp.analyze_competitors(
    p_target_asin TEXT,
    p_keyword TEXT DEFAULT NULL,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    query TEXT,
    your_asin TEXT,
    your_share NUMERIC,
    competitors JSONB,
    market_concentration NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH market_data AS (
        SELECT 
            query,
            asin,
            SUM(total_purchases) AS total_purchases,
            SUM(total_clicks) AS total_clicks,
            SUM(total_impressions) AS total_impressions
        FROM sqp.weekly_summary
        WHERE period_end BETWEEN p_start_date AND p_end_date
            AND (p_keyword IS NULL OR query = p_keyword)
        GROUP BY query, asin
    ),
    market_shares AS (
        SELECT 
            query,
            asin,
            total_purchases,
            SUM(total_purchases) OVER (PARTITION BY query) AS market_total,
            total_purchases::numeric / NULLIF(SUM(total_purchases) OVER (PARTITION BY query), 0) AS purchase_share
        FROM market_data
    ),
    competitor_analysis AS (
        SELECT 
            ms.query,
            jsonb_agg(
                jsonb_build_object(
                    'asin', ms.asin,
                    'purchase_share', ROUND(ms.purchase_share, 4),
                    'share_change', ROUND(
                        ms.purchase_share - LAG(ms.purchase_share) OVER (PARTITION BY ms.query, ms.asin ORDER BY ms.asin),
                        4
                    ),
                    'threat_level', 
                        CASE 
                            WHEN ms.purchase_share > 0.2 THEN 'high'
                            WHEN ms.purchase_share > 0.1 THEN 'medium'
                            ELSE 'low'
                        END
                ) ORDER BY ms.purchase_share DESC
            ) FILTER (WHERE ms.asin != p_target_asin) AS competitors,
            SUM(ms.purchase_share * ms.purchase_share) AS hhi
        FROM market_shares ms
        WHERE EXISTS (
            SELECT 1 FROM market_shares ms2 
            WHERE ms2.query = ms.query AND ms2.asin = p_target_asin
        )
        GROUP BY ms.query
    )
    SELECT 
        ca.query,
        p_target_asin AS your_asin,
        ROUND(ms.purchase_share, 4) AS your_share,
        ca.competitors,
        ROUND(ca.hhi, 4) AS market_concentration
    FROM competitor_analysis ca
    JOIN market_shares ms ON ca.query = ms.query AND ms.asin = p_target_asin;
END;
$$;

-- 6. Market Statistics Function
CREATE OR REPLACE FUNCTION sqp.calculate_market_stats(
    p_keywords TEXT[] DEFAULT NULL,
    p_start_date DATE,
    p_end_date DATE,
    p_table_name TEXT DEFAULT 'sqp.weekly_summary'
)
RETURNS TABLE (
    total_asins BIGINT,
    total_purchases BIGINT,
    total_clicks BIGINT,
    total_impressions BIGINT,
    avg_purchase_share NUMERIC,
    top_3_concentration NUMERIC,
    market_growth_rate NUMERIC,
    avg_ctr NUMERIC,
    avg_cvr NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH market_data AS (
        SELECT 
            asin,
            SUM(total_purchases) AS asin_purchases,
            SUM(total_clicks) AS asin_clicks,
            SUM(total_impressions) AS asin_impressions
        FROM sqp.weekly_summary
        WHERE period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR query = ANY(p_keywords))
        GROUP BY asin
    ),
    ranked_asins AS (
        SELECT 
            *,
            ROW_NUMBER() OVER (ORDER BY asin_purchases DESC) AS rank,
            asin_purchases::numeric / NULLIF(SUM(asin_purchases) OVER (), 0) AS purchase_share
        FROM market_data
    ),
    growth_data AS (
        SELECT 
            SUM(CASE WHEN period_end >= p_end_date - INTERVAL '30 days' THEN total_purchases ELSE 0 END) AS recent_purchases,
            SUM(CASE WHEN period_end < p_end_date - INTERVAL '30 days' THEN total_purchases ELSE 0 END) AS older_purchases
        FROM sqp.weekly_summary
        WHERE period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR query = ANY(p_keywords))
    )
    SELECT 
        COUNT(DISTINCT md.asin) AS total_asins,
        SUM(md.asin_purchases) AS total_purchases,
        SUM(md.asin_clicks) AS total_clicks,
        SUM(md.asin_impressions) AS total_impressions,
        ROUND(AVG(ra.purchase_share), 4) AS avg_purchase_share,
        ROUND(SUM(CASE WHEN ra.rank <= 3 THEN ra.purchase_share ELSE 0 END), 4) AS top_3_concentration,
        ROUND(
            CASE 
                WHEN gd.older_purchases > 0 THEN 
                    ((gd.recent_purchases - gd.older_purchases)::numeric / gd.older_purchases) * 100
                ELSE 0 
            END, 2
        ) AS market_growth_rate,
        ROUND(
            CASE 
                WHEN SUM(md.asin_impressions) > 0 THEN 
                    SUM(md.asin_clicks)::numeric / SUM(md.asin_impressions)
                ELSE 0 
            END, 4
        ) AS avg_ctr,
        ROUND(
            CASE 
                WHEN SUM(md.asin_clicks) > 0 THEN 
                    SUM(md.asin_purchases)::numeric / SUM(md.asin_clicks)
                ELSE 0 
            END, 4
        ) AS avg_cvr
    FROM market_data md
    JOIN ranked_asins ra ON md.asin = ra.asin
    CROSS JOIN growth_data gd
    GROUP BY gd.recent_purchases, gd.older_purchases;
END;
$$;

-- 7. Market Share CSV Export Function
CREATE OR REPLACE FUNCTION sqp.get_market_share_csv(
    p_start_date DATE,
    p_end_date DATE,
    p_keywords TEXT[] DEFAULT NULL,
    p_asins TEXT[] DEFAULT NULL,
    p_aggregate TEXT DEFAULT 'weekly'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_csv TEXT;
    v_header TEXT;
    v_table_name TEXT;
BEGIN
    -- Set table based on aggregate
    v_table_name := CASE 
        WHEN p_aggregate = 'monthly' THEN 'sqp.monthly_summary'
        ELSE 'sqp.weekly_summary'
    END;
    
    -- Build CSV header
    v_header := 'period_end,query,asin,total_purchases,total_clicks,total_impressions,purchase_share,click_share,impression_share';
    
    -- Build CSV data
    WITH csv_data AS (
        SELECT 
            period_end::text,
            query,
            asin,
            total_purchases::text,
            total_clicks::text,
            total_impressions::text,
            ROUND(purchase_share, 4)::text,
            ROUND(click_share, 4)::text,
            ROUND(impression_share, 4)::text
        FROM sqp.weekly_summary
        WHERE period_end BETWEEN p_start_date AND p_end_date
            AND (p_keywords IS NULL OR query = ANY(p_keywords))
            AND (p_asins IS NULL OR asin = ANY(p_asins))
        ORDER BY period_end DESC, query, asin
    )
    SELECT string_agg(
        period_end || ',' ||
        query || ',' ||
        asin || ',' ||
        total_purchases || ',' ||
        total_clicks || ',' ||
        total_impressions || ',' ||
        purchase_share || ',' ||
        click_share || ',' ||
        impression_share,
        E'\n'
    ) INTO v_csv
    FROM csv_data;
    
    RETURN v_header || E'\n' || COALESCE(v_csv, '');
END;
$$;

-- 8. Ranking Correlation Data Function
CREATE OR REPLACE FUNCTION sqp.get_ranking_correlation_data(
    p_start_date DATE,
    p_end_date DATE,
    p_keywords TEXT[] DEFAULT NULL,
    p_asin TEXT DEFAULT NULL,
    p_correlation_metric TEXT DEFAULT 'purchases'
)
RETURNS TABLE (
    query TEXT,
    asin TEXT,
    period_end DATE,
    organic_rank INTEGER,
    total_purchases INTEGER,
    total_clicks INTEGER,
    total_impressions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ws.query,
        ws.asin,
        ws.period_end,
        ws.avg_organic_rank::INTEGER AS organic_rank,
        ws.total_purchases::INTEGER,
        ws.total_clicks::INTEGER,
        ws.total_impressions
    FROM sqp.weekly_summary ws
    WHERE ws.period_end BETWEEN p_start_date AND p_end_date
        AND ws.avg_organic_rank IS NOT NULL
        AND ws.avg_organic_rank > 0
        AND (p_keywords IS NULL OR ws.query = ANY(p_keywords))
        AND (p_asin IS NULL OR ws.asin = p_asin)
        AND ws.total_clicks > 0  -- Ensure we have meaningful data
    ORDER BY ws.query, ws.asin, ws.period_end;
END;
$$;

-- Grant execute permissions on all functions
GRANT EXECUTE ON FUNCTION sqp.get_yoy_keyword_performance TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sqp.calculate_cvr_gaps TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sqp.get_purchase_velocity_heatmap TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sqp.calculate_share_of_voice TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sqp.analyze_competitors TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sqp.calculate_market_stats TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sqp.get_market_share_csv TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sqp.get_ranking_correlation_data TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON FUNCTION sqp.get_yoy_keyword_performance IS 'Returns year-over-year performance metrics for keywords with percentage changes';
COMMENT ON FUNCTION sqp.calculate_cvr_gaps IS 'Analyzes conversion rate gaps against market, competitor, and historical benchmarks';
COMMENT ON FUNCTION sqp.get_purchase_velocity_heatmap IS 'Returns purchase velocity data in a heatmap-ready format';
COMMENT ON FUNCTION sqp.calculate_share_of_voice IS 'Calculates share of voice metrics across impressions, clicks, and purchases';
COMMENT ON FUNCTION sqp.analyze_competitors IS 'Provides competitor analysis for a specific ASIN including market concentration';
COMMENT ON FUNCTION sqp.calculate_market_stats IS 'Returns comprehensive market statistics including growth rates and concentration';
COMMENT ON FUNCTION sqp.get_market_share_csv IS 'Exports market share data in CSV format';
COMMENT ON FUNCTION sqp.get_ranking_correlation_data IS 'Returns data for calculating correlation between organic rank and performance metrics';