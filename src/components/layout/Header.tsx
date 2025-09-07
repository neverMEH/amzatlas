import React, { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon, UserIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

interface Brand {
  id: string
  display_name: string
}

interface HeaderProps {
  selectedBrand?: string
  onBrandChange: (brandId: string) => void
}

async function fetchBrands(): Promise<Brand[]> {
  const response = await fetch('/api/brands')
  if (!response.ok) {
    throw new Error('Failed to fetch brands')
  }
  const data = await response.json()
  return data.data
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
    const savedBrandId = localStorage.getItem('selectedBrandId')
    if (savedBrandId && !selectedBrand) {
      onBrandChange(savedBrandId)
    }
  }, [selectedBrand, onBrandChange])

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
    onBrandChange(brandId)
    localStorage.setItem('selectedBrandId', brandId)
    setIsDropdownOpen(false)
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
                className="flex items-center space-x-2 px-4 py-2 rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={toggleDropdown}
                onKeyDown={handleKeyDown}
                aria-label="Select brand"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
              >
                <span className="text-gray-700">
                  {selectedBrandObj ? selectedBrandObj.display_name : 'Select Brand'}
                </span>
                <ChevronDownIcon 
                  size={16} 
                  className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              
              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[200px]">
                  {isLoading ? (
                    <div className="px-4 py-2 text-sm text-gray-500">Loading brands...</div>
                  ) : error ? (
                    <div className="px-4 py-2 text-sm text-red-600">Failed to load brands</div>
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