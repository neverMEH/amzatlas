# SQP Intelligence API Documentation

## Overview

The SQP Intelligence API provides comprehensive access to Amazon Search Query Performance data with advanced analytics, brand filtering, period comparisons, and anomaly detection capabilities.

### Base URL
```
https://your-domain.com/api
```

### Authentication
All endpoints require authentication via Supabase JWT tokens passed in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Table of Contents

1. [Brand Management APIs](#brand-management-apis)
2. [Dashboard APIs](#dashboard-apis)
3. [Period Comparison APIs](#period-comparison-apis)
4. [Keyword Trend APIs](#keyword-trend-apis)
5. [Anomaly Detection APIs](#anomaly-detection-apis)

---

## Brand Management APIs

### Get Brands List
Retrieve all brands with optional filtering and performance stats.

**Endpoint:** `GET /api/brands`

**Query Parameters:**
- `search` (string, optional): Search brands by name
- `includeStats` (boolean, optional): Include performance statistics
- `isActive` (boolean, optional): Filter by active status

**Response:**
```json
{
  "brands": [
    {
      "id": "uuid",
      "brand_name": "Brand Name",
      "display_name": "Display Name",
      "is_active": true,
      "asin_count": 25,
      "total_revenue": 150000.00,
      "avg_cvr": 3.5
    }
  ]
}
```

### Search Brands
Intelligent brand search with fuzzy matching.

**Endpoint:** `GET /api/brands/search`

**Query Parameters:**
- `q` or `query` (string, required): Search term

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "brand_name": "Brand Name",
      "display_name": "Display Name",
      "match_score": 0.95
    }
  ],
  "query": "search term",
  "count": 5
}
```

### Get Brand Details
Retrieve detailed information about a specific brand.

**Endpoint:** `GET /api/brands/{brandId}`

**Response:**
```json
{
  "brand": {
    "id": "uuid",
    "brand_name": "Brand Name",
    "display_name": "Display Name",
    "parent_brand_id": "uuid",
    "is_active": true,
    "performance": {
      "total_asins": 25,
      "total_revenue": 150000.00,
      "avg_cvr": 3.5,
      "total_impressions": 1000000,
      "total_purchases": 5000
    },
    "childBrands": [...],
    "parentBrand": {...},
    "productTypes": [
      {
        "product_type": "Electronics",
        "asin_count": 15
      }
    ]
  }
}
```

### Get Brand ASINs
Retrieve all ASINs associated with a brand.

**Endpoint:** `GET /api/brands/{brandId}/asins`

**Query Parameters:**
- `includePerformance` (boolean, optional): Include performance metrics
- `sortBy` (string, optional): Sort field (asin, title, impressions, revenue)
- `order` (string, optional): Sort order (asc, desc)

**Response:**
```json
{
  "brandId": "uuid",
  "asins": [
    {
      "asin": "B08XYZ123",
      "product_title": "Product Title",
      "total_impressions": 50000,
      "total_clicks": 2000,
      "total_purchases": 100,
      "total_revenue": 5000.00
    }
  ],
  "count": 25
}
```

### Get Brand Hierarchy
Retrieve the complete brand hierarchy structure.

**Endpoint:** `GET /api/brands/hierarchy`

**Query Parameters:**
- `includeMetrics` (boolean, optional): Include performance metrics

**Response:**
```json
{
  "hierarchy": [
    {
      "id": "uuid",
      "brand_name": "Parent Brand",
      "display_name": "Parent Display",
      "level": 0,
      "children": [
        {
          "id": "uuid",
          "brand_name": "Child Brand",
          "display_name": "Child Display",
          "level": 1,
          "children": []
        }
      ]
    }
  ],
  "flat": [...],
  "totalBrands": 50,
  "rootBrands": 5
}
```

### Get Brand Statistics
Get aggregated statistics for brands.

**Endpoint:** `GET /api/brands/stats`

**Query Parameters:**
- `brandId` (string, optional): Specific brand ID
- `dateRange` (string, optional): Time range (7d, 30d, 90d, 1y)

**Response:**
```json
{
  "dateRange": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T00:00:00Z",
    "label": "30d"
  },
  "brandId": "uuid",
  "totals": {
    "asins": 25,
    "impressions": 1000000,
    "clicks": 50000,
    "cartAdds": 10000,
    "purchases": 5000,
    "revenue": 250000.00
  },
  "averages": {
    "ctr": 5.0,
    "cartAddRate": 20.0,
    "cartToPurchaseRate": 50.0,
    "cvr": 10.0,
    "revenuePerAsin": 10000.00,
    "pricePerPurchase": 50.00
  },
  "topBrands": [...]
}
```

---

## Dashboard APIs

### Get Dashboard Metrics
Core performance metrics with period comparisons.

**Endpoint:** `GET /api/dashboard/metrics`

**Query Parameters:**
- `start` (date, required): Start date (YYYY-MM-DD)
- `end` (date, required): End date (YYYY-MM-DD)
- `brandId` (string, optional): Filter by brand

**Response:**
```json
{
  "totalPurchases": 5000,
  "weekOverWeekChange": 15.5,
  "marketShare": 25.0,
  "marketShareChange": 2.5,
  "purchaseCVR": 10.0,
  "cvrChange": 1.2,
  "zeroPurchaseKeywords": 150,
  "zeroPurchaseChange": -10,
  "purchaseROI": 4.5,
  "roiChange": 0.5
}
```

### Get Keywords Performance
Retrieve keyword performance data.

**Endpoint:** `GET /api/dashboard/keywords`

**Query Parameters:**
- `limit` (number, optional): Number of results (default: 10)
- `type` (string, optional): Keyword type (top, zero-purchase, rising, negative-roi)
- `brandId` (string, optional): Filter by brand

**Response:**
```json
[
  {
    "keyword": "wireless headphones",
    "purchases": 500,
    "marketPurchases": 2500,
    "share": 20.0,
    "cvr": 8.5,
    "spend": 1000.00,
    "roi": 5.0,
    "trend": "up"
  }
]
```

### Get Purchase Trends
Historical purchase trends data.

**Endpoint:** `GET /api/dashboard/trends`

**Query Parameters:**
- `weeks` (number, optional): Number of weeks (default: 12)
- `brandId` (string, optional): Filter by brand

**Response:**
```json
[
  {
    "week": "W1",
    "purchases": 1000,
    "market": 5000
  },
  {
    "week": "W2",
    "purchases": 1200,
    "market": 5500
  }
]
```

### Get Search Performance (v2)
Enhanced search performance metrics with funnel analysis.

**Endpoint:** `GET /api/dashboard/v2/search-performance`

**Query Parameters:**
- `startDate` (date, optional): Start date
- `endDate` (date, optional): End date
- `asins` (string, optional): Comma-separated ASIN list
- `queries` (string, optional): Comma-separated search queries
- `brandId` (string, optional): Filter by brand
- `minVolume` (number, optional): Minimum impression volume
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "data": [
    {
      "asin": "B08XYZ123",
      "searchQuery": "wireless headphones",
      "impressions": 10000,
      "clicks": 500,
      "cartAdds": 100,
      "purchases": 50,
      "ctr": 5.0,
      "cartAddRate": 20.0,
      "conversionRate": 10.0,
      "funnelCompletionRate": 0.5
    }
  ],
  "summary": {
    "totalQueries": 100,
    "totalImpressions": 1000000,
    "totalClicks": 50000,
    "totalCartAdds": 10000,
    "totalPurchases": 5000,
    "averageCTR": 5.0,
    "averageConversionRate": 10.0
  },
  "filters": {...}
}
```

---

## Period Comparison APIs

### Get Period Comparisons
Compare performance across different time periods.

**Endpoint:** `GET /api/period-comparison`

**Query Parameters:**
- `type` (string, optional): Comparison type (week, month, quarter, year)
- `brandId` (string, optional): Filter by brand
- `asin` (string, optional): Filter by ASIN
- `searchQuery` (string, optional): Filter by search query
- `limit` (number, optional): Result limit
- `offset` (number, optional): Pagination offset

**Response:**
```json
{
  "comparisonType": "week",
  "filters": {...},
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 500,
    "hasMore": true
  },
  "summary": {
    "totalRecords": 500,
    "avgImpressionChange": 15.5,
    "avgCvrChange": 2.1,
    "avgRevenueChange": 20.3,
    "improvedCount": 300,
    "declinedCount": 150,
    "stableCount": 50
  },
  "data": [
    {
      "asin": "B08XYZ123",
      "search_query": "wireless headphones",
      "current_impressions": 10000,
      "previous_impressions": 8000,
      "impressions_change_pct": 25.0,
      "current_cvr": 10.0,
      "previous_cvr": 8.5,
      "cvr_change_pct": 17.6
    }
  ]
}
```

### Get Period Trends
Analyze trends over multiple periods.

**Endpoint:** `GET /api/period-comparison/trends`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand
- `asin` (string, optional): Filter by ASIN
- `metric` (string, optional): Metric to analyze (impressions, clicks, purchases, revenue, cvr, ctr)
- `periods` (number, optional): Number of periods to analyze

**Response:**
```json
{
  "metric": "impressions",
  "periods": 12,
  "trendDirection": "growing",
  "avgChange": 5.5,
  "data": [
    {
      "period": "2024-01-01",
      "value": 10000,
      "changePercent": 10.0,
      "changeAbsolute": 1000,
      "movingAverage": 9500
    }
  ]
}
```

### Get Period Comparison Summary
Summary of comparisons across all period types.

**Endpoint:** `GET /api/period-comparison/summary`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand

**Response:**
```json
{
  "brandId": "uuid",
  "summaries": [
    {
      "period": "week",
      "hasData": true,
      "metrics": {
        "totalKeywords": 500,
        "improvedCount": 300,
        "declinedCount": 150,
        "stableCount": 50,
        "avgImpressionChange": 15.5
      },
      "topGainers": [...],
      "topDecliners": [...]
    }
  ],
  "overall": {
    "bestPerformingPeriod": "week",
    "worstPerformingPeriod": "year",
    "mostVolatilePeriod": "month",
    "avgChangeByPeriod": {
      "week": 15.5,
      "month": 10.2,
      "quarter": 5.1,
      "year": 2.3
    }
  }
}
```

### Flexible Period Comparison
Custom period comparisons with advanced filtering.

**Endpoint:** `POST /api/period-comparison/flexible`

**Request Body:**
```json
{
  "periodType": "custom",
  "currentStart": "2024-01-01",
  "currentEnd": "2024-01-31",
  "previousStart": "2023-12-01",
  "previousEnd": "2023-12-31",
  "brandId": "uuid",
  "asinList": ["B08XYZ123", "B08XYZ456"],
  "minImpressions": 100
}
```

**Response:**
```json
{
  "periodType": "custom",
  "dateRange": {...},
  "filters": {...},
  "stats": {
    "overview": {...},
    "distribution": {...},
    "topMetrics": {...}
  },
  "data": [...]
}
```

---

## Keyword Trend APIs

### Get Keyword Trends
Analyze keyword performance trends with rolling averages.

**Endpoint:** `GET /api/keyword-trends`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand
- `weeks` (number, optional): Number of weeks to analyze (default: 12)
- `minImpressions` (number, optional): Minimum impressions threshold
- `trendType` (string, optional): Filter by trend type (emerging, declining, stable, volatile)
- `limit` (number, optional): Result limit
- `offset` (number, optional): Pagination offset

**Response:**
```json
{
  "filters": {...},
  "pagination": {...},
  "summary": {
    "totalKeywords": 1000,
    "trendDistribution": {
      "emerging": 200,
      "growing": 150,
      "stable": 400,
      "declining": 200,
      "volatile": 50
    },
    "avgVolatility": 0.25,
    "avgTrendStrength": 0.65,
    "topPerformers": [...],
    "needsAttention": [...]
  },
  "data": [
    {
      "o_asin": "B08XYZ123",
      "o_search_query": "wireless headphones",
      "o_trend_classification": "emerging",
      "o_momentum_score": 0.85,
      "o_volatility_score": 0.15,
      "o_trend_strength": 0.75,
      "o_current_week_impressions": 15000,
      "o_avg_weekly_impressions": 10000
    }
  ]
}
```

### Get Rolling Averages
Get keyword performance with rolling average calculations.

**Endpoint:** `GET /api/keyword-trends/rolling-averages`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand
- `asin` (string, optional): Filter by ASIN
- `searchQuery` (string, optional): Filter by search query
- `windowSize` (number, optional): Rolling window size (default: 6)
- `weeks` (number, optional): Number of weeks to retrieve

**Response:**
```json
{
  "filters": {...},
  "summary": {
    "totalQueries": 50,
    "increasing": 20,
    "decreasing": 10,
    "stable": 20,
    "highMomentum": 5
  },
  "data": [
    {
      "asin": "B08XYZ123",
      "brandId": "uuid",
      "searchQuery": "wireless headphones",
      "dataPoints": [
        {
          "weekStart": "2024-01-01",
          "impressions": 10000,
          "clicks": 500,
          "purchases": 50,
          "rollingAvgImpressions": 9500,
          "rollingAvgCvr": 9.8,
          "impressionsTrend": 0.05
        }
      ],
      "analysis": {
        "trendDirection": "increasing",
        "momentum": 15.5,
        "volatility": 0.12
      }
    }
  ]
}
```

### Get Trend Distribution
Distribution of keywords across different trend classifications.

**Endpoint:** `GET /api/keyword-trends/distribution`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand

**Response:**
```json
{
  "brandId": "uuid",
  "summary": {
    "totalKeywords": 1000,
    "totalImpressions": 10000000,
    "healthScore": 75,
    "dominantTrend": "stable"
  },
  "distribution": [
    {
      "trend_type": "emerging",
      "keyword_count": 150,
      "avg_impressions": 5000,
      "total_impressions": 750000,
      "percentage": 15.0,
      "impressionShare": 7.5,
      "example_keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "chartData": [...],
  "insights": {
    "opportunities": [...],
    "risks": [...],
    "recommendations": [...]
  }
}
```

### Get Top Trending Keywords
Retrieve top performing keywords by trend classification.

**Endpoint:** `GET /api/keyword-trends/top-trending`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand
- `trendType` (string, optional): Filter by trend type
- `limit` (number, optional): Result limit (default: 20)

**Response:**
```json
{
  "filters": {...},
  "summary": {
    "totalKeywords": 20,
    "trendBreakdown": [...],
    "topOpportunity": {...}
  },
  "data": [
    {
      "asin": "B08XYZ123",
      "search_query": "wireless headphones",
      "trend_classification": "strong_growth",
      "rank_in_category": 1,
      "impressions": 50000,
      "cvr": 12.5,
      "insights": [...],
      "competitionLevel": {
        "level": "medium",
        "score": 50,
        "reason": "Moderate competition"
      },
      "opportunityScore": 85
    }
  ],
  "grouped": {...},
  "crossAsinOpportunities": [...]
}
```

---

## Anomaly Detection APIs

### Get Anomalies
Detect statistical anomalies in keyword performance.

**Endpoint:** `GET /api/anomalies`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand
- `metric` (string, optional): Metric to analyze (impressions, clicks, purchases, all)
- `severity` (string, optional): Severity level (extreme, moderate, mild)
- `dateRange` (string, optional): Date range (24h, 7d, 30d)
- `limit` (number, optional): Result limit

**Response:**
```json
{
  "filters": {...},
  "summary": {
    "totalAnomalies": 50,
    "byMetric": {
      "impressions": 20,
      "clicks": 15,
      "purchases": 15
    },
    "bySeverity": {
      "extreme": 5,
      "moderate": 20,
      "mild": 25
    },
    "byDirection": {
      "positive": 30,
      "negative": 20
    }
  },
  "patterns": {
    "brandWide": false,
    "categorySpecific": {},
    "timeConcentrated": false,
    "primaryMetricAffected": "impressions",
    "commonCharacteristics": [...]
  },
  "anomalies": [
    {
      "o_asin": "B08XYZ123",
      "o_search_query": "wireless headphones",
      "o_impressions_z_score": 3.5,
      "o_impressions_pct_from_avg": 250.0,
      "severity": "extreme",
      "type": "traffic_surge",
      "insights": [...],
      "recommendedActions": [...]
    }
  ]
}
```

### Get Anomaly Alerts
Real-time anomaly alerts with business impact analysis.

**Endpoint:** `GET /api/anomalies/alerts`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand
- `priority` (string, optional): Alert priority (high, medium, low)
- `status` (string, optional): Alert status (active, acknowledged, resolved)

**Response:**
```json
{
  "filters": {...},
  "summary": {
    "total": 25,
    "byPriority": {
      "high": 5,
      "medium": 10,
      "low": 10
    },
    "criticalAlerts": 3,
    "estimatedTotalImpact": 50000.00
  },
  "alerts": [
    {
      "id": "alert_id",
      "timestamp": "2024-01-15T10:00:00Z",
      "asin": "B08XYZ123",
      "brandId": "uuid",
      "searchQuery": "wireless headphones",
      "priority": "high",
      "status": "active",
      "type": "traffic_loss",
      "metrics": {...},
      "impact": {
        "revenueImpact": -5000.00,
        "purchaseImpact": -100,
        "impactLevel": "severe"
      },
      "title": "Extreme impressions drop for \"wireless headphones\"",
      "description": "Impressions decreased by 75% compared to the 6-week average",
      "recommendations": [...]
    }
  ],
  "grouped": {...}
}
```

### Get Anomaly Summary
High-level summary of anomaly patterns and trends.

**Endpoint:** `GET /api/anomalies/summary`

**Query Parameters:**
- `brandId` (string, optional): Filter by brand

**Response:**
```json
{
  "brandId": "uuid",
  "period": "7 days",
  "summary": {
    "totalAnomalies": 50,
    "extremeAnomalies": 5,
    "moderateAnomalies": 20,
    "mildAnomalies": 25,
    "affectedAsins": 15,
    "affectedQueries": 30,
    "avgImpressionsDeviation": 45.5,
    "avgClicksDeviation": 35.2,
    "avgPurchasesDeviation": 28.7,
    "positiveAnomalies": 20,
    "negativeAnomalies": 30
  },
  "trends": {
    "weekly": [...],
    "direction": "increasing"
  },
  "topAffected": [...],
  "riskScore": {
    "score": 65,
    "level": "high",
    "factors": [...]
  },
  "insights": [...],
  "lastUpdated": "2024-01-15T10:00:00Z"
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API requests are rate limited to:
- 100 requests per minute per API key
- 1000 requests per hour per API key

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

---

## Best Practices

1. **Use Brand Filtering**: When analyzing specific brands, always include the `brandId` parameter for better performance
2. **Pagination**: Use limit and offset parameters for large datasets
3. **Caching**: Implement client-side caching for relatively static data like brand lists
4. **Error Handling**: Always check for error responses and implement retry logic
5. **Date Ranges**: Keep date ranges reasonable to avoid timeouts (max 90 days recommended)

---

## Examples

### Example 1: Get brand performance overview
```bash
# Get brand list
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/api/brands?includeStats=true"

# Get specific brand metrics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/api/dashboard/metrics?brandId=UUID&start=2024-01-01&end=2024-01-31"

# Get brand keyword trends
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/api/keyword-trends?brandId=UUID&trendType=emerging"
```

### Example 2: Analyze period-over-period performance
```bash
# Get week-over-week comparison
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/api/period-comparison?type=week&brandId=UUID"

# Get trend analysis
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/api/period-comparison/trends?brandId=UUID&metric=impressions&periods=12"
```

### Example 3: Monitor anomalies
```bash
# Get recent anomalies
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/api/anomalies?brandId=UUID&severity=extreme&dateRange=7d"

# Get anomaly alerts
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.example.com/api/anomalies/alerts?brandId=UUID&priority=high"
```