import { useQuery, useQueryClient } from '@tanstack/react-query'

// Types
export interface ASINKeywordsParams {
  asin: string
  startDate?: string
  endDate?: string
}

export interface ASINKeywordsData {
  keywords: Array<{
    keyword: string
    impressions: number
  }>
  totalCount: number
}
export interface KeywordPerformanceParams {
  asin: string
  keyword: string
  startDate: string
  endDate: string
  compareStartDate?: string
  compareEndDate?: string
}

export interface KeywordComparisonParams {
  asin: string
  keywords: string[]
  startDate: string
  endDate: string
  compareStartDate?: string
  compareEndDate?: string
}

export interface KeywordPerformanceData {
  summary: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
  }
  timeSeries: Array<{
    date: string
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
  }>
  funnelData: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
  }
  marketShare: {
    totalMarket: {
      impressions: number
      clicks: number
      purchases: number
    }
    competitors: Array<{
      asin: string
      brand: string
      title: string
      impressionShare: number
      clickShare: number
      purchaseShare: number
    }>
  }
  comparisonSummary?: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
  }
  comparisonTimeSeries?: Array<{
    date: string
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
  }>
  comparisonFunnelData?: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
  }
  comparisonMarketShare?: {
    totalMarket: {
      impressions: number
      clicks: number
      purchases: number
    }
    competitors: Array<{
      asin: string
      brand: string
      title: string
      impressionShare: number
      clickShare: number
      purchaseShare: number
    }>
  }
}

export interface KeywordComparisonData {
  timeSeries: Array<{
    date: string
    [keyword: string]: any
  }>
  funnels: {
    [keyword: string]: {
      impressions: number
      clicks: number
      cartAdds: number
      purchases: number
    }
  }
  marketShare: {
    [keyword: string]: number
  }
  comparisonData?: {
    [keyword: string]: {
      current: {
        impressions: number
        clicks: number
        cartAdds: number
        purchases: number
      }
      previous: {
        impressions: number
        clicks: number
        cartAdds: number
        purchases: number
      }
    }
  }
}

// API functions
async function fetchASINKeywords(params: ASINKeywordsParams): Promise<ASINKeywordsData> {
  const searchParams = new URLSearchParams({
    asin: params.asin,
  })

  if (params.startDate) searchParams.append('startDate', params.startDate)
  if (params.endDate) searchParams.append('endDate', params.endDate)

  const response = await fetch(`/api/dashboard/v2/asin-keywords?${searchParams}`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch ASIN keywords')
  }

  return response.json()
}
async function fetchKeywordPerformance(params: KeywordPerformanceParams): Promise<KeywordPerformanceData> {
  const searchParams = new URLSearchParams({
    asin: params.asin,
    keyword: params.keyword,
    startDate: params.startDate,
    endDate: params.endDate,
  })

  if (params.compareStartDate && params.compareEndDate) {
    searchParams.append('compareStartDate', params.compareStartDate)
    searchParams.append('compareEndDate', params.compareEndDate)
  }

  const response = await fetch(`/api/dashboard/v2/keyword-performance?${searchParams}`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch keyword performance data')
  }

  return response.json()
}

async function fetchKeywordComparison(params: KeywordComparisonParams): Promise<KeywordComparisonData> {
  const searchParams = new URLSearchParams({
    asin: params.asin,
    keywords: params.keywords.join(','),
    startDate: params.startDate,
    endDate: params.endDate,
  })

  if (params.compareStartDate && params.compareEndDate) {
    searchParams.append('compareStartDate', params.compareStartDate)
    searchParams.append('compareEndDate', params.compareEndDate)
  }

  const response = await fetch(`/api/dashboard/v2/keyword-comparison?${searchParams}`)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch keyword comparison data')
  }

  return response.json()
}

// Query key factories
export const keywordQueryKeys = {
  all: ['keyword-analysis'] as const,
  keywords: (params: ASINKeywordsParams) =>
    [...keywordQueryKeys.all, 'keywords', params] as const,
  performance: (params: KeywordPerformanceParams) => 
    [...keywordQueryKeys.all, 'performance', params] as const,
  comparison: (params: KeywordComparisonParams) => 
    [...keywordQueryKeys.all, 'comparison', params] as const,
}

// React Query hooks
export function useASINKeywords(params: ASINKeywordsParams | null) {
  return useQuery({
    queryKey: params ? keywordQueryKeys.keywords(params) : ['asin-keywords-disabled'],
    queryFn: () => params ? fetchASINKeywords(params) : Promise.reject('No params'),
    enabled: !!params?.asin,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  })
}
export function useKeywordPerformance(params: KeywordPerformanceParams | null) {
  return useQuery({
    queryKey: params ? keywordQueryKeys.performance(params) : ['keyword-analysis-disabled'],
    queryFn: () => params ? fetchKeywordPerformance(params) : Promise.reject('No params'),
    enabled: !!params,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (cacheTime renamed to gcTime in v5)
    retry: 2,
  })
}

export function useKeywordComparison(params: KeywordComparisonParams | null) {
  return useQuery({
    queryKey: params ? keywordQueryKeys.comparison(params) : ['keyword-comparison-disabled'],
    queryFn: () => params ? fetchKeywordComparison(params) : Promise.reject('No params'),
    enabled: !!params && params.keywords.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (cacheTime renamed to gcTime in v5)
    retry: 2,
  })
}

// Prefetch functions for hover functionality
export function usePrefetchKeywordPerformance() {
  const queryClient = useQueryClient()

  return async (params: KeywordPerformanceParams) => {
    await queryClient.prefetchQuery({
      queryKey: keywordQueryKeys.performance(params),
      queryFn: () => fetchKeywordPerformance(params),
      staleTime: 5 * 60 * 1000,
    })
  }
}

export function usePrefetchKeywordComparison() {
  const queryClient = useQueryClient()

  return async (params: KeywordComparisonParams) => {
    await queryClient.prefetchQuery({
      queryKey: keywordQueryKeys.comparison(params),
      queryFn: () => fetchKeywordComparison(params),
      staleTime: 5 * 60 * 1000,
    })
  }
}

// Invalidation helper
export function useInvalidateKeywordQueries() {
  const queryClient = useQueryClient()

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: keywordQueryKeys.all }),
    invalidatePerformance: (params?: KeywordPerformanceParams) => 
      queryClient.invalidateQueries({ 
        queryKey: params ? keywordQueryKeys.performance(params) : [...keywordQueryKeys.all, 'performance']
      }),
    invalidateComparison: (params?: KeywordComparisonParams) =>
      queryClient.invalidateQueries({ 
        queryKey: params ? keywordQueryKeys.comparison(params) : [...keywordQueryKeys.all, 'comparison']
      }),
  }
}