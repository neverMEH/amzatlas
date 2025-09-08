/**
 * Get a default date range for the dashboard
 * Based on the data availability shown in the API response,
 * we should look for weeks that actually have data
 */
export function getDefaultDateRange() {
  // Based on the comparison suggestions showing data exists for:
  // - Aug 3-9, 2025 (previous week from Aug 10-16)
  // - Jul 10-16, 2025 (Prime Day week)
  // Let's default to the most recent week that likely has data
  
  // Try the week of Aug 25-31, 2025 first (last complete week of August)
  return {
    startDate: '2025-08-25',
    endDate: '2025-08-31'
  }
  
  // Alternative weeks with known data (based on comparison suggestions):
  // - '2025-08-03' to '2025-08-09'
  // - '2025-07-10' to '2025-07-16' (Prime Day week)
}