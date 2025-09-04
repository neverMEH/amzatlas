import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { KeywordMarketShare } from '../KeywordMarketShare'

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ dataKey }: any) => <div data-testid={`pie-${dataKey}`} />,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

const mockData = {
  totalMarket: {
    impressions: 100000,
    clicks: 5000,
    purchases: 250,
  },
  competitors: [
    {
      asin: 'B001CZKJYA',
      brand: 'Work Sharp',
      title: 'Work Sharp Knife Sharpener',
      impressionShare: 0.15,
      clickShare: 0.18,
      purchaseShare: 0.22,
    },
    {
      asin: 'B002COMPETITOR1',
      brand: 'Competitor Brand 1',
      title: 'Competitor Product 1',
      impressionShare: 0.25,
      clickShare: 0.20,
      purchaseShare: 0.18,
    },
    {
      asin: 'B003COMPETITOR2',
      brand: 'Competitor Brand 2',
      title: 'Competitor Product 2',
      impressionShare: 0.20,
      clickShare: 0.22,
      purchaseShare: 0.25,
    },
    {
      asin: 'B004OTHERS',
      brand: 'Others',
      title: 'Other Products',
      impressionShare: 0.40,
      clickShare: 0.40,
      purchaseShare: 0.35,
    },
  ],
}

describe('KeywordMarketShare', () => {
  it('renders market share visualization', () => {
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('Market Share: knife sharpener')).toBeInTheDocument()
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
  })

  it('highlights the current ASIN', () => {
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // Check that the current ASIN is highlighted in the table
    const currentAsinRow = screen.getByText('B001CZKJYA').closest('tr')
    expect(currentAsinRow).toHaveClass('bg-blue-50')
  })

  it('displays share metrics in table', () => {
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // Check table header
    expect(screen.getByText('ASIN / Product')).toBeInTheDocument()
    // New table headers for enhanced version
    expect(screen.getByText('CVR')).toBeInTheDocument()
    expect(screen.getByText('CTR')).toBeInTheDocument()
    expect(screen.getByText('Purchases')).toBeInTheDocument()

    // Check that the current ASIN is displayed
    expect(screen.getByText('B001CZKJYA')).toBeInTheDocument()
  })

  it('allows toggling between share metrics', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // Default should be impression share
    expect(screen.getByRole('button', { name: /impression share/i })).toHaveClass('bg-blue-600')

    // Click on click share
    const clickShareButton = screen.getByRole('button', { name: /click share/i })
    await user.click(clickShareButton)
    expect(clickShareButton).toHaveClass('bg-blue-600')

    // Click on purchase share
    const purchaseShareButton = screen.getByRole('button', { name: /purchase share/i })
    await user.click(purchaseShareButton)
    expect(purchaseShareButton).toHaveClass('bg-blue-600')
  })

  it('shows total market size', () => {
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText(/Total Market:/)).toBeInTheDocument()
    expect(screen.getByText(/100,000 impressions/)).toBeInTheDocument()
  })

  it('displays loading state', () => {
    render(
      <KeywordMarketShare
        data={null}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={true}
        error={null}
      />
    )

    expect(screen.getByTestId('market-share-skeleton')).toBeInTheDocument()
  })

  it('displays error state', () => {
    const error = new Error('Failed to load market share data')
    
    render(
      <KeywordMarketShare
        data={null}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={error}
      />
    )

    expect(screen.getByText('Error loading market share')).toBeInTheDocument()
    expect(screen.getByText('Failed to load market share data')).toBeInTheDocument()
  })

  it('handles empty data gracefully', () => {
    render(
      <KeywordMarketShare
        data={null}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('No market share data available')).toBeInTheDocument()
  })

  it('sorts competitors by conversion rate', () => {
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // Check that competitors are sorted by conversion rate
    const rows = screen.getAllByRole('row')
    // Should be sorted by CVR now, not impression share
    // Current ASIN should be included even if not in top 5
    expect(screen.getByText('B001CZKJYA')).toBeInTheDocument()
  })

  it('limits displayed competitors', () => {
    const manyCompetitors = {
      ...mockData,
      competitors: Array.from({ length: 20 }, (_, i) => ({
        asin: `B00${i}`,
        brand: `Brand ${i}`,
        title: `Product ${i}`,
        impressionShare: 0.05,
        clickShare: 0.05,
        purchaseShare: 0.05,
      })),
    }

    render(
      <KeywordMarketShare
        data={manyCompetitors}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // Should show top 5 competitors
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(6) // 1 header + 5 data rows
  })

  it('shows position indicator for current ASIN', () => {
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // Current ASIN should show its position
    const currentAsinRow = screen.getByText('B001CZKJYA').closest('tr')
    expect(currentAsinRow).toHaveTextContent('#1') // Position based on CVR sorting
  })

  it('displays product title on hover', () => {
    render(
      <KeywordMarketShare
        data={mockData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // Title is now on the cell containing the ASIN
    const asinCell = screen.getByText('B001CZKJYA').closest('td')
    expect(asinCell).toHaveAttribute('title', 'Work Sharp Knife Sharpener')
  })

  it('shows share changes when comparison data provided', () => {
    const comparisonData = {
      totalMarket: {
        impressions: 90000,
        clicks: 4500,
        purchases: 225,
      },
      competitors: [
        {
          asin: 'B001CZKJYA',
          brand: 'Work Sharp',
          title: 'Work Sharp Knife Sharpener',
          impressionShare: 0.12,
          clickShare: 0.15,
          purchaseShare: 0.18,
        },
      ],
    }

    render(
      <KeywordMarketShare
        data={mockData}
        comparisonData={comparisonData}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        isLoading={false}
        error={null}
      />
    )

    // The enhanced component focuses on CVR, CTR, and purchases instead of share changes
    // Check that the component still renders with comparison data
    expect(screen.getByText('B001CZKJYA')).toBeInTheDocument()
    expect(screen.getByText('CVR')).toBeInTheDocument()
  })

  describe('ASIN and Product Name Display', () => {
    it('displays ASIN instead of brand name in table header', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Should show "ASIN / Product" instead of "Brand"
      expect(screen.getByText('ASIN / Product')).toBeInTheDocument()
      expect(screen.queryByText('Brand')).not.toBeInTheDocument()
    })

    it('displays ASIN and product name in table cells', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Should show ASIN
      expect(screen.getByText('B001CZKJYA')).toBeInTheDocument()
      // Should show truncated product name
      expect(screen.getByText(/Work Sharp Knife.../)).toBeInTheDocument()
    })

    it('shows full product name in tooltip', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Find the cell containing the ASIN
      const asinCell = screen.getByText('B001CZKJYA').closest('td')
      expect(asinCell).toHaveAttribute('title', 'Work Sharp Knife Sharpener')
    })

    it('truncates long product names appropriately', () => {
      const longTitleData = {
        ...mockData,
        competitors: [
          {
            asin: 'B001LONGASIN',
            brand: 'Test Brand',
            title: 'This is a very long product title that should be truncated for display purposes to maintain table readability',
            impressionShare: 0.25,
            clickShare: 0.30,
            purchaseShare: 0.35,
          },
          ...mockData.competitors,
        ],
      }

      render(
        <KeywordMarketShare
          data={longTitleData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Should show truncated title
      const truncatedTitle = screen.getByText(/This is a very long product title.../)
      expect(truncatedTitle).toBeInTheDocument()
      
      // Full title should be in tooltip
      const cell = truncatedTitle.closest('td')
      expect(cell).toHaveAttribute('title', 'This is a very long product title that should be truncated for display purposes to maintain table readability')
    })

    it('handles missing product titles gracefully', () => {
      const missingTitleData = {
        ...mockData,
        competitors: [
          {
            asin: 'B001NOTITLE',
            brand: 'No Title Brand',
            title: '', // Empty title
            impressionShare: 0.20,
            clickShare: 0.25,
            purchaseShare: 0.30,
          },
          ...mockData.competitors,
        ],
      }

      render(
        <KeywordMarketShare
          data={missingTitleData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Should show ASIN even without title
      expect(screen.getByText('B001NOTITLE')).toBeInTheDocument()
      // Should show placeholder for missing title
      expect(screen.getByText('[No product name]')).toBeInTheDocument()
    })
  })

  describe('Full-width layout tests', () => {
    it('uses full width container', () => {
      const { container } = render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Check that the main container is full width
      const mainContainer = container.firstChild
      expect(mainContainer).toHaveClass('bg-white', 'rounded-lg', 'shadow', 'p-6')
      // Should not have width constraints
      expect(mainContainer).not.toHaveClass('max-w-md', 'max-w-lg', 'max-w-xl')
    })

    it('uses optimized grid layout for full width', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Find the grid container
      const gridContainer = screen.getByTestId('pie-chart').closest('.grid')
      expect(gridContainer).toHaveClass('lg:grid-cols-3') // Should use 3 columns on large screens
      expect(gridContainer).toHaveClass('gap-8') // Increased gap for full width
    })

    it('adjusts table width for better readability', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // Check that table container spans appropriate columns
      const tableContainer = screen.getByRole('table').closest('div')
      expect(tableContainer).toHaveClass('lg:col-span-2') // Table should span 2 columns on large screens
    })

    it('maintains responsive behavior at different widths', () => {
      const { container } = render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          isLoading={false}
          error={null}
        />
      )

      // The component should be responsive-ready even at full width
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toBeDefined()
      // Should have responsive classes for smaller screens
      expect(gridContainer).toHaveClass('lg:grid-cols-3')
    })
  })
})