import { useState } from 'react'
import { useBrandProductsWithPrefetch, type BrandProduct } from './useBrandProductSegments'
import { useBrandDashboard } from '@/lib/api/brand-dashboard'

interface UseBrandDashboardEnhancedParams {
  brandId: string
  dateFrom: string
  dateTo: string
  comparisonDateFrom?: string
  comparisonDateTo?: string
  limit?: number
  offset?: number
  minImpressions?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface EnhancedBrandDashboardData {
  kpis: any // KPIs from original API
  products: BrandProduct[] // Enhanced products with segment metadata
  searchQueries: any[] // Search queries from original API
}

export function useBrandDashboardEnhanced(params: UseBrandDashboardEnhancedParams) {
  // Get original dashboard data for KPIs and search queries
  const originalDashboard = useBrandDashboard(
    params.brandId,
    params.dateFrom,
    params.dateTo,
    params.comparisonDateFrom,
    params.comparisonDateTo
  )

  // Get enhanced products data with prefetching
  const enhancedProducts = useBrandProductsWithPrefetch({
    brandId: params.brandId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    comparisonDateFrom: params.comparisonDateFrom,
    comparisonDateTo: params.comparisonDateTo,
    includeSegments: true, // Always include segment metadata
    limit: params.limit || 20,
    offset: params.offset || 0,
    minImpressions: params.minImpressions || 0,
    sortBy: params.sortBy || 'impressions',
    sortOrder: params.sortOrder || 'desc',
  })

  // Combine data sources
  const combinedData: EnhancedBrandDashboardData | undefined = 
    originalDashboard.data && enhancedProducts.data ? {
      kpis: originalDashboard.data.data.kpis,
      products: enhancedProducts.data.data.products,
      searchQueries: originalDashboard.data.data.searchQueries,
    } : undefined

  return {
    data: combinedData ? { data: combinedData } : undefined,
    isLoading: originalDashboard.isLoading || enhancedProducts.isLoading,
    error: originalDashboard.error || enhancedProducts.error,
    
    // Enhanced features from products API
    meta: enhancedProducts.data?.meta,
    prefetchStatus: enhancedProducts.prefetchStatus,
    
    // Individual query states for debugging
    originalDashboardState: {
      isLoading: originalDashboard.isLoading,
      error: originalDashboard.error,
      data: originalDashboard.data,
    },
    enhancedProductsState: {
      isLoading: enhancedProducts.isLoading,
      error: enhancedProducts.error,
      data: enhancedProducts.data,
      prefetchStatus: enhancedProducts.prefetchStatus,
    },

    // Methods for optimistic updates
    updateProductOptimistically: enhancedProducts.updateProductOptimistically,
    invalidateProductSegments: enhancedProducts.invalidateProductSegments,
  }
}

// Hook for managing pagination with React Query
export function useBrandProductsPaginated(
  baseParams: Omit<UseBrandDashboardEnhancedParams, 'limit' | 'offset'>,
  itemsPerPage: number = 20
) {
  const [currentPage, setCurrentPage] = useState(1)
  
  const offset = (currentPage - 1) * itemsPerPage
  
  const query = useBrandDashboardEnhanced({
    ...baseParams,
    limit: itemsPerPage,
    offset,
  })

  const totalPages = query.meta ? Math.ceil(query.meta.totalCount / itemsPerPage) : 1

  return {
    ...query,
    pagination: {
      currentPage,
      totalPages,
      itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      setCurrentPage,
      totalCount: query.meta?.totalCount || 0,
    }
  }
}