# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-30-keyword-analysis-popup/spec.md

> Created: 2025-08-30
> Version: 1.0.0

## Endpoints

### GET /api/dashboard/v2/keyword-performance

**Purpose:** Retrieve detailed performance metrics for a specific keyword-ASIN combination
**Parameters:**
- `asin` (string, required): The ASIN to filter by
- `keyword` (string, required): The search query/keyword to analyze
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, required): End date in YYYY-MM-DD format
- `comparisonStartDate` (string, optional): Comparison period start date
- `comparisonEndDate` (string, optional): Comparison period end date

**Response:**
```json
{
  "success": true,
  "data": {
    "keyword": "string",
    "asin": "string",
    "dateRange": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    },
    "comparisonDateRange": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    },
    "metrics": {
      "current": {
        "impressions": "number",
        "clicks": "number",
        "cartAdds": "number",
        "purchases": "number",
        "clickRate": "number",
        "cartAddRate": "number",
        "purchaseRate": "number",
        "impressionShare": "number",
        "clickShare": "number",
        "purchaseShare": "number"
      },
      "comparison": {
        "impressions": "number",
        "clicks": "number",
        "cartAdds": "number",
        "purchases": "number",
        "clickRate": "number",
        "cartAddRate": "number",
        "purchaseRate": "number",
        "impressionShare": "number",
        "clickShare": "number",
        "purchaseShare": "number"
      },
      "changes": {
        "impressions": "number",
        "clicks": "number",
        "cartAdds": "number",
        "purchases": "number",
        "clickRate": "number",
        "cartAddRate": "number",
        "purchaseRate": "number",
        "impressionShare": "number",
        "clickShare": "number",
        "purchaseShare": "number"
      }
    },
    "timeSeries": [
      {
        "date": "YYYY-MM-DD",
        "impressions": "number",
        "clicks": "number",
        "cartAdds": "number",
        "purchases": "number",
        "clickRate": "number",
        "cartAddRate": "number",
        "purchaseRate": "number"
      }
    ],
    "comparisonTimeSeries": [
      {
        "date": "YYYY-MM-DD",
        "impressions": "number",
        "clicks": "number",
        "cartAdds": "number",
        "purchases": "number",
        "clickRate": "number",
        "cartAddRate": "number",
        "purchaseRate": "number"
      }
    ],
    "funnelData": {
      "impressions": "number",
      "clicks": "number",
      "cartAdds": "number",
      "purchases": "number"
    },
    "marketShare": {
      "totalMarket": {
        "impressions": "number",
        "clicks": "number",
        "purchases": "number"
      },
      "competitors": [
        {
          "asin": "string",
          "brand": "string",
          "title": "string",
          "impressionShare": "number",
          "clickShare": "number",
          "purchaseShare": "number"
        }
      ]
    }
  }
}
```

**Errors:**
- 400: Invalid parameters (missing required fields, invalid date format)
- 404: ASIN or keyword not found
- 500: Server error

### GET /api/dashboard/v2/keyword-comparison

**Purpose:** Compare performance metrics across multiple keywords for a specific ASIN
**Parameters:**
- `asin` (string, required): The ASIN to filter by
- `keywords` (string[], required): Array of keywords to compare (max 10)
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, required): End date in YYYY-MM-DD format
- `comparisonStartDate` (string, optional): Comparison period start date
- `comparisonEndDate` (string, optional): Comparison period end date

**Response:**
```json
{
  "success": true,
  "data": {
    "asin": "string",
    "keywords": ["string"],
    "dateRange": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    },
    "comparisonDateRange": {
      "start": "YYYY-MM-DD",
      "end": "YYYY-MM-DD"
    },
    "combinedMetrics": {
      "current": {
        "totalImpressions": "number",
        "totalClicks": "number",
        "totalCartAdds": "number",
        "totalPurchases": "number",
        "avgClickRate": "number",
        "avgCartAddRate": "number",
        "avgPurchaseRate": "number",
        "combinedImpressionShare": "number",
        "combinedClickShare": "number",
        "combinedPurchaseShare": "number"
      },
      "comparison": {
        "totalImpressions": "number",
        "totalClicks": "number",
        "totalCartAdds": "number",
        "totalPurchases": "number",
        "avgClickRate": "number",
        "avgCartAddRate": "number",
        "avgPurchaseRate": "number",
        "combinedImpressionShare": "number",
        "combinedClickShare": "number",
        "combinedPurchaseShare": "number"
      }
    },
    "individualMetrics": [
      {
        "keyword": "string",
        "metrics": {
          "impressions": "number",
          "clicks": "number",
          "cartAdds": "number",
          "purchases": "number",
          "clickRate": "number",
          "cartAddRate": "number",
          "purchaseRate": "number",
          "impressionShare": "number",
          "clickShare": "number",
          "purchaseShare": "number"
        },
        "changes": {
          "impressions": "number",
          "clicks": "number",
          "cartAdds": "number",
          "purchases": "number",
          "clickRate": "number",
          "cartAddRate": "number",
          "purchaseRate": "number"
        }
      }
    ],
    "insights": {
      "topPerformers": ["string"],
      "biggestGains": ["string"],
      "biggestLosses": ["string"],
      "conversionCorrelations": [
        {
          "keywords": ["string", "string"],
          "correlation": "number",
          "insight": "string"
        }
      ],
      "recommendations": ["string"]
    },
    "timeSeries": {
      "combined": [
        {
          "date": "YYYY-MM-DD",
          "impressions": "number",
          "clicks": "number",
          "cartAdds": "number",
          "purchases": "number"
        }
      ],
      "individual": {
        "keyword1": [
          {
            "date": "YYYY-MM-DD",
            "impressions": "number",
            "clicks": "number",
            "cartAdds": "number",
            "purchases": "number"
          }
        ]
      }
    }
  }
}
```

**Errors:**
- 400: Invalid parameters (too many keywords, missing required fields)
- 404: ASIN not found
- 500: Server error

## Controllers

### KeywordPerformanceController

**getKeywordPerformance()**
- Query `sqp.search_query_performance` table filtered by ASIN and keyword
- Calculate period comparisons if comparison dates provided
- Aggregate time series data by date
- Calculate market share by comparing to total market metrics
- Return formatted response with all metrics

### KeywordComparisonController  

**compareKeywords()**
- Validate keyword count (max 10)
- Query performance data for all selected keywords
- Calculate combined metrics (sum for totals, weighted average for rates)
- Generate individual keyword metrics
- Run correlation analysis between keywords
- Generate insights and recommendations based on patterns
- Return comprehensive comparison data

## Error Handling

All endpoints follow consistent error response format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

Common error codes:
- `INVALID_PARAMETERS`: Missing or invalid request parameters
- `NOT_FOUND`: Requested resource not found
- `TOO_MANY_KEYWORDS`: Exceeded maximum keyword limit
- `DATE_RANGE_ERROR`: Invalid date range specified
- `SERVER_ERROR`: Internal server error