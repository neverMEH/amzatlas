# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-04-brand-main-page/spec.md

## Endpoints

### GET /api/brands

**Purpose:** Retrieve all available brands for the header dropdown selector

**Response Format:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "display_name": "Work Sharp"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001", 
      "display_name": "Amazon Basics"
    }
  ]
}
```

### GET /api/brands/[brandId]/dashboard

**Purpose:** Retrieve complete dashboard data for a selected brand including KPIs, products, and search queries

**Parameters:**
- `brandId` (path): UUID of the brand
- `date_from` (query): Start date for metrics (ISO 8601)
- `date_to` (query): End date for metrics (ISO 8601)
- `comparison_date_from` (query): Comparison period start date
- `comparison_date_to` (query): Comparison period end date
- `product_limit` (query): Number of products to return (default: 50)
- `query_limit` (query): Number of search queries to return (default: 50)

**Response Format:**
```json
{
  "data": {
    "kpis": {
      "impressions": {
        "value": 24500,
        "trend": [3200, 3100, 2900, 3300, 3400, ...], // 20 data points
        "comparison": 12.3 // Only if comparison dates provided
      },
      "clicks": {
        "value": 4585,
        "trend": [620, 580, 650, 590, 610, ...],
        "comparison": 8.7
      },
      "cartAdds": {
        "value": 1080,
        "trend": [140, 135, 150, 145, 155, ...],
        "comparison": -3.2
      },
      "purchases": {
        "value": 631,
        "trend": [78, 82, 85, 79, 88, ...],
        "comparison": 15.4
      }
    },
    "products": [
      {
        "id": "B08VD8ZGFZ",
        "name": "Work Sharp MK2 Professional",
        "childAsin": "B08VD8ZGFZ",
        "image": "/api/products/B08VD8ZGFZ/image",
        "impressions": 2450,
        "impressionsComparison": 8.3,
        "clicks": 385,
        "clicksComparison": 12.5,
        "cartAdds": 65,
        "cartAddsComparison": -3.8,
        "purchases": 45,
        "purchasesComparison": 15.2,
        "ctr": "15.7%",
        "ctrComparison": 4.2,
        "cvr": "11.7%", 
        "cvrComparison": -2.1,
        "impressionShare": "32%",
        "impressionShareComparison": 5.8,
        "cvrShare": "28%",
        "cvrShareComparison": 3.2,
        "ctrShare": "35%",
        "ctrShareComparison": 7.5,
        "cartAddShare": "30%",
        "cartAddShareComparison": -1.3,
        "purchaseShare": "25%",
        "purchaseShareComparison": 2.8
      }
      // ... more products
    ],
    "searchQueries": [
      {
        "id": 1,
        "query": "knife sharpener",
        "impressions": 8500,
        "impressionsComparison": 12.3,
        "clicks": 1250,
        "clicksComparison": 8.7,
        "cartAdds": 185,
        "cartAddsComparison": 5.2,
        "purchases": 95,
        "purchasesComparison": 7.8,
        "ctr": "14.7%",
        "ctrComparison": -3.6,
        "cvr": "7.6%",
        "cvrComparison": 2.1,
        "impressionShare": "45%",
        "impressionShareComparison": 8.5,
        "cvrShare": "32%",
        "cvrShareComparison": 4.7,
        "ctrShare": "38%", 
        "ctrShareComparison": 6.2,
        "cartAddShare": "35%",
        "cartAddShareComparison": 3.8,
        "purchaseShare": "30%",
        "purchaseShareComparison": 5.3
      }
      // ... more search queries
    ]
  },
  "meta": {
    "brand": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "display_name": "Work Sharp"
    },
    "dateRange": {
      "from": "2025-08-01",
      "to": "2025-09-04"
    },
    "comparisonDateRange": {
      "from": "2025-07-01",
      "to": "2025-08-04"
    }
  }
}
```

### GET /api/products/[asin]/image

**Purpose:** Retrieve product image for display in the product table

**Parameters:**
- `asin` (path): ASIN of the product

**Response:** 
- Binary image data with appropriate content-type header
- Returns placeholder image if product image not available

## Implementation Details

### KPI Trend Calculation
- Trend arrays contain 20 evenly distributed data points over the selected date range
- Used for sparkline visualizations in KPI cards
- Calculated from daily aggregates

### Comparison Calculations
- All comparison values are percentage changes between periods
- Formula: `((current - previous) / previous) * 100`
- Null/undefined when comparison dates not provided

### Share Metric Calculations
- **Impression Share**: ASIN impressions / Total market impressions
- **CTR Share**: ASIN clicks / Total market clicks  
- **CVR Share**: ASIN purchases / Total market purchases
- **Cart Add Share**: ASIN cart adds / Total market cart adds
- **Purchase Share**: ASIN purchases / Total market purchases

### Performance Requirements
- Response time < 500ms for up to 100 products
- Utilize materialized views for share calculations
- Cache results for 2 minutes

### Error Handling
```json
{
  "error": {
    "code": "BRAND_NOT_FOUND",
    "message": "Brand not found"
  }
}
```

Error codes:
- `BRAND_NOT_FOUND` - Invalid brand ID
- `INVALID_DATE_RANGE` - Invalid or missing date parameters
- `DATABASE_ERROR` - Query execution failure