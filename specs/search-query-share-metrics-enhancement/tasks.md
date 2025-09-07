# Spec Tasks

These are the tasks to be completed for adding comparison data to share metrics in the Search Query Performance table.

> Created: 2025-08-30
> Status: Ready for Implementation

## Tasks

### 1. Add Comparison Data for Share Metrics

**Objective:** Display comparison data (percentage changes) for the existing share metrics when a comparison period is selected, maintaining consistency with how other metrics show comparison data.

#### 1.1 Update SearchQueryTable Component
- [ ] **Write tests for share metric comparison display**
  - Test that share metrics show comparison indicators when comparisonData is provided
  - Test percentage change calculations for share metrics
  - Test formatting and styling consistency with other metrics
  - Test edge cases (zero values, missing comparison data)

- [ ] **Implement comparison display for share metrics**
  - Update `SearchQueryTable.tsx` to show comparison data for impression_share, click_share, purchase_share
  - Use existing `formatChange()` function for percentage calculations
  - Apply consistent styling (green for positive, red for negative changes)
  - Ensure proper alignment below share metric values

#### 1.2 Add Cart Add Share Column (if missing)
- [ ] **Verify cart_add_share availability**
  - Check if cart_add_share is included in API response
  - Confirm data is available in the database/views

- [ ] **Add cart_add_share column if not present**
  - Update column definitions to include cart add share
  - Position between click share and purchase share
  - Apply same formatting as other share metrics
  - Include comparison data display for this metric

#### 1.3 Verify Data Flow
- [ ] **Confirm API returns comparison share data**
  - Check `/api/dashboard/v2/asin-overview` endpoint response
  - Verify topQueriesComparison includes share metric fields
  - Ensure data aggregation preserves share metrics

- [ ] **Update TypeScript interfaces if needed**
  - Ensure SearchQueryData interface includes all share metrics
  - Verify comparison data types are properly defined
  - Update any missing type definitions

### 2. Testing and Verification

#### 2.1 Comprehensive Test Coverage
- [ ] **Unit tests for comparison display**
  - Test formatChange() function with share metric values
  - Test comparison indicator rendering
  - Test edge cases (null values, zero comparisons)

- [ ] **Integration tests**
  - Test complete data flow from API to component
  - Verify share metrics comparison data persists through aggregation
  - Test with different date ranges and comparison periods

#### 2.2 Manual Testing
- [ ] **Visual verification**
  - Confirm comparison indicators appear for all share metrics
  - Verify consistent styling with other metric comparisons
  - Check alignment and spacing

- [ ] **Data accuracy testing**
  - Validate percentage change calculations are correct
  - Cross-reference with database values
  - Test with known data sets

## Implementation Notes

### TDD Approach
- Start with failing tests for each new feature
- Implement minimal code to pass tests
- Refactor while maintaining test coverage
- Ensure all existing tests continue to pass

### Data Consistency
- Maintain consistency with existing comparison logic
- Use same date range calculations as other metrics
- Follow established patterns for percentage formatting

### Performance Considerations
- Consider lazy loading for large datasets
- Optimize database queries for share calculations
- Monitor memory usage with additional data columns

### Code Quality
- Follow existing TypeScript patterns and interfaces
- Maintain consistent error handling
- Use established utility functions for formatting and calculations