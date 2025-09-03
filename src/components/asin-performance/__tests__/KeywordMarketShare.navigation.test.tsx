import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KeywordMarketShare, getDashboardUrl } from '../KeywordMarketShare'

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data }: any) => <div data-testid="pie">{JSON.stringify(data)}</div>,
  Cell: () => null,
  Legend: () => <div data-testid="legend" />,
  Tooltip: () => null,
}))

describe('KeywordMarketShare - Cross-Tab Navigation', () => {
  const mockWindowOpen = vi.fn()
  const originalWindowOpen = window.open
  const originalLocation = window.location

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
        title: 'Product A',
        impressionShare: 0.25,
        clickShare: 0.20,
        purchaseShare: 0.15,
      },
      {
        asin: 'B002',
        brand: 'Brand B',
        title: 'Product B',
        impressionShare: 0.20,
        clickShare: 0.30,
        purchaseShare: 0.35,
      },
    ],
  }

  beforeEach(() => {
    mockWindowOpen.mockClear()
    window.open = mockWindowOpen
    
    // Mock window.location
    delete (window as any).location
    window.location = {
      ...originalLocation,
      search: '?startDate=2025-08-01&endDate=2025-08-07&keyword=knife+sharpener',
    } as Location
  })

  afterEach(() => {
    window.open = originalWindowOpen
    window.location = originalLocation
  })

  describe('Dashboard URL Generation', () => {
    it('should generate correct dashboard URL with ASIN', () => {
      const url = getDashboardUrl('B001234567')
      expect(url).toContain('/?asin=B001234567')
      expect(url).toContain('source=keyword-analysis')
    })

    it('should include date range from URL params', () => {
      const params = new URLSearchParams('startDate=2025-08-01&endDate=2025-08-07')
      const url = getDashboardUrl('B001234567', params)
      
      expect(url).toContain('asin=B001234567')
      expect(url).toContain('startDate=2025-08-01')
      expect(url).toContain('endDate=2025-08-07')
      expect(url).toContain('source=keyword-analysis')
    })

    it('should extract date range from current window location', () => {
      const url = getDashboardUrl('B001234567')
      
      expect(url).toContain('startDate=2025-08-01')
      expect(url).toContain('endDate=2025-08-07')
    })
  })

  describe('Click Navigation', () => {
    it('should open new tab when clicking on competitor ASIN', async () => {
      const user = userEvent.setup()
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001" // Current ASIN
          isLoading={false}
          error={null}
        />
      )

      // Click on Brand B (competitor)
      const brandBRow = screen.getByText('Brand B').closest('tr')!
      await user.click(brandBRow)

      expect(mockWindowOpen).toHaveBeenCalledTimes(1)
      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('/?asin=B002'),
        '_blank',
        'noopener,noreferrer'
      )
    })

    it('should not navigate when clicking on current ASIN', async () => {
      const user = userEvent.setup()
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001" // Current ASIN
          isLoading={false}
          error={null}
        />
      )

      // Click on Brand A (current ASIN)
      const brandARow = screen.getByText('Brand A').closest('tr')!
      await user.click(brandARow)

      expect(mockWindowOpen).not.toHaveBeenCalled()
    })

    it('should include all required parameters in navigation URL', async () => {
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

      const brandBRow = screen.getByText('Brand B').closest('tr')!
      await user.click(brandBRow)

      const callUrl = mockWindowOpen.mock.calls[0][0]
      expect(callUrl).toContain('asin=B002')
      expect(callUrl).toContain('startDate=2025-08-01')
      expect(callUrl).toContain('endDate=2025-08-07')
      expect(callUrl).toContain('source=keyword-analysis')
    })

    it('should show cursor pointer on hover for clickable rows', async () => {
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

      const brandBRow = screen.getByText('Brand B').closest('tr')!
      expect(brandBRow).toHaveClass('cursor-pointer')
      
      // Current ASIN should not have cursor pointer
      const brandARow = screen.getByText('Brand A').closest('tr')!
      expect(brandARow).not.toHaveClass('cursor-pointer')
    })

    it('should display external link icon for competitors', () => {
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // Should have external link icon for Brand B
      const rows = screen.getAllByRole('row')
      const brandBRow = rows.find(row => row.textContent?.includes('Brand B'))
      expect(brandBRow?.querySelector('svg')).toBeTruthy()
    })
  })

  describe('Real-world Scenario', () => {
    it('should handle complete navigation flow from keyword analysis', async () => {
      const user = userEvent.setup()
      
      // Simulate being on keyword analysis page
      window.location.search = '?asin=B001&keyword=knife+sharpener&startDate=2025-08-01&endDate=2025-08-07'
      
      render(
        <KeywordMarketShare
          data={mockData}
          keyword="knife sharpener"
          asin="B001"
          isLoading={false}
          error={null}
        />
      )

      // User sees market share data sorted by conversion rate
      const rows = screen.getAllByRole('row')
      expect(rows[1]).toHaveTextContent('Brand B') // First data row should be Brand B (highest CVR)

      // User clicks on Brand B to analyze competitor
      await user.click(rows[1])

      // Should open dashboard with Brand B ASIN and current date range
      expect(mockWindowOpen).toHaveBeenCalledWith(
        '/?asin=B002&source=keyword-analysis&startDate=2025-08-01&endDate=2025-08-07',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })
})