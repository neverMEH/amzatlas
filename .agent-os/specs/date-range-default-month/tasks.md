# Spec Tasks

Feature: When an ASIN is selected, have the date range default to the most recent fully completed month that the ASIN has data for.

> Created: 2025-08-31
> Status: Ready for Implementation

## Tasks

- [x] 1. Data Availability Analysis
  - [x] 1.1 Write tests for ASIN data availability detection
  - [x] 1.2 Create utility function to find the most recent fully completed month with data for a given ASIN
  - [x] 1.3 Implement API endpoint to fetch ASIN data availability (date ranges)
  - [x] 1.4 Add caching mechanism for ASIN data availability to improve performance
  - [x] 1.5 Verify all tests pass

- [x] 2. Update DateRangePicker Component
  - [x] 2.1 Write tests for DateRangePicker default behavior when ASIN changes
  - [x] 2.2 Modify component to accept ASIN prop and fetch data availability
  - [x] 2.3 Implement logic to calculate the most recent fully completed month
  - [x] 2.4 Update state management to set default date range when ASIN is selected
  - [x] 2.5 Handle loading states while fetching ASIN data availability
  - [x] 2.6 Verify all tests pass

- [x] 3. ASIN Selector Integration
  - [x] 3.1 Write tests for ASIN selector callback behavior
  - [x] 3.2 Update ASINSelector component to trigger date range update on selection
  - [x] 3.3 Implement proper event handling and state synchronization
  - [x] 3.4 Ensure smooth UX transition when switching ASINs
  - [x] 3.5 Verify all tests pass

- [x] 4. Dashboard Page Integration
  - [x] 4.1 Write integration tests for ASIN selection and date range updates
  - [x] 4.2 Update page.tsx to coordinate ASIN selection with date range defaults
  - [x] 4.3 Handle edge cases (no data available, partial month data)
  - [x] 4.4 Implement proper error handling and user feedback
  - [x] 4.5 Verify all integration tests pass

- [x] 5. Performance and Edge Cases
  - [x] 5.1 Write tests for edge cases (new ASINs, sparse data, missing months)
  - [x] 5.2 Optimize data availability queries for performance
  - [x] 5.3 Add fallback behavior when no complete month is available
  - [x] 5.4 Test with various ASINs to ensure consistent behavior
  - [x] 5.5 Verify all tests pass