'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBrands } from '@/lib/api/brands'

export default function BrandsPage() {
  const router = useRouter()
  const { data: brands, isLoading } = useBrands()

  useEffect(() => {
    // Redirect to first brand when brands are loaded
    if (brands && brands.length > 0) {
      const firstBrandId = brands[0].id
      router.replace(`/brands/${firstBrandId}`)
    }
  }, [brands, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading brands...</div>
      </div>
    )
  }

  if (!brands || brands.length === 0) {
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