import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export interface BrandDashboardUrlState {
  // Pagination
  page?: number
  limit?: number
  
  // Sorting
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  
  // Filters
  minImpressions?: number
  
  // Expanded rows
  expanded?: string[]
  
  // Date ranges
  dateFrom?: string
  dateTo?: string
  compareFrom?: string
  compareTo?: string
  showComparison?: boolean
  
  // Selected products
  selected?: string[]
}

export function useUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse current URL state
  const urlState = useMemo((): BrandDashboardUrlState => {
    return {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
      minImpressions: searchParams.get('minImpressions') ? parseInt(searchParams.get('minImpressions')!, 10) : undefined,
      expanded: searchParams.get('expanded')?.split(',').filter(Boolean) || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      compareFrom: searchParams.get('compareFrom') || undefined,
      compareTo: searchParams.get('compareTo') || undefined,
      showComparison: searchParams.get('showComparison') === 'true',
      selected: searchParams.get('selected')?.split(',').filter(Boolean) || undefined,
    }
  }, [searchParams])

  // Update URL state
  const updateUrlState = useCallback((updates: Partial<BrandDashboardUrlState>, replace: boolean = false) => {
    const current = new URLSearchParams(searchParams.toString())
    
    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        current.delete(key)
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          current.delete(key)
        } else {
          current.set(key, value.join(','))
        }
      } else {
        current.set(key, value.toString())
      }
    })

    // Clean up empty parameters
    const cleanParams = new URLSearchParams()
    for (const [key, value] of current) {
      if (value && value !== 'undefined' && value !== 'null') {
        cleanParams.set(key, value)
      }
    }

    const newUrl = `${pathname}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`
    
    if (replace) {
      router.replace(newUrl)
    } else {
      router.push(newUrl)
    }
  }, [router, pathname, searchParams])

  // Specific state updaters
  const updatePagination = useCallback((page: number, limit?: number) => {
    updateUrlState({ page, ...(limit && { limit }) }, true)
  }, [updateUrlState])

  const updateSorting = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    updateUrlState({ sortBy, sortOrder, page: 1 }, true) // Reset to page 1 when sorting changes
  }, [updateUrlState])

  const updateFilters = useCallback((filters: Pick<BrandDashboardUrlState, 'minImpressions'>) => {
    updateUrlState({ ...filters, page: 1 }, true) // Reset to page 1 when filters change
  }, [updateUrlState])

  const updateExpandedRows = useCallback((expanded: string[]) => {
    updateUrlState({ expanded }, true)
  }, [updateUrlState])

  const updateDateRange = useCallback((
    dateFrom: string,
    dateTo: string,
    compareFrom?: string,
    compareTo?: string,
    showComparison?: boolean
  ) => {
    updateUrlState({
      dateFrom,
      dateTo,
      compareFrom,
      compareTo,
      showComparison,
      page: 1 // Reset to page 1 when date changes
    }, true)
  }, [updateUrlState])

  const updateSelectedProducts = useCallback((selected: string[]) => {
    updateUrlState({ selected }, true)
  }, [updateUrlState])

  // Navigation helpers
  const navigateToAsinDashboard = useCallback((asin: string, preserveContext: boolean = true) => {
    const contextParams = new URLSearchParams()
    
    if (preserveContext) {
      // Preserve date range and comparison settings
      if (urlState.dateFrom) contextParams.set('dateFrom', urlState.dateFrom)
      if (urlState.dateTo) contextParams.set('dateTo', urlState.dateTo)
      if (urlState.compareFrom) contextParams.set('compareFrom', urlState.compareFrom)
      if (urlState.compareTo) contextParams.set('compareTo', urlState.compareTo)
      if (urlState.showComparison) contextParams.set('showComparison', 'true')
    }
    
    contextParams.set('asin', asin)
    contextParams.set('source', 'brand-dashboard') // Track navigation source
    
    const asinDashboardUrl = `/?${contextParams.toString()}`
    router.push(asinDashboardUrl)
  }, [router, urlState])

  const navigateBack = useCallback((fallbackUrl: string = '/brands') => {
    // Check if we can go back in browser history
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackUrl)
    }
  }, [router])

  // Reset all state
  const resetUrlState = useCallback(() => {
    router.replace(pathname)
  }, [router, pathname])

  return {
    // Current state
    urlState,
    
    // Update methods
    updateUrlState,
    updatePagination,
    updateSorting,
    updateFilters,
    updateExpandedRows,
    updateDateRange,
    updateSelectedProducts,
    
    // Navigation methods
    navigateToAsinDashboard,
    navigateBack,
    resetUrlState,
    
    // Utility methods
    hasFilters: !!(urlState.minImpressions || urlState.sortBy),
    hasDateRange: !!(urlState.dateFrom && urlState.dateTo),
    hasComparison: !!(urlState.showComparison && urlState.compareFrom && urlState.compareTo),
    hasExpandedRows: !!(urlState.expanded && urlState.expanded.length > 0),
    hasSelectedProducts: !!(urlState.selected && urlState.selected.length > 0),
  }
}

// Enhanced hook that integrates with React Query expanded state
export function useUrlStateWithQuerySync() {
  const urlStateHook = useUrlState()
  const { urlState, updateExpandedRows } = urlStateHook
  
  // Sync expanded rows between URL and React Query cache
  const syncExpandedRows = useCallback((expandedAsins: string[]) => {
    // Only update URL if different from current state
    const currentExpanded = urlState.expanded || []
    const isSame = expandedAsins.length === currentExpanded.length &&
      expandedAsins.every(asin => currentExpanded.includes(asin))
    
    if (!isSame) {
      updateExpandedRows(expandedAsins)
    }
  }, [urlState.expanded, updateExpandedRows])

  return {
    ...urlStateHook,
    syncExpandedRows,
  }
}

// Hook for preserving navigation context across route changes
export function useNavigationContext() {
  const searchParams = useSearchParams()
  
  const context = useMemo(() => {
    return {
      source: searchParams.get('source'),
      preservedAsin: searchParams.get('asin'),
      preservedDateFrom: searchParams.get('dateFrom'),
      preservedDateTo: searchParams.get('dateTo'),
      preservedCompareFrom: searchParams.get('compareFrom'),
      preservedCompareTo: searchParams.get('compareTo'),
      preservedShowComparison: searchParams.get('showComparison') === 'true',
    }
  }, [searchParams])

  const isFromBrandDashboard = context.source === 'brand-dashboard'
  
  return {
    context,
    isFromBrandDashboard,
    hasPreservedDateRange: !!(context.preservedDateFrom && context.preservedDateTo),
    hasPreservedComparison: !!(context.preservedShowComparison && context.preservedCompareFrom && context.preservedCompareTo),
  }
}