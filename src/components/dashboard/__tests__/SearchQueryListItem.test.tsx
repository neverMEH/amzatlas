import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchQueryListItem } from '../SearchQueryListItem'

const mockQuery = {
  id: 1,
  query: 'laptop',
  impressions: 8500,
  impressionsComparison: 12.3,
  clicks: 1250,
  clicksComparison: 8.7,
  cartAdds: 185,
  cartAddsComparison: 5.2,
  purchases: 95,
  purchasesComparison: 7.8,
  ctr: '14.7%',
  ctrComparison: -3.6,
  cvr: '7.6%',
  cvrComparison: 2.1,
  impressionShare: '45%',
  impressionShareComparison: 8.5,
  cvrShare: '32%',
  cvrShareComparison: 4.7,
  ctrShare: '38%',
  ctrShareComparison: 6.2,
  cartAddShare: '35%',
  cartAddShareComparison: 3.8,
  purchaseShare: '30%',
  purchaseShareComparison: 5.3,
}

describe('SearchQueryListItem', () => {
  it('should render query data correctly', () => {
    render(
      <table>
        <tbody>
          <SearchQueryListItem query={mockQuery} showComparison={false} />
        </tbody>
      </table>
    )
    
    expect(screen.getByText('laptop')).toBeInTheDocument()
    expect(screen.getByText('8,500')).toBeInTheDocument()
    expect(screen.getByText('1,250')).toBeInTheDocument()
    expect(screen.getByText('185')).toBeInTheDocument()
    expect(screen.getByText('95')).toBeInTheDocument()
    expect(screen.getByText('14.7%')).toBeInTheDocument()
    expect(screen.getByText('7.6%')).toBeInTheDocument()
  })

  it('should render share metrics with appropriate styling', () => {
    render(
      <table>
        <tbody>
          <SearchQueryListItem query={mockQuery} showComparison={false} />
        </tbody>
      </table>
    )
    
    // Impression share 45% should have green styling (>=40 range)
    const impressionShare = screen.getByText('45%')
    expect(impressionShare).toHaveClass('text-green-600', 'bg-green-50')
    
    // CVR share 32% should have blue styling (25-39 range)
    const cvrShare = screen.getByText('32%')
    expect(cvrShare).toHaveClass('text-blue-600', 'bg-blue-50')
  })

  it('should apply yellow styling for low share values', () => {
    const lowShareQuery = {
      ...mockQuery,
      impressionShare: '15%',
    }
    
    render(
      <table>
        <tbody>
          <SearchQueryListItem query={lowShareQuery} showComparison={false} />
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
          <SearchQueryListItem query={mockQuery} showComparison={false} />
        </tbody>
      </table>
    )
    
    expect(screen.queryByText('12.3%')).not.toBeInTheDocument()
    expect(screen.queryByText('8.7%')).not.toBeInTheDocument()
  })

  it('should show comparison indicators when showComparison is true', () => {
    render(
      <table>
        <tbody>
          <SearchQueryListItem query={mockQuery} showComparison={true} />
        </tbody>
      </table>
    )
    
    // Positive comparisons
    expect(screen.getByText('12.3%')).toBeInTheDocument()
    expect(screen.getByText('8.7%')).toBeInTheDocument()
    expect(screen.getByText('7.8%')).toBeInTheDocument()
    
    // Negative comparisons
    expect(screen.getByText('3.6%')).toBeInTheDocument() // CTR comparison
  })

  it('should render checkbox', () => {
    render(
      <table>
        <tbody>
          <SearchQueryListItem query={mockQuery} showComparison={false} />
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
          <SearchQueryListItem 
            query={mockQuery} 
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

  it('should apply hover styling', () => {
    render(
      <table>
        <tbody>
          <SearchQueryListItem query={mockQuery} showComparison={false} />
        </tbody>
      </table>
    )
    
    const row = screen.getByText('laptop').closest('tr')
    expect(row).toHaveClass('hover:bg-gray-50')
  })

  it('should format numbers with locale formatting', () => {
    const largeNumberQuery = {
      ...mockQuery,
      impressions: 1234567,
      clicks: 89012,
    }
    
    render(
      <table>
        <tbody>
          <SearchQueryListItem query={largeNumberQuery} showComparison={false} />
        </tbody>
      </table>
    )
    
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getByText('89,012')).toBeInTheDocument()
  })
})