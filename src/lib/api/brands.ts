import { useQuery } from '@tanstack/react-query'
import type { Brand, BrandsResponse } from '@/types/brand'

interface UseBrandsOptions {
  includeInactive?: boolean
  includeHierarchy?: boolean
  includeCounts?: boolean
}

export function useBrands(options?: UseBrandsOptions) {
  return useQuery<Brand[]>({
    queryKey: ['brands', options],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (options?.includeInactive) searchParams.set('includeInactive', 'true')
      if (options?.includeHierarchy) searchParams.set('includeHierarchy', 'true')
      if (options?.includeCounts) searchParams.set('includeCounts', 'true')
      
      const url = `/api/brands${searchParams.toString() ? `?${searchParams}` : ''}`
      const response = await fetch(url)
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(error.error || 'Failed to fetch brands')
      }
      
      const result: BrandsResponse = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}