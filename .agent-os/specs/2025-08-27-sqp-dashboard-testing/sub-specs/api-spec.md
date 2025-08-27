# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-27-sqp-dashboard-testing/spec.md

> Created: 2025-08-27
> Version: 1.0.0

## Endpoints

### Report Endpoints

#### GET /api/reports/search-terms

Retrieve search terms report data with filtering and pagination.

**Parameters:**
- `startDate` (query, optional): Start date filter (ISO 8601 format)
- `endDate` (query, optional): End date filter (ISO 8601 format)  
- `limit` (query, optional): Number of records to return (default: 100, max: 1000)
- `offset` (query, optional): Number of records to skip (default: 0)
- `sortBy` (query, optional): Field to sort by (search_term, impressions, clicks, ctr, avg_position)
- `sortOrder` (query, optional): Sort direction (asc, desc, default: desc)

**Response Format:**
```json
{
  "data": [
    {
      "search_term": "string",
      "impressions": "number",
      "clicks": "number",
      "ctr": "number",
      "avg_position": "number",
      "date": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number", 
    "offset": "number",
    "hasMore": "boolean"
  },
  "metadata": {
    "lastRefresh": "string (ISO 8601)",
    "dataRange": {
      "start": "string (ISO 8601)",
      "end": "string (ISO 8601)"
    }
  }
}
```

#### GET /api/reports/campaigns

Retrieve campaign performance report data.

**Parameters:**
- `startDate` (query, optional): Start date filter
- `endDate` (query, optional): End date filter
- `campaignIds` (query, optional): Comma-separated list of campaign IDs
- `limit` (query, optional): Number of records to return
- `offset` (query, optional): Number of records to skip
- `sortBy` (query, optional): Field to sort by (campaign_name, impressions, clicks, cost, conversions)
- `sortOrder` (query, optional): Sort direction

**Response Format:**
```json
{
  "data": [
    {
      "campaign_id": "string",
      "campaign_name": "string",
      "impressions": "number",
      "clicks": "number",
      "cost": "number",
      "conversions": "number",
      "conversion_rate": "number",
      "ctr": "number",
      "avg_cpc": "number",
      "date": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number",
    "offset": "number", 
    "hasMore": "boolean"
  },
  "metadata": {
    "lastRefresh": "string (ISO 8601)",
    "dataRange": {
      "start": "string (ISO 8601)",
      "end": "string (ISO 8601)"
    }
  }
}
```

#### GET /api/reports/keywords

Retrieve keyword performance report data.

**Parameters:**
- `startDate` (query, optional): Start date filter
- `endDate` (query, optional): End date filter
- `keywordIds` (query, optional): Comma-separated list of keyword IDs
- `matchType` (query, optional): Keyword match type filter (exact, phrase, broad)
- `limit` (query, optional): Number of records to return
- `offset` (query, optional): Number of records to skip
- `sortBy` (query, optional): Field to sort by (keyword, impressions, clicks, cost, quality_score)
- `sortOrder` (query, optional): Sort direction

**Response Format:**
```json
{
  "data": [
    {
      "keyword_id": "string",
      "keyword": "string",
      "match_type": "string",
      "impressions": "number",
      "clicks": "number",
      "cost": "number",
      "conversions": "number",
      "quality_score": "number",
      "ctr": "number",
      "avg_cpc": "number",
      "avg_position": "number",
      "date": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  },
  "metadata": {
    "lastRefresh": "string (ISO 8601)",
    "dataRange": {
      "start": "string (ISO 8601)",
      "end": "string (ISO 8601)"
    }
  }
}
```

#### GET /api/reports/ad-groups

Retrieve ad group performance report data.

**Parameters:**
- `startDate` (query, optional): Start date filter
- `endDate` (query, optional): End date filter
- `adGroupIds` (query, optional): Comma-separated list of ad group IDs
- `campaignIds` (query, optional): Comma-separated list of campaign IDs
- `limit` (query, optional): Number of records to return
- `offset` (query, optional): Number of records to skip
- `sortBy` (query, optional): Field to sort by (ad_group_name, impressions, clicks, cost, conversions)
- `sortOrder` (query, optional): Sort direction

**Response Format:**
```json
{
  "data": [
    {
      "ad_group_id": "string",
      "ad_group_name": "string", 
      "campaign_id": "string",
      "campaign_name": "string",
      "impressions": "number",
      "clicks": "number",
      "cost": "number",
      "conversions": "number",
      "conversion_rate": "number",
      "ctr": "number",
      "avg_cpc": "number",
      "date": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  },
  "metadata": {
    "lastRefresh": "string (ISO 8601)",
    "dataRange": {
      "start": "string (ISO 8601)",
      "end": "string (ISO 8601)"
    }
  }
}
```

#### POST /api/reports/custom-query

Execute a custom query against the SQP data.

**Request Body:**
```json
{
  "query": "string (BigQuery SQL)",
  "parameters": {
    "startDate": "string (ISO 8601, optional)",
    "endDate": "string (ISO 8601, optional)",
    "limit": "number (optional, max: 10000)"
  },
  "cacheResults": "boolean (optional, default: false)"
}
```

**Response Format:**
```json
{
  "data": [
    {
      "dynamic_fields": "dynamic values based on query"
    }
  ],
  "metadata": {
    "queryExecutionTime": "number (milliseconds)",
    "rowCount": "number",
    "bytesProcessed": "number",
    "cached": "boolean"
  }
}
```

### Dashboard Endpoints

#### GET /api/dashboards/views

Retrieve all custom dashboard views for the current user.

**Parameters:**
- `limit` (query, optional): Number of views to return (default: 50)
- `offset` (query, optional): Number of views to skip (default: 0)
- `sortBy` (query, optional): Field to sort by (name, created_at, updated_at)
- `sortOrder` (query, optional): Sort direction

**Response Format:**
```json
{
  "data": [
    {
      "id": "string (UUID)",
      "name": "string",
      "description": "string",
      "configuration": {
        "widgets": [
          {
            "id": "string",
            "type": "string (chart, table, metric)",
            "title": "string",
            "reportType": "string",
            "filters": "object",
            "position": {
              "x": "number",
              "y": "number",
              "width": "number", 
              "height": "number"
            }
          }
        ],
        "layout": "object"
      },
      "isDefault": "boolean",
      "createdAt": "string (ISO 8601)",
      "updatedAt": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  }
}
```

#### POST /api/dashboards/views

Create a new custom dashboard view.

**Request Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "configuration": {
    "widgets": [
      {
        "id": "string",
        "type": "string (chart, table, metric)",
        "title": "string",
        "reportType": "string",
        "filters": "object",
        "position": {
          "x": "number",
          "y": "number", 
          "width": "number",
          "height": "number"
        }
      }
    ],
    "layout": "object"
  },
  "isDefault": "boolean (optional, default: false)"
}
```

**Response Format:**
```json
{
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "description": "string",
    "configuration": "object",
    "isDefault": "boolean",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

#### PUT /api/dashboards/views/{viewId}

Update an existing dashboard view.

**Path Parameters:**
- `viewId` (required): UUID of the dashboard view

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)", 
  "configuration": "object (optional)",
  "isDefault": "boolean (optional)"
}
```

**Response Format:**
```json
{
  "data": {
    "id": "string (UUID)",
    "name": "string",
    "description": "string",
    "configuration": "object",
    "isDefault": "boolean",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
}
```

#### DELETE /api/dashboards/views/{viewId}

Delete a dashboard view.

**Path Parameters:**
- `viewId` (required): UUID of the dashboard view

**Response Format:**
```json
{
  "message": "Dashboard view deleted successfully"
}
```

#### GET /api/dashboards/layout

Retrieve the current dashboard layout configuration.

**Response Format:**
```json
{
  "data": {
    "gridSize": {
      "columns": "number",
      "rows": "number"
    },
    "widgets": [
      {
        "id": "string",
        "position": {
          "x": "number",
          "y": "number",
          "width": "number",
          "height": "number"
        }
      }
    ],
    "theme": "string",
    "autoRefresh": {
      "enabled": "boolean",
      "interval": "number (minutes)"
    }
  }
}
```

#### PUT /api/dashboards/layout

Update the dashboard layout configuration.

**Request Body:**
```json
{
  "gridSize": {
    "columns": "number (optional)",
    "rows": "number (optional)"
  },
  "widgets": [
    {
      "id": "string",
      "position": {
        "x": "number",
        "y": "number",
        "width": "number",
        "height": "number"
      }
    }
  ],
  "theme": "string (optional)",
  "autoRefresh": {
    "enabled": "boolean (optional)",
    "interval": "number (optional, minutes)"
  }
}
```

**Response Format:**
```json
{
  "data": {
    "gridSize": "object",
    "widgets": "array",
    "theme": "string",
    "autoRefresh": "object",
    "updatedAt": "string (ISO 8601)"
  }
}
```

### Data Refresh Endpoints

#### POST /api/data/refresh

Trigger a manual data refresh for specified data sources.

**Request Body:**
```json
{
  "sources": [
    "string (search_terms, campaigns, keywords, ad_groups, or 'all')"
  ],
  "dateRange": {
    "start": "string (ISO 8601, optional)",
    "end": "string (ISO 8601, optional)"
  },
  "priority": "string (low, normal, high, optional, default: normal)"
}
```

**Response Format:**
```json
{
  "data": {
    "refreshId": "string (UUID)",
    "status": "string (queued, running, completed, failed)",
    "sources": "array",
    "dateRange": "object",
    "priority": "string",
    "estimatedDuration": "number (minutes)",
    "createdAt": "string (ISO 8601)"
  }
}
```

#### GET /api/data/refresh/{refreshId}/status

Get the status of a data refresh operation.

**Path Parameters:**
- `refreshId` (required): UUID of the refresh operation

**Response Format:**
```json
{
  "data": {
    "refreshId": "string (UUID)",
    "status": "string (queued, running, completed, failed)",
    "sources": "array",
    "dateRange": "object",
    "priority": "string",
    "progress": {
      "percentage": "number (0-100)",
      "currentSource": "string",
      "recordsProcessed": "number",
      "totalRecords": "number"
    },
    "duration": "number (seconds)",
    "error": "string (if status is failed)",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)",
    "completedAt": "string (ISO 8601, if completed)"
  }
}
```

#### GET /api/data/refresh/history

Get history of data refresh operations.

**Parameters:**
- `limit` (query, optional): Number of records to return (default: 50, max: 200)
- `offset` (query, optional): Number of records to skip (default: 0)
- `status` (query, optional): Filter by status (queued, running, completed, failed)
- `source` (query, optional): Filter by data source

**Response Format:**
```json
{
  "data": [
    {
      "refreshId": "string (UUID)",
      "status": "string",
      "sources": "array", 
      "dateRange": "object",
      "priority": "string",
      "duration": "number (seconds)",
      "recordsProcessed": "number",
      "error": "string (if failed)",
      "createdAt": "string (ISO 8601)",
      "completedAt": "string (ISO 8601, if completed)"
    }
  ],
  "pagination": {
    "total": "number",
    "limit": "number",
    "offset": "number",
    "hasMore": "boolean"
  }
}
```

## Controllers

### ReportsController

Handles all report-related API endpoints including search terms, campaigns, keywords, and ad groups reports.

**Methods:**
- `getSearchTerms()` - Handles GET /api/reports/search-terms
- `getCampaigns()` - Handles GET /api/reports/campaigns  
- `getKeywords()` - Handles GET /api/reports/keywords
- `getAdGroups()` - Handles GET /api/reports/ad-groups
- `executeCustomQuery()` - Handles POST /api/reports/custom-query

### DashboardController

Manages dashboard views and layout configurations.

**Methods:**
- `getViews()` - Handles GET /api/dashboards/views
- `createView()` - Handles POST /api/dashboards/views
- `updateView()` - Handles PUT /api/dashboards/views/{viewId}
- `deleteView()` - Handles DELETE /api/dashboards/views/{viewId}
- `getLayout()` - Handles GET /api/dashboards/layout
- `updateLayout()` - Handles PUT /api/dashboards/layout

### DataRefreshController

Manages data refresh operations and status tracking.

**Methods:**
- `triggerRefresh()` - Handles POST /api/data/refresh
- `getRefreshStatus()` - Handles GET /api/data/refresh/{refreshId}/status
- `getRefreshHistory()` - Handles GET /api/data/refresh/history

## Error Handling

All endpoints follow a consistent error response format:

### Error Response Format
```json
{
  "error": {
    "code": "string (error code)",
    "message": "string (human-readable message)",
    "details": "string (optional additional details)",
    "field": "string (optional field name for validation errors)"
  },
  "timestamp": "string (ISO 8601)",
  "path": "string (request path)"
}
```

### Common Error Codes

- `INVALID_REQUEST` (400): Malformed request body or invalid parameters
- `UNAUTHORIZED` (401): Authentication required
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (422): Data validation failed
- `RATE_LIMITED` (429): Too many requests
- `SERVER_ERROR` (500): Internal server error
- `DATA_UNAVAILABLE` (503): Data refresh in progress or data source unavailable

### Validation Rules

- Date parameters must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
- `limit` parameters have maximum values as specified per endpoint
- `offset` parameters must be non-negative integers
- Custom queries are validated for safety (no DELETE, DROP, ALTER statements)
- Dashboard view names must be unique per user
- Widget positions must be within grid boundaries

### Rate Limiting

- Report endpoints: 100 requests per minute per user
- Custom query endpoint: 10 requests per minute per user  
- Dashboard endpoints: 50 requests per minute per user
- Data refresh endpoints: 5 requests per minute per user

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Requests remaining in current window  
- `X-RateLimit-Reset`: Timestamp when the current window resets