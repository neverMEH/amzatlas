# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-30-keyword-analysis-popup/spec.md

> Created: 2025-08-30
> Version: 1.0.0

## Technical Requirements

### Frontend Components

- **KeywordAnalysisModal**: Main popup component using React Portal for overlay rendering
  - Props: keyword, asin, dateRange, onClose, onExpand
  - State management using React Query for data fetching
  - Responsive design with min-width: 800px, max-width: 90vw
  
- **KeywordPerformanceChart**: Time series visualization using Recharts
  - Displays metrics: impressions, clicks, cart adds, purchases, CTR, CVR
  - Toggle between metrics similar to existing PerformanceChart
  - Supports comparison data overlay when date comparison is active

- **KeywordFunnelChart**: Conversion funnel specific to selected keyword
  - Reuses existing FunnelChart component with keyword-filtered data
  - Shows progression: Impressions → Clicks → Cart Adds → Purchases

- **KeywordMarketShare**: Market share analysis for the keyword
  - Pie/donut chart showing brand distribution for the keyword
  - Table view with competitor ASINs and their share percentages

- **MultiKeywordSelector**: Component for selecting additional keywords
  - Searchable dropdown with virtualization for performance
  - Chip display for selected keywords (max 10)
  - Clear individual or all selections

- **KeywordComparisonView**: Comparative analysis interface
  - Tabbed view: Combined Metrics | Individual Analysis
  - Side-by-side metric comparisons
  - Unique insights panel highlighting correlations

### UI/UX Specifications

- **Click Handler**: Add to SearchQueryTable rows
  - Visual feedback: cursor pointer, hover state (background color change)
  - Keyboard accessibility: Enter key to open popup
  
- **Modal Behavior**:
  - Overlay with semi-transparent backdrop
  - Close on backdrop click or ESC key
  - Smooth open/close animations (200ms transition)
  
- **Expand to Tab**:
  - Button in top-right corner of modal
  - Opens new tab at route: `/keyword-analysis?asin={asin}&keywords={keywords}&dateRange={range}`
  - Maintains all current state including selected keywords

- **Breadcrumb Navigation** (in expanded view):
  - Format: Dashboard > {ASIN} - {Product Title} > Keyword Analysis
  - Clickable links to navigate back

### Data Management

- **API Endpoints** (new):
  - `GET /api/dashboard/v2/keyword-performance`: Single keyword metrics
  - `GET /api/dashboard/v2/keyword-comparison`: Multi-keyword comparison data
  
- **Caching Strategy**:
  - Use React Query with 5-minute stale time
  - Cache key includes: asin, keyword(s), dateRange
  - Prefetch on hover (with debounce) for instant popup

- **Performance Optimization**:
  - Lazy load chart components
  - Virtual scrolling for keyword selector (if > 100 keywords)
  - Memoize expensive calculations
  - Use React.memo for pure components

### Integration Requirements

- **With Existing Components**:
  - Reuse existing chart components where possible
  - Maintain consistent styling with current dashboard
  - Use existing date range state from main dashboard
  
- **Router Integration**:
  - New route for expanded view: `/keyword-analysis`
  - Query parameters for state persistence
  - Back button support with proper navigation

- **State Management**:
  - Local state for modal open/close
  - Shared state for selected keywords using React Context
  - Sync with URL parameters in expanded view

### Performance Criteria

- Popup opens within 300ms of click
- Chart rendering completes within 500ms
- Smooth 60fps animations for all interactions
- Maximum bundle size increase: 150KB (with code splitting)
- Support for up to 10,000 keywords in the selector