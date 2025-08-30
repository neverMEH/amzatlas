# Comparison Data Implementation - Change Reference

## Date: August 30, 2025

### Overview
Added comparison data display functionality to the Search Query Performance table, showing percentage changes for all metrics when a comparison period is selected.

## Files Modified

### 1. `/src/components/asin-performance/SearchQueryTable.tsx`

#### Changes Made:
- **Added `cartAddShare?` to interface**:
  ```typescript
  interface SearchQueryData {
    // ... existing fields
    cartAddShare?: number  // Added optional field
  }
  ```

- **Updated table headers** to conditionally show Cart Add Share column:
  ```typescript
  {data.some(d => d.cartAddShare !== undefined) && (
    <th className="px-6 py-3 text-right">
      <button onClick={() => handleSort('cartAddShare' as SortField)}>
        <span>Cart Add Share</span>
        <SortIcon field={'cartAddShare' as SortField} />
      </button>
    </th>
  )}
  ```

- **Added comparison display for CTR and CVR**:
  ```typescript
  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
    <div>
      {formatPercentage(row.ctr)}
      {comparisonRow && (
        <div className={`text-xs ${
          row.ctr > comparisonRow.ctr ? 'text-green-600' : 
          row.ctr < comparisonRow.ctr ? 'text-red-600' : 'text-gray-500'
        }`}>
          {formatChange(row.ctr, comparisonRow.ctr)}
        </div>
      )}
    </div>
  </td>
  ```

- **Added comparison display for all share metrics**:
  ```typescript
  {showShareMetrics && (
    <>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
        <div>
          {formatPercentage(row.impressionShare, 1)}
          {comparisonRow && (
            <div className={`text-xs ${
              row.impressionShare > comparisonRow.impressionShare ? 'text-green-600' : 
              row.impressionShare < comparisonRow.impressionShare ? 'text-red-600' : 'text-gray-500'
            }`}>
              {formatChange(row.impressionShare, comparisonRow.impressionShare)}
            </div>
          )}
        </div>
      </td>
      {/* Similar pattern for clickShare, cartAddShare, purchaseShare */}
    </>
  )}
  ```

### 2. `/src/components/asin-performance/__tests__/SearchQueryTable.test.tsx`

#### Added Test Suites:

- **Rate Metrics Comparison Data tests**:
  - `displays comparison data for CTR and CVR`
  - `handles zero and negative changes for rate metrics`

- **Share Metrics Comparison Data tests**:
  - `displays comparison data for share metrics when showShareMetrics is enabled`
  - `handles zero and missing comparison values for share metrics`
  - `does not show comparison data for share metrics when comparison data is not provided`
  - `includes cart add share column when available in data`
  - `displays comparison data for cart add share when available`

### 3. `/src/app/api/dashboard/v2/asin-overview/route.ts`

#### Changes Made:
- **Added cart_add_share mapping for main data**:
  ```typescript
  topQueries = searchQueryData?.map((row: any) => ({
    // ... existing fields
    cartAddShare: row.cart_add_share || 0,  // Added
  }))
  ```

- **Added cart_add_share mapping for comparison data**:
  ```typescript
  topQueriesComparison = compareSearchQueryData.map((row: any) => ({
    // ... existing fields
    cartAddShare: row.cart_add_share || 0,  // Added
  }))
  ```

### 4. `/src/app/api/dashboard/v2/asin-overview/utils/keyword-aggregation.ts`

#### Changes Made:
- **Updated interfaces**:
  ```typescript
  export interface SearchQueryData {
    // ... existing fields
    cart_add_share: number  // Added
  }

  export interface AggregatedSearchQuery {
    // ... existing fields
    cartAddShare: number  // Added
  }
  ```

- **Added cart add share aggregation logic**:
  ```typescript
  const weightedCartAddShare = rows.reduce((sum, row) => {
    return sum + (row.cart_add_share * row.cart_adds)
  }, 0) / (totalCartAdds || 1)
  ```

- **Updated return object**:
  ```typescript
  return {
    // ... existing fields
    cartAddShare: weightedCartAddShare || 0,  // Added
  }
  ```

- **Updated transformation function**:
  ```typescript
  export function transformSearchQueryData(data: any[]): SearchQueryData[] {
    return data.map(row => ({
      // ... existing fields
      cart_add_share: row.cart_add_share || 0,  // Added
    }))
  }
  ```

### 5. `/src/lib/api/asin-performance.ts`

#### Changes Made:
- **Updated TypeScript interfaces**:
  ```typescript
  topQueries: Array<{
    // ... existing fields
    cartAddShare?: number  // Added
  }>
  topQueriesComparison?: Array<{
    // ... existing fields
    cartAddShare?: number  // Added
  }>
  ```

## Key Implementation Details

### Comparison Logic
The `formatChange` function (already existed) calculates percentage changes:
```typescript
function formatChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0%'
  const change = ((current - previous) / previous) * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
}
```

### Styling Convention
- **Green** (`text-green-600`): Positive changes
- **Red** (`text-red-600`): Negative changes  
- **Gray** (`text-gray-500`): No change (0%)

### Display Pattern
All comparison values follow the same pattern:
1. Main value displayed normally
2. Comparison change displayed below in smaller text (`text-xs`)
3. Color-coded based on direction of change

## Metrics Now Supporting Comparison

### Volume Metrics (already had comparison):
- Impressions
- Clicks
- Cart Adds
- Purchases

### Rate Metrics (newly added):
- CTR (Click-Through Rate)
- CVR (Conversion Rate)

### Share Metrics (newly added):
- Impression Share
- Click Share
- Cart Add Share (also newly added as a column)
- Purchase Share

## Testing Summary

All tests passing:
- 24 total tests in SearchQueryTable.test.tsx
- 7 new tests added for comparison functionality
- Comprehensive coverage of edge cases (zero values, missing data)

## Commits Made

1. **First Commit**: `feat: Add comparison data display for share metrics in SearchQueryTable`
   - Added share metrics comparison functionality
   - Added cart add share column support

2. **Second Commit**: `feat: Add comparison data display for CTR and CVR metrics`
   - Extended comparison to rate metrics

## Notes for Future Reference

1. **Cart Add Share** was not originally displayed in the table but existed in the database
2. **Aggregation Logic** properly handles weighted averages for share metrics when date ranges > 7 days
3. **Backward Compatible** - All changes maintain backward compatibility
4. **No Database Changes** - All required fields already existed in the database views
5. **Progressive Enhancement** - Table works normally even without comparison data

## How to Test

1. Select an ASIN in the dashboard
2. Choose a date range
3. Enable comparison period
4. Observe percentage changes below each metric value
5. Toggle "Show share metrics" to see share metric comparisons

## Performance Considerations

- Minimal performance impact as comparison data was already being fetched
- Only display logic was added to show the existing data
- No additional API calls or database queries required