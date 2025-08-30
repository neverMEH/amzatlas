import { differenceInDays, parseISO } from 'date-fns'

export interface SearchQueryData {
  search_query: string
  start_date: string
  end_date: string
  impressions: number
  clicks: number
  cart_adds: number
  purchases: number
  click_through_rate: number
  conversion_rate: number
  cart_add_rate: number
  purchase_rate: number
  impression_share: number
  click_share: number
  cart_add_share: number
  purchase_share: number
}

export interface AggregatedSearchQuery {
  searchQuery: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  ctr: number
  cvr: number
  cartAddRate: number
  purchaseRate: number
  impressionShare: number
  clickShare: number
  cartAddShare: number
  purchaseShare: number
}

/**
 * Determines if the date range requires aggregation (>7 days)
 */
export function shouldAggregateKeywords(startDate: string, endDate: string): boolean {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const daysDifference = differenceInDays(end, start)
  return daysDifference > 7
}

/**
 * Aggregates search query data by keyword
 * Sums volume metrics and calculates weighted averages for rate metrics
 */
export function aggregateSearchQueries(data: SearchQueryData[]): AggregatedSearchQuery[] {
  // Group by search query
  const grouped = data.reduce((acc, row) => {
    const key = row.search_query
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(row)
    return acc
  }, {} as Record<string, SearchQueryData[]>)

  // Aggregate each group
  return Object.entries(grouped).map(([searchQuery, rows]) => {
    // Sum volume metrics
    const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0)
    const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0)
    const totalCartAdds = rows.reduce((sum, row) => sum + row.cart_adds, 0)
    const totalPurchases = rows.reduce((sum, row) => sum + row.purchases, 0)

    // Calculate weighted averages for share metrics
    const weightedImpressionShare = rows.reduce((sum, row) => {
      return sum + (row.impression_share * row.impressions)
    }, 0) / totalImpressions

    const weightedClickShare = rows.reduce((sum, row) => {
      return sum + (row.click_share * row.clicks)
    }, 0) / (totalClicks || 1)

    const weightedCartAddShare = rows.reduce((sum, row) => {
      return sum + (row.cart_add_share * row.cart_adds)
    }, 0) / (totalCartAdds || 1)

    const weightedPurchaseShare = rows.reduce((sum, row) => {
      return sum + (row.purchase_share * row.purchases)
    }, 0) / (totalPurchases || 1)

    // Calculate rate metrics from aggregated data
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
    const cvr = totalClicks > 0 ? totalPurchases / totalClicks : 0
    const cartAddRate = totalClicks > 0 ? totalCartAdds / totalClicks : 0
    const purchaseRate = totalCartAdds > 0 ? totalPurchases / totalCartAdds : 0

    return {
      searchQuery,
      impressions: totalImpressions,
      clicks: totalClicks,
      cartAdds: totalCartAdds,
      purchases: totalPurchases,
      ctr,
      cvr,
      cartAddRate,
      purchaseRate,
      impressionShare: weightedImpressionShare || 0,
      clickShare: weightedClickShare || 0,
      cartAddShare: weightedCartAddShare || 0,
      purchaseShare: weightedPurchaseShare || 0,
    }
  })
  // Sort by impressions descending to maintain order
  .sort((a, b) => b.impressions - a.impressions)
}

/**
 * Transforms raw database data to the format expected by aggregation
 */
export function transformSearchQueryData(data: any[]): SearchQueryData[] {
  return data.map(row => ({
    search_query: row.search_query,
    start_date: row.start_date,
    end_date: row.end_date,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    cart_adds: row.cart_adds || 0,
    purchases: row.purchases || 0,
    click_through_rate: row.click_through_rate || 0,
    conversion_rate: row.conversion_rate || 0,
    cart_add_rate: row.cart_add_rate || 0,
    purchase_rate: row.purchase_rate || 0,
    impression_share: row.impression_share || 0,
    click_share: row.click_share || 0,
    cart_add_share: row.cart_add_share || 0,
    purchase_share: row.purchase_share || 0,
  }))
}