#!/usr/bin/env node
/**
 * Test script to verify current date handling in the application
 */

import { format, startOfWeek, endOfWeek, parseISO, isAfter, subMonths } from 'date-fns'

console.log('Testing Current Date Handling')
console.log('=============================')

// Test 1: Current date detection
const today = new Date()
console.log(`\n1. Current System Date: ${format(today, 'yyyy-MM-dd HH:mm:ss')}`)
console.log(`   Expected: 2025-09-03 (or current date)`)

// Test 2: Current week calculation
const dayOfWeek = today.getDay()
const startOfCurrentWeek = new Date(today)
startOfCurrentWeek.setDate(today.getDate() - dayOfWeek)
const endOfCurrentWeek = new Date(startOfCurrentWeek)
endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 6)

console.log(`\n2. Current Week Calculation:`)
console.log(`   Start: ${format(startOfCurrentWeek, 'yyyy-MM-dd')} (Sunday)`)
console.log(`   End: ${format(endOfCurrentWeek, 'yyyy-MM-dd')} (Saturday)`)
console.log(`   Expected: 2025-08-31 to 2025-09-06 (for Sep 3, 2025)`)

// Test 3: Using date-fns functions
const weekStart = startOfWeek(today, { weekStartsOn: 0 })
const weekEnd = endOfWeek(today, { weekStartsOn: 0 })

console.log(`\n3. Date-fns Week Calculation:`)
console.log(`   Start: ${format(weekStart, 'yyyy-MM-dd')}`)
console.log(`   End: ${format(weekEnd, 'yyyy-MM-dd')}`)

// Test 4: Recent date detection (within 2 months)
const twoMonthsAgo = subMonths(today, 2)
const testDates = [
  '2025-08-31', // Current week start
  '2025-07-01', // ~2 months ago
  '2025-06-01', // ~3 months ago
  '2024-12-01', // ~9 months ago
]

console.log(`\n4. Recent Date Detection (within 2 months of ${format(today, 'yyyy-MM-dd')}):`)
testDates.forEach(dateStr => {
  const date = parseISO(dateStr)
  const isRecent = isAfter(date, twoMonthsAgo)
  console.log(`   ${dateStr}: ${isRecent ? 'RECENT' : 'OLD'} (should ${isRecent ? 'keep' : 'maybe replace'})`)
})

// Test 5: Dashboard default behavior
console.log(`\n5. Expected Dashboard Behavior:`)
console.log(`   - Initial load: Shows current week (${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')})`)
console.log(`   - ASIN selected: Should KEEP current week if no data`)
console.log(`   - ASIN with old data: Should KEEP current week, show "no data" message`)
console.log(`   - Only override if user's selection is already OLD (>2 months)`)

// Test 6: Keyword Analysis page behavior
console.log(`\n6. Expected Keyword Analysis Behavior:`)
console.log(`   - No URL dates: Redirect with current week dates in URL`)
console.log(`   - With URL dates: Use those dates (hasManualSelection=true)`)
console.log(`   - Date picker won't auto-change dates`)

console.log('\n=============================')
console.log('✓ Date handling test complete')