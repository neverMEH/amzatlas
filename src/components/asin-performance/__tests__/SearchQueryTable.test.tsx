import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SearchQueryTable } from '../SearchQueryTable'

const mockSearchQueries = [
  {
    searchQuery: 'knife sharpener',
    impressions: 15000,
    clicks: 750,
    cartAdds: 225,
    purchases: 112,
    ctr: 0.05,
    cvr: 0.0075,
    cartAddRate: 0.3,
    purchaseRate: 0.498,
    impressionShare: 0.23,
    clickShare: 0.28,
    purchaseShare: 0.31,
  },
  {
    searchQuery: 'electric knife sharpener',
    impressions: 8500,
    clicks: 510,
    cartAdds: 153,
    purchases: 76,
    ctr: 0.06,
    cvr: 0.0089,
    cartAddRate: 0.3,
    purchaseRate: 0.497,
    impressionShare: 0.18,
    clickShare: 0.21,
    purchaseShare: 0.24,
  },
  {
    searchQuery: 'work sharp knife sharpener',
    impressions: 6200,
    clicks: 434,
    cartAdds: 130,
    purchases: 65,
    ctr: 0.07,
    cvr: 0.0105,
    cartAddRate: 0.3,
    purchaseRate: 0.5,
    impressionShare: 0.35,
    clickShare: 0.38,
    purchaseShare: 0.42,
  },
  {
    searchQuery: 'professional knife sharpener',
    impressions: 4300,
    clicks: 258,
    cartAdds: 77,
    purchases: 38,
    ctr: 0.06,
    cvr: 0.0088,
    cartAddRate: 0.298,
    purchaseRate: 0.494,
    impressionShare: 0.12,
    clickShare: 0.14,
    purchaseShare: 0.15,
  },
  {
    searchQuery: 'kitchen knife sharpener',
    impressions: 3800,
    clicks: 228,
    cartAdds: 68,
    purchases: 34,
    ctr: 0.06,
    cvr: 0.0089,
    cartAddRate: 0.298,
    purchaseRate: 0.5,
    impressionShare: 0.09,
    clickShare: 0.10,
    purchaseShare: 0.11,
  },
]

describe('SearchQueryTable', () => {
  it('renders loading state when data is loading', () => {
    render(
      <SearchQueryTable
        data={[]}
        isLoading={true}
        error={null}
      />
    )

    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument()
  })

  it('renders error state when there is an error', () => {
    render(
      <SearchQueryTable
        data={[]}
        isLoading={false}
        error={new Error('Failed to load search query data')}
      />
    )

    expect(screen.getByText('Error loading search queries')).toBeInTheDocument()
    expect(screen.getByText('Failed to load search query data')).toBeInTheDocument()
  })

  it('renders empty state when there is no data', () => {
    render(
      <SearchQueryTable
        data={[]}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('No search query data available')).toBeInTheDocument()
    expect(screen.getByText('Select an ASIN and date range to view search query performance')).toBeInTheDocument()
  })

  it('displays search query data in table format', () => {
    render(
      <SearchQueryTable
        data={mockSearchQueries}
        isLoading={false}
        error={null}
      />
    )

    // Check table headers
    expect(screen.getByText('Search Query')).toBeInTheDocument()
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('Clicks')).toBeInTheDocument()
    expect(screen.getByText('Cart Adds')).toBeInTheDocument()
    expect(screen.getByText('Purchases')).toBeInTheDocument()
    expect(screen.getByText('CTR')).toBeInTheDocument()
    expect(screen.getByText('CVR')).toBeInTheDocument()

    // Check first row data
    expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    expect(screen.getByText('15,000')).toBeInTheDocument()
    expect(screen.getByText('750')).toBeInTheDocument()
    expect(screen.getByText('112')).toBeInTheDocument()
    expect(screen.getByText('5.00%')).toBeInTheDocument()
    expect(screen.getByText('0.75%')).toBeInTheDocument()
  })

  it('sorts data by column when header is clicked', async () => {
    render(
      <SearchQueryTable
        data={mockSearchQueries}
        isLoading={false}
        error={null}
      />
    )

    // By default, data is sorted by impressions descending (highest first)
    let rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('knife sharpener')

    // Click on impressions header to sort ascending
    const impressionsHeader = screen.getByRole('button', { name: /impressions/i })
    fireEvent.click(impressionsHeader)

    await waitFor(() => {
      rows = screen.getAllByRole('row')
      // First data row should have lowest impressions
      expect(rows[1]).toHaveTextContent('kitchen knife sharpener')
    })

    // Click again to sort descending
    fireEvent.click(impressionsHeader)

    await waitFor(() => {
      rows = screen.getAllByRole('row')
      // First data row should have highest impressions again
      expect(rows[1]).toHaveTextContent('knife sharpener')
    })
  })

  it('allows searching/filtering queries', async () => {
    render(
      <SearchQueryTable
        data={mockSearchQueries}
        isLoading={false}
        error={null}
      />
    )

    const searchInput = screen.getByPlaceholderText(/search queries/i)
    
    // Type in search
    fireEvent.change(searchInput, { target: { value: 'electric' } })

    await waitFor(() => {
      // Should only show queries containing 'electric'
      expect(screen.getByText('electric knife sharpener')).toBeInTheDocument()
      expect(screen.queryByText('knife sharpener')).not.toBeInTheDocument()
      expect(screen.queryByText('work sharp knife sharpener')).not.toBeInTheDocument()
    })
  })

  it('handles pagination correctly', async () => {
    // Create a large dataset for pagination
    const largeDataset = Array.from({ length: 25 }, (_, i) => ({
      searchQuery: `query ${i + 1}`,
      impressions: 1000 + i * 100,
      clicks: 50 + i * 5,
      cartAdds: 15 + i * 2,
      purchases: 5 + i,
      ctr: 0.05,
      cvr: 0.005,
      cartAddRate: 0.3,
      purchaseRate: 0.5,
      impressionShare: 0.1,
      clickShare: 0.1,
      purchaseShare: 0.1,
    }))

    render(
      <SearchQueryTable
        data={largeDataset}
        isLoading={false}
        error={null}
      />
    )

    // Should show first 10 items (sorted by impressions descending)
    expect(screen.getByText('query 25')).toBeInTheDocument() // Highest impressions
    expect(screen.getByText('query 16')).toBeInTheDocument() // 10th highest
    expect(screen.queryByText('query 15')).not.toBeInTheDocument() // 11th highest

    // Click next page
    const nextButton = screen.getByLabelText(/next page/i)
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.queryByText('query 25')).not.toBeInTheDocument()
      expect(screen.getByText('query 15')).toBeInTheDocument() // 11th highest
      expect(screen.getByText('query 6')).toBeInTheDocument() // 20th highest
    })

    // Should show page info  
    expect(screen.getByText(/showing.*11.*20.*25/i)).toBeInTheDocument()
  })

  it('displays share metrics when toggled', () => {
    render(
      <SearchQueryTable
        data={mockSearchQueries}
        isLoading={false}
        error={null}
      />
    )

    // Share columns should not be visible initially
    expect(screen.queryByText('Impression Share')).not.toBeInTheDocument()
    expect(screen.queryByText('Click Share')).not.toBeInTheDocument()
    expect(screen.queryByText('Purchase Share')).not.toBeInTheDocument()

    // Toggle to show share metrics
    const shareToggle = screen.getByLabelText(/show share metrics/i)
    fireEvent.click(shareToggle)

    // Share columns should now be visible
    expect(screen.getByText('Impression Share')).toBeInTheDocument()
    expect(screen.getByText('Click Share')).toBeInTheDocument()
    expect(screen.getByText('Purchase Share')).toBeInTheDocument()

    // Check share values are displayed
    expect(screen.getByText('23.0%')).toBeInTheDocument() // First row impression share
  })

  it('highlights high-performing queries', () => {
    render(
      <SearchQueryTable
        data={mockSearchQueries}
        isLoading={false}
        error={null}
      />
    )

    // The 'work sharp knife sharpener' query has the highest CVR and should be highlighted
    const highPerformingRow = screen.getByText('work sharp knife sharpener').closest('tr')
    expect(highPerformingRow).toHaveClass('bg-green-50')
  })

  it('exports data when export button is clicked', () => {
    const onExport = vi.fn()
    
    render(
      <SearchQueryTable
        data={mockSearchQueries}
        isLoading={false}
        error={null}
        onExport={onExport}
      />
    )

    const exportButton = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportButton)

    expect(onExport).toHaveBeenCalledWith(mockSearchQueries)
  })
})