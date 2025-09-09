import React from 'react'
import { ChevronRight, ArrowLeft, Home, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNavigationContext, useUrlState } from '@/hooks/useUrlState'

interface BrandDashboardBreadcrumbProps {
  brandName: string
  brandId: string
  currentPage?: 'overview' | 'products' | 'keywords'
}

export const BrandDashboardBreadcrumb: React.FC<BrandDashboardBreadcrumbProps> = ({
  brandName,
  brandId,
  currentPage = 'overview'
}) => {
  const router = useRouter()
  const { navigateBack } = useUrlState()
  const { isFromBrandDashboard, context } = useNavigationContext()

  const handleBackToDashboard = () => {
    if (context.preservedAsin && isFromBrandDashboard) {
      // If we came from the main dashboard with a preserved ASIN, go back there
      const params = new URLSearchParams()
      params.set('asin', context.preservedAsin)
      if (context.preservedDateFrom) params.set('dateFrom', context.preservedDateFrom)
      if (context.preservedDateTo) params.set('dateTo', context.preservedDateTo)
      if (context.preservedCompareFrom) params.set('compareFrom', context.preservedCompareFrom)
      if (context.preservedCompareTo) params.set('compareTo', context.preservedCompareTo)
      if (context.preservedShowComparison) params.set('showComparison', 'true')
      
      router.push(`/?${params.toString()}`)
    } else {
      // Otherwise navigate to brands list
      router.push('/brands')
    }
  }

  const handleBrandOverview = () => {
    if (currentPage !== 'overview') {
      router.push(`/brands/${brandId}`)
    }
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      <button
        onClick={handleBackToDashboard}
        className="flex items-center hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} className="mr-1" />
        Back
      </button>
      
      <ChevronRight size={16} className="text-gray-400" />
      
      <button
        onClick={() => router.push('/brands')}
        className="flex items-center hover:text-gray-900 transition-colors"
      >
        <Building2 size={16} className="mr-1" />
        Brands
      </button>
      
      <ChevronRight size={16} className="text-gray-400" />
      
      <button
        onClick={handleBrandOverview}
        className={`hover:text-gray-900 transition-colors ${
          currentPage === 'overview' ? 'text-gray-900 font-medium' : ''
        }`}
      >
        {brandName}
      </button>

      {currentPage !== 'overview' && (
        <>
          <ChevronRight size={16} className="text-gray-400" />
          <span className="text-gray-900 font-medium capitalize">
            {currentPage}
          </span>
        </>
      )}

      {/* Context indicator if coming from main dashboard */}
      {isFromBrandDashboard && context.preservedAsin && (
        <div className="ml-4 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
          Context: {context.preservedAsin}
        </div>
      )}
    </div>
  )
}