import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductList } from '../ProductList'

const mockProducts = [
  {
    id: 'B001',
    name: 'Test Product 1',
    childAsin: 'B001',
    image: '/test-image-1.jpg',
    impressions: 2450,
    impressionsComparison: 8.3,
    clicks: 385,
    clicksComparison: 12.5,
    cartAdds: 65,
    cartAddsComparison: -3.8,
    purchases: 45,
    purchasesComparison: 15.2,
    ctr: '15.7%',
    ctrComparison: 4.2,
    cvr: '11.7%',
    cvrComparison: -2.1,
    impressionShare: '32%',
    impressionShareComparison: 5.8,
    cvrShare: '28%',
    cvrShareComparison: 3.2,
    ctrShare: '35%',
    ctrShareComparison: 7.5,
    cartAddShare: '30%',
    cartAddShareComparison: -1.3,
    purchaseShare: '25%',
    purchaseShareComparison: 2.8,
  },
  {
    id: 'B002',
    name: 'Test Product 2',
    childAsin: 'B002',
    image: '/test-image-2.jpg',
    impressions: 3800,
    impressionsComparison: -5.2,
    clicks: 720,
    clicksComparison: -8.1,
    cartAdds: 95,
    cartAddsComparison: -12.3,
    purchases: 61,
    purchasesComparison: -7.5,
    ctr: '18.9%',
    ctrComparison: -4.5,
    cvr: '8.5%',
    cvrComparison: -7.2,
    impressionShare: '45%',
    impressionShareComparison: -2.4,
    cvrShare: '22%',
    cvrShareComparison: -4.3,
    ctrShare: '40%',
    ctrShareComparison: -6.2,
    cartAddShare: '20%',
    cartAddShareComparison: -9.8,
    purchaseShare: '18%',
    purchaseShareComparison: -5.4,
  },
]

describe('ProductList', () => {
  it('should render the product list table', () => {
    render(<ProductList products={mockProducts} showComparison={false} />)
    
    expect(screen.getByText('Product List')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('should render all column headers', () => {
    render(<ProductList products={mockProducts} showComparison={false} />)
    
    const headers = [
      'Product Name',
      'Child ASIN',
      'Impressions',
      'Clicks',
      'Cart Adds',
      'Purchases',
      'CTR',
      'CVR',
      'Impression Share',
      'CVR Share',
      'CTR Share',
      'Cart Add Share',
      'Purchase Share',
    ]
    
    headers.forEach(header => {
      expect(screen.getByText(header)).toBeInTheDocument()
    })
  })

  it('should render all products', () => {
    render(<ProductList products={mockProducts} showComparison={false} />)
    
    expect(screen.getByText('Test Product 1')).toBeInTheDocument()
    expect(screen.getByText('Test Product 2')).toBeInTheDocument()
  })

  it('should show filter button', () => {
    render(<ProductList products={mockProducts} showComparison={false} />)
    
    const filterButton = screen.getByRole('button', { name: /filter/i })
    expect(filterButton).toBeInTheDocument()
  })

  it('should handle filter button click', async () => {
    const user = userEvent.setup()
    const onFilter = vi.fn()
    render(<ProductList products={mockProducts} showComparison={false} onFilter={onFilter} />)
    
    const filterButton = screen.getByRole('button', { name: /filter/i })
    await user.click(filterButton)
    
    expect(onFilter).toHaveBeenCalled()
  })

  it('should show pagination controls', () => {
    render(<ProductList products={mockProducts} showComparison={false} />)
    
    expect(screen.getByText('Showing: 1-2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should handle pagination', async () => {
    const user = userEvent.setup()
    const longProductList = Array.from({ length: 20 }, (_, i) => ({
      ...mockProducts[0],
      id: `B${i + 1}`,
      name: `Product ${i + 1}`,
      childAsin: `B${i + 1}`,
    }))
    
    render(<ProductList products={longProductList} showComparison={false} itemsPerPage={7} />)
    
    // Should show first 7 items
    expect(screen.getByText('Showing: 1-7 of 20')).toBeInTheDocument()
    expect(screen.getByText('Product 1')).toBeInTheDocument()
    expect(screen.queryByText('Product 8')).not.toBeInTheDocument()
    
    // Click next
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    // Should show next page
    expect(screen.getByText('Showing: 8-14 of 20')).toBeInTheDocument()
    expect(screen.queryByText('Product 1')).not.toBeInTheDocument()
    expect(screen.getByText('Product 8')).toBeInTheDocument()
  })

  it('should handle sorting when clicking column headers', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    render(<ProductList products={mockProducts} showComparison={false} onSort={onSort} />)
    
    const impressionsHeader = screen.getByText('Impressions')
    await user.click(impressionsHeader)
    
    expect(onSort).toHaveBeenCalledWith('impressions')
  })

  it('should handle product row clicks for navigation', async () => {
    const user = userEvent.setup()
    const onProductClick = vi.fn()
    render(
      <ProductList 
        products={mockProducts} 
        showComparison={false} 
        onProductClick={onProductClick} 
      />
    )
    
    const productRow = screen.getByText('Test Product 1').closest('tr')
    await user.click(productRow!)
    
    expect(onProductClick).toHaveBeenCalledWith('B001')
  })

  it('should show comparison indicators when showComparison is true', () => {
    render(<ProductList products={mockProducts} showComparison={true} />)
    
    // Should show comparison indicators (arrows with percentages)
    expect(screen.getByText('8.3%')).toBeInTheDocument()
    expect(screen.getByText('5.2%')).toBeInTheDocument()
  })

  it('should handle checkbox selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ProductList 
        products={mockProducts} 
        showComparison={false} 
        onSelect={onSelect}
      />
    )
    
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // Click first product checkbox
    
    expect(onSelect).toHaveBeenCalledWith(['B001'])
    
    await user.click(checkboxes[2]) // Click second product checkbox
    expect(onSelect).toHaveBeenCalledWith(['B001', 'B002'])
  })

  it('should handle select all checkbox', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <ProductList 
        products={mockProducts} 
        showComparison={false} 
        onSelect={onSelect}
      />
    )
    
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
    await user.click(selectAllCheckbox)
    
    expect(onSelect).toHaveBeenCalledWith(['B001', 'B002'])
  })

  it('should show loading state', () => {
    render(<ProductList loading={true} />)
    
    expect(screen.getByTestId('product-list-skeleton')).toBeInTheDocument()
  })

  it('should show error state', () => {
    render(<ProductList error="Failed to load products" />)
    
    expect(screen.getByText('Failed to load products')).toBeInTheDocument()
  })

  it('should show empty state when no products', () => {
    render(<ProductList products={[]} showComparison={false} />)
    
    expect(screen.getByText('No products found')).toBeInTheDocument()
  })

  it('should disable pagination buttons appropriately', () => {
    render(<ProductList products={mockProducts} showComparison={false} />)
    
    const prevButton = screen.getByRole('button', { name: /previous/i })
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    // On first page, previous should be disabled
    expect(prevButton).toBeDisabled()
    // With only 2 items and default 7 per page, next should be disabled
    expect(nextButton).toBeDisabled()
  })
})