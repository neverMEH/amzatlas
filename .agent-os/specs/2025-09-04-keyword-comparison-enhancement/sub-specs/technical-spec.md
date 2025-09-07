# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-04-keyword-comparison-enhancement/spec.md

## Technical Requirements

### Layout & UI Requirements

- Convert `/keyword-analysis` page from 3-column grid (`grid-cols-3`) to vertical stack layout (`space-y-6`)
- Implement full-width container for KeywordComparisonView component
- Position MultiKeywordSelector above comparison view in comparison mode
- Increase visible keyword funnels from 4 to 8 using responsive grid
- Update all container max-width constraints from `max-w-4xl` to `max-w-6xl`

### KPI-Enhanced Keyword Selector

- Create new API endpoint `/api/dashboard/v2/keyword-metrics` returning KeywordKPI data
- Implement React Query hooks for real-time KPI data fetching
- Design table-based UI with 5 KPI columns: Impressions, Clicks, Purchases, CTR, CVR
- Add sortable dropdown with 6 options: Alphabetical (A-Z, Z-A), Performance metrics (Impressions, Clicks, Purchases, Market Share)
- Implement collapsible filter panel with minimum thresholds for impressions and purchases
- Add loading states and skeleton UI during data fetching

### Filterable Bar Chart Component

- Create new `FilterableBarChart.tsx` component using Recharts library
- Support metric switching: impressions, clicks, purchases, CTR, CVR
- Implement dynamic sorting by selected metric value
- Add interactive tooltips displaying all metrics on hover
- Include data export functionality (CSV format)
- Use color coding to indicate performance levels (green/yellow/red based on thresholds)

### Waterfall Chart Enhancements

- Fix tooltip positioning using Recharts' built-in tooltip positioning
- Add keyboard navigation support for accessibility
- Implement click-to-drill-down functionality for detailed metric view
- Optimize rendering performance for datasets with 50+ keywords
- Add responsive breakpoints for chart height and bar width

### Performance Criteria

- Page load time < 2 seconds with 50 keywords
- Chart rendering < 500ms for up to 20 keywords
- Smooth 60fps scrolling with full dataset
- API response times < 300ms for KPI data
- Memory usage < 100MB for typical session

### Data Integration

- Maintain compatibility with existing `search_query_performance` table structure
- Use materialized view `search_performance_summary` for optimized queries
- Implement request debouncing for filter/sort operations
- Cache KPI data with 5-minute TTL using React Query

### Testing Requirements

- Unit tests achieving 80%+ coverage for new components
- Integration tests for complete user workflows
- Performance benchmarks for large datasets (1000+ keywords)
- Visual regression tests for chart components
- Accessibility tests meeting WCAG 2.1 AA standards

## External Dependencies

- **@tanstack/react-query v5.x** - Client-side data caching and synchronization
- **Justification:** Already in use, provides efficient data fetching with built-in caching, loading states, and error handling essential for KPI real-time updates

- **react-intersection-observer v9.x** - Viewport detection for lazy loading
- **Justification:** Optimize performance when rendering large keyword lists by only loading visible items, critical for 1000+ keyword datasets

- **file-saver v2.x** - Client-side file generation for exports
- **Justification:** Enable CSV export functionality for filtered bar chart data without server round-trip