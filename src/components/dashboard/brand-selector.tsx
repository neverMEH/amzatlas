'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Search, Building2, Package, BarChart3 } from 'lucide-react'

interface Brand {
  id: string
  brand_name: string
  display_name: string
  parent_brand_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  asin_count?: number
  total_revenue?: number
  avg_cvr?: number
}

interface BrandHierarchyNode {
  brand: Brand
  children: BrandHierarchyNode[]
  level: number
  productTypes: Array<{
    product_type: string
    asin_count: number
  }>
}

interface BrandSelectorProps {
  selectedBrandId: string | null
  onBrandSelect: (brandId: string | null) => void
  showStats?: boolean
  allowMultiple?: boolean
}

export default function BrandSelector({
  selectedBrandId,
  onBrandSelect,
  showStats = true,
  allowMultiple = false
}: BrandSelectorProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [hierarchy, setHierarchy] = useState<BrandHierarchyNode[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    new Set(selectedBrandId ? [selectedBrandId] : [])
  )

  useEffect(() => {
    fetchBrands()
    fetchHierarchy()
  }, [showStats])

  const fetchBrands = async () => {
    try {
      const params = new URLSearchParams({
        includeStats: showStats.toString()
      })
      
      const response = await fetch(`/api/brands?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setBrands(data.brands)
      }
    } catch (error) {
      console.error('Error fetching brands:', error)
    }
  }

  const fetchHierarchy = async () => {
    try {
      const response = await fetch('/api/brands/hierarchy')
      const data = await response.json()
      
      if (data.success) {
        setHierarchy(data.hierarchy)
      }
    } catch (error) {
      console.error('Error fetching hierarchy:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleNode = (brandId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(brandId)) {
      newExpanded.delete(brandId)
    } else {
      newExpanded.add(brandId)
    }
    setExpandedNodes(newExpanded)
  }

  const handleBrandSelect = (brandId: string) => {
    if (allowMultiple) {
      const newSelected = new Set(selectedBrands)
      if (newSelected.has(brandId)) {
        newSelected.delete(brandId)
      } else {
        newSelected.add(brandId)
      }
      setSelectedBrands(newSelected)
      onBrandSelect(newSelected.size === 0 ? null : Array.from(newSelected).join(','))
    } else {
      setSelectedBrands(new Set([brandId]))
      onBrandSelect(brandId)
    }
  }

  const filteredBrands = brands.filter(brand =>
    brand.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    brand.brand_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const renderBrandNode = (node: BrandHierarchyNode) => {
    const isExpanded = expandedNodes.has(node.brand.id)
    const isSelected = selectedBrands.has(node.brand.id)
    const hasChildren = node.children.length > 0 || node.productTypes.length > 0

    return (
      <div key={node.brand.id} className="mb-1">
        <div
          className={`
            flex items-center justify-between p-2 rounded-lg cursor-pointer
            transition-colors duration-150
            ${isSelected 
              ? 'bg-blue-50 border border-blue-200' 
              : 'hover:bg-gray-50'
            }
          `}
          style={{ paddingLeft: `${(node.level * 20) + 8}px` }}
        >
          <div 
            className="flex items-center flex-1"
            onClick={() => handleBrandSelect(node.brand.id)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (hasChildren) toggleNode(node.brand.id)
              }}
              className={`mr-2 ${!hasChildren ? 'invisible' : ''}`}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
            
            <Building2 className="w-4 h-4 mr-2 text-gray-400" />
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {node.brand.display_name}
                </span>
                {node.brand.asin_count !== undefined && (
                  <span className="text-xs text-gray-500">
                    ({node.brand.asin_count} ASINs)
                  </span>
                )}
              </div>
              
              {showStats && node.brand.total_revenue !== undefined && (
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    ${(node.brand.total_revenue / 1000).toFixed(1)}K
                  </span>
                  {node.brand.avg_cvr !== undefined && (
                    <span>CVR: {node.brand.avg_cvr.toFixed(2)}%</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {allowMultiple && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleBrandSelect(node.brand.id)}
              className="ml-2"
            />
          )}
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-1">
            {node.productTypes.map(type => (
              <div
                key={type.product_type}
                className="flex items-center gap-2 p-2 ml-8 text-sm text-gray-600 hover:bg-gray-50 rounded"
                style={{ paddingLeft: `${((node.level + 1) * 20) + 8}px` }}
              >
                <Package className="w-3 h-3 text-gray-400" />
                <span>{type.product_type}</span>
                <span className="text-xs text-gray-500">
                  ({type.asin_count} products)
                </span>
              </div>
            ))}
            
            {node.children.map(child => renderBrandNode(child))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Select Brand
        </h3>
        
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {selectedBrands.size > 0 && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-700">
                {selectedBrands.size} brand{selectedBrands.size > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => {
                  setSelectedBrands(new Set())
                  onBrandSelect(null)
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : searchTerm ? (
          <div className="space-y-1">
            {filteredBrands.map(brand => (
              <div
                key={brand.id}
                onClick={() => handleBrandSelect(brand.id)}
                className={`
                  flex items-center justify-between p-2 rounded-lg cursor-pointer
                  transition-colors duration-150
                  ${selectedBrands.has(brand.id)
                    ? 'bg-blue-50 border border-blue-200' 
                    : 'hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {brand.display_name}
                  </span>
                  {brand.asin_count !== undefined && (
                    <span className="text-xs text-gray-500">
                      ({brand.asin_count} ASINs)
                    </span>
                  )}
                </div>
                
                {allowMultiple && (
                  <input
                    type="checkbox"
                    checked={selectedBrands.has(brand.id)}
                    onChange={() => handleBrandSelect(brand.id)}
                    className="ml-2"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {hierarchy.map(node => renderBrandNode(node))}
          </div>
        )}
      </div>
    </div>
  )
}