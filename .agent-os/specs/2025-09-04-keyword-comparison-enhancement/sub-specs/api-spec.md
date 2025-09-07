# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-04-keyword-comparison-enhancement/spec.md

## Endpoints

### GET /api/dashboard/v2/keyword-metrics

**Purpose:** Fetch aggregated KPI data for all keywords of a specific ASIN within a date range

**Parameters:**
- `asin` (required, string): The ASIN to fetch keywords for
- `startDate` (required, string): Start date in ISO format
- `endDate` (required, string): End date in ISO format
- `comparisonStartDate` (optional, string): Start date for comparison period
- `comparisonEndDate` (optional, string): End date for comparison period

**Response:**
```json
{
  "keywords": [
    {
      "keyword": "string",
      "impressions": 0,
      "clicks": 0,
      "cartAdds": 0,
      "purchases": 0,
      "ctr": 0.0,
      "cvr": 0.0,
      "cartAddRate": 0.0,
      "purchaseShare": 0.0,
      "comparisonData": {
        "impressions": 0,
        "clicks": 0,
        "cartAdds": 0,
        "purchases": 0,
        "ctr": 0.0,
        "cvr": 0.0,
        "changes": {
          "impressions": 0.0,
          "clicks": 0.0,
          "purchases": 0.0,
          "ctr": 0.0,
          "cvr": 0.0
        }
      }
    }
  ],
  "totalKeywords": 0,
  "dateRange": {
    "start": "string",
    "end": "string"
  }
}
```

**Errors:**
- `400 Bad Request`: Invalid parameters (missing ASIN, invalid dates)
- `404 Not Found`: ASIN not found in database
- `500 Internal Server Error`: Database query failure

### PATCH /api/dashboard/v2/keyword-comparison

**Purpose:** Enhanced endpoint to support bar chart visualization with metric filtering

**Parameters:**
- Existing parameters remain unchanged
- Add `metric` (optional, enum): Selected metric for bar chart display ["impressions", "clicks", "purchases", "ctr", "cvr"]
- Add `sortBy` (optional, enum): Sort order for results ["value-desc", "value-asc", "keyword-asc", "keyword-desc"]

**Response:** 
Enhanced response includes:
```json
{
  "marketShareData": {
    "selectedMetric": "impressions",
    "data": [
      {
        "asin": "string",
        "value": 0,
        "percentage": 0.0,
        "rank": 1
      }
    ]
  },
  // ... existing response fields
}
```

**Errors:** Same as existing endpoint

### GET /api/dashboard/v2/export/keyword-comparison

**Purpose:** Export keyword comparison data in CSV format

**Parameters:**
- `asin` (required, string): The ASIN to export data for
- `keywords` (required, array): List of keywords to include
- `startDate` (required, string): Start date in ISO format
- `endDate` (required, string): End date in ISO format
- `metrics` (optional, array): Metrics to include in export ["impressions", "clicks", "purchases", "ctr", "cvr"]

**Response:**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="keyword-comparison-{asin}-{date}.csv"`
- Body: CSV formatted data

**Errors:**
- `400 Bad Request`: Invalid parameters
- `413 Payload Too Large`: Too many keywords requested (limit: 100)