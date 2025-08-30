import { shouldAggregateKeywords, aggregateSearchQueries, transformSearchQueryData } from '../app/api/dashboard/v2/asin-overview/utils/keyword-aggregation'

// Test data simulating multiple weeks
const testData = [
  {
    search_query: 'knife sharpener',
    start_date: '2024-01-01',
    end_date: '2024-01-07',
    impressions: 1000,
    clicks: 100,
    cart_adds: 50,
    purchases: 10,
    click_through_rate: 0.1,
    conversion_rate: 0.1,
    cart_add_rate: 0.5,
    purchase_rate: 0.2,
    impression_share: 0.2,
    click_share: 0.25,
    purchase_share: 0.3,
  },
  {
    search_query: 'knife sharpener',
    start_date: '2024-01-08',
    end_date: '2024-01-14',
    impressions: 1500,
    clicks: 120,
    cart_adds: 60,
    purchases: 15,
    click_through_rate: 0.08,
    conversion_rate: 0.125,
    cart_add_rate: 0.5,
    purchase_rate: 0.25,
    impression_share: 0.25,
    click_share: 0.3,
    purchase_share: 0.35,
  },
  {
    search_query: 'sharpening stone',
    start_date: '2024-01-01',
    end_date: '2024-01-07',
    impressions: 800,
    clicks: 60,
    cart_adds: 30,
    purchases: 5,
    click_through_rate: 0.075,
    conversion_rate: 0.083,
    cart_add_rate: 0.5,
    purchase_rate: 0.167,
    impression_share: 0.16,
    click_share: 0.15,
    purchase_share: 0.1,
  },
]

console.log('Testing keyword aggregation...\n')

// Test 1: Check if date range requires aggregation
console.log('Test 1: Date range check')
console.log('2024-01-01 to 2024-01-14 requires aggregation:', shouldAggregateKeywords('2024-01-01', '2024-01-14'))
console.log('2024-01-01 to 2024-01-07 requires aggregation:', shouldAggregateKeywords('2024-01-01', '2024-01-07'))
console.log()

// Test 2: Aggregate the data
console.log('Test 2: Aggregating data')
const transformedData = transformSearchQueryData(testData)
const aggregatedData = aggregateSearchQueries(transformedData)

console.log('Original data has', testData.length, 'rows')
console.log('Aggregated data has', aggregatedData.length, 'rows')
console.log()

// Test 3: Check aggregated results
console.log('Test 3: Aggregated results')
aggregatedData.forEach(query => {
  console.log(`\nKeyword: ${query.searchQuery}`)
  console.log(`  Impressions: ${query.impressions} (sum)`)
  console.log(`  Clicks: ${query.clicks} (sum)`)
  console.log(`  Purchases: ${query.purchases} (sum)`)
  console.log(`  CTR: ${(query.ctr * 100).toFixed(2)}% (recalculated)`)
  console.log(`  CVR: ${(query.cvr * 100).toFixed(2)}% (recalculated)`)
  console.log(`  Impression Share: ${(query.impressionShare * 100).toFixed(2)}% (weighted avg)`)
})

// Test 4: Verify calculations
console.log('\nTest 4: Verify calculations for "knife sharpener"')
const knifeSharpener = aggregatedData.find(q => q.searchQuery === 'knife sharpener')
if (knifeSharpener) {
  console.log('Expected impressions: 2500, Actual:', knifeSharpener.impressions)
  console.log('Expected clicks: 220, Actual:', knifeSharpener.clicks)
  console.log('Expected CTR: 8.8%, Actual:', (knifeSharpener.ctr * 100).toFixed(2) + '%')
  
  // Weighted impression share calculation
  const expectedImpressionShare = (0.2 * 1000 + 0.25 * 1500) / 2500
  console.log('Expected impression share:', (expectedImpressionShare * 100).toFixed(2) + '%',
              'Actual:', (knifeSharpener.impressionShare * 100).toFixed(2) + '%')
}