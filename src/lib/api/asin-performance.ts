import { useQuery } from '@tanstack/react-query'

export interface ASIN {
  asin: string
  productTitle: string
  brand: string
}

export interface ASINPerformanceData {
  asin: string
  productTitle: string
  brand: string
  dateRange: {
    start: string
    end: string
  }
  metrics: {
    totals: {
      impressions: number
      clicks: number
      cartAdds: number
      purchases: number
    }
    rates: {
      clickThroughRate: number
      cartAddRate: number
      purchaseRate: number
      overallConversionRate: number
    }
    marketShare: {
      impressionShare: number
      clickShare: number
      purchaseShare: number
    }
    pricing: {
      medianPrice: number
      competitorMedianPrice: number
      priceCompetitiveness: number
    }
  }
  comparison?: {
    metrics: any
    changes: {
      impressions: number
      clicks: number
      purchases: number
      conversionRate: number
    }
  }
  timeSeries: Array<{
    date: string
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
  }>
  topQueries: Array<{
    query: string
    impressions: number
    clicks: number
    purchases: number
    conversionRate: number
  }>
}

export function useASINList() {
  return useQuery<{ asins: ASIN[] }>({
    queryKey: ['asins'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/v2/asins')
      if (!response.ok) {
        throw new Error('Failed to fetch ASINs')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useASINPerformance(
  asin: string,
  startDate: string,
  endDate: string,
  compareStartDate?: string,
  compareEndDate?: string
) {
  return useQuery<ASINPerformanceData>({
    queryKey: ['asin-performance', asin, startDate, endDate, compareStartDate, compareEndDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        asin,
        startDate,
        endDate,
        ...(compareStartDate && { compareStartDate }),
        ...(compareEndDate && { compareEndDate }),
      })

      const response = await fetch(`/api/dashboard/v2/asin-overview?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch ASIN performance data')
      }
      return response.json()
    },
    enabled: !!asin && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useSearchQueries(
  asin: string,
  startDate: string,
  endDate: string,
  page: number = 1,
  pageSize: number = 50,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc',
  searchTerm?: string
) {
  return useQuery({
    queryKey: ['search-queries', asin, startDate, endDate, page, pageSize, sortBy, sortOrder, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams({
        asin,
        startDate,
        endDate,
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(sortBy && { sortBy }),
        ...(sortOrder && { sortOrder }),
        ...(searchTerm && { searchTerm }),
      })

      const response = await fetch(`/api/dashboard/v2/asin-search-queries?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch search queries')
      }
      return response.json()
    },
    enabled: !!asin && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}