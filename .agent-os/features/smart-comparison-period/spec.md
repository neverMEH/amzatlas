# Smart Comparison Period Selection Feature Specification

> Feature: Smart Comparison Period Selection
> Created: 2025-08-31
> Status: Planning
> Priority: High

## Problem Statement

Currently, the ASIN Performance dashboard uses a fixed 7-day offset for comparison periods regardless of the selected date range. This creates several user experience issues:

### Current Behavior Issues
- **Week selections**: 7-day comparison periods work well
- **Month selections**: 7-day comparison doesn't provide meaningful month-over-month insights
- **Quarter selections**: 7-day comparison is completely inadequate for quarterly analysis
- **Custom ranges**: Fixed 7-day offset may not align with business reporting cycles

### User Pain Points
1. **Misleading comparisons**: Comparing December monthly performance to a 7-day period in November
2. **Lack of contextual relevance**: Users expect month-over-month when selecting monthly ranges
3. **Inconsistent reporting**: Business stakeholders receive inconsistent comparison metrics
4. **Manual workarounds**: Users must manually calculate proper comparison periods

## Proposed Solution

Implement intelligent comparison period selection that automatically chooses appropriate comparison periods based on the selected date range characteristics.

### Smart Logic Rules
1. **Week-over-Week**: For date ranges 6-8 days → Compare to same period previous week
2. **Month-over-Month**: For date ranges 28-32 days → Compare to same period previous month
3. **Quarter-over-Quarter**: For date ranges 89-93 days → Compare to same period previous quarter
4. **Year-over-Year**: For date ranges 363-367 days → Compare to same period previous year
5. **Custom Equivalent**: For other ranges → Compare to equivalent period shifted by range duration

### Algorithm Details
```typescript
function calculateSmartComparisonPeriod(startDate: Date, endDate: Date): {
  comparisonStartDate: Date;
  comparisonEndDate: Date;
  comparisonType: 'week' | 'month' | 'quarter' | 'year' | 'custom';
} {
  const rangeDays = differenceInDays(endDate, startDate) + 1;
  
  if (rangeDays >= 6 && rangeDays <= 8) {
    // Week-over-week comparison
    return {
      comparisonStartDate: subWeeks(startDate, 1),
      comparisonEndDate: subWeeks(endDate, 1),
      comparisonType: 'week'
    };
  }
  
  if (rangeDays >= 28 && rangeDays <= 32) {
    // Month-over-month comparison
    return {
      comparisonStartDate: subMonths(startDate, 1),
      comparisonEndDate: subMonths(endDate, 1),
      comparisonType: 'month'
    };
  }
  
  // Additional logic for quarters, years, and custom ranges...
}
```

## Feature Requirements

### Functional Requirements

#### FR-1: Smart Period Detection
- **Description**: Automatically detect the type of period based on date range length
- **Acceptance Criteria**:
  - 6-8 day ranges detected as weekly
  - 28-32 day ranges detected as monthly
  - 89-93 day ranges detected as quarterly
  - 363-367 day ranges detected as yearly
  - All other ranges use custom equivalent period logic

#### FR-2: Appropriate Comparison Calculation
- **Description**: Calculate comparison periods using appropriate time units
- **Acceptance Criteria**:
  - Weekly ranges compare to previous week (subtract 7 days)
  - Monthly ranges compare to previous month (subtract 1 month, handle month-end edge cases)
  - Quarterly ranges compare to previous quarter (subtract 3 months)
  - Yearly ranges compare to previous year (subtract 1 year)
  - Custom ranges compare to equivalent period shifted by range duration

#### FR-3: Comparison Type Indication
- **Description**: Clearly communicate the comparison type to users
- **Acceptance Criteria**:
  - Dashboard shows "vs. Previous Week" for weekly comparisons
  - Dashboard shows "vs. Previous Month" for monthly comparisons
  - Dashboard shows "vs. Previous Quarter" for quarterly comparisons
  - Dashboard shows "vs. Previous Year" for yearly comparisons
  - Dashboard shows custom date ranges for non-standard periods

#### FR-4: Edge Case Handling
- **Description**: Handle calendar edge cases gracefully
- **Acceptance Criteria**:
  - Month-end dates (e.g., Jan 31 → Feb 28 in non-leap years)
  - Leap year considerations for yearly comparisons
  - Daylight saving time transitions
  - Business calendar alignment options

### Non-Functional Requirements

#### NFR-1: Performance
- Comparison period calculation must complete within 50ms
- No impact on existing API response times

#### NFR-2: Backwards Compatibility
- Existing API contracts maintained
- Default behavior preserved for consumers not using smart selection

#### NFR-3: User Experience
- Comparison period changes communicated clearly in UI
- No breaking changes to existing dashboard functionality

## Implementation Approach

### Phase 1: Core Algorithm Implementation
1. Create smart comparison period calculation utility
2. Add comprehensive unit tests for edge cases
3. Integration with existing date utilities

### Phase 2: API Integration
1. Update asin-overview API to support smart comparison mode
2. Add comparison type metadata to API responses
3. Maintain backwards compatibility with explicit comparison dates

### Phase 3: UI Updates
1. Update DateRangePicker to show intelligent comparison preview
2. Enhance chart headers to display appropriate comparison type
3. Update MetricsCards to show contextually relevant comparison labels

### Phase 4: Advanced Features
1. User preference for comparison type override
2. Business calendar integration (e.g., retail calendar)
3. Multi-period comparison support (show both WoW and MoM)

## Success Metrics

### User Experience Metrics
- **Comparison Relevance**: 95% of comparisons should be contextually appropriate
- **User Confusion Reduction**: Eliminate support tickets about "wrong" comparison periods
- **Dashboard Usage**: Increase in dashboard session duration due to more meaningful comparisons

### Technical Metrics
- **Performance**: Smart calculation < 50ms response time
- **Accuracy**: 100% correct comparison period calculation for standard ranges
- **Edge Case Coverage**: 100% test coverage for calendar edge cases

## Risks and Mitigation

### Risk: User Confusion During Transition
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: 
  - Gradual rollout with feature flag
  - Clear communication of new behavior
  - Option to revert to fixed 7-day comparison

### Risk: Calendar Edge Case Bugs
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Comprehensive test suite covering edge cases
  - Extensive QA testing across date ranges
  - Fallback to fixed offset on calculation errors

### Risk: Performance Impact
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Performance testing during development
  - Caching of calculation results
  - Optimization of date manipulation libraries

## Dependencies

### Internal Dependencies
- Existing DateRangePicker component
- ASIN overview API endpoint
- Date utility functions (date-fns library)
- Dashboard comparison display components

### External Dependencies
- date-fns library (already in use)
- No additional external dependencies required

## Out of Scope

### Excluded from Initial Implementation
- Business/retail calendar integration (future enhancement)
- Multi-timezone support (current system is UTC-based)
- Custom comparison period user overrides (Phase 4 feature)
- Historical comparison beyond previous period (e.g., 2 months ago)

### Future Enhancements
- AI-powered seasonal comparison suggestions
- Industry benchmark comparisons
- Multi-period trend analysis
- Custom business calendar support

## Expected Deliverable

A complete smart comparison period selection system that automatically selects contextually appropriate comparison periods, improving the relevance and usability of the ASIN Performance dashboard's comparative analytics.

### Success Criteria
- Users see month-over-month comparisons when selecting monthly date ranges
- Quarterly selections show quarter-over-quarter comparisons
- All comparison types are clearly labeled and contextually appropriate
- No performance degradation in dashboard load times
- Backwards compatibility maintained for API consumers