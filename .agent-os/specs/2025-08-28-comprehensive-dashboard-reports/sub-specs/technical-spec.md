# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-28-comprehensive-dashboard-reports/spec.md

## Technical Requirements

### Dashboard Architecture
- **Component Structure**: Modular React components using shadcn/ui for consistent UI
  - BrandSelector component as persistent global header with brand switching and search
  - PeriodSelector component for WoW/MoM/QoQ/YoY selection with date range picker
  - MetricsGrid component with drill-down capabilities for each metric card
  - TrendChart component using Recharts for interactive time-series visualizations
  - ComparisonTable component with sortable columns and export functionality
  - FilterPanel component for ASIN, query, and metric threshold filtering within brand context
  - BrandSummaryCard component showing aggregated brand-level metrics
- **Keyword Trend Components**:
  - KeywordTrendChart component with trend bands and anomaly highlighting
  - AnomalyAlertPanel component for real-time keyword spike/drop detection
  - EmergingKeywordsWidget component with growth rate indicators
  - MultiLevelDrilldown component for Brand → Product Type → ASIN navigation
  - KeywordHeatmap component for week-by-week deviation visualization
  - TrendSparklineTable component with inline 12-week trend graphs

### Brand Management System
- **Brand Extraction Service**: Automated brand identification from product titles
  - NLP-based brand name extraction using regex patterns and common brand formats
  - Brand name normalization (handling variations like "Brand Name" vs "BrandName")
  - Manual brand override capability through admin interface
  - Brand hierarchy support for sub-brands and product lines
- **Brand Context Management**: Persistent brand selection across user sessions
  - LocalStorage/SessionStorage for brand preference persistence
  - React Context API for global brand state management
  - Automatic brand context injection into all API calls
  - Brand switching without page reload

### Data Processing Pipeline
- **Period Calculation Engine**: Server-side TypeScript service for period comparisons
  - Automatic period boundary detection (week starts Sunday, month/quarter/year boundaries)
  - Percentage change calculations with null/zero handling
  - Rolling period comparisons (last 4 weeks, last 12 months, etc.)
  - Cached calculation results in Redis with TTL based on data freshness
  - Brand-aware aggregations at all calculation levels
- **Data Source Integration**:
  - Read from existing `search_query_performance` and `asin_performance_data` tables
  - Join with `asin_brand_mapping` for brand filtering
  - Leverage materialized views for pre-calculated aggregations
  - Fall back to raw tables for custom date ranges

### Performance Optimizations
- **Materialized Views**: PostgreSQL materialized views for common aggregations
  - brand_performance_summary: Brand-level aggregated metrics
  - period_performance_summary: Pre-calculated period metrics refreshed daily with brand grouping
  - query_trend_analysis: Query-level trends with period comparisons filtered by brand
  - asin_period_comparisons: ASIN performance across all period types with brand association
- **Query Optimization**: 
  - Index strategies on brand, date columns and commonly filtered fields
  - Partition tables by brand and date for faster queries
  - Connection pooling with Supabase for concurrent requests
  - Brand-specific cache keys for efficient data retrieval

### Real-time Features
- **Server-Sent Events (SSE)**: Live dashboard updates when new data syncs
  - Period comparison recalculation notifications
  - Report generation progress updates
  - Data quality alerts for anomalies

### Report Generation System
- **Background Job Processing**: BullMQ/Redis for async report generation
  - Scheduled weekly/monthly report generation
  - On-demand report creation with progress tracking
  - PDF/Excel export using Puppeteer and ExcelJS
  - Email delivery integration via SendGrid/Postmark

### Weekly Data Update Pipeline
- **BigQuery Sync Integration**: Automated weekly update process
  - Step 1: Existing BigQuery sync populates `search_query_performance` and `asin_performance_data`
  - Step 2: Brand extraction for new ASINs using `sqp.update_brand_mappings()`
  - Step 3: Materialized view refresh using `sqp.refresh_period_views()`
  - Step 4: Cache invalidation for affected date ranges
- **Update Schedule**:
  - BigQuery sync: Sunday 2:00 AM (existing process)
  - Brand mapping update: Sunday 3:00 AM
  - View refresh: Sunday 3:30 AM
  - Cache warm-up: Sunday 4:00 AM
- **Error Handling**:
  - Automatic retry on materialized view refresh failures
  - Email alerts on brand extraction failures
  - Fallback to previous week's data if sync fails
  - Transaction rollback on partial updates

### Frontend State Management
- **React Query (TanStack Query)**: Efficient data fetching and caching
  - Intelligent cache invalidation on period changes
  - Optimistic updates for filter changes
  - Background refetching for real-time feel
  - Query result sharing across components

### Keyword Trend Analysis Engine
- **Rolling Average Calculations**: Specialized service for 6-week rolling metrics
  - Window functions for efficient rolling calculations
  - Standard deviation for Z-score anomaly detection
  - Trend classification algorithms (emerging/declining/stable/volatile)
  - Multi-level aggregation support (ASIN → Product Type → Brand)
- **Statistical Analysis**:
  - Z-score calculation for volume and revenue anomalies
  - Trend consistency scoring based on directional changes
  - Correlation analysis between price changes and performance
  - Forecast confidence intervals for emerging keywords
- **Performance Optimizations**:
  - Pre-calculated rolling metrics in materialized views
  - Indexed Z-score columns for fast anomaly queries
  - Partitioned trend data by week for efficient windowing
  
### UI/UX Specifications
- **Responsive Design**: Mobile-first approach with breakpoints
  - Desktop: Full dashboard with side-by-side comparisons
  - Tablet: Stacked layout with collapsible sections
  - Mobile: Simplified view with swipeable period selection
- **Interactive Features**:
  - Hover tooltips showing period comparison details
  - Click-to-drill from summary to detailed views
  - Keyboard shortcuts for period navigation
  - Export buttons on all data visualizations
- **Keyword Trend Visualizations**:
  - Line charts with trend bands (actual vs 6-week average ±1 std dev)
  - Heat maps showing keyword deviation from baseline by week
  - Sparkline tables with 12-week mini trend lines
  - Alert cards for keywords exceeding 2 standard deviations
  - Hierarchical treemaps for Brand → Product Type → ASIN drill-down

### Error Handling & Monitoring
- **Graceful Degradation**: Fallback to cached data on API failures
- **Error Boundaries**: Component-level error handling with user-friendly messages
- **Performance Monitoring**: Track query execution times and dashboard load speeds
- **Analytics**: Track user interactions to optimize report layouts

## External Dependencies

- **@tanstack/react-table** - Advanced data table functionality with sorting, filtering, and pagination
- **Justification:** Required for complex comparison tables with dynamic columns and row grouping
- **natural** or **compromise** - Natural language processing for brand extraction
- **Justification:** Extract brand names from unstructured product titles with high accuracy
- **date-fns** - Date manipulation and formatting for period calculations
- **Justification:** More performant than moment.js for period boundary calculations
- **recharts** - Already in use, but leveraging advanced features for period comparisons
- **Justification:** Supports complex time-series visualizations with period overlays
- **react-sparklines** - Inline sparkline charts for trend tables
- **Justification:** Lightweight library for embedding mini charts in table rows
- **d3-scale** - Statistical scaling for Z-score visualizations
- **Justification:** Required for accurate heat map color scaling based on standard deviations
- **exceljs** - Excel report generation for data exports
- **Justification:** Enables formatted Excel exports with charts and multiple sheets
- **@react-pdf/renderer** - PDF report generation
- **Justification:** Creates professional PDF reports with charts and tables
- **bullmq** - Background job processing for report generation
- **Justification:** Handles async report generation with progress tracking
- **zod** - Runtime type validation for API responses
- **Justification:** Ensures data integrity when processing period comparisons