import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchQueryList } from '../SearchQueryList'

const mockQueries = [
  {
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
  },
  {
    id: 2,
    query: 'smartphone',
    impressions: 12300,
    impressionsComparison: 15.8,
    clicks: 2450,
    clicksComparison: 10.2,
    cartAdds: 320,
    cartAddsComparison: 7.5,
    purchases: 180,
    purchasesComparison: 9.3,
    ctr: '19.9%',
    ctrComparison: -5.6,
    cvr: '7.3%',
    cvrComparison: -1.8,
    impressionShare: '52%',
    impressionShareComparison: 10.7,
    cvrShare: '28%',
    cvrShareComparison: -2.5,
    ctrShare: '45%',
    ctrShareComparison: 8.9,
    cartAddShare: '42%',
    cartAddShareComparison: 6.4,
    purchaseShare: '38%',
    purchaseShareComparison: 7.2,
  },
]

describe('SearchQueryList', () => {
  it('should render the search query list table', () => {
    render(<SearchQueryList queries={mockQueries} showComparison={false} />)
    
    expect(screen.getByText('Search Query List')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('should render all column headers', () => {
    render(<SearchQueryList queries={mockQueries} showComparison={false} />)
    
    const headers = [
      'Search Query',
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

  it('should render all queries', () => {
    render(<SearchQueryList queries={mockQueries} showComparison={false} />)
    
    expect(screen.getByText('laptop')).toBeInTheDocument()
    expect(screen.getByText('smartphone')).toBeInTheDocument()
  })

  it('should show filter button', () => {
    render(<SearchQueryList queries={mockQueries} showComparison={false} />)
    
    const filterButton = screen.getByRole('button', { name: /filter/i })
    expect(filterButton).toBeInTheDocument()
  })

  it('should handle filter button click', async () => {
    const user = userEvent.setup()
    const onFilter = vi.fn()
    render(<SearchQueryList queries={mockQueries} showComparison={false} onFilter={onFilter} />)
    
    const filterButton = screen.getByRole('button', { name: /filter/i })
    await user.click(filterButton)
    
    expect(onFilter).toHaveBeenCalled()
  })

  it('should show pagination controls', () => {
    render(<SearchQueryList queries={mockQueries} showComparison={false} />)
    
    expect(screen.getByText('Showing: 1-2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should handle pagination', async () => {
    const user = userEvent.setup()
    const longQueryList = Array.from({ length: 20 }, (_, i) => ({
      ...mockQueries[0],
      id: i + 1,
      query: `query ${i + 1}`,
    }))
    
    render(<SearchQueryList queries={longQueryList} showComparison={false} itemsPerPage={7} />)
    
    // Should show first 7 items
    expect(screen.getByText('Showing: 1-7 of 20')).toBeInTheDocument()
    expect(screen.getByText('query 1')).toBeInTheDocument()
    expect(screen.queryByText('query 8')).not.toBeInTheDocument()
    
    // Click next
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    // Should show next page
    expect(screen.getByText('Showing: 8-14 of 20')).toBeInTheDocument()
    expect(screen.queryByText('query 1')).not.toBeInTheDocument()
    expect(screen.getByText('query 8')).toBeInTheDocument()
  })

  it('should handle sorting when clicking column headers', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    render(<SearchQueryList queries={mockQueries} showComparison={false} onSort={onSort} />)
    
    const impressionsHeader = screen.getByText('Impressions')
    await user.click(impressionsHeader)
    
    expect(onSort).toHaveBeenCalledWith('impressions')
  })

  it('should show comparison indicators when showComparison is true', () => {
    render(<SearchQueryList queries={mockQueries} showComparison={true} />)
    
    // Should show comparison indicators (arrows with percentages)
    expect(screen.getByText('12.3%')).toBeInTheDocument()
    expect(screen.getByText('15.8%')).toBeInTheDocument()
  })

  it('should handle checkbox selection', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <SearchQueryList 
        queries={mockQueries} 
        showComparison={false} 
        onSelect={onSelect}
      />
    )
    
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1]) // Click first query checkbox
    
    expect(onSelect).toHaveBeenCalledWith([1])
    
    await user.click(checkboxes[2]) // Click second query checkbox
    expect(onSelect).toHaveBeenCalledWith([1, 2])
  })

  it('should handle select all checkbox', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <SearchQueryList 
        queries={mockQueries} 
        showComparison={false} 
        onSelect={onSelect}
      />
    )
    
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
    await user.click(selectAllCheckbox)
    
    expect(onSelect).toHaveBeenCalledWith([1, 2])
  })

  it('should show loading state', () => {
    render(<SearchQueryList loading={true} />)
    
    expect(screen.getByTestId('search-query-list-skeleton')).toBeInTheDocument()
  })

  it('should show error state', () => {
    render(<SearchQueryList error="Failed to load search queries" />)
    
    expect(screen.getByText('Failed to load search queries')).toBeInTheDocument()
  })

  it('should show empty state when no queries', () => {
    render(<SearchQueryList queries={[]} showComparison={false} />)
    
    expect(screen.getByText('No search queries found')).toBeInTheDocument()
  })

  it('should disable pagination buttons appropriately', () => {
    render(<SearchQueryList queries={mockQueries} showComparison={false} />)
    
    const prevButton = screen.getByRole('button', { name: /previous/i })
    const nextButton = screen.getByRole('button', { name: /next/i })
    
    // On first page, previous should be disabled
    expect(prevButton).toBeDisabled()
    // With only 2 items and default 7 per page, next should be disabled
    expect(nextButton).toBeDisabled()
  })
})