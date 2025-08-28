# Dashboard Reports Specification

This is the dashboard reports specification for the spec detailed in @.agent-os/specs/2025-08-28-dashboard-bigquery-sync/spec.md

## Report Categories and Implementations

### Core Performance Reports

#### 1. YoY Keyword Performance Analysis
**Data Source:** `sqp.yearly_summary` view with year-over-year comparisons
**Metrics:** Impressions, clicks, purchases, CTR, CVR with YoY % changes
**Visualization:** Line charts with dual Y-axis, data table with sparklines
**API Endpoint:** `GET /api/reports/performance/yoy-keywords`

#### 2. Weekly Purchase Velocity Tracker
**Data Source:** `sqp.weekly_trends` materialized view
**Metrics:** Week-over-week purchase count changes, velocity trends
**Visualization:** Area chart with trend lines, heatmap for multi-ASIN view
**API Endpoint:** `GET /api/reports/performance/purchase-velocity`

#### 3. Keyword Ranking Correlation Report
**Data Source:** Join `sqp.weekly_summary` with ranking data
**Metrics:** Purchase count vs organic rank correlation coefficient
**Visualization:** Scatter plot with regression line, correlation matrix
**API Endpoint:** `GET /api/reports/performance/rank-correlation`

#### 4. ASIN vs Market Share Analysis
**Data Source:** `sqp.weekly_summary` with purchase_share calculations
**Metrics:** Your purchase % of total market by keyword
**Visualization:** Stacked bar chart, market share trending line
**API Endpoint:** `GET /api/reports/performance/market-share`

#### 5. Conversion Rate Gap Analysis
**Data Source:** `sqp.weekly_summary` comparing ASIN CVR to market average
**Metrics:** ASIN CVR vs Market CVR with priority scoring
**Visualization:** Gap analysis chart with priority matrix
**API Endpoint:** `GET /api/reports/performance/cvr-gap`

### Diagnostic Reports

#### 6. Zero Purchase Alert Report
**Data Source:** `sqp.weekly_summary WHERE clicks > 0 AND purchases = 0`
**Metrics:** Keywords with clicks but no conversions, wasted spend
**Visualization:** Alert table with severity indicators
**API Endpoint:** `GET /api/reports/diagnostic/zero-purchase`

#### 7. Cart Abandonment Analysis
**Data Source:** Custom view joining cart_adds vs purchases by keyword
**Metrics:** Cart add rate, abandonment rate, lost revenue estimate
**Visualization:** Funnel chart, abandonment trend line
**API Endpoint:** `GET /api/reports/diagnostic/cart-abandonment`

#### 8. Bleeding Keywords Report
**Data Source:** `sqp.weekly_trends WHERE trend = 'declining' AND ad_spend > 0`
**Metrics:** Keywords losing rank despite ad spend, efficiency score
**Visualization:** Waterfall chart showing rank decline, spend vs performance
**API Endpoint:** `GET /api/reports/diagnostic/bleeding-keywords`

#### 9. CTR Deterioration Alerts
**Data Source:** `sqp.weekly_trends WHERE ctr_wow < -10`
**Metrics:** Declining click-through rates with severity scoring
**Visualization:** Alert dashboard with trend sparklines
**API Endpoint:** `GET /api/reports/diagnostic/ctr-alerts`

#### 10. Seasonal Opportunity Calendar
**Data Source:** Historical patterns from `sqp.monthly_summary`
**Metrics:** Upcoming seasonal keyword spikes based on YoY patterns
**Visualization:** Calendar heatmap, opportunity timeline
**API Endpoint:** `GET /api/reports/diagnostic/seasonal-opportunities`

### Actionable Dashboards

#### 11. 4-Quadrant Keyword Prioritization
**Data Source:** Combined metrics from multiple views
**Metrics:** Performance vs Potential matrix (High/Low Performance, High/Low Potential)
**Visualization:** Interactive 4-quadrant scatter plot with filtering
**API Endpoint:** `GET /api/reports/actionable/keyword-quadrants`

#### 12. Weekly Action Item Generator
**Data Source:** Aggregated insights from all diagnostic reports
**Metrics:** Prioritized to-do list based on impact and effort
**Visualization:** Kanban board style action items
**API Endpoint:** `GET /api/reports/actionable/weekly-actions`

#### 13. Performance Anomaly Detector
**Data Source:** Statistical analysis on `sqp.weekly_summary`
**Metrics:** Statistical outliers using z-scores and IQR methods
**Visualization:** Anomaly timeline, detail cards for each anomaly
**API Endpoint:** `GET /api/reports/actionable/anomalies`

## Component Updates Required

### Dashboard Layout Updates
- Replace `/dashboard/reports/*` pages with new report components
- Update navigation to include all 13 reports organized by category
- Implement report filtering by date range, ASIN, and keyword

### API Route Modifications
Replace existing mock data endpoints:
- `/api/dashboard/metrics` → Real purchase metrics from Supabase
- `/api/dashboard/trends` → Weekly trends from materialized views
- `/api/dashboard/keywords` → Top performing keywords
- `/api/dashboard/roi-trends` → ROI calculations from actual data
- `/api/dashboard/market-share-trends` → Market share from purchase_share

### UI Components
- Create reusable chart components using Recharts
- Implement data tables with sorting/filtering using tanstack/react-table
- Add export functionality for all reports (CSV, PDF)
- Implement real-time updates using Server-Sent Events

## Performance Requirements

### Query Optimization
- All report queries must return in < 500ms
- Use materialized views for complex aggregations
- Implement query result caching with 5-minute TTL
- Paginate results for tables with > 100 rows

### Data Freshness
- Reports should reflect data synced within last 24 hours
- Show "last updated" timestamp on each report
- Visual indicator if data is stale (> 48 hours old)

### Load Time Targets
- Initial page load: < 1 second
- Report switching: < 300ms
- Data filtering: < 200ms
- Export generation: < 5 seconds

## Error Handling

### Data Availability
- Show meaningful empty states when no data available
- Provide sample date ranges with available data
- Fall back to cached data if real-time query fails

### User Feedback
- Loading states for all async operations
- Error messages with suggested actions
- Success confirmations for exports and actions