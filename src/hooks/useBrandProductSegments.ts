import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

export interface BrandProduct {
  asin: string
  productName: string
  impressions: number
  impressionsComparison?: number
  clicks: number
  clicksComparison?: number
  cartAdds: number
  cartAddsComparison?: number
  purchases: number
  purchasesComparison?: number
  ctr: number
  ctrComparison?: number
  cvr: number
  cvrComparison?: number
  clickShare: number
  cartAddShare: number
  purchaseShare: number
  segmentMetadata?: {
    weeklySegmentsAvailable: number
    monthlySegmentsAvailable: number
    hasWeeklyData: boolean
    hasMonthlyData: boolean
    dateRange: {
      earliest: number
      latest: number
    }
  }
}

interface BrandProductsParams {
  brandId: string
  dateFrom?: string
  dateTo?: string
  comparisonDateFrom?: string
  comparisonDateTo?: string
  includeSegments?: boolean
  limit?: number
  offset?: number
  minImpressions?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface BrandProductsResponse {
  data: {
    products: BrandProduct[]
  }
  meta: {
    brand: {
      id: string
      brand_name: string
    }
    totalCount: number
    limit: number
    offset: number
    hasMore: boolean
    queryTime: number
    dateRange?: {
      from: string
      to: string
    }
    comparisonDateRange?: {
      from: string
      to: string
    }
    filters: {
      minImpressions?: number
      sortBy: string
      sortOrder: string
    }
  }
}

const QUERY_KEYS = {
  brandProducts: (brandId: string, params: Partial<BrandProductsParams>) =>
    ['brandProducts', brandId, params] as const,
  brandProductSegments: (brandId: string, asin: string, segmentType: string, params: any) =>
    ['brandProductSegments', brandId, asin, segmentType, params] as const,
}

// Fetch brand products with enhanced caching
export function useBrandProducts(params: BrandProductsParams) {
  return useQuery({
    queryKey: QUERY_KEYS.brandProducts(params.brandId, {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      comparisonDateFrom: params.comparisonDateFrom,
      comparisonDateTo: params.comparisonDateTo,
      includeSegments: params.includeSegments,
      limit: params.limit,
      offset: params.offset,
      minImpressions: params.minImpressions,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    }),
    queryFn: async (): Promise<BrandProductsResponse> => {
      const searchParams = new URLSearchParams()
      
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
      if (params.dateTo) searchParams.set('dateTo', params.dateTo)
      if (params.comparisonDateFrom) searchParams.set('comparisonDateFrom', params.comparisonDateFrom)
      if (params.comparisonDateTo) searchParams.set('comparisonDateTo', params.comparisonDateTo)
      if (params.includeSegments) searchParams.set('includeSegments', 'true')
      if (params.limit) searchParams.set('limit', params.limit.toString())
      if (params.offset) searchParams.set('offset', params.offset.toString())
      if (params.minImpressions) searchParams.set('minImpressions', params.minImpressions.toString())
      if (params.sortBy) searchParams.set('sortBy', params.sortBy)
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder)

      const response = await fetch(`/api/brands/${params.brandId}/products?${searchParams}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to fetch brand products')
      }

      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
    enabled: !!params.brandId,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

// Prefetch segments for top products based on impressions
export function useBrandProductsWithPrefetch(params: BrandProductsParams) {
  const queryClient = useQueryClient()
  const productsQuery = useBrandProducts(params)

  // Get top 3 products by impressions for prefetching
  const topProducts = useMemo(() => {
    if (!productsQuery.data?.data.products) return []
    return productsQuery.data.data.products
      .slice()
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
  }, [productsQuery.data])

  // Prefetch segment data for top products
  const prefetchQueries = useQueries({
    queries: topProducts.map(product => ({
      queryKey: QUERY_KEYS.brandProductSegments(
        params.brandId, 
        product.asin, 
        'weekly',
        {
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          comparisonDateFrom: params.comparisonDateFrom,
          comparisonDateTo: params.comparisonDateTo,
          limit: 10,
          offset: 0,
        }
      ),
      queryFn: async () => {
        const searchParams = new URLSearchParams({
          segmentType: 'weekly',
          limit: '10',
          offset: '0',
          ...(params.dateFrom && { dateFrom: params.dateFrom }),
          ...(params.dateTo && { dateTo: params.dateTo }),
          ...(params.comparisonDateFrom && { comparisonDateFrom: params.comparisonDateFrom }),
          ...(params.comparisonDateTo && { comparisonDateTo: params.comparisonDateTo }),
        })

        const response = await fetch(`/api/brands/${params.brandId}/products/${product.asin}/segments?${searchParams}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Failed to fetch segment data')
        }
        return response.json()
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      enabled: !!product.segmentMetadata?.hasWeeklyData,
    })),
  })

  return {
    ...productsQuery,
    prefetchStatus: {
      prefetchedCount: prefetchQueries.filter(q => q.isSuccess).length,
      totalPrefetchable: topProducts.length,
      isPrefetching: prefetchQueries.some(q => q.isLoading),
    }
  }
}

// Optimistic updates for product list state
export function useBrandProductsOptimistic(params: BrandProductsParams) {
  const queryClient = useQueryClient()
  const productsQuery = useBrandProductsWithPrefetch(params)

  const updateProductOptimistically = (
    asin: string, 
    updater: (product: BrandProduct) => BrandProduct
  ) => {
    const queryKey = QUERY_KEYS.brandProducts(params.brandId, {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      comparisonDateFrom: params.comparisonDateFrom,
      comparisonDateTo: params.comparisonDateTo,
      includeSegments: params.includeSegments,
      limit: params.limit,
      offset: params.offset,
      minImpressions: params.minImpressions,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    })

    queryClient.setQueryData<BrandProductsResponse>(queryKey, (oldData) => {
      if (!oldData) return oldData

      return {
        ...oldData,
        data: {
          ...oldData.data,
          products: oldData.data.products.map(product =>
            product.asin === asin ? updater(product) : product
          )
        }
      }
    })
  }

  const invalidateProductSegments = (asin: string) => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const [queryType, brandId, queryAsin] = query.queryKey
        return queryType === 'brandProductSegments' && 
               brandId === params.brandId && 
               queryAsin === asin
      }
    })
  }

  return {
    ...productsQuery,
    updateProductOptimistically,
    invalidateProductSegments,
  }
}

// Hook for managing expanded rows state with URL sync
export function useExpandableRows() {
  const queryClient = useQueryClient()
  
  // Store expanded state in React Query cache for persistence
  const cacheKey = ['expandedRows']
  
  const expandedRows = queryClient.getQueryData<Set<string>>(cacheKey) || new Set<string>()
  
  const toggleExpanded = (asin: string) => {
    const newExpandedRows = new Set(expandedRows)
    if (expandedRows.has(asin)) {
      newExpandedRows.delete(asin)
    } else {
      newExpandedRows.add(asin)
    }
    
    queryClient.setQueryData(cacheKey, newExpandedRows)
    return Array.from(newExpandedRows)
  }
  
  const isExpanded = (asin: string) => expandedRows.has(asin)
  
  const expandAll = (asins: string[]) => {
    const newExpandedRows = new Set([...expandedRows, ...asins])
    queryClient.setQueryData(cacheKey, newExpandedRows)
    return Array.from(newExpandedRows)
  }
  
  const collapseAll = () => {
    queryClient.setQueryData(cacheKey, new Set<string>())
    return []
  }

  const setExpandedFromUrl = (asins: string[]) => {
    const newExpandedRows = new Set(asins)
    queryClient.setQueryData(cacheKey, newExpandedRows)
  }

  return {
    expandedRows: Array.from(expandedRows),
    toggleExpanded,
    isExpanded,
    expandAll,
    collapseAll,
    setExpandedFromUrl,
    expandedCount: expandedRows.size,
  }
}

// Segments query with intelligent caching
export function useBrandProductSegments(
  brandId: string,
  asin: string,
  segmentType: 'weekly' | 'monthly',
  params: {
    dateFrom?: string
    dateTo?: string
    comparisonDateFrom?: string
    comparisonDateTo?: string
    limit?: number
    offset?: number
  }
) {
  return useQuery({
    queryKey: QUERY_KEYS.brandProductSegments(brandId, asin, segmentType, params),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        segmentType,
        limit: (params.limit || 10).toString(),
        offset: (params.offset || 0).toString(),
        ...(params.dateFrom && { dateFrom: params.dateFrom }),
        ...(params.dateTo && { dateTo: params.dateTo }),
        ...(params.comparisonDateFrom && { comparisonDateFrom: params.comparisonDateFrom }),
        ...(params.comparisonDateTo && { comparisonDateTo: params.comparisonDateTo }),
      })

      const response = await fetch(`/api/brands/${brandId}/products/${asin}/segments?${searchParams}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to fetch segment data')
      }
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (segment data is more static)
    gcTime: 20 * 60 * 1000, // 20 minutes
    enabled: !!brandId && !!asin,
    refetchOnWindowFocus: false,
  })
}

// Export query keys for external cache management
export { QUERY_KEYS }