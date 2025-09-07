'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useASINList, type ASIN } from '@/lib/api/asin-performance'

interface ASINSelectorProps {
  value: string
  onChange: (asin: string) => void
}

export function ASINSelector({ value, onChange }: ASINSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, error } = useASINList()

  const filteredASINs = data?.asins?.filter((asin: ASIN) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      asin.asin.toLowerCase().includes(searchLower) ||
      asin.productTitle.toLowerCase().includes(searchLower) ||
      asin.brand.toLowerCase().includes(searchLower)
    )
  }) || []

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelect = (asin: string) => {
    onChange(asin)
    setIsOpen(false)
    setSearchTerm('')
  }

  const selectedASIN = data?.asins?.find((a: ASIN) => a.asin === value)

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          placeholder="Search or select an ASIN..."
          value={isOpen ? searchTerm : (selectedASIN ? `${selectedASIN.asin} - ${selectedASIN.productTitle}` : value)}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-auto">
          {isLoading && (
            <div className="px-4 py-3 text-gray-500">Loading ASINs...</div>
          )}
          
          {error && (
            <div className="px-4 py-3 text-red-500">Error loading ASINs</div>
          )}
          
          {!isLoading && !error && filteredASINs.length === 0 && (
            <div className="px-4 py-3 text-gray-500">No ASINs found</div>
          )}
          
          {!isLoading && !error && filteredASINs.length > 0 && (
            <ul>
              {filteredASINs.map((asin: ASIN) => (
                <li
                  key={asin.asin}
                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSelect(asin.asin)}
                >
                  <div className="font-medium">{asin.asin} - {asin.productTitle}</div>
                  <div className="text-sm text-gray-500">{asin.brand}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}