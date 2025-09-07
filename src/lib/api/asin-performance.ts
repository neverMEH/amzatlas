import { useQuery } from '@tanstack/react-query'

export interface ASIN {
  asin: string
  productTitle: string
  brand: string
}

import type { ComparisonPeriod } from '@/lib/date-utils/comparison-period'

export interface SuggestionMetadata {
  period: ComparisonPeriod
  dataAvailability: {
    hasData: boolean
    recordCount: number
    coverage: number
    dataQuality: 'high' | 'medium' | 'low'
  }
  confidence: {
    score: number
    factors: {
      dataCompleteness: number
      recency: number
      periodAlignment: number
      seasonalRelevance: number
    }
  }
  warnings: string[]
}

export interface ComparisonSuggestions {
  suggestions: SuggestionMetadata[]
  selectedSuggestion?: SuggestionMetadata
  recommendedMode: string
}

export interface ComparisonValidation {
  isValid: boolean
  metadata?: SuggestionMetadata
  errors?: string[]
}

export interface ASINPerformanceData {
  asin: string
  productTitle: string
  brand: string
  dateRange: {
    start: string
    end: string
  }
  comparisonDateRange?: {
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
    }
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
  comparisonTimeSeries?: Array<{
    date: string
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
  }>
  topQueries: Array<{
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
    cartAddShare?: number
    purchaseShare: number
  }>
  topQueriesComparison?: Array<{
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
    cartAddShare?: number
    purchaseShare: number
  }>
  comparisonSuggestions?: ComparisonSuggestions
  comparisonValidation?: ComparisonValidation
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
      if (!asin) {
        throw new Error('ASIN is required')
      }

      const params = new URLSearchParams({
        asin,
        startDate,
        endDate,
        includeQueries: 'true',
      })

      if (compareStartDate && compareEndDate) {
        params.append('compareStartDate', compareStartDate)
        params.append('compareEndDate', compareEndDate)
      }

      const response = await fetch(`/api/dashboard/v2/asin-overview?${params.toString()}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch ASIN performance data')
      }
      return response.json()
    },
    enabled: !!asin && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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

export function useComparisonSuggestions(params: {
  asin: string
  startDate: string
  endDate: string
} | null) {
  return useQuery<ComparisonSuggestions>({
    queryKey: ['comparison-suggestions', params],
    queryFn: async () => {
      if (!params) throw new Error('No parameters provided')
      
      const response = await fetch(
        `/api/comparison-periods/suggestions?` + new URLSearchParams({
          asin: params.asin,
          startDate: params.startDate,
          endDate: params.endDate,
        })
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch comparison suggestions')
      }
      
      return response.json()
    },
    enabled: !!params,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useComparisonValidation(params: {
  asin: string
  mainRange: { start: string; end: string }
  comparisonRange: { start: string; end: string }
} | null) {
  return useQuery<ComparisonValidation>({
    queryKey: ['comparison-validation', params],
    queryFn: async () => {
      if (!params) throw new Error('No parameters provided')
      
      const response = await fetch('/api/comparison-periods/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })
      
      if (!response.ok) {
        throw new Error('Failed to validate comparison period')
      }
      
      return response.json()
    },
    enabled: !!params,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export interface ASINDataAvailability {
  asin: string
  dateRanges: Array<{
    start_date: string
    end_date: string
    record_count: number
  }>
  mostRecentCompleteMonth: {
    year: number
    month: number
    startDate: string
    endDate: string
  } | null
  fallbackRange: {
    startDate: string
    endDate: string
  } | null
  summary: {
    totalRecords: number
    dateRangeCount: number
    earliestDate: string | null
    latestDate: string | null
  }
}

export async function fetchASINDataAvailability(asin: string): Promise<ASINDataAvailability> {
  const response = await fetch(`/api/dashboard/v2/asin-data-availability?asin=${encodeURIComponent(asin)}`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch ASIN data availability')
  }
  
  return response.json()
}

export function useASINDataAvailability(asin: string | null) {
  return useQuery<ASINDataAvailability>({
    queryKey: ['asin-data-availability', asin],
    queryFn: () => fetchASINDataAvailability(asin!),
    enabled: !!asin,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}