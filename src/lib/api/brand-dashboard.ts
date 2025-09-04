import { useQuery } from '@tanstack/react-query'

interface KPIData {
  value: number
  trend: number[]
  comparison: number | null
}

interface ProductData {
  id: string
  name: string
  childAsin: string
  image: string
  impressions: number
  impressionsComparison?: number
  clicks: number
  clicksComparison?: number
  cartAdds: number
  cartAddsComparison?: number
  purchases: number
  purchasesComparison?: number
  ctr: string
  ctrComparison?: number
  cvr: string
  cvrComparison?: number
  impressionShare: string
  impressionShareComparison?: number
  cvrShare: string
  cvrShareComparison?: number
  ctrShare: string
  ctrShareComparison?: number
  cartAddShare: string
  cartAddShareComparison?: number
  purchaseShare: string
  purchaseShareComparison?: number
}

interface SearchQueryData {
  id: number
  query: string
  impressions: number
  impressionsComparison?: number
  clicks: number
  clicksComparison?: number
  cartAdds: number
  cartAddsComparison?: number
  purchases: number
  purchasesComparison?: number
  ctr: string
  ctrComparison?: number
  cvr: string
  cvrComparison?: number
  impressionShare: string
  impressionShareComparison?: number
  cvrShare: string
  cvrShareComparison?: number
  ctrShare: string
  ctrShareComparison?: number
  cartAddShare: string
  cartAddShareComparison?: number
  purchaseShare: string
  purchaseShareComparison?: number
}

interface BrandDashboardResponse {
  data: {
    kpis: {
      impressions: KPIData
      clicks: KPIData
      cartAdds: KPIData
      purchases: KPIData
    }
    products: ProductData[]
    searchQueries: SearchQueryData[]
  }
  meta: {
    brand: {
      id: string
      display_name: string
    }
    dateRange: {
      from: string
      to: string
    }
    comparisonDateRange?: {
      from: string
      to: string
    }
  }
}

export function useBrandDashboard(
  brandId: string,
  dateFrom: string,
  dateTo: string,
  comparisonDateFrom?: string,
  comparisonDateTo?: string,
  productLimit = 50,
  queryLimit = 50
) {
  const params = new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    product_limit: productLimit.toString(),
    query_limit: queryLimit.toString(),
  })

  if (comparisonDateFrom && comparisonDateTo) {
    params.append('comparison_date_from', comparisonDateFrom)
    params.append('comparison_date_to', comparisonDateTo)
  }

  return useQuery<BrandDashboardResponse>({
    queryKey: ['brand-dashboard', brandId, dateFrom, dateTo, comparisonDateFrom, comparisonDateTo],
    queryFn: async () => {
      const response = await fetch(`/api/brands/${brandId}/dashboard?${params}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to fetch brand dashboard data')
      }
      return response.json()
    },
    enabled: !!brandId && !!dateFrom && !!dateTo,
  })
}