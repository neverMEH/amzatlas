import React, { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon, UserIcon, AlertCircle, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Brand, BrandsResponse } from '@/types/brand'
import { getBrandErrorMessage } from '@/lib/utils/error-messages'

interface HeaderProps {
  selectedBrand?: string
  onBrandChange: (brandId: string) => void
}

async function fetchBrands(): Promise<Brand[]> {
  const response = await fetch('/api/brands')
  if (!response.ok) {
    throw new Error('Failed to fetch brands')
  }
  const result = await response.json()
  return result.data || []
}

export const Header: React.FC<HeaderProps> = ({ selectedBrand, onBrandChange }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch brands from API
  const { data: brands = [], isLoading, error } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Get selected brand object
  const selectedBrandObj = brands.find(b => b.id === selectedBrand)

  // Load selected brand from localStorage on mount
  useEffect(() => {
    try {
      const savedBrandId = localStorage.getItem('selectedBrandId')
      if (savedBrandId && !selectedBrand && brands.length > 0) {
        // Verify the saved brand still exists
        const brandExists = brands.some(b => b.id === savedBrandId)
        if (brandExists) {
          onBrandChange(savedBrandId)
        } else {
          // Clear invalid brand ID
          localStorage.removeItem('selectedBrandId')
        }
      }
    } catch (error) {
      console.error('Error loading saved brand:', error)
    }
  }, [brands]) // Only depend on brands, not selectedBrand or onBrandChange to avoid loops

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const selectBrand = (brandId: string) => {
    try {
      localStorage.setItem('selectedBrandId', brandId)
      onBrandChange(brandId)
      setIsDropdownOpen(false)
    } catch (error) {
      console.error('Error saving brand selection:', error)
      // Still update the UI even if storage fails
      onBrandChange(brandId)
      setIsDropdownOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isDropdownOpen) {
      toggleDropdown()
    }
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* AMZ Atlas Branding */}
            <div className="flex items-center text-blue-600 font-semibold">
              <span className="text-blue-600 bg-blue-100 p-1 rounded mr-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16.24 7.76L14.12 14.12L7.76 16.24L9.88 9.88L16.24 7.76Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              AMZ Atlas
            </div>

            {/* Brand Selector */}
            <div className="hidden md:block relative" ref={dropdownRef}>
              <button
                data-testid="brand-selector"
                className={`flex items-center space-x-2 px-4 py-2 rounded-md border transition-colors ${
                  error 
                    ? 'border-red-300 bg-red-50 hover:bg-red-100' 
                    : 'border-gray-200 hover:bg-gray-50'
                } ${isLoading || error ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={toggleDropdown}
                onKeyDown={handleKeyDown}
                aria-label="Select brand"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-gray-500" />
                    <span className="text-gray-500">Loading brands...</span>
                  </>
                ) : error ? (
                  <>
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-red-700">Error loading brands</span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-700">
                      {selectedBrandObj ? selectedBrandObj.display_name : 'Select Brand'}
                    </span>
                    <ChevronDownIcon 
                      size={16} 
                      className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </>
                )}
              </button>
              
              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[200px]">
                  {isLoading ? (
                    <div className="px-4 py-3 flex items-center space-x-2 text-sm text-gray-500">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Loading brands...</span>
                    </div>
                  ) : error ? (
                    <div className="px-4 py-3">
                      <div className="flex items-start space-x-2 text-sm text-red-600">
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Failed to load brands</p>
                          <p className="text-xs text-red-500 mt-1">{getBrandErrorMessage(error)}</p>
                          <button 
                            onClick={() => window.location.reload()}
                            className="text-xs text-red-600 underline mt-2 hover:text-red-700"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : brands.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      No brands available
                    </div>
                  ) : (
                    <ul className="py-1" role="listbox">
                      {brands.map((brand) => (
                        <li
                          key={brand.id}
                          data-testid={`brand-option-${brand.id}`}
                          className={`px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors ${
                            selectedBrand === brand.id ? 'bg-gray-100' : ''
                          }`}
                          onClick={() => selectBrand(brand.id)}
                          role="option"
                          aria-selected={selectedBrand === brand.id}
                        >
                          {brand.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors">
              <UserIcon size={20} />
            </button>
            <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-medium">
              JD
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}