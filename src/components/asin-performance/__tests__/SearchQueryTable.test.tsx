import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  describe('Rate Metrics Comparison Data', () => {
    it('displays comparison data for CTR and CVR', () => {
      const mockData = [
        {
          searchQuery: 'knife sharpener',
          impressions: 15000,
          clicks: 750,
          cartAdds: 225,
          purchases: 112,
          ctr: 0.05,
          cvr: 0.15,
          cartAddRate: 0.3,
          purchaseRate: 0.498,
          impressionShare: 0.25,
          clickShare: 0.30,
          purchaseShare: 0.35,
        },
      ]

      const mockComparisonData = [
        {
          searchQuery: 'knife sharpener',
          impressions: 12000,
          clicks: 480,
          cartAdds: 120,
          purchases: 60,
          ctr: 0.04,
          cvr: 0.125,
          cartAddRate: 0.25,
          purchaseRate: 0.5,
          impressionShare: 0.20,
          clickShare: 0.25,
          purchaseShare: 0.28,
        },
      ]

      render(
        <SearchQueryTable
          data={mockData}
          comparisonData={mockComparisonData}
          isLoading={false}
          error={null}
        />
      )

      // Should display CTR value
      expect(screen.getByText('5.00%')).toBeInTheDocument()
      
      // Should display CTR comparison change (0.05 vs 0.04 = +25%)
      const ctrElement = screen.getByText('5.00%')
      const ctrContainer = ctrElement.closest('td')
      const ctrChange = ctrContainer?.querySelector('.text-xs')
      expect(ctrChange).toHaveTextContent('+25.0%')
      expect(ctrChange).toHaveClass('text-green-600')

      // Should display CVR value
      expect(screen.getByText('15.00%')).toBeInTheDocument()
      
      // Should display CVR comparison change (0.15 vs 0.125 = +20%)
      const cvrElement = screen.getByText('15.00%')
      const cvrContainer = cvrElement.closest('td')
      const cvrChange = cvrContainer?.querySelector('.text-xs')
      expect(cvrChange).toHaveTextContent('+20.0%')
      expect(cvrChange).toHaveClass('text-green-600')
    })

    it('handles zero and negative changes for rate metrics', () => {
      const mockData = [
        {
          searchQuery: 'test query',
          impressions: 1000,
          clicks: 50,
          cartAdds: 15,
          purchases: 5,
          ctr: 0.05,
          cvr: 0.10,
          cartAddRate: 0.3,
          purchaseRate: 0.333,
          impressionShare: 0.15,
          clickShare: 0.20,
          purchaseShare: 0.25,
        },
      ]

      const mockComparisonData = [
        {
          searchQuery: 'test query',
          impressions: 1000,
          clicks: 60,
          cartAdds: 12,
          purchases: 6,
          ctr: 0.06, // Higher CTR
          cvr: 0.10, // Same CVR
          cartAddRate: 0.2,
          purchaseRate: 0.5,
          impressionShare: 0.15,
          clickShare: 0.20,
          purchaseShare: 0.25,
        },
      ]

      render(
        <SearchQueryTable
          data={mockData}
          comparisonData={mockComparisonData}
          isLoading={false}
          error={null}
        />
      )

      // Check CTR with decrease (0.05 vs 0.06 = -16.7%)
      const ctrElement = screen.getByText('5.00%')
      const ctrContainer = ctrElement.closest('td')
      const ctrChange = ctrContainer?.querySelector('.text-xs')
      expect(ctrChange).toHaveTextContent('-16.7%')
      expect(ctrChange).toHaveClass('text-red-600')

      // Check CVR with no change (0.10 vs 0.10 = 0%)
      const cvrElement = screen.getByText('10.00%')
      const cvrContainer = cvrElement.closest('td')
      const cvrChange = cvrContainer?.querySelector('.text-xs')
      expect(cvrChange).toHaveTextContent('0.0%')
      expect(cvrChange).toHaveClass('text-gray-500')
    })
  })

  describe('Share Metrics Comparison Data', () => {
    it('displays comparison data for share metrics when showShareMetrics is enabled', () => {
      const mockData = [
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
          impressionShare: 0.25,
          clickShare: 0.30,
          purchaseShare: 0.35,
        },
      ]

      const mockComparisonData = [
        {
          searchQuery: 'knife sharpener',
          impressions: 12000,
          clicks: 600,
          cartAdds: 180,
          purchases: 90,
          ctr: 0.05,
          cvr: 0.0075,
          cartAddRate: 0.3,
          purchaseRate: 0.5,
          impressionShare: 0.20,
          clickShare: 0.25,
          purchaseShare: 0.28,
        },
      ]

      render(
        <SearchQueryTable
          data={mockData}
          comparisonData={mockComparisonData}
          isLoading={false}
          error={null}
        />
      )

      // Enable share metrics
      const shareToggle = screen.getByLabelText(/show share metrics/i)
      fireEvent.click(shareToggle)

      // Should display share metric values
      expect(screen.getByText('25.0%')).toBeInTheDocument() // Impression share
      expect(screen.getByText('30.0%')).toBeInTheDocument() // Click share
      expect(screen.getByText('35.0%')).toBeInTheDocument() // Purchase share

      // Should display comparison changes for share metrics
      // Impression share: 0.25 vs 0.20 = +25%
      const impressionShareChanges = screen.getAllByText('+25.0%')
      expect(impressionShareChanges.length).toBeGreaterThan(1) // One for impressions, one for impression share

      // Click share: 0.30 vs 0.25 = +20%
      expect(screen.getByText('+20.0%')).toBeInTheDocument()

      // Purchase share: 0.35 vs 0.28 = +25%
      // Note: There might be multiple +25.0% values (impressions and purchase share)
      const purchaseShareElement = screen.getByText('35.0%')
      const purchaseShareContainer = purchaseShareElement.closest('td')
      const purchaseShareChange = purchaseShareContainer?.querySelector('.text-xs')
      expect(purchaseShareChange).toHaveTextContent('+25.0%')
    })

    it('handles zero and missing comparison values for share metrics', () => {
      const mockData = [
        {
          searchQuery: 'test query',
          impressions: 1000,
          clicks: 100,
          cartAdds: 30,
          purchases: 10,
          ctr: 0.1,
          cvr: 0.1,
          cartAddRate: 0.3,
          purchaseRate: 0.333,
          impressionShare: 0.15,
          clickShare: 0.20,
          purchaseShare: 0.25,
        },
      ]

      const mockComparisonData = [
        {
          searchQuery: 'test query',
          impressions: 800,
          clicks: 80,
          cartAdds: 24,
          purchases: 8,
          ctr: 0.1,
          cvr: 0.1,
          cartAddRate: 0.3,
          purchaseRate: 0.333,
          impressionShare: 0, // Zero share
          clickShare: 0.20, // Same share
          purchaseShare: 0.30, // Higher previous share
        },
      ]

      render(
        <SearchQueryTable
          data={mockData}
          comparisonData={mockComparisonData}
          isLoading={false}
          error={null}
        />
      )

      // Enable share metrics
      const shareToggle = screen.getByLabelText(/show share metrics/i)
      fireEvent.click(shareToggle)

      // Check impression share with zero comparison (0.15 vs 0 = +∞)
      const impressionShareElement = screen.getByText('15.0%')
      const impressionShareContainer = impressionShareElement.closest('td')
      const impressionShareChange = impressionShareContainer?.querySelector('.text-xs')
      expect(impressionShareChange).toHaveTextContent('+∞')

      // Check click share with same value (0.20 vs 0.20 = 0%)
      const clickShareElement = screen.getByText('20.0%')
      const clickShareContainer = clickShareElement.closest('td')
      const clickShareChange = clickShareContainer?.querySelector('.text-xs')
      expect(clickShareChange).toHaveTextContent('0.0%')

      // Check purchase share with decrease (0.25 vs 0.30 = -16.7%)
      const purchaseShareElement = screen.getByText('25.0%')
      const purchaseShareContainer = purchaseShareElement.closest('td')
      const purchaseShareChange = purchaseShareContainer?.querySelector('.text-xs')
      expect(purchaseShareChange).toHaveTextContent('-16.7%')
      expect(purchaseShareChange).toHaveClass('text-red-600')
    })

    it('does not show comparison data for share metrics when comparison data is not provided', () => {
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
        />
      )

      // Enable share metrics
      const shareToggle = screen.getByLabelText(/show share metrics/i)
      fireEvent.click(shareToggle)

      // Should display share values but no comparison indicators
      expect(screen.getByText('23.0%')).toBeInTheDocument() // Impression share
      
      // Should not have any comparison change elements for share metrics
      const shareCell = screen.getByText('23.0%').closest('td')
      const changeIndicator = shareCell?.querySelector('.text-xs')
      expect(changeIndicator).not.toBeInTheDocument()
    })

    it('includes cart add share column when available in data', () => {
      const mockDataWithCartAddShare = [
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
          cartAddShare: 0.32, // New field
          purchaseShare: 0.31,
        },
      ]

      render(
        <SearchQueryTable
          data={mockDataWithCartAddShare}
          isLoading={false}
          error={null}
        />
      )

      // Enable share metrics
      const shareToggle = screen.getByLabelText(/show share metrics/i)
      fireEvent.click(shareToggle)

      // Should display cart add share column header
      expect(screen.getByText('Cart Add Share')).toBeInTheDocument()

      // Should display cart add share value
      expect(screen.getByText('32.0%')).toBeInTheDocument()
    })

    it('displays comparison data for cart add share when available', () => {
      const mockDataWithCartAddShare = [
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
          cartAddShare: 0.32,
          purchaseShare: 0.31,
        },
      ]

      const mockComparisonDataWithCartAddShare = [
        {
          searchQuery: 'knife sharpener',
          impressions: 12000,
          clicks: 600,
          cartAdds: 180,
          purchases: 90,
          ctr: 0.05,
          cvr: 0.0075,
          cartAddRate: 0.3,
          purchaseRate: 0.5,
          impressionShare: 0.20,
          clickShare: 0.25,
          cartAddShare: 0.28,
          purchaseShare: 0.28,
        },
      ]

      render(
        <SearchQueryTable
          data={mockDataWithCartAddShare}
          comparisonData={mockComparisonDataWithCartAddShare}
          isLoading={false}
          error={null}
        />
      )

      // Enable share metrics
      const shareToggle = screen.getByLabelText(/show share metrics/i)
      fireEvent.click(shareToggle)

      // Should display cart add share value
      expect(screen.getByText('32.0%')).toBeInTheDocument()

      // Should display comparison change for cart add share
      // Cart add share: 0.32 vs 0.28 = +14.3%
      const cartAddShareElement = screen.getByText('32.0%')
      const cartAddShareContainer = cartAddShareElement.closest('td')
      const cartAddShareChange = cartAddShareContainer?.querySelector('.text-xs')
      expect(cartAddShareChange).toHaveTextContent('+14.3%')
      expect(cartAddShareChange).toHaveClass('text-green-600')
    })
  })

  describe('Aggregated Data Handling', () => {
    const mockAggregatedData = [
      {
        searchQuery: 'knife sharpener',
        impressions: 25000, // Sum of multiple weeks
        clicks: 2200, // Sum of multiple weeks
        cartAdds: 660,
        purchases: 220,
        ctr: 0.088, // Recalculated: 2200/25000
        cvr: 0.1, // Recalculated: 220/2200
        cartAddRate: 0.3, // Recalculated: 660/2200
        purchaseRate: 0.333, // Recalculated: 220/660
        impressionShare: 0.25, // Weighted average
        clickShare: 0.28,
        purchaseShare: 0.32,
      },
      {
        searchQuery: 'electric knife sharpener',
        impressions: 18500,
        clicks: 1110,
        cartAdds: 333,
        purchases: 166,
        ctr: 0.06,
        cvr: 0.1495,
        cartAddRate: 0.3,
        purchaseRate: 0.498,
        impressionShare: 0.20,
        clickShare: 0.22,
        purchaseShare: 0.25,
      },
    ]

    it('displays aggregated data correctly with single entry per keyword', () => {
      render(
        <SearchQueryTable
          data={mockAggregatedData}
          isLoading={false}
          error={null}
        />
      )

      // Check that each keyword appears only once
      const knifeSharpenerElements = screen.getAllByText('knife sharpener')
      expect(knifeSharpenerElements).toHaveLength(1)

      // Check aggregated values are displayed
      expect(screen.getByText('25,000')).toBeInTheDocument() // Aggregated impressions
      expect(screen.getByText('2,200')).toBeInTheDocument() // Aggregated clicks
      expect(screen.getByText('220')).toBeInTheDocument() // Aggregated purchases

      // Check recalculated rate metrics
      expect(screen.getByText('8.80%')).toBeInTheDocument() // CTR
      expect(screen.getByText('10.00%')).toBeInTheDocument() // CVR
    })

    it('sorts aggregated data correctly by volume metrics', async () => {
      render(
        <SearchQueryTable
          data={mockAggregatedData}
          isLoading={false}
          error={null}
        />
      )

      // Default sort by impressions descending
      let rows = screen.getAllByRole('row')
      expect(rows[1]).toHaveTextContent('knife sharpener') // 25,000 impressions

      // Click to sort by purchases
      const purchasesHeader = screen.getByRole('button', { name: /purchases/i })
      fireEvent.click(purchasesHeader)

      await waitFor(() => {
        rows = screen.getAllByRole('row')
        expect(rows[1]).toHaveTextContent('knife sharpener') // 220 purchases (still highest)
      })
    })

    it('filters aggregated data correctly', async () => {
      render(
        <SearchQueryTable
          data={mockAggregatedData}
          isLoading={false}
          error={null}
        />
      )

      const searchInput = screen.getByPlaceholderText(/search queries/i)
      fireEvent.change(searchInput, { target: { value: 'electric' } })

      await waitFor(() => {
        expect(screen.getByText('electric knife sharpener')).toBeInTheDocument()
        expect(screen.queryByText('knife sharpener')).not.toBeInTheDocument()
      })
    })

    it('displays comparison data correctly with aggregated values', () => {
      const mockComparisonData = [
        {
          searchQuery: 'knife sharpener',
          impressions: 20000,
          clicks: 1800,
          cartAdds: 540,
          purchases: 180,
          ctr: 0.09,
          cvr: 0.1,
          cartAddRate: 0.3,
          purchaseRate: 0.333,
          impressionShare: 0.23,
          clickShare: 0.26,
          purchaseShare: 0.30,
        },
      ]

      render(
        <SearchQueryTable
          data={mockAggregatedData}
          comparisonData={mockComparisonData}
          isLoading={false}
          error={null}
        />
      )

      // Should show percentage changes for aggregated data
      // 25000 vs 20000 impressions = +25%
      expect(screen.getByText('+25.0%')).toBeInTheDocument()
      
      // 2200 vs 1800 clicks = +22.2%
      // Use getAllByText since multiple metrics might have the same percentage change
      const percentageChanges = screen.getAllByText('+22.2%')
      expect(percentageChanges.length).toBeGreaterThan(0)
    })

    it('handles pagination with aggregated data', async () => {
      // Create large aggregated dataset
      const largeAggregatedData = Array.from({ length: 15 }, (_, i) => ({
        searchQuery: `aggregated query ${i + 1}`,
        impressions: 50000 - i * 2000, // Decreasing order
        clicks: 5000 - i * 200,
        cartAdds: 1500 - i * 60,
        purchases: 500 - i * 20,
        ctr: 0.1,
        cvr: 0.1,
        cartAddRate: 0.3,
        purchaseRate: 0.333,
        impressionShare: 0.1,
        clickShare: 0.1,
        purchaseShare: 0.1,
      }))

      render(
        <SearchQueryTable
          data={largeAggregatedData}
          isLoading={false}
          error={null}
        />
      )

      // Should show first 10 items
      expect(screen.getByText('aggregated query 1')).toBeInTheDocument()
      expect(screen.getByText('aggregated query 10')).toBeInTheDocument()
      expect(screen.queryByText('aggregated query 11')).not.toBeInTheDocument()

      // Navigate to next page
      fireEvent.click(screen.getByLabelText(/next page/i))

      await waitFor(() => {
        expect(screen.queryByText('aggregated query 1')).not.toBeInTheDocument()
        expect(screen.getByText('aggregated query 11')).toBeInTheDocument()
        expect(screen.getByText('aggregated query 15')).toBeInTheDocument()
      })
    })

    it('highlights high-performing aggregated queries', () => {
      const mockHighPerformingAggregated = [
        {
          searchQuery: 'top performer',
          impressions: 30000,
          clicks: 3600,
          cartAdds: 1080,
          purchases: 540,
          ctr: 0.12,
          cvr: 0.15, // High CVR
          cartAddRate: 0.3,
          purchaseRate: 0.5,
          impressionShare: 0.3,
          clickShare: 0.35,
          purchaseShare: 0.4,
        },
        {
          searchQuery: 'average performer',
          impressions: 20000,
          clicks: 1000,
          cartAdds: 200,
          purchases: 50,
          ctr: 0.05,
          cvr: 0.05, // Low CVR
          cartAddRate: 0.2,
          purchaseRate: 0.25,
          impressionShare: 0.2,
          clickShare: 0.15,
          purchaseShare: 0.1,
        },
      ]

      render(
        <SearchQueryTable
          data={mockHighPerformingAggregated}
          isLoading={false}
          error={null}
        />
      )

      // High CVR row should be highlighted
      const highPerformingRow = screen.getByText('top performer').closest('tr')
      expect(highPerformingRow).toHaveClass('bg-green-50')
    })

    it('exports aggregated data correctly', () => {
      const onExport = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockAggregatedData}
          isLoading={false}
          error={null}
          onExport={onExport}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /export/i }))

      // Should export the aggregated data
      expect(onExport).toHaveBeenCalledWith(mockAggregatedData)
      expect(onExport.mock.calls[0][0]).toHaveLength(2)
      expect(onExport.mock.calls[0][0][0].impressions).toBe(25000) // Aggregated value
    })
  })

  describe('Keyword Click Functionality', () => {
    it('makes keyword cells clickable with proper styling', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // Get the first keyword cell
      const keywordCell = screen.getByText('knife sharpener')
      
      // Check that it has clickable styling classes
      expect(keywordCell).toHaveClass('hover:text-blue-600')
      expect(keywordCell).toHaveClass('hover:underline')
      
      // Check that the row has cursor pointer
      const keywordRow = keywordCell.closest('tr')
      expect(keywordRow).toHaveClass('cursor-pointer')
    })

    it('makes entire row clickable, not just the keyword text', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // Get the row containing the keyword
      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Click on different parts of the row
      // Click on impressions cell in the same row
      const impressionsCell = keywordRow?.querySelector('td:nth-child(2)')
      await user.click(impressionsCell!)

      expect(onKeywordClick).toHaveBeenCalledTimes(1)
      expect(onKeywordClick).toHaveBeenCalledWith('knife sharpener', mockSearchQueries[0])

      // Click on CTR cell in the same row
      const ctrCell = keywordRow?.querySelector('td:nth-child(6)')
      await user.click(ctrCell!)

      expect(onKeywordClick).toHaveBeenCalledTimes(2)
      expect(onKeywordClick).toHaveBeenCalledWith('knife sharpener', mockSearchQueries[0])
    })

    it('applies cursor pointer style to entire row when clickable', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // Get the row containing the keyword
      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Check that the entire row has cursor pointer
      expect(keywordRow).toHaveClass('cursor-pointer')
    })

    it('shows hover effect on entire row', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Hover over a non-keyword cell in the row
      const impressionsCell = keywordRow?.querySelector('td:nth-child(2)')
      await user.hover(impressionsCell!)
      
      // Row should have hover background
      expect(keywordRow).toHaveClass('hover:bg-gray-50')
    })

    it('supports keyboard navigation on entire row', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Focus the row
      keywordRow?.focus()
      expect(document.activeElement).toBe(keywordRow)
      
      // Press Enter
      await user.keyboard('{Enter}')
      
      expect(onKeywordClick).toHaveBeenCalledTimes(1)
      expect(onKeywordClick).toHaveBeenCalledWith('knife sharpener', mockSearchQueries[0])

      // Press Space
      await user.keyboard(' ')
      
      expect(onKeywordClick).toHaveBeenCalledTimes(2)
    })

    it('updates aria-label for entire row accessibility', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Row should have appropriate ARIA attributes
      expect(keywordRow).toHaveAttribute('aria-label', 'Click to analyze keyword: knife sharpener')
      expect(keywordRow).toHaveAttribute('role', 'button')
      expect(keywordRow).toHaveAttribute('tabIndex', '0')
    })

    it('does not make rows clickable when onKeywordClick is not provided', () => {
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
        />
      )

      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Row should not have clickable attributes
      expect(keywordRow).not.toHaveClass('cursor-pointer')
      expect(keywordRow).not.toHaveAttribute('role', 'button')
      expect(keywordRow).not.toHaveAttribute('tabIndex')
    })

    it('calls onKeywordClick when keyword is clicked', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordCell = screen.getByText('knife sharpener')
      await user.click(keywordCell)

      expect(onKeywordClick).toHaveBeenCalledTimes(1)
      expect(onKeywordClick).toHaveBeenCalledWith('knife sharpener', mockSearchQueries[0])
    })

    it('applies hover styles when hovering over keyword', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordCell = screen.getByText('knife sharpener')
      const keywordRow = keywordCell.closest('tr')
      
      // Check initial state
      expect(keywordRow).not.toHaveClass('bg-gray-100')
      
      // Hover over keyword
      await user.hover(keywordCell)
      
      // Row should have hover background
      expect(keywordRow).toHaveClass('hover:bg-gray-50')
    })

    it('supports keyboard navigation with Enter key', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Focus the row
      keywordRow?.focus()
      expect(document.activeElement).toBe(keywordRow)
      
      // Press Enter
      await user.keyboard('{Enter}')
      
      expect(onKeywordClick).toHaveBeenCalledTimes(1)
      expect(onKeywordClick).toHaveBeenCalledWith('knife sharpener', mockSearchQueries[0])
    })

    it('supports keyboard navigation with Space key', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      // Focus the row
      keywordRow?.focus()
      
      // Press Space
      await user.keyboard(' ')
      
      expect(onKeywordClick).toHaveBeenCalledTimes(1)
      expect(onKeywordClick).toHaveBeenCalledWith('knife sharpener', mockSearchQueries[0])
    })

    it('does not make keywords clickable when onKeywordClick is not provided', () => {
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
        />
      )

      const keywordCell = screen.getByText('knife sharpener')
      
      // Should not have clickable styling
      expect(keywordCell).not.toHaveClass('cursor-pointer')
      expect(keywordCell).not.toHaveClass('hover:text-blue-600')
    })

    it('maintains clickability after sorting', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // Sort by CTR
      const ctrHeader = screen.getByRole('button', { name: /^ctr$/i })
      await user.click(ctrHeader)

      // Click on a keyword after sorting
      const keywordCell = screen.getByText('work sharp knife sharpener')
      await user.click(keywordCell)

      expect(onKeywordClick).toHaveBeenCalledWith('work sharp knife sharpener', expect.objectContaining({
        searchQuery: 'work sharp knife sharpener'
      }))
    })

    it('maintains clickability after filtering', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // Filter for 'electric'
      const searchInput = screen.getByPlaceholderText(/search queries/i)
      await user.type(searchInput, 'electric')

      // Click on filtered keyword
      const keywordCell = await screen.findByText('electric knife sharpener')
      await user.click(keywordCell)

      expect(onKeywordClick).toHaveBeenCalledWith('electric knife sharpener', expect.objectContaining({
        searchQuery: 'electric knife sharpener'
      }))
    })

    it('adds aria-label for accessibility', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordRow = screen.getByText('knife sharpener').closest('tr')
      
      expect(keywordRow).toHaveAttribute('aria-label', 'Click to analyze keyword: knife sharpener')
      expect(keywordRow).toHaveAttribute('role', 'button')
      expect(keywordRow).toHaveAttribute('tabIndex', '0')
    })

    it('maintains proper focus order with tab navigation', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // Tab through elements
      await user.tab()
      
      // Should be able to tab to keyword rows
      const firstKeywordRow = screen.getByText('knife sharpener').closest('tr')
      const secondKeywordRow = screen.getByText('electric knife sharpener').closest('tr')
      
      // Continue tabbing and check focus order
      let activeElement = document.activeElement
      const focusableElements = []
      
      while (activeElement && focusableElements.length < 20) {
        focusableElements.push(activeElement)
        await user.tab()
        if (document.activeElement === focusableElements[0]) break
        activeElement = document.activeElement
      }
      
      // Keyword rows should be in the focus order
      expect(focusableElements).toContain(firstKeywordRow)
      expect(focusableElements).toContain(secondKeywordRow)
    })

    it('handles rapid clicks without issues', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordCell = screen.getByText('knife sharpener')
      
      // Rapid clicks
      await user.tripleClick(keywordCell)
      
      // Should handle all clicks
      expect(onKeywordClick).toHaveBeenCalledTimes(3)
    })

    it('provides visual feedback on click', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const keywordCell = screen.getByText('knife sharpener')
      
      // Should have transition class for smooth feedback
      expect(keywordCell).toHaveClass('transition-colors')
      
      await user.click(keywordCell)
      
      // Callback should fire
      expect(onKeywordClick).toHaveBeenCalled()
    })
  })

  describe('Enhanced Styling and Visual Feedback', () => {
    it('applies smooth transition effects to rows', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // Get all clickable rows by looking for tr elements with role="button"
      const firstRow = screen.getByText('knife sharpener').closest('tr')
      const secondRow = screen.getByText('electric knife sharpener').closest('tr')
      const thirdRow = screen.getByText('work sharp knife sharpener').closest('tr')
      
      // All clickable rows should have transition
      expect(firstRow).toHaveClass('transition-all')
      expect(secondRow).toHaveClass('transition-all')
      expect(thirdRow).toHaveClass('transition-all')
    })

    it('shows different hover states for regular vs high-performing rows', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // High-performing row (highest CVR)
      const highPerformingRow = screen.getByText('work sharp knife sharpener').closest('tr')
      expect(highPerformingRow).toHaveClass('bg-green-50')
      expect(highPerformingRow).toHaveClass('hover:bg-green-100')
      
      // Regular row - use the one with lowest CVR
      const regularRow = screen.getByText('knife sharpener').closest('tr')
      expect(regularRow).not.toHaveClass('bg-green-50')
      expect(regularRow).toHaveClass('hover:bg-gray-50')
    })

    it('maintains visual hierarchy with hover effects', async () => {
      const onKeywordClick = vi.fn()
      const user = userEvent.setup()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      // High-performing row
      const highPerformingRow = screen.getByText('work sharp knife sharpener').closest('tr')
      
      // Should maintain green background even when hovering
      await user.hover(highPerformingRow!)
      expect(highPerformingRow).toHaveClass('bg-green-50')
      expect(highPerformingRow).toHaveClass('hover:bg-green-100')
    })

    it('applies hover shadow effect to clickable rows', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const row = screen.getByText('knife sharpener').closest('tr')
      expect(row).toHaveClass('hover:shadow-sm')
    })

    it('does not apply hover effects when rows are not clickable', () => {
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
        />
      )

      const row = screen.getByText('knife sharpener').closest('tr')
      
      // Should not have cursor pointer or hover shadow
      expect(row).not.toHaveClass('cursor-pointer')
      expect(row).not.toHaveClass('hover:shadow-sm')
      expect(row).not.toHaveClass('transition-all')
    })

    it('shows hover outline for better keyboard navigation visibility', () => {
      const onKeywordClick = vi.fn()
      
      render(
        <SearchQueryTable
          data={mockSearchQueries}
          isLoading={false}
          error={null}
          onKeywordClick={onKeywordClick}
        />
      )

      const row = screen.getByText('knife sharpener').closest('tr')
      expect(row).toHaveClass('focus:outline-2')
      expect(row).toHaveClass('focus:outline-blue-500')
    })
  })
})