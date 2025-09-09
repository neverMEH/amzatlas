# Spec Tasks

These are the tasks to be completed for the spec detailed in @.agent-os/specs/brand-dashboard-product-names/spec.md

> Created: 2025-09-09
> Status: Ready for Implementation

## Tasks

### Task 1: Update Brand Dashboard API to Include Product Titles

**Objective**: Modify the `/api/brands/[brandId]/products` endpoint to return product titles alongside ASINs

**Subtasks**:
1. **Write failing test for product title inclusion**
   - Create test that expects `product_title` field in API response
   - Test should fail initially since current API only returns ASINs
   - Location: `__tests__/api/brands/products.test.ts`

2. **Analyze current API implementation**
   - Review `/src/app/api/brands/[brandId]/products/route.ts`
   - Identify current query structure and data source
   - Document current fields being selected

3. **Update SQL query to include product_title**
   - Modify query in the API route to SELECT product_title field
   - Ensure product_title is available in search_performance_summary view
   - Verify field name matches schema (product_title vs title vs product_name)

4. **Update TypeScript types**
   - Add product_title field to BrandProduct interface
   - Update any related type definitions
   - Ensure type safety throughout the chain

5. **Verify test passes**
   - Run updated test to confirm product_title is now returned
   - Validate that existing functionality remains intact

### Task 2: Update Brand Dashboard UI to Display Product Names

**Objective**: Modify the brand dashboard product list component to show product names instead of only ASINs

**Subtasks**:
1. **Write failing UI test for product name display**
   - Create test that expects product names to be visible in the UI
   - Test should check for product name text content in table rows
   - Mock API response to include product_title field

2. **Update BrandProductList component**
   - Modify table headers to show "Product" instead of "ASIN" or similar
   - Display product_title as primary text with ASIN as secondary
   - Handle cases where product_title might be null/undefined

3. **Style product name display**
   - Apply consistent text formatting for product names
   - Consider truncation for long product names with tooltip
   - Maintain visual hierarchy (product name prominent, ASIN secondary)

4. **Handle edge cases**
   - Display fallback when product_title is empty/null
   - Ensure responsive behavior if needed
   - Maintain sorting functionality if applicable

5. **Verify UI test passes**
   - Run component test to confirm product names are displayed
   - Test edge cases (missing product_title, long names, etc.)

### Task 3: Integration Testing and Verification

**Objective**: Ensure end-to-end functionality works correctly in the brand dashboard

**Subtasks**:
1. **Create integration test**
   - Test full flow from API call to UI display
   - Verify real API response includes product_title
   - Test with actual brand data if available

2. **Manual testing verification**
   - Navigate to brand dashboard in browser
   - Verify product names are displayed correctly
   - Test with multiple brands to ensure consistency

3. **Performance verification**
   - Ensure adding product_title doesn't significantly impact query performance
   - Monitor API response times before and after changes
   - Verify no N+1 query issues introduced

4. **Documentation update**
   - Update API documentation if it exists
   - Add comments to code explaining product_title inclusion
   - Update any relevant README or spec documentation