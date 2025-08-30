# Spec Tasks

These are the tasks to be completed for the performance chart type switching feature

> Created: 2025-08-30
> Status: Ready for Implementation

## Tasks

### 1. Analyze Current PerformanceChart Component
- [ ] Review `/src/components/asin-performance/PerformanceChart.tsx` to understand current implementation
- [ ] Document how date range data is currently passed to the component
- [ ] Identify where chart type (line vs bar) is currently determined
- [ ] Review how comparison data is handled in the current chart

### 2. Implement Date Range Duration Detection
- [ ] Add utility function to calculate duration between start and end dates
- [ ] Create logic to detect when selected range is exactly 1 week (7 days)
- [ ] Handle edge cases for partial weeks or week boundaries
- [ ] Add TypeScript types for chart type enumeration

### 3. Update Chart Type Logic
- [ ] Modify PerformanceChart component to accept chart type as a prop or calculate it internally
- [ ] Implement conditional rendering for Recharts BarChart vs LineChart components
- [ ] Ensure both chart types use the same data structure and formatting
- [ ] Maintain consistent styling (colors, tooltips, legends) across chart types

### 4. Handle Comparison Data for Bar Charts
- [ ] Ensure comparison data displays correctly in bar chart format
- [ ] Implement grouped bars for current vs comparison periods when showing 1 week
- [ ] Maintain tooltip functionality for both current and comparison data points
- [ ] Ensure bar chart legends clearly distinguish between current and comparison data

### 5. Update Chart Configuration
- [ ] Configure bar chart spacing and sizing for optimal readability
- [ ] Ensure bar charts use same color scheme as line charts
- [ ] Implement proper axis formatting for single-week bar chart display
- [ ] Add responsive behavior for bar chart elements

### 6. Write Comprehensive Tests
- [ ] Create test cases in `/src/components/asin-performance/__tests__/PerformanceChart.test.tsx`
- [ ] Test chart type detection for various date ranges:
  - [ ] Exactly 7 days (should show bar chart)
  - [ ] Less than 7 days (should show bar chart)
  - [ ] More than 7 days (should show line chart)
  - [ ] Multiple weeks (should show line chart)
  - [ ] Multiple months (should show line chart)
- [ ] Test comparison data rendering in both chart types
- [ ] Test metric toggle functionality works with both chart types
- [ ] Mock Recharts components to verify correct chart type is rendered

### 7. Integration Testing
- [ ] Test the feature end-to-end in the dashboard
- [ ] Verify chart switches correctly when date range changes
- [ ] Ensure all metrics (impressions, clicks, cart adds, purchases, etc.) display correctly in both chart types
- [ ] Test comparison period functionality with 1-week selections
- [ ] Verify performance and responsiveness with both chart types

### 8. Edge Case Handling
- [ ] Handle cases where date range spans partial weeks
- [ ] Ensure proper behavior when no data is available for the selected period
- [ ] Test behavior when comparison data is missing or incomplete
- [ ] Handle timezone considerations for week boundary detection

### 9. Documentation Updates
- [ ] Update component documentation to describe chart type switching behavior
- [ ] Add comments explaining the 1-week detection logic
- [ ] Document any new props or configuration options added

### 10. Performance Optimization
- [ ] Ensure chart type switching doesn't cause unnecessary re-renders
- [ ] Optimize data transformation for bar chart format if needed
- [ ] Verify memory usage and performance with both chart types

### 11. User Experience Validation
- [ ] Verify bar charts are more readable than line charts for single-week data
- [ ] Ensure transitions between chart types are smooth and intuitive
- [ ] Validate that tooltips and interactions work consistently across both chart types
- [ ] Test with various screen sizes to ensure bar charts display properly

### 12. Code Review and Cleanup
- [ ] Review code for maintainability and clarity
- [ ] Ensure consistent code style with existing codebase
- [ ] Remove any unused imports or code
- [ ] Verify TypeScript types are properly defined

### Acceptance Criteria
- ✅ When date range is 7 days or less, PerformanceChart displays a bar chart
- ✅ When date range is more than 7 days, PerformanceChart displays a line chart
- ✅ Comparison data works correctly with both chart types
- ✅ All existing functionality (metric toggles, tooltips, legends) works with both chart types
- ✅ Chart type switching is automatic based on date range selection
- ✅ Performance and visual quality are maintained across both chart types
- ✅ Comprehensive test coverage for the new functionality