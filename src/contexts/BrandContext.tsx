import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface BrandContextType {
  selectedBrandId: string | null
  setSelectedBrandId: (brandId: string | null) => void
  isLoading: boolean
}

const BrandContext = createContext<BrandContextType | undefined>(undefined)

interface BrandProviderProps {
  children: ReactNode
}

export const BrandProvider: React.FC<BrandProviderProps> = ({ children }) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load selected brand from localStorage on mount
  useEffect(() => {
    const savedBrandId = localStorage.getItem('selectedBrandId')
    if (savedBrandId) {
      setSelectedBrandId(savedBrandId)
    }
    setIsLoading(false)
  }, [])

  // Save to localStorage whenever selectedBrandId changes
  useEffect(() => {
    if (selectedBrandId) {
      localStorage.setItem('selectedBrandId', selectedBrandId)
    } else {
      localStorage.removeItem('selectedBrandId')
    }
  }, [selectedBrandId])

  return (
    <BrandContext.Provider value={{ selectedBrandId, setSelectedBrandId, isLoading }}>
      {children}
    </BrandContext.Provider>
  )
}

export const useBrand = () => {
  const context = useContext(BrandContext)
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider')
  }
  return context
}