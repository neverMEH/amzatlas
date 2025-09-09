'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { KpiModules } from '@/components/dashboard/KpiModules'
import { ProductList } from '@/components/dashboard/ProductList'
import { SearchQueryList } from '@/components/dashboard/SearchQueryList'
import { useBrandDashboard } from '@/lib/api/brand-dashboard'
import { DateRangePickerV2 } from '@/components/asin-performance/DateRangePickerV2'
import { BrandDashboardBreadcrumb } from '@/components/navigation/BrandDashboardBreadcrumb'

interface BrandDashboardProps {
  params: {
    brandId: string
  }
}

export default function BrandDashboard({ params }: BrandDashboardProps) {
  const router = useRouter()
  const { brandId } = params
  const [selectedBrand, setSelectedBrand] = useState<string>(brandId)
  const [showComparison, setShowComparison] = useState(false)
  
  // Date state
  const [dateRange, setDateRange] = useState(() => {
    // Default to last 30 days
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    
    return {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    }
  })
  
  const [compareRange, setCompareRange] = useState({
    startDate: '',
    endDate: '',
    enabled: false,
  })

  // Fetch dashboard data
  const { data, isLoading, error } = useBrandDashboard(
    selectedBrand,
    dateRange.startDate,
    dateRange.endDate,
    compareRange.enabled ? compareRange.startDate : undefined,
    compareRange.enabled ? compareRange.endDate : undefined
  )

  // Update comparison mode when compare range is enabled
  useEffect(() => {
    setShowComparison(compareRange.enabled)
  }, [compareRange.enabled])

  // Handle brand change from header
  const handleBrandChange = (newBrandId: string) => {
    setSelectedBrand(newBrandId)
    router.push(`/brands/${newBrandId}`)
  }

  // Handle product click to navigate to ASIN performance dashboard
  const handleProductClick = (asin: string) => {
    // Navigate to main dashboard with ASIN pre-selected
    router.push(`/?asin=${asin}`)
  }

  // Handle date range change
  const handleDateRangeChange = (range: { startDate: string; endDate: string }) => {
    setDateRange(range)
  }
  
  const handleCompareChange = (range: { enabled: boolean; startDate?: string; endDate?: string }) => {
    if (range.enabled && range.startDate && range.endDate) {
      setCompareRange({
        startDate: range.startDate,
        endDate: range.endDate,
        enabled: true,
      })
    } else {
      setCompareRange({
        startDate: '',
        endDate: '',
        enabled: false,
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        selectedBrand={selectedBrand}
        onBrandChange={handleBrandChange}
      />
      
      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <BrandDashboardBreadcrumb 
          brandName={data?.data.brand?.brand_name || `Brand ${selectedBrand}`}
          brandId={selectedBrand}
          currentPage="overview"
        />

        {/* Date Range Picker and Comparison Toggle */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <DateRangePickerV2
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onChange={handleDateRangeChange}
              showComparison={true}
              compareStartDate={compareRange.startDate}
              compareEndDate={compareRange.endDate}
              onCompareChange={handleCompareChange}
              hasManualSelection={true}
            />
            
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showComparison}
                onChange={(e) => {
                  const enabled = e.target.checked
                  setShowComparison(enabled)
                  if (!enabled) {
                    setCompareRange({
                      startDate: '',
                      endDate: '',
                      enabled: false,
                    })
                  }
                }}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Show comparison</span>
            </label>
          </div>
        </div>

        {/* KPI Cards */}
        <KpiModules
          data={data ? { kpis: data.data.kpis } : null}
          showComparison={showComparison}
          loading={isLoading}
          error={error?.message}
        />

        {/* Product List */}
        <div className="mt-8">
          <ProductList
            products={data?.data.products}
            showComparison={showComparison}
            loading={isLoading}
            error={error?.message}
            onProductClick={handleProductClick}
            brandId={selectedBrand}
            dateRange={dateRange}
            comparisonDateRange={compareRange.enabled ? compareRange : undefined}
          />
        </div>

        {/* Search Query List */}
        <SearchQueryList
          queries={data?.data.searchQueries}
          showComparison={showComparison}
          loading={isLoading}
          error={error?.message}
        />
      </main>
    </div>
  )
}