# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-28-comprehensive-dashboard-reports/spec.md

## API Overview

New REST API endpoints to support period-over-period reporting and enhanced dashboard functionality. All endpoints follow RESTful conventions and return JSON responses.

## Endpoints

### GET /api/dashboard/v3/brands

**Purpose:** Retrieve list of available brands with basic metrics

**Parameters:**
- `include_inactive` (optional): Boolean to include inactive brands (default: false)
- `parent_only` (optional): Boolean to show only parent brands (default: false)

**Response:**
```json
{
  "data": {
    "brands": [
      {
        "brand_id": "550e8400-e29b-41d4-a716-446655440000",
        "brand_name": "TechPro",
        "display_name": "TechPro Electronics",
        "parent_brand_id": null,
        "active_asins": 12,
        "total_impressions_last_30d": 450000,
        "total_purchases_last_30d": 3200,
        "is_active": true
      }
    ]
  }
}
```

**Errors:**
- 401: Unauthorized

### GET /api/dashboard/v3/period-comparison

**Purpose:** Retrieve period-over-period comparison data for specified metrics and time ranges

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `period_type` (required): One of 'week', 'month', 'quarter', 'year'
- `start_date` (required): ISO date string for period start
- `end_date` (optional): ISO date string for period end (defaults to current date)
- `asins` (optional): Comma-separated list of ASINs to filter (within selected brand)
- `metrics` (optional): Comma-separated list of metrics to include (defaults to all)
- `comparison_type` (optional): 'absolute' or 'percentage' (default: 'percentage')

**Response:**
```json
{
  "data": {
    "current_period": {
      "start": "2025-01-01",
      "end": "2025-01-31",
      "metrics": {
        "total_impressions": 150000,
        "total_clicks": 4500,
        "total_purchases": 320,
        "click_rate": 0.03,
        "purchase_rate": 0.071
      }
    },
    "previous_period": {
      "start": "2024-12-01",
      "end": "2024-12-31",
      "metrics": {
        "total_impressions": 120000,
        "total_clicks": 3600,
        "total_purchases": 280,
        "click_rate": 0.03,
        "purchase_rate": 0.078
      }
    },
    "changes": {
      "total_impressions": 25.0,
      "total_clicks": 25.0,
      "total_purchases": 14.3,
      "click_rate": 0.0,
      "purchase_rate": -9.0
    }
  },
  "metadata": {
    "brand_id": "550e8400-e29b-41d4-a716-446655440000",
    "brand_name": "TechPro",
    "period_type": "month",
    "comparison_type": "percentage"
  }
}
```

**Errors:**
- 400: Invalid period type or date range
- 422: Start date after end date

### GET /api/dashboard/v3/search-performance-trends

**Purpose:** Analyze search query performance trends over time

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `period_type` (required): One of 'week', 'month', 'quarter', 'year' 
- `time_range` (optional): Number of periods to analyze (default: 12)
- `asins` (optional): Comma-separated list of ASINs (within selected brand)
- `min_volume` (optional): Minimum query volume threshold
- `sort_by` (optional): 'volume', 'score', 'growth_rate' (default: 'volume')
- `limit` (optional): Number of results (default: 100)

**Response:**
```json
{
  "data": {
    "queries": [
      {
        "search_query": "wireless headphones",
        "current_volume": 45000,
        "current_score": 8.5,
        "trend_data": [
          {
            "period": "2025-W01",
            "volume": 42000,
            "score": 8.3,
            "impressions": 15000,
            "clicks": 450,
            "purchases": 32
          }
        ],
        "growth_metrics": {
          "volume_growth_rate": 7.1,
          "score_change": 0.2,
          "trend_direction": "up"
        }
      }
    ]
  },
  "pagination": {
    "total": 450,
    "page": 1,
    "per_page": 100
  }
}
```

**Errors:**
- 400: Invalid parameters
- 429: Rate limit exceeded

### GET /api/dashboard/v3/funnel-analysis

**Purpose:** Detailed conversion funnel analysis with period comparisons

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `period_type` (required): One of 'week', 'month', 'quarter', 'year'
- `periods` (optional): Number of periods to include (default: 4)
- `asins` (optional): Comma-separated list of ASINs (within selected brand)
- `breakdown` (optional): 'brand', 'asin', 'query', 'shipping' (default: 'asin')

**Response:**
```json
{
  "data": {
    "funnel_stages": [
      {
        "stage": "impressions",
        "total_count": 500000,
        "asin_count": 45000,
        "conversion_to_next": 0.03
      },
      {
        "stage": "clicks",
        "total_count": 15000,
        "asin_count": 1350,
        "conversion_to_next": 0.45
      },
      {
        "stage": "cart_adds",
        "total_count": 6750,
        "asin_count": 608,
        "conversion_to_next": 0.65
      },
      {
        "stage": "purchases",
        "total_count": 4388,
        "asin_count": 395,
        "conversion_to_next": null
      }
    ],
    "period_comparison": {
      "previous_period": {
        "impressions": 450000,
        "final_conversion": 0.0087
      },
      "change_percentage": {
        "impressions": 11.1,
        "final_conversion": 2.3
      }
    }
  }
}
```

**Errors:**
- 400: Invalid period type or breakdown
- 404: No data for specified period

### GET /api/dashboard/v3/pricing-analysis

**Purpose:** Analyze price-performance correlations across periods

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `period_type` (required): One of 'week', 'month', 'quarter', 'year'
- `metric` (required): 'median_click_price', 'median_cart_add_price', 'median_purchase_price'
- `asins` (optional): Comma-separated list of ASINs (within selected brand)
- `include_competitors` (optional): Boolean to include non-brand products in market analysis (default: true)

**Response:**
```json
{
  "data": {
    "price_trends": [
      {
        "period": "2025-01",
        "asin_price": 29.99,
        "market_price": 32.45,
        "price_position": "below_market",
        "conversion_rate": 0.045,
        "market_share": 0.12
      }
    ],
    "correlations": {
      "price_vs_conversion": -0.65,
      "price_vs_market_share": -0.72,
      "optimal_price_range": {
        "min": 27.99,
        "max": 31.99
      }
    }
  }
}
```

**Errors:**
- 400: Invalid metric or parameters

### GET /api/dashboard/v3/shipping-impact

**Purpose:** Analyze shipping speed impact on conversions

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `period_type` (required): One of 'month', 'quarter', 'year'
- `start_date` (required): ISO date string
- `end_date` (optional): ISO date string
- `asins` (optional): Comma-separated list of ASINs (within selected brand)

**Response:**
```json
{
  "data": {
    "shipping_performance": {
      "same_day": {
        "clicks": 5000,
        "purchases": 450,
        "conversion_rate": 0.09,
        "avg_price": 45.99
      },
      "one_day": {
        "clicks": 12000,
        "purchases": 840,
        "conversion_rate": 0.07,
        "avg_price": 38.99
      },
      "two_day": {
        "clicks": 8000,
        "purchases": 400,
        "conversion_rate": 0.05,
        "avg_price": 32.99
      }
    },
    "trends": {
      "same_day_preference_growth": 15.2,
      "price_sensitivity_by_speed": {
        "same_day": "low",
        "one_day": "medium",
        "two_day": "high"
      }
    }
  }
}
```

**Errors:**
- 400: Period type must be month or longer for shipping analysis

### POST /api/dashboard/v3/reports/generate

**Purpose:** Generate custom reports with specified parameters

**Parameters:**
```json
{
  "name": "Monthly Performance Report",
  "brand_id": "550e8400-e29b-41d4-a716-446655440000",
  "report_type": "monthly",
  "period_start": "2025-01-01",
  "period_end": "2025-01-31",
  "sections": ["overview", "funnel", "queries", "pricing", "shipping"],
  "format": "pdf",
  "email_to": ["team@example.com"],
  "include_brand_comparison": true
}
```

**Response:**
```json
{
  "data": {
    "report_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "estimated_completion": "2025-01-20T10:30:00Z",
    "webhook_url": "/api/dashboard/v3/reports/550e8400-e29b-41d4-a716-446655440000/status"
  }
}
```

**Errors:**
- 400: Invalid report configuration
- 429: Report generation limit exceeded

### GET /api/dashboard/v3/reports/{report_id}/status

**Purpose:** Check report generation status

**Response:**
```json
{
  "data": {
    "report_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "download_url": "https://cdn.example.com/reports/550e8400.pdf",
    "expires_at": "2025-02-01T00:00:00Z",
    "metrics_summary": {
      "total_impressions": 500000,
      "conversion_rate": 0.045,
      "period_growth": 12.3
    }
  }
}
```

**Errors:**
- 404: Report not found

### GET /api/dashboard/v3/keyword-trends

**Purpose:** Analyze keyword performance with 6-week rolling averages and anomaly detection

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `level` (required): 'asin', 'product_type', or 'brand' for aggregation level
- `start_date` (optional): ISO date string for period start (default: 12 weeks ago)
- `end_date` (optional): ISO date string for period end (default: current week)
- `keywords` (optional): Comma-separated list of specific keywords to analyze
- `trend_status` (optional): Filter by 'emerging', 'declining', 'stable', 'volatile'
- `min_z_score` (optional): Minimum absolute Z-score for anomaly detection (default: 2)
- `limit` (optional): Number of results per week (default: 100)

**Response:**
```json
{
  "data": {
    "trends": [
      {
        "week": "2025-01-20",
        "keyword": "wireless headphones",
        "level": "asin",
        "level_value": "B08XYZ123",
        "metrics": {
          "weekly_volume": 45000,
          "rolling_6w_volume": 38500,
          "rolling_6w_stddev": 3200,
          "volume_z_score": 2.03,
          "volume_vs_6w_trend_pct": 16.9,
          "wow_change_pct": 8.5,
          "six_week_change_pct": 25.0
        },
        "trend_status": "EMERGING",
        "performance_metrics": {
          "revenue": 125000,
          "rolling_6w_revenue": 105000,
          "ctr": 0.045,
          "conversion_rate": 0.082,
          "impression_share": 0.15,
          "purchase_share": 0.18
        }
      }
    ],
    "summary": {
      "total_keywords": 450,
      "emerging_keywords": 45,
      "declining_keywords": 38,
      "significant_anomalies": 12
    }
  },
  "metadata": {
    "aggregation_level": "asin",
    "weeks_analyzed": 12,
    "last_update": "2025-01-28T03:30:00Z"
  }
}
```

**Errors:**
- 400: Invalid level or date range
- 404: No data for specified filters

### GET /api/dashboard/v3/keyword-anomalies

**Purpose:** Detect statistically significant keyword performance anomalies

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `period` (optional): 'current_week' or 'last_4_weeks' (default: 'current_week')
- `min_z_score` (optional): Minimum absolute Z-score (default: 2)
- `impact_metric` (optional): 'volume', 'revenue', or 'both' (default: 'both')
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "data": {
    "anomalies": [
      {
        "keyword": "bluetooth speaker waterproof",
        "asin": "B08ABC456",
        "brand": "TechPro",
        "anomaly_type": "POSITIVE_SPIKE",
        "z_scores": {
          "volume": 3.45,
          "revenue": 2.89
        },
        "impact": {
          "volume_change": "+145%",
          "revenue_change": "+98%",
          "baseline_volume": 12000,
          "actual_volume": 29400
        },
        "context": {
          "week": "2025-01-20",
          "trend_history": "Previously stable for 8 weeks"
        }
      }
    ],
    "statistics": {
      "total_anomalies": 28,
      "positive_anomalies": 18,
      "negative_anomalies": 10,
      "avg_z_score": 2.67
    }
  }
}
```

**Errors:**
- 400: Invalid parameters

### GET /api/dashboard/v3/emerging-declining-keywords

**Purpose:** Identify keywords with consistent growth or decline patterns

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `trend_type` (required): 'emerging', 'declining', or 'both'
- `min_trend_weeks` (optional): Minimum consecutive weeks of trend (default: 3)
- `min_growth_rate` (optional): Minimum growth percentage for emerging (default: 20)
- `aggregation` (optional): 'asin', 'product_type', or 'brand' (default: 'brand')
- `limit` (optional): Number of results (default: 100)

**Response:**
```json
{
  "data": {
    "keywords": [
      {
        "keyword": "smart home devices",
        "trend_type": "EMERGING",
        "aggregation_level": "brand",
        "metrics": {
          "current_volume": 85000,
          "volume_6w_ago": 45000,
          "six_week_growth": 88.9,
          "trend_consistency": 0.92,
          "consecutive_growth_weeks": 5
        },
        "performance": {
          "total_purchases_6w": 3200,
          "revenue_growth": 95.5,
          "market_share_gain": 2.1
        },
        "forecast": {
          "projected_volume_next_week": 92000,
          "confidence": 0.85
        }
      }
    ]
  }
}
```

**Errors:**
- 400: Invalid trend type or parameters

### GET /api/dashboard/v3/multi-level-keyword-comparison

**Purpose:** Compare keyword performance across ASIN, Product Type, and Brand levels

**Parameters:**
- `brand_id` (required): UUID of the brand to filter
- `keyword` (required): Specific keyword to analyze
- `start_date` (optional): ISO date string (default: 12 weeks ago)
- `end_date` (optional): ISO date string (default: current week)

**Response:**
```json
{
  "data": {
    "keyword": "wireless headphones",
    "levels": {
      "brand": {
        "total_volume": 250000,
        "rolling_6w_volume": 220000,
        "volume_trend": "+13.6%",
        "market_share": 15.5,
        "asin_count": 12,
        "revenue": 875000
      },
      "product_types": [
        {
          "product_type": "Audio",
          "volume": 180000,
          "volume_share": 72.0,
          "trend": "+15.2%",
          "asin_count": 8
        }
      ],
      "top_asins": [
        {
          "asin": "B08XYZ123",
          "volume": 45000,
          "volume_share": 18.0,
          "trend": "+25.0%",
          "performance": "STAR_PERFORMER"
        }
      ]
    },
    "trend_alignment": {
      "brand_vs_market": "OUTPERFORMING",
      "consistency_score": 0.78
    }
  }
}
```

**Errors:**
- 400: Missing required parameters
- 404: Keyword not found

### GET /api/dashboard/v3/top-performers

**Purpose:** Identify top performing ASINs and queries by various metrics

**Parameters:**
- `brand_id` (required): UUID of the brand to filter (or 'all' for cross-brand view)
- `metric` (required): 'volume', 'conversion', 'revenue', 'growth'
- `period_type` (required): One of 'week', 'month', 'quarter', 'year'
- `limit` (optional): Number of results (default: 20)
- `group_by` (optional): 'asin' or 'brand' (default: 'asin')

**Response:**
```json
{
  "data": {
    "top_asins": [
      {
        "asin": "B08XYZ123",
        "metric_value": 4500,
        "change_percentage": 25.0,
        "rank_change": 2
      }
    ],
    "top_queries": [
      {
        "query": "bluetooth speaker waterproof",
        "metric_value": 15000,
        "associated_asins": 3,
        "growth_trend": "accelerating"
      }
    ]
  }
}
```

**Errors:**
- 400: Invalid metric or period type

### PUT /api/dashboard/v3/brands/{brand_id}/asin-mapping

**Purpose:** Update brand-ASIN mapping for manual overrides

**Parameters:**
```json
{
  "asin": "B08XYZ123",
  "action": "assign" | "remove",
  "confidence_score": 1.0
}
```

**Response:**
```json
{
  "data": {
    "asin": "B08XYZ123",
    "brand_id": "550e8400-e29b-41d4-a716-446655440000",
    "extraction_method": "manual",
    "confidence_score": 1.0,
    "verified": true
  }
}
```

**Errors:**
- 404: Brand or ASIN not found
- 409: ASIN already assigned to different brand

## Common Response Headers

All API responses include:
- `X-Request-ID`: Unique request identifier for debugging
- `X-Rate-Limit-Remaining`: Number of requests remaining in rate limit window
- `X-Response-Time`: Server processing time in milliseconds

## Error Response Format

```json
{
  "error": {
    "code": "INVALID_PERIOD_TYPE",
    "message": "Period type must be one of: week, month, quarter, year",
    "details": {
      "provided_value": "daily",
      "allowed_values": ["week", "month", "quarter", "year"]
    }
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Rate Limiting

- Standard endpoints: 1000 requests per hour per API key
- Report generation: 10 reports per hour per API key
- Burst allowance: 100 requests per minute

## Authentication

All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <supabase_access_token>
```