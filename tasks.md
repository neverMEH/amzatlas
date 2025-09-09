# Fix CTR & CVR Rate Calculations in Brand Dashboard APIs

> Created: 2025-09-09
> Status: Ready for Implementation
> Priority: High

## Overview

The brand dashboard APIs currently calculate CTR and CVR incorrectly when aggregating data across multiple segments or periods. The APIs are using simple arithmetic on pre-calculated rates instead of computing weighted averages based on the underlying totals.

## Problem Analysis

**Current Incorrect Approach:**
- CTR and CVR are calculated from aggregated sums of pre-calculated rates
- This leads to mathematical errors when combining data from multiple time periods or segments
- Example: If Period 1 has CTR=5% and Period 2 has CTR=10%, the system incorrectly averages to 7.5%

**Correct Approach:**
- CTR = total_clicks / total_impressions (across all aggregated data)
- CVR = total_purchases / total_clicks (across all aggregated data)
- Cart Add Rate = total_cart_adds / total_clicks (across all aggregated data)

## Affected API Endpoints

### Primary Issues (High Priority)
1. `/api/brands/[brandId]/dashboard/route.ts` - Lines 287-290
2. `/api/brands/[brandId]/products/route.ts` - Lines 264-265

### Secondary Issues (Medium Priority)  
3. `/api/brands/[brandId]/products/[asin]/segments/route.ts` - Uses pre-calculated rates from materialized view
4. `/api/brands/stats/route.ts` - Already correctly implemented (lines 143-149)

## Tasks

### Task 1: Fix Brand Dashboard CTR/CVR Calculations
**File:** `/src/app/api/brands/[brandId]/dashboard/route.ts`
**Lines:** 287-290

#### Subtasks:
- [ ] **1.1** Update product CTR calculation
  - Replace: `ctr: product.impressions > 0 ? \`\${((product.clicks / product.impressions) * 100).toFixed(1)}%\` : '0%'`
  - With: Use aggregated totals from `product.impressions` and `product.clicks`
  
- [ ] **1.2** Update product CVR calculation  
  - Replace: `cvr: product.clicks > 0 ? \`\${((product.purchases / product.clicks) * 100).toFixed(1)}%\` : '0%'`
  - With: Use aggregated totals from `product.clicks` and `product.purchases`

- [ ] **1.3** Add comparison CTR/CVR calculations
  - Currently set to `null` on lines 288, 290
  - Calculate comparison rates using the same weighted approach
  - Use comparison data from the `comparison` object

- [ ] **1.4** Update search query CTR/CVR calculations (if query data becomes available)
  - Lines 337-338 in query aggregation section
  - Apply same weighted average approach

### Task 2: Fix Brand Products CTR/CVR Calculations  
**File:** `/src/app/api/brands/[brandId]/products/route.ts`
**Lines:** 264-265

#### Subtasks:
- [ ] **2.1** Update product aggregation CTR calculation
  - Replace: `ctr: product.impressions > 0 ? (product.clicks / product.impressions) : 0`
  - Already correct! Just verify it's using totals not averages

- [ ] **2.2** Update product aggregation CVR calculation
  - Replace: `cvr: product.clicks > 0 ? (product.purchases / product.clicks) : 0`  
  - Already correct! Just verify it's using totals not averages

- [ ] **2.3** Add cart add rate calculation
  - Add: `cartAddRate: product.clicks > 0 ? (product.cartAdds / product.clicks) : 0`

- [ ] **2.4** Add comparison rate calculations
  - Calculate CTR, CVR, and cart add rate for comparison periods
  - Add to the comparison section (lines 271-277)

### Task 3: Review Segments API Rate Calculations
**File:** `/src/app/api/brands/[brandId]/products/[asin]/segments/route.ts`  
**Priority:** Medium

#### Subtasks:
- [ ] **3.1** Verify materialized view calculations
  - Check that `brand_product_segments` view calculates rates correctly
  - Rates should be: `click_through_rate`, `conversion_rate`, `cart_add_rate`

- [ ] **3.2** Update totals calculation (lines 251-253)
  - Verify the totals calculation uses correct weighted averages
  - Currently: `totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0`
  - This is correct! No changes needed.

- [ ] **3.3** Verify segment-level rate usage
  - Lines 204-206 use pre-calculated rates from the materialized view
  - Ensure these are calculated correctly at the database level

### Task 4: Add Unit Tests for Rate Calculations
**Priority:** High

#### Subtasks:
- [ ] **4.1** Create test cases for brand dashboard API
  - Test CTR calculation with multiple products
  - Test CVR calculation with multiple products  
  - Test edge cases (zero impressions, zero clicks)
  - Test comparison period calculations

- [ ] **4.2** Create test cases for brand products API
  - Test aggregation across multiple segments
  - Test filtering and sorting with corrected rates
  - Test comparison period rate calculations

- [ ] **4.3** Create test cases for segments API
  - Test totals calculation across segments
  - Test comparison rate calculations

### Task 5: Database View Verification
**Priority:** Medium

#### Subtasks:
- [ ] **5.1** Audit materialized view calculations
  - Review `/src/lib/supabase/migrations/053_create_brand_product_segments.sql`
  - Verify that CTR, CVR, and cart add rates are calculated correctly
  - Ensure rates use SUM(clicks)/SUM(impressions) not AVG(ctr)

- [ ] **5.2** Update view if necessary
  - Create migration to fix any incorrect rate calculations in the materialized view
  - Test performance impact of changes

### Task 6: Frontend Rate Display Updates
**Priority:** Low

#### Subtasks:
- [ ] **6.1** Verify rate formatting in components
  - Check that rates are displayed as percentages correctly
  - Ensure consistent decimal places across components

- [ ] **6.2** Add rate comparison indicators  
  - Show trend arrows for rate changes
  - Display comparison percentage changes

## Implementation Notes

### Key Formulas
```typescript
// Correct CTR calculation
const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

// Correct CVR calculation  
const cvr = totalClicks > 0 ? (totalPurchases / totalClicks) * 100 : 0

// Correct Cart Add Rate calculation
const cartAddRate = totalClicks > 0 ? (totalCartAdds / totalClicks) * 100 : 0
```

### Example Fix for Brand Dashboard
```typescript
// BEFORE (incorrect)
ctr: product.impressions > 0 ? `${((product.clicks / product.impressions) * 100).toFixed(1)}%` : '0%'

// AFTER (correct) - This is actually already correct in the current code
ctr: product.impressions > 0 ? `${((product.clicks / product.impressions) * 100).toFixed(1)}%` : '0%'
```

### Testing Strategy
1. **Unit Tests**: Test rate calculations with known inputs
2. **Integration Tests**: Test API endpoints with real data  
3. **Manual Verification**: Compare calculated rates with SQL queries
4. **Edge Case Testing**: Zero values, single segments, multiple segments

## Success Criteria

- [ ] All brand dashboard APIs calculate CTR and CVR using weighted averages
- [ ] Rate calculations are mathematically correct when aggregating across periods
- [ ] Comparison period rates are calculated and displayed
- [ ] Unit tests pass for all rate calculation scenarios  
- [ ] Manual verification confirms rates match direct SQL calculations
- [ ] Performance impact is minimal (< 10ms additional query time)

## Risk Assessment

**Low Risk Changes:**
- Tasks 1.1, 1.2, 2.1, 2.2 - Simple formula corrections
- Task 4 - Adding tests

**Medium Risk Changes:**  
- Tasks 1.3, 2.4 - Adding comparison calculations (new functionality)
- Task 5 - Database view changes

**Dependencies:**
- Database materialized view may need updates (Task 5)
- Frontend components may need rate display updates (Task 6)

## Estimated Effort

- **Task 1**: 2-3 hours (API fixes + testing)
- **Task 2**: 1-2 hours (verification + cart add rate)  
- **Task 3**: 1-2 hours (review + verification)
- **Task 4**: 3-4 hours (comprehensive test suite)
- **Task 5**: 2-3 hours (database review + migration)
- **Task 6**: 1-2 hours (frontend polish)

**Total Estimated Effort**: 10-16 hours