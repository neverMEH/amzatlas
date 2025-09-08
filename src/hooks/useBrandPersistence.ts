import { useState, useEffect, useCallback } from 'react'
import { brandPersistence } from '@/lib/utils/brand-persistence'

/**
 * Hook for managing brand persistence
 */
export function useBrandPersistence() {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load initial brand ID
  useEffect(() => {
    const savedBrandId = brandPersistence.getBrandId()
    if (savedBrandId) {
      setSelectedBrandId(savedBrandId)
    }
    setIsLoading(false)
  }, [])

  // Listen for changes from other tabs
  useEffect(() => {
    const unsubscribe = brandPersistence.addChangeListener((brandId) => {
      setSelectedBrandId(brandId)
    })

    return unsubscribe
  }, [])

  // Listen for changes in the same tab
  useEffect(() => {
    const unsubscribe = brandPersistence.addLocalChangeListener((brandId) => {
      setSelectedBrandId(brandId)
    })

    return unsubscribe
  }, [])

  // Save brand ID
  const saveBrandId = useCallback((brandId: string) => {
    brandPersistence.saveBrandId(brandId)
    setSelectedBrandId(brandId)
  }, [])

  // Clear brand ID
  const clearBrandId = useCallback(() => {
    brandPersistence.clearBrandId()
    setSelectedBrandId(null)
  }, [])

  return {
    selectedBrandId,
    saveBrandId,
    clearBrandId,
    isLoading
  }
}