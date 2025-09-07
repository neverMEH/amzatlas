import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductListItem } from '../ProductListItem'

const mockProduct = {
  id: 'B001',
  name: 'Test Product',
  childAsin: 'B001',
  image: '/test-image.jpg',
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
}

describe('ProductListItem', () => {
  it('should render product data correctly', () => {
    render(
      <table>
        <tbody>
          <ProductListItem product={mockProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('B001')).toBeInTheDocument()
    expect(screen.getByText('2,450')).toBeInTheDocument()
    expect(screen.getByText('385')).toBeInTheDocument()
    expect(screen.getByText('65')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('15.7%')).toBeInTheDocument()
    expect(screen.getByText('11.7%')).toBeInTheDocument()
  })

  it('should render product image', () => {
    render(
      <table>
        <tbody>
          <ProductListItem product={mockProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', '/test-image.jpg')
    expect(image).toHaveAttribute('alt', 'Test Product')
  })

  it('should render share metrics with appropriate styling', () => {
    render(
      <table>
        <tbody>
          <ProductListItem product={mockProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    // Impression share 32% should have blue styling (25-39 range)
    const impressionShare = screen.getByText('32%')
    expect(impressionShare).toHaveClass('text-blue-600', 'bg-blue-50')
  })

  it('should apply green styling for high share values', () => {
    const highShareProduct = {
      ...mockProduct,
      impressionShare: '45%',
    }
    
    render(
      <table>
        <tbody>
          <ProductListItem product={highShareProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    const impressionShare = screen.getByText('45%')
    expect(impressionShare).toHaveClass('text-green-600', 'bg-green-50')
  })

  it('should apply yellow styling for low share values', () => {
    const lowShareProduct = {
      ...mockProduct,
      impressionShare: '15%',
    }
    
    render(
      <table>
        <tbody>
          <ProductListItem product={lowShareProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    const impressionShare = screen.getByText('15%')
    expect(impressionShare).toHaveClass('text-yellow-600', 'bg-yellow-50')
  })

  it('should not show comparison indicators when showComparison is false', () => {
    render(
      <table>
        <tbody>
          <ProductListItem product={mockProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    expect(screen.queryByText('8.3%')).not.toBeInTheDocument()
    expect(screen.queryByText('12.5%')).not.toBeInTheDocument()
  })

  it('should show comparison indicators when showComparison is true', () => {
    render(
      <table>
        <tbody>
          <ProductListItem product={mockProduct} showComparison={true} />
        </tbody>
      </table>
    )
    
    // Positive comparisons
    expect(screen.getByText('8.3%')).toBeInTheDocument()
    expect(screen.getByText('12.5%')).toBeInTheDocument()
    expect(screen.getByText('15.2%')).toBeInTheDocument()
    
    // Negative comparisons
    expect(screen.getByText('3.8%')).toBeInTheDocument() // Cart adds
  })

  it('should render checkbox', () => {
    render(
      <table>
        <tbody>
          <ProductListItem product={mockProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeInTheDocument()
  })

  it('should handle checkbox click', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    
    render(
      <table>
        <tbody>
          <ProductListItem 
            product={mockProduct} 
            showComparison={false}
            onSelect={onSelect} 
          />
        </tbody>
      </table>
    )
    
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)
    
    expect(onSelect).toHaveBeenCalledWith(true)
  })

  it('should handle row click for navigation', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    
    render(
      <table>
        <tbody>
          <ProductListItem 
            product={mockProduct} 
            showComparison={false}
            onClick={onClick} 
          />
        </tbody>
      </table>
    )
    
    const row = screen.getByText('Test Product').closest('tr')
    await user.click(row!)
    
    expect(onClick).toHaveBeenCalled()
  })

  it('should apply hover styling', async () => {
    const user = userEvent.setup()
    
    render(
      <table>
        <tbody>
          <ProductListItem product={mockProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    const row = screen.getByText('Test Product').closest('tr')
    expect(row).toHaveClass('hover:bg-gray-50')
  })

  it('should format numbers with locale formatting', () => {
    const largeNumberProduct = {
      ...mockProduct,
      impressions: 1234567,
      clicks: 89012,
    }
    
    render(
      <table>
        <tbody>
          <ProductListItem product={largeNumberProduct} showComparison={false} />
        </tbody>
      </table>
    )
    
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getByText('89,012')).toBeInTheDocument()
  })
})