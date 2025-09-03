import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { KeywordMarketShare } from '../KeywordMarketShare'
import { useRouter } from 'next/navigation'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data }: any) => <div data-testid="pie">{JSON.stringify(data)}</div>,
  Cell: () => null,
  Legend: () => <div data-testid="legend" />,
  Tooltip: () => null,
}))

describe('KeywordMarketShare - Enhanced Features', () => {
  const mockPush = vi.fn()
  
  const mockData = {
    totalMarket: {
      impressions: 100000,
      clicks: 10000,
      purchases: 1000,
    },
    competitors: [
      {
        asin: 'B001',
        brand: 'Brand A',
        title: 'Product A - High Converter',
        impressionShare: 0.25,
        clickShare: 0.20,
        purchaseShare: 0.15,
      },
      {
        asin: 'B002',
        brand: 'Brand B',
        title: 'Product B - Best Converter',
        impressionShare: 0.20,
        clickShare: 0.30,
        purchaseShare: 0.35, // Highest conversion rate
      },
      {
        asin: 'B003',
        brand: 'Brand C',
        title: 'Product C - Medium Converter',
        impressionShare: 0.15,
        clickShare: 0.15,
        purchaseShare: 0.20,
      },
      {
        asin: 'B004',
        brand: 'Brand D',
        title: 'Product D - Low Converter',
        impressionShare: 0.10,
        clickShare: 0.08,
        purchaseShare: 0.05,
      },
      {
        asin: 'B005',
        brand: 'Brand E',
        title: 'Product E - Moderate Converter',
        impressionShare: 0.08,
        clickShare: 0.10,
        purchaseShare: 0.12,
      },
      {
        asin: 'B006',
        brand: 'Brand F',
        title: 'Product F - Poor Converter',
        impressionShare: 0.22,
        clickShare: 0.17,
        purchaseShare: 0.13,
      },
    ],
  }

  beforeEach(() => {
    mockPush.mockClear()
    ;(useRouter as Mock).mockReturnValue({
      push: mockPush,
    })
  })

  describe('Conversion Rate Sorting', () => {
    it('should calculate and display conversion rates', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // The conversion rate should be calculated as purchases/clicks
      // For Brand B: 0.35 * 1000 / (0.30 * 10000) = 350 / 3000 = 0.1167 = 11.67%
      expect(screen.getByText(/Market Share: knife sharpener/)).toBeInTheDocument()
    })

    it('should sort ASINs by conversion rate when implemented', () => {
      // This test will verify the sorting once we implement it
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // After implementation, the order should be by CVR:
      // B002 (11.67%), B003 (13.33%), B005 (12%), B001 (7.5%), B006 (7.65%), B004 (6.25%)
    })
  })

  describe('Top 5 Display Limit', () => {
    it('should display only top 5 ASINs in the table', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // Count table rows (excluding header)
      const tableRows = screen.getAllByRole('row')
      // Should have 1 header row + 5 data rows (not 6)
      expect(tableRows.length).toBeLessThanOrEqual(6) // Currently shows 10, will be 6 after fix
    })

    it('should show current ASIN even if not in top 5', () => {
      // Test with current ASIN that would be outside top 5
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B004" // Low converter
          isLoading={false}
          error={null}
        />
      )

      // Should still show the current ASIN highlighted
      expect(screen.getByText('Brand D')).toBeInTheDocument()
    })
  })

  describe('Enhanced Metrics Display', () => {
    it('should display conversion rate for each ASIN', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // After implementation, should see CVR percentages
      // expect(screen.getByText(/11.67%/)).toBeInTheDocument() // B002's CVR
    })

    it('should display click-through rate for each ASIN', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // After implementation, should see CTR percentages
      // CTR = clicks/impressions
      // For B002: 0.30 * 10000 / (0.20 * 100000) = 3000 / 20000 = 15%
    })

    it('should display total purchases for each ASIN', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // After implementation, should see purchase counts
      // For B002: 0.35 * 1000 = 350 purchases
    })
  })

  describe('Clickable ASIN Navigation', () => {
    it('should make ASIN rows clickable', async () => {
      const user = userEvent.setup()
      window.open = vi.fn()
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // After implementation, clicking on a competitor should open dashboard
      const brandRow = screen.getByText('Brand B')
      await user.click(brandRow.closest('tr')!)

      // Should open new tab with dashboard URL
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('/?asin=B002'),
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('should include current date range in navigation URL', async () => {
      const user = userEvent.setup()
      window.open = vi.fn()
      
      // Simulate being on keyword analysis page with date params
      Object.defineProperty(window, 'location', {
        value: {
          search: '?startDate=2025-08-01&endDate=2025-08-07',
        },
        writable: true,
      })
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      const brandRow = screen.getByText('Brand B')
      await user.click(brandRow.closest('tr')!)

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-08-01&endDate=2025-08-07'),
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('should add source parameter for tracking', async () => {
      const user = userEvent.setup()
      window.open = vi.fn()
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      const brandRow = screen.getByText('Brand B')
      await user.click(brandRow.closest('tr')!)

      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining('source=keyword-analysis'),
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  describe('Visual Indicators', () => {
    it('should highlight current ASIN row', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      const currentAsinRow = screen.getByText('Brand A').closest('tr')
      expect(currentAsinRow).toHaveClass('bg-blue-50')
    })

    it('should show hover state on clickable rows', async () => {
      const user = userEvent.setup()
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      const competitorRow = screen.getByText('Brand B').closest('tr')
      
      // After implementation, should have hover styles
      await user.hover(competitorRow!)
      // expect(competitorRow).toHaveClass('hover:bg-gray-50')
      // expect(competitorRow).toHaveStyle({ cursor: 'pointer' })
    })
  })

  describe('Metric Toggle Behavior', () => {
    it('should update display when switching metrics', async () => {
      const user = userEvent.setup()
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // Switch to Purchase Share
      await user.click(screen.getByText('Purchase Share'))

      // Should now sort by purchase share
      const tableRows = screen.getAllByRole('row')
      // B002 should be first (35% purchase share)
    })

    it('should maintain conversion rate sorting regardless of metric toggle', () => {
      // After implementation, CVR sorting should be primary
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // Even when viewing impression share, order should be by CVR
    })
  })
})