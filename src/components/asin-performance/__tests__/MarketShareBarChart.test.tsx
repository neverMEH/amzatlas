import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarketShareBarChart } from '../MarketShareBarChart'
import '@testing-library/jest-dom'

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts')
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children, data }: any) => (
      <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
        {children}
      </div>
    ),
    Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
  }
})

describe('MarketShareBarChart', () => {
  const mockData = {
    totalMarket: {
      impressions: 1000000,
      clicks: 50000,
      purchases: 2000,
    },
    competitors: [
      {
        asin: 'B001',
        brand: 'Brand A',
        title: 'Product A - High Quality Professional Tool',
        impressionShare: 0.3,
        clickShare: 0.35,
        purchaseShare: 0.4,
      },
      {
        asin: 'B002',
        brand: 'Brand B',
        title: 'Product B - Budget Friendly Option',
        impressionShare: 0.25,
        clickShare: 0.22,
        purchaseShare: 0.18,
      },
      {
        asin: 'B003',
        brand: 'Brand C',
        title: 'Product C - Premium Selection',
        impressionShare: 0.2,
        clickShare: 0.19,
        purchaseShare: 0.22,
      },
      {
        asin: 'B004',
        brand: 'Brand D',
        title: 'Product D - Bestseller',
        impressionShare: 0.15,
        clickShare: 0.16,
        purchaseShare: 0.15,
      },
      {
        asin: 'B005',
        brand: 'Brand E',
        title: 'Product E - New Entry',
        impressionShare: 0.1,
        clickShare: 0.08,
        purchaseShare: 0.05,
      },
    ],
  }

  const defaultProps = {
    data: mockData,
    keyword: 'knife sharpener',
    asin: 'B001',
    isLoading: false,
    error: null,
  }

  describe('Rendering', () => {
    test('renders chart with title and controls', () => {
      render(<MarketShareBarChart {...defaultProps} />)

      expect(screen.getByText('Market Share Analysis: knife sharpener')).toBeInTheDocument()
      expect(screen.getByText(/Competitive landscape/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /impressions/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /clicks/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /purchases/i })).toBeInTheDocument()
    })

    test('renders loading state', () => {
      render(<MarketShareBarChart {...defaultProps} isLoading={true} data={null} />)

      expect(screen.getByTestId('bar-chart-skeleton')).toBeInTheDocument()
    })

    test('renders error state', () => {
      const error = new Error('Failed to load data')
      render(<MarketShareBarChart {...defaultProps} error={error} data={null} />)

      expect(screen.getByText('Error loading market share')).toBeInTheDocument()
      expect(screen.getByText('Failed to load data')).toBeInTheDocument()
    })

    test('renders empty state when no data', () => {
      render(<MarketShareBarChart {...defaultProps} data={null} />)

      expect(screen.getByText('No market share data available')).toBeInTheDocument()
    })
  })

  describe('Metric Selection', () => {
    test('switches between metrics', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      // Default should be impressions
      expect(screen.getByRole('button', { name: /impressions/i })).toHaveClass('bg-blue-600')

      // Click on clicks metric
      await user.click(screen.getByRole('button', { name: /clicks/i }))
      expect(screen.getByRole('button', { name: /clicks/i })).toHaveClass('bg-blue-600')
      expect(screen.getByRole('button', { name: /impressions/i })).not.toHaveClass('bg-blue-600')

      // Click on CTR metric
      await user.click(screen.getByRole('button', { name: /click-through rate/i }))
      expect(screen.getByRole('button', { name: /click-through rate/i })).toHaveClass('bg-blue-600')
    })

    test('updates y-axis label based on metric', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      // Check impressions (count)
      expect(screen.getByText(/Competitive landscape by impressions/i)).toBeInTheDocument()

      // Switch to CTR (percentage)
      await user.click(screen.getByRole('button', { name: /click-through rate/i }))
      expect(screen.getByText(/Competitive landscape by click-through rate/i)).toBeInTheDocument()
    })
  })

  describe('Filtering and Sorting', () => {
    test('filters top N results', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      const showTopSelect = screen.getByLabelText('Show top:')
      
      // Default is 10
      expect(showTopSelect).toHaveValue('10')

      // Change to top 5
      await user.selectOptions(showTopSelect, '5')
      
      // Chart should update with only 5 items
      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      expect(chartData).toHaveLength(5)
    })

    test('toggles sort by conversion rate', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      const sortCheckbox = screen.getByLabelText('Sort by conversion rate')
      
      // Should be checked by default
      expect(sortCheckbox).toBeChecked()

      // Uncheck
      await user.click(sortCheckbox)
      expect(sortCheckbox).not.toBeChecked()

      // Data should be sorted differently
      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // When not sorted by conversion, should be sorted by selected metric
      expect(chartData[0].asin).toBe('B001') // Highest impression share
    })

    test('handles different metric sorting correctly', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      // Uncheck sort by conversion
      const sortCheckbox = screen.getByLabelText('Sort by conversion rate')
      await user.click(sortCheckbox)

      // Switch to purchases
      await user.click(screen.getByRole('button', { name: /purchases/i }))

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // Should be sorted by purchase count
      expect(chartData[0].value).toBe(800) // 0.4 * 2000
    })
  })

  describe('Chart Data Calculation', () => {
    test('calculates absolute values correctly', () => {
      render(<MarketShareBarChart {...defaultProps} />)

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')

      // First item should have impressions calculated
      const firstItem = chartData.find((d: any) => d.asin === 'B001')
      expect(firstItem.value).toBe(300000) // 0.3 * 1000000
    })

    test('calculates CTR correctly', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      // Switch to CTR
      await user.click(screen.getByRole('button', { name: /click-through rate/i }))

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')

      // CTR should be calculated as percentage
      const firstItem = chartData.find((d: any) => d.asin === 'B001')
      // CTR = (clicks/impressions) * 100 = ((0.35 * 50000) / (0.3 * 1000000)) * 100
      expect(firstItem.value).toBeCloseTo(5.833, 1)
    })

    test('calculates CVR correctly', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      // Switch to CVR
      await user.click(screen.getByRole('button', { name: /conversion rate/i }))

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')

      // CVR should be calculated as percentage
      const firstItem = chartData.find((d: any) => d.asin === 'B001')
      // CVR = (purchases/clicks) * 100 = ((0.4 * 2000) / (0.35 * 50000)) * 100
      expect(firstItem.value).toBeCloseTo(4.571, 1)
    })
  })

  describe('Visual Indicators', () => {
    test('highlights current ASIN', () => {
      render(<MarketShareBarChart {...defaultProps} />)

      const cells = screen.getAllByTestId('cell')
      const currentAsinCell = cells[0] // First cell should be current ASIN
      
      expect(currentAsinCell).toHaveAttribute('data-fill', '#3b82f6') // Blue color
    })

    test('uses different colors for competitors', () => {
      render(<MarketShareBarChart {...defaultProps} />)

      const cells = screen.getAllByTestId('cell')
      const competitorCells = cells.slice(1)
      
      competitorCells.forEach((cell, index) => {
        expect(cell).toHaveAttribute('data-fill')
        const fill = cell.getAttribute('data-fill')
        expect(fill).not.toBe('#3b82f6') // Not blue (current ASIN color)
      })
    })

    test('displays legend correctly', () => {
      render(<MarketShareBarChart {...defaultProps} />)

      expect(screen.getByText(`Current ASIN (${defaultProps.asin})`)).toBeInTheDocument()
      expect(screen.getByText('Competitors')).toBeInTheDocument()
    })
  })

  describe('Large Dataset Handling', () => {
    const largeDataset = {
      ...mockData,
      competitors: Array.from({ length: 50 }, (_, i) => ({
        asin: `B${String(i).padStart(3, '0')}`,
        brand: `Brand ${i}`,
        title: `Product ${i} - Description`,
        impressionShare: (50 - i) / 1000,
        clickShare: (50 - i) / 1200,
        purchaseShare: (50 - i) / 1100,
      })),
    }

    test('handles large datasets efficiently', () => {
      render(<MarketShareBarChart {...defaultProps} data={largeDataset} />)

      const showTopSelect = screen.getByLabelText('Show top:')
      expect(showTopSelect).toBeInTheDocument()

      // Should still show controls
      expect(screen.getByRole('button', { name: /impressions/i })).toBeInTheDocument()
    })

    test('limits display to selected top N', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} data={largeDataset} />)

      // Select top 20
      const showTopSelect = screen.getByLabelText('Show top:')
      await user.selectOptions(showTopSelect, '20')

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      expect(chartData).toHaveLength(20)
    })
  })

  describe('Comparison Data', () => {
    const comparisonData = {
      ...mockData,
      competitors: mockData.competitors.map(c => ({
        ...c,
        impressionShare: c.impressionShare * 0.9, // 10% decrease
      })),
    }

    test('handles comparison data when provided', () => {
      render(
        <MarketShareBarChart
          {...defaultProps}
          comparisonData={comparisonData}
        />
      )

      // Should still render without errors
      expect(screen.getByText('Market Share Analysis: knife sharpener')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<MarketShareBarChart {...defaultProps} />)

      expect(screen.getByLabelText('Show top:')).toBeInTheDocument()
      expect(screen.getByLabelText('Sort by conversion rate')).toBeInTheDocument()
    })

    test('metric buttons have proper focus states', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      const impressionsButton = screen.getByRole('button', { name: /impressions/i })
      
      // Tab to button
      await user.tab()
      expect(impressionsButton).toHaveFocus()
    })

    test('provides keyboard navigation for controls', async () => {
      const user = userEvent.setup()
      render(<MarketShareBarChart {...defaultProps} />)

      // Tab through controls
      await user.tab() // First metric button
      await user.tab() // Second metric button
      await user.tab() // Third metric button
      await user.tab() // Show top select
      
      const showTopSelect = screen.getByLabelText('Show top:')
      expect(showTopSelect).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    test('handles zero values gracefully', () => {
      const zeroData = {
        ...mockData,
        competitors: mockData.competitors.map(c => ({
          ...c,
          clickShare: 0,
          purchaseShare: 0,
        })),
      }

      render(<MarketShareBarChart {...defaultProps} data={zeroData} />)

      // Should render without errors
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    test('handles missing competitor data', () => {
      const incompleteData = {
        ...mockData,
        competitors: [],
      }

      render(<MarketShareBarChart {...defaultProps} data={incompleteData} />)

      // Should show empty chart
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    test('truncates long product names', () => {
      const longNameData = {
        ...mockData,
        competitors: [{
          ...mockData.competitors[0],
          title: 'This is a very long product name that should be truncated for display purposes in the chart',
        }],
      }

      render(<MarketShareBarChart {...defaultProps} data={longNameData} />)

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // Title should be truncated
      expect(chartData[0].title.length).toBeLessThanOrEqual(23) // 20 chars + '...'
    })
  })
})