# Date Utilities Documentation

This directory contains timezone-aware date utilities for handling Amazon SQP data, which uses PST/PDT timezone.

## Overview

All date utilities in this module are timezone-aware and default to PST/PDT (`America/Los_Angeles`) to match Amazon's data timezone. This ensures consistent date handling across the application regardless of the user's local timezone.

## Core Utilities

### Current Date Utils (`current-date-utils.ts`)

#### `getCurrentWeekRange(options?)`
Returns the current week's date range in PST/PDT.

```typescript
// Get current week (Sunday-Saturday) in September 2025
const range = getCurrentWeekRange()
// Returns: { startDate: '2025-08-31', endDate: '2025-09-06' }

// Get current week with Monday as start
const range = getCurrentWeekRange({ weekStartsOn: 1 })
// Returns: { startDate: '2025-09-01', endDate: '2025-09-07' }
```

#### `getDefaultDateRange(options?)`
Returns default date range for different period types.

```typescript
// Examples for September 3, 2025
getDefaultDateRange({ periodType: 'week' })
// Returns: { startDate: '2025-08-31', endDate: '2025-09-06' }

getDefaultDateRange({ periodType: 'month' })
// Returns: { startDate: '2025-09-01', endDate: '2025-09-30' }

getDefaultDateRange({ periodType: 'quarter' })
// Returns: { startDate: '2025-07-01', endDate: '2025-09-30' }

getDefaultDateRange({ periodType: 'custom', days: 30 })
// Returns: { startDate: '2025-08-05', endDate: '2025-09-03' }
```

#### `isDateRangeRecent(range, options?)`
Checks if a date range is within the recency threshold (default: 2 months).

```typescript
// For current date September 3, 2025
isDateRangeRecent({ start: '2025-08-01', end: '2025-08-31' }) // true (1 month ago)
isDateRangeRecent({ start: '2025-06-01', end: '2025-06-30' }) // false (3 months ago)
isDateRangeRecent({ start: '2024-09-01', end: '2024-09-30' }) // false (1 year ago)
```

#### `shouldOverrideDateWithHistorical(currentSelection, historicalData, options?)`
Determines if historical data should override the current date selection.

```typescript
// Recent selection with old data - should NOT override
shouldOverrideDateWithHistorical(
  { start: '2025-08-31', end: '2025-09-06' }, // Current week
  { start: '2024-01-01', end: '2024-12-31' }  // Old data
) // Returns: false

// Old selection with newer data - should override
shouldOverrideDateWithHistorical(
  { start: '2024-01-01', end: '2024-01-31' }, // Old selection
  { start: '2024-08-01', end: '2024-08-31' }  // More recent data
) // Returns: true
```

#### `calculateRecencyConfidence(dateEnd)`
Returns confidence level based on how recent the date is.

```typescript
// For current date September 3, 2025
calculateRecencyConfidence('2025-08-30') // 'high' (last week)
calculateRecencyConfidence('2025-07-03') // 'high' (2 months ago)
calculateRecencyConfidence('2025-05-03') // 'medium' (4 months ago)
calculateRecencyConfidence('2024-09-03') // 'low' (1 year ago)
```

### Timezone Utils (`timezone-utils.ts`)

#### Constants
- `DEFAULT_TIMEZONE = 'America/Los_Angeles'` - Amazon SQP data timezone

#### Key Functions

##### `toAPIDateString(date)`
Converts any date to PST/PDT date string for API calls.

```typescript
// From UTC timestamp to PST date string
toAPIDateString(new Date('2025-09-03T07:00:00Z')) // '2025-09-03' (PST)
```

##### `fromAPIDateString(dateStr)`
Parses API date string as PST/PDT date.

```typescript
fromAPIDateString('2025-09-03') // Date object in PST
```

##### `getCurrentDateInTimezone(timezone?)`
Get current date in specified timezone.

```typescript
getCurrentDateInTimezone() // Current date/time in PST/PDT
getCurrentDateInTimezone('America/New_York') // Current date/time in EST/EDT
```

## Usage Examples

### Dashboard Date Initialization
```typescript
// Get current week for dashboard
const currentWeek = getCurrentWeekRange()
const [dateRange, setDateRange] = useState(currentWeek)

// Check if we should use historical data
if (shouldOverrideDateWithHistorical(dateRange, availableDataRange)) {
  setDateRange(availableDataRange)
}
```

### API Date Handling
```typescript
// Send dates to API (ensures PST/PDT)
const apiParams = {
  startDate: toAPIDateString(userSelectedDate),
  endDate: toAPIDateString(userSelectedEndDate)
}

// Parse dates from API response
const dataDate = fromAPIDateString(response.date)
```

### Smart Date Suggestions
```typescript
// Generate suggestions with confidence scoring
const suggestions = dateRanges.map(range => ({
  ...range,
  confidence: calculateRecencyConfidence(range.end),
  isRecent: isDateRangeRecent(range)
}))

// Sort by confidence (high -> medium -> low)
suggestions.sort((a, b) => {
  const order = { high: 3, medium: 2, low: 1 }
  return order[b.confidence] - order[a.confidence]
})
```

## Timezone Considerations

1. **Data Storage**: All dates in the database are stored in PST/PDT
2. **API Communication**: Always use `toAPIDateString()` when sending dates
3. **Display**: Dates are displayed in PST/PDT for consistency with Amazon data
4. **DST Handling**: Automatically handled by `date-fns-tz` library

## Testing

Run timezone-aware tests:
```bash
npm run test:date-utils
npm run test:current-date
npm run validate:current-dates
```

## Migration Guide

When updating existing code to use timezone-aware utilities:

1. Replace `new Date()` with `getCurrentDateInTimezone()`
2. Replace `format(date, 'yyyy-MM-dd')` with `toAPIDateString(date)`
3. Replace `parseISO(dateStr)` with `fromAPIDateString(dateStr)` for API dates
4. Use `getCurrentWeekRange()` instead of manual week calculations