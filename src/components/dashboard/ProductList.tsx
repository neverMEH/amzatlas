import React, { useState, useMemo } from 'react'
import { FilterIcon, ChevronUp, ChevronDown } from 'lucide-react'
import { ProductListItem } from './ProductListItem'
import { useSortedData } from '@/hooks/useSortedData'

interface Product {
  id: string
  name: string
  childAsin: string
  image: string
  impressions: number
  impressionsComparison?: number
  clicks: number
  clicksComparison?: number
  cartAdds: number
  cartAddsComparison?: number
  purchases: number
  purchasesComparison?: number
  ctr: string
  ctrComparison?: number
  cvr: string
  cvrComparison?: number
  impressionShare: string
  impressionShareComparison?: number
  cvrShare: string
  cvrShareComparison?: number
  ctrShare: string
  ctrShareComparison?: number
  cartAddShare: string
  cartAddShareComparison?: number
  purchaseShare: string
  purchaseShareComparison?: number
}

interface ProductListProps {
  products?: Product[]
  showComparison: boolean
  itemsPerPage?: number
  loading?: boolean
  error?: string
  onFilter?: () => void
  onSort?: (column: string) => void
  onProductClick?: (asin: string) => void
  onSelect?: (selectedIds: string[]) => void
}

export const ProductList: React.FC<ProductListProps> = ({
  products = [],
  showComparison,
  itemsPerPage = 7,
  loading = false,
  error,
  onFilter,
  onSort,
  onProductClick,
  onSelect,
}) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  
  // Use sorting hook
  const { sortedData, sortConfig, handleSort } = useSortedData(products)

  // Calculate pagination on sorted data
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProducts = sortedData.slice(startIndex, endIndex)

  // Handle select all
  const isAllSelected = useMemo(() => {
    if (currentProducts.length === 0) return false
    return currentProducts.every(product => selectedProducts.has(product.id))
  }, [currentProducts, selectedProducts])

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelectedProducts = new Set(selectedProducts)
    if (e.target.checked) {
      currentProducts.forEach(product => newSelectedProducts.add(product.id))
    } else {
      currentProducts.forEach(product => newSelectedProducts.delete(product.id))
    }
    setSelectedProducts(newSelectedProducts)
    onSelect?.(Array.from(newSelectedProducts))
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelectedProducts = new Set(selectedProducts)
    if (checked) {
      newSelectedProducts.add(productId)
    } else {
      newSelectedProducts.delete(productId)
    }
    setSelectedProducts(newSelectedProducts)
    onSelect?.(Array.from(newSelectedProducts))
  }

  const handleColumnClick = (column: string) => {
    handleSort(column)
    onSort?.(column)
  }
  
  const renderSortIcon = (column: string) => {
    if (sortConfig?.key !== column) return null
    return sortConfig.direction === 'asc' ? (
      <ChevronUp size={14} className="inline-block ml-1" />
    ) : (
      <ChevronDown size={14} className="inline-block ml-1" />
    )
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse" data-testid="product-list-skeleton">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-gray-500 text-center py-8">No products found</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Product List
            </h1>
          </div>
          <div className="flex space-x-2">
            <button
              className="px-4 py-2 border border-gray-300 rounded-md flex items-center text-sm"
              onClick={onFilter}
            >
              <FilterIcon size={16} className="mr-2" />
              Filter
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                  />
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('name')}
                >
                  Product Name
                  {renderSortIcon('name')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('childAsin')}
                >
                  Child ASIN
                  {renderSortIcon('childAsin')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('impressions')}
                >
                  Impressions
                  {renderSortIcon('impressions')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('clicks')}
                >
                  Clicks
                  {renderSortIcon('clicks')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('cartAdds')}
                >
                  Cart Adds
                  {renderSortIcon('cartAdds')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('purchases')}
                >
                  Purchases
                  {renderSortIcon('purchases')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('ctr')}
                >
                  CTR
                  {renderSortIcon('ctr')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('cvr')}
                >
                  CVR
                  {renderSortIcon('cvr')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('impressionShare')}
                >
                  Impression Share
                  {renderSortIcon('impressionShare')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('cvrShare')}
                >
                  CVR Share
                  {renderSortIcon('cvrShare')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('ctrShare')}
                >
                  CTR Share
                  {renderSortIcon('ctrShare')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('cartAddShare')}
                >
                  Cart Add Share
                  {renderSortIcon('cartAddShare')}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleColumnClick('purchaseShare')}
                >
                  Purchase Share
                  {renderSortIcon('purchaseShare')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentProducts.map((product) => (
                <ProductListItem
                  key={product.id}
                  product={product}
                  showComparison={showComparison}
                  onSelect={(checked) => handleSelectProduct(product.id, checked)}
                  onClick={() => onProductClick?.(product.childAsin)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Showing: {startIndex + 1}-{Math.min(endIndex, products.length)} of {products.length}
          </div>
          <div className="flex items-center space-x-2">
            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-gray-500 disabled:opacity-50"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i + 1}
                className={`px-3 py-1 rounded-md ${
                  currentPage === i + 1
                    ? 'bg-gray-900 text-white'
                    : 'border border-gray-300 text-gray-500'
                }`}
                onClick={() => handlePageChange(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-gray-500 disabled:opacity-50"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}