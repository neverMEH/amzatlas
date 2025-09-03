# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-03-keyword-analysis-enhancements/spec.md

> Created: 2025-09-03
> Version: 1.0.0

## Technical Requirements

### Date Range Selection Fix

- Fix the issue where DateRangePickerV2 calendar closes immediately when clicked
- Ensure the calendar dropdown remains open until a date is selected or clicked outside
- Update the onChange handler to properly propagate date changes to the parent component
- Maintain state consistency between period type selector and date display
- Preserve the ASIN-based auto-date selection functionality

### Enhanced Market Share Module  

- Modify KeywordMarketShare component to focus on top 5 converting ASINs
- Add conversion rate calculation (purchases/clicks) as primary sort metric
- Include additional KPIs for each ASIN:
  - Conversion Rate (CVR)
  - Click-Through Rate (CTR)
  - Total purchases
  - Impression share
- Implement clickable ASIN rows that open main dashboard in new tab
- Pass ASIN as query parameter to auto-select in dashboard
- Maintain responsive table layout with proper truncation for long titles

### Waterfall Chart Component

- Create new WaterfallChart component using Recharts library
- Support dynamic metric selection (impressions, clicks, cart adds, purchases)
- Calculate and display variance between current and comparison periods
- Sort keywords by absolute change value (descending)
- Show top 10 keywords only
- Use color coding: green for positive changes, red for negative
- Display actual values and percentage changes on hover
- Include running total line to show cumulative impact
- Support both absolute and percentage view modes

### Metric Toggle System

- Create reusable MetricToggle component for chart controls
- Support switching between:
  - Impressions
  - Clicks  
  - Cart Adds
  - Purchases
- Maintain selected metric state in URL parameters
- Update chart data reactively when metric changes
- Show metric-specific formatting (numbers vs percentages)

### Cross-Tab Navigation

- Implement utility function for dashboard URL generation
- Include query parameters:
  - asin: Selected ASIN
  - startDate: Current date range start
  - endDate: Current date range end  
  - source: 'keyword-analysis' for tracking
- Use window.open with target="_blank" and rel="noopener"
- Ensure dashboard properly handles incoming parameters

## UI/UX Specifications

- Maintain existing design system and component styling
- Use consistent color palette from Tailwind configuration
- Ensure smooth transitions and loading states
- Add proper aria-labels for accessibility
- Show loading skeletons during data fetches
- Display error states with actionable messages

## Performance Criteria

- Waterfall chart should render within 500ms for 10 keywords
- Market share data should load within 1 second
- Date range changes should trigger updates within 300ms
- Implement proper memoization for expensive calculations
- Use React.memo for pure component optimization