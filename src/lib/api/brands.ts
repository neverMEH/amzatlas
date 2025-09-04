import { useQuery } from '@tanstack/react-query'

export interface Brand {
  id: string
  display_name: string
}

export function useBrands() {
  return useQuery<Brand[]>({
    queryKey: ['brands'],
    queryFn: async () => {
      const response = await fetch('/api/brands')
      if (!response.ok) {
        throw new Error('Failed to fetch brands')
      }
      return response.json()
    },
  })
}