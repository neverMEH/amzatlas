# PerformanceChart Component Analysis

## Current Implementation Summary

### Component Overview
- **Location**: `/src/components/asin-performance/PerformanceChart.tsx`
- **Type**: React functional component using Recharts library
- **Current Chart Type**: Always renders a `LineChart` (no bar chart option)

### Data Flow
1. **Date Range Selection**: 
   - User selects date range in `DateRangePickerV2` component
   - Date range state (`startDate`, `endDate`) is managed in parent component (`page.tsx`)
   - No duration information is passed to PerformanceChart

2. **Data Structure**:
   ```typescript
   interface TimeSeriesData {
     date: string
     impressions: number
     clicks: number
     cartAdds: number
     purchases: number
   }
   ```

3. **Props Interface**:
   ```typescript
   interface PerformanceChartProps {
     data: TimeSeriesData[]          // Main time series data
     comparisonData?: TimeSeriesData[] // Optional comparison period data
     isLoading: boolean
     error: Error | null
   }
   ```

### Chart Type Determination
- **Current State**: Chart type is hardcoded as `LineChart` (line 233)
- **No Dynamic Selection**: No logic exists to switch between chart types
- **No Duration Info**: Component doesn't receive date range duration information

### Comparison Data Handling
1. **Data Merge**: Current and comparison data are merged into a single array (lines 117-132)
2. **Visual Distinction**: 
   - Comparison lines use dashed style (`strokeDasharray="5 5"`)
   - Comparison lines have 50% opacity
   - Labels append "(Previous)" to metric names
3. **Conditional Rendering**: Comparison lines only render when `comparisonData` prop exists

### Key Features
- **Metric Toggle**: Users can select individual metrics or "View All"
- **Dual Y-Axis**: When viewing all metrics, uses left axis for impressions, right for others
- **Custom Tooltip**: Shows formatted values for all visible metrics
- **Responsive**: Uses ResponsiveContainer for width/height management

## Implementation Requirements

To add bar chart support when duration ≤ 7 days:

1. **Pass Duration Info**: Either:
   - Calculate duration within PerformanceChart from data points
   - Pass duration or chart type from parent component
   
2. **Add Bar Chart Import**: Import `BarChart` and `Bar` from Recharts

3. **Conditional Rendering**: Switch between LineChart and BarChart based on duration

4. **Maintain Features**: Ensure all existing features work with both chart types:
   - Metric selection
   - Comparison data
   - Tooltips
   - Legends
   - Axis formatting

5. **Bar Chart Specifics**:
   - Group bars for comparison data (current vs previous)
   - Maintain same color scheme
   - Adjust spacing for readability