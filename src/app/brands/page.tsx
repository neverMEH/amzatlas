'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBrands } from '@/lib/api/brands'
import type { Brand } from '@/types/brand'

export default function BrandsPage() {
  const router = useRouter()
  const { data: brands, isLoading } = useBrands()
  
  // Ensure brands is treated as an array
  const brandsList = brands || []

  useEffect(() => {
    // Redirect to first brand when brands are loaded
    if (brandsList.length > 0) {
      const firstBrandId = brandsList[0].id
      router.replace(`/brands/${firstBrandId}`)
    }
  }, [brandsList, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading brands...</div>
      </div>
    )
  }

  if (brandsList.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">No Brands Found</h1>
          <p className="text-gray-500">Please ensure brands are configured in the system.</p>
        </div>
      </div>
    )
  }

  // This will not be shown as we redirect immediately
  return null
}