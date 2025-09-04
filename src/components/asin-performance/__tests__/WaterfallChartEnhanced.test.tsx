import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WaterfallChartEnhanced, WaterfallDataPoint } from '../WaterfallChartEnhanced'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => {
  const OriginalModule = vi.importActual('recharts')
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children, data, onMouseMove, onMouseLeave }: any) => (
      <div 
        data-testid="bar-chart" 
        data-chart-data={JSON.stringify(data)}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    ),
    Bar: ({ children, shape }: any) => {
      // Extract bar data if shape is provided
      const BarShape = shape
      return (
        <div data-testid="bar">
          {children}
          {BarShape && <div data-testid="custom-bar-shape">Custom Shape</div>}
        </div>
      )
    },
    XAxis: ({ dataKey, angle, textAnchor }: any) => (
      <div data-testid="x-axis" data-datakey={dataKey} data-angle={angle} data-textanchor={textAnchor} />
    ),
    YAxis: ({ tickFormatter }: any) => (
      <div data-testid="y-axis" data-has-formatter={!!tickFormatter} />
    ),
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: ({ content }: any) => (
      <div data-testid="tooltip" data-custom-content={!!content} />
    ),
    Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
    ReferenceLine: ({ y }: any) => <div data-testid="reference-line" data-y={y} />,
    Legend: () => <div data-testid="legend" />,
  }
})

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Minus: () => <div data-testid="minus-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  EyeOff: () => <div data-testid="eye-off-icon" />,
  ChevronDown: () => <div data-testid="chevron-down-icon" />,
  ChevronUp: () => <div data-testid="chevron-up-icon" />,
  Download: () => <div data-testid="download-icon" />,
}))

describe('WaterfallChartEnhanced', () => {
  const mockData: WaterfallDataPoint[] = [
    {
      keyword: 'knife sharpener',
      current: 150000,
      previous: 100000,
      change: 50000,
      changePercent: 50
    },
    {
      keyword: 'electric knife sharpener',
      current: 80000,
      previous: 100000,
      change: -20000,
      changePercent: -20
    },
    {
      keyword: 'whetstone',
      current: 60000,
      previous: 60000,
      change: 0,
      changePercent: 0
    },
    {
      keyword: 'sharpening steel',
      current: 45000,
      previous: 40000,
      change: 5000,
      changePercent: 12.5
    },
    {
      keyword: 'diamond sharpener for knives and tools long name test',
      current: 30000,
      previous: 25000,
      change: 5000,
      changePercent: 20
    }
  ]

  const mockMetrics = {
    impressions: mockData,
    clicks: mockData.map(d => ({
      ...d,
      current: Math.floor(d.current * 0.05),
      previous: Math.floor(d.previous * 0.04),
      change: Math.floor(d.current * 0.05) - Math.floor(d.previous * 0.04),
      changePercent: ((Math.floor(d.current * 0.05) - Math.floor(d.previous * 0.04)) / Math.floor(d.previous * 0.04)) * 100
    })),
    cartAdds: mockData.map(d => ({
      ...d,
      current: Math.floor(d.current * 0.01),
      previous: Math.floor(d.previous * 0.008),
      change: Math.floor(d.current * 0.01) - Math.floor(d.previous * 0.008),
      changePercent: ((Math.floor(d.current * 0.01) - Math.floor(d.previous * 0.008)) / Math.floor(d.previous * 0.008)) * 100
    })),
    purchases: mockData.map(d => ({
      ...d,
      current: Math.floor(d.current * 0.002),
      previous: Math.floor(d.previous * 0.0015),
      change: Math.floor(d.current * 0.002) - Math.floor(d.previous * 0.0015),
      changePercent: ((Math.floor(d.current * 0.002) - Math.floor(d.previous * 0.0015)) / Math.floor(d.previous * 0.0015)) * 100
    }))
  }

  const defaultProps = {
    data: mockData,
    metric: 'impressions' as const,
    title: 'Keyword Performance Waterfall',
    isLoading: false,
    error: null,
  }

  describe('Rendering', () => {
    test('renders chart with title and controls', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      expect(screen.getByText('Keyword Performance Waterfall')).toBeInTheDocument()
      expect(screen.getByText('Sort:')).toBeInTheDocument()
      expect(screen.getByText('Show:')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /waterfall/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /side-by-side/i })).toBeInTheDocument()
    })

    test('renders loading state', () => {
      render(<WaterfallChartEnhanced {...defaultProps} isLoading={true} data={[]} />)

      const animatePulse = document.querySelector('.animate-pulse')
      expect(animatePulse).toBeInTheDocument()
    })

    test('renders error state', () => {
      const error = new Error('Failed to load data')
      render(<WaterfallChartEnhanced {...defaultProps} error={error} data={[]} />)

      expect(screen.getByText('Error loading waterfall chart: Failed to load data')).toBeInTheDocument()
    })

    test('renders empty state when no data', () => {
      render(<WaterfallChartEnhanced {...defaultProps} data={[]} />)

      expect(screen.getByText('No comparison data available')).toBeInTheDocument()
    })

    test('truncates long keyword names', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // Find the truncated keyword in waterfall data
      const longKeyword = chartData.find((d: any) => 
        d.originalData?.keyword === 'diamond sharpener for knives and tools long name test'
      )
      
      expect(longKeyword).toBeDefined()
      expect(longKeyword.displayName).toBe('diamond sharpener for knive...')
    })
  })

  describe('View Mode Toggle', () => {
    test('switches between waterfall and side-by-side views', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      // Default should be waterfall view
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()

      // Switch to side-by-side view
      await user.click(screen.getByRole('button', { name: /side-by-side/i }))
      
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
      expect(screen.getByRole('table')).toBeInTheDocument()
      
      const headers = screen.getAllByRole('columnheader')
      expect(headers[0]).toHaveTextContent('Keyword')
      expect(headers[1]).toHaveTextContent('Previous')
      expect(headers[2]).toHaveTextContent('Current')
      expect(headers[3]).toHaveTextContent('Change')
      expect(headers[4]).toHaveTextContent('Trend')
    })

    test('maintains selected view mode button state', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const waterfallButton = screen.getByRole('button', { name: /waterfall/i })
      const sideBySideButton = screen.getByRole('button', { name: /side-by-side/i })

      // Initially waterfall is selected
      expect(waterfallButton).toHaveClass('bg-white', 'text-gray-900')
      expect(sideBySideButton).toHaveClass('text-gray-600')

      // Switch to side-by-side
      await user.click(sideBySideButton)

      expect(sideBySideButton).toHaveClass('bg-white', 'text-gray-900')
      expect(waterfallButton).toHaveClass('text-gray-600')
    })
  })

  describe('Sorting Functionality', () => {
    test('sorts by impact by default', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const sortSelect = screen.getByText('Sort:').nextElementSibling as HTMLSelectElement
      expect(sortSelect.value).toBe('impact')

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // First item should be "Previous Total", followed by highest impact keyword
      expect(chartData[0].keyword).toBe('Previous Total')
      expect(chartData[1].keyword).toBe('knife sharpener') // Highest absolute change
    })

    test('sorts by percentage change', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const sortSelect = screen.getByText('Sort:').nextElementSibling as HTMLSelectElement
      await user.selectOptions(sortSelect, 'percentage')

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // After Previous Total, should be sorted by percentage change
      expect(chartData[1].keyword).toBe('knife sharpener') // 50% change
    })

    test('sorts alphabetically', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const sortSelect = screen.getByText('Sort:').nextElementSibling as HTMLSelectElement
      await user.selectOptions(sortSelect, 'alphabetical')

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // After Previous Total, should be sorted alphabetically
      expect(chartData[1].originalData.keyword).toBe('diamond sharpener for knives and tools long name test')
    })

    test('sorts by current value', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const sortSelect = screen.getByText('Sort:').nextElementSibling as HTMLSelectElement
      await user.selectOptions(sortSelect, 'current')

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // After Previous Total, should be sorted by current value
      expect(chartData[1].keyword).toBe('knife sharpener') // Highest current value
    })

    test('sorts by previous value', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const sortSelect = screen.getByText('Sort:').nextElementSibling as HTMLSelectElement
      await user.selectOptions(sortSelect, 'previous')

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      // After Previous Total, should be sorted by previous value
      expect(chartData[1].keyword).toBe('knife sharpener') // Tied with electric, but knife comes first
    })
  })

  describe('Show Top N Functionality', () => {
    const manyKeywords: WaterfallDataPoint[] = Array.from({ length: 25 }, (_, i) => ({
      keyword: `keyword-${i}`,
      current: (25 - i) * 10000,
      previous: (25 - i) * 9000,
      change: (25 - i) * 1000,
      changePercent: 11.11
    }))

    test('limits display to selected top N', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} data={manyKeywords} />)

      const showSelect = screen.getByText('Show:').nextElementSibling as HTMLSelectElement
      
      // Default is top 10
      expect(showSelect.value).toBe('10')

      const chartElement = screen.getByTestId('bar-chart')
      let chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      // Should have 10 keywords + 2 totals (Previous Total and Current Total)
      expect(chartData.filter((d: any) => !d.isTotal)).toHaveLength(10)

      // Change to top 5
      await user.selectOptions(showSelect, '5')
      
      chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      expect(chartData.filter((d: any) => !d.isTotal)).toHaveLength(5)
    })

    test('shows summary text with counts', () => {
      render(<WaterfallChartEnhanced {...defaultProps} data={manyKeywords} />)

      expect(screen.getByText('Impressions - showing 10 of 25 keywords')).toBeInTheDocument()
    })

    test('shows all keywords when "All" is selected', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} data={manyKeywords} />)

      const showSelect = screen.getByText('Show:').nextElementSibling as HTMLSelectElement
      await user.selectOptions(showSelect, '999')

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      expect(chartData.filter((d: any) => !d.isTotal)).toHaveLength(25)
    })
  })

  describe('Metric Switching', () => {
    test('switches between metrics when metrics prop is provided', async () => {
      const user = userEvent.setup()
      const mockOnMetricChange = vi.fn()
      
      render(
        <WaterfallChartEnhanced 
          {...defaultProps} 
          metrics={mockMetrics}
          onMetricChange={mockOnMetricChange}
        />
      )

      const metricSelect = screen.getByText('Metric:').nextElementSibling as HTMLSelectElement
      expect(metricSelect).toBeInTheDocument()
      expect(metricSelect.value).toBe('impressions')

      // Switch to clicks
      await user.selectOptions(metricSelect, 'clicks')
      expect(metricSelect.value).toBe('clicks')
      expect(mockOnMetricChange).toHaveBeenCalledWith('clicks')

      // Switch to purchases
      await user.selectOptions(metricSelect, 'purchases')
      expect(metricSelect.value).toBe('purchases')
      expect(mockOnMetricChange).toHaveBeenCalledWith('purchases')
    })

    test('updates chart data when metric changes', async () => {
      const user = userEvent.setup()
      render(
        <WaterfallChartEnhanced 
          {...defaultProps} 
          metrics={mockMetrics}
        />
      )

      const metricSelect = screen.getByText('Metric:').nextElementSibling as HTMLSelectElement
      const chartElement = screen.getByTestId('bar-chart')
      
      // Check initial data (impressions)
      let chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      const initialTotal = chartData.find((d: any) => d.keyword === 'Previous Total')
      // Sum of previous impressions: 100000 + 100000 + 60000 + 40000 + 25000 = 325000
      expect(initialTotal.value).toBe(325000)

      // Switch to clicks
      await user.selectOptions(metricSelect, 'clicks')
      
      chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      const clicksTotal = chartData.find((d: any) => d.keyword === 'Previous Total')
      expect(clicksTotal.value).toBeLessThan(initialTotal.value) // Clicks should be less than impressions
    })

    test('does not show metric selector when metrics prop is not provided', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      expect(screen.queryByText('Metric:')).not.toBeInTheDocument()
    })
  })

  describe('Waterfall Data Transformation', () => {
    test('correctly calculates waterfall data structure', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')

      // Should have: Previous Total + 5 keywords + Current Total
      expect(chartData).toHaveLength(7)

      // First item should be Previous Total
      expect(chartData[0].keyword).toBe('Previous Total')
      expect(chartData[0].value).toBe(325000) // Sum of all previous values
      expect(chartData[0].isTotal).toBe(true)
      expect(chartData[0].type).toBe('total')

      // Check positive change
      const knifeSharpener = chartData.find((d: any) => d.keyword === 'knife sharpener')
      expect(knifeSharpener).toMatchObject({
        value: 50000,
        type: 'positive',
        isTotal: false
      })

      // Check negative change
      const electricSharpener = chartData.find((d: any) => d.keyword === 'electric knife sharpener')
      expect(electricSharpener).toMatchObject({
        value: -20000,
        type: 'negative',
        isTotal: false
      })

      // Check neutral change
      const whetstone = chartData.find((d: any) => d.keyword === 'whetstone')
      expect(whetstone).toMatchObject({
        value: 0,
        type: 'neutral',
        isTotal: false
      })

      // Last item should be Current Total
      const lastItem = chartData[chartData.length - 1]
      expect(lastItem.keyword).toBe('Current Total')
      expect(lastItem.value).toBe(365000) // Previous total + net change
      expect(lastItem.isTotal).toBe(true)
      expect(lastItem.type).toBe('total')
    })

    test('assigns correct colors to bars', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const cells = screen.getAllByTestId('cell')
      
      // Check colors - sorted by impact by default, so order might be different
      expect(cells[0]).toHaveAttribute('data-fill', '#3B82F6') // Blue for Previous Total
      
      // Find specific cells by their color to verify they exist
      const greenCells = cells.filter(cell => cell.getAttribute('data-fill') === '#10B981')
      const redCells = cells.filter(cell => cell.getAttribute('data-fill') === '#EF4444')
      const grayCells = cells.filter(cell => cell.getAttribute('data-fill') === '#6B7280')
      const blueCells = cells.filter(cell => cell.getAttribute('data-fill') === '#3B82F6')
      
      expect(greenCells.length).toBe(3) // 3 positive changes
      expect(redCells.length).toBe(1) // 1 negative change
      expect(grayCells.length).toBe(1) // 1 neutral change
      expect(blueCells.length).toBe(2) // 2 totals (Previous and Current)
    })
  })

  describe('Details Toggle', () => {
    test('toggles summary statistics section', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      // Details should be hidden by default
      expect(screen.queryByText('Summary Statistics')).not.toBeInTheDocument()

      // Click show details
      const toggleButton = screen.getByRole('button', { name: /show details/i })
      await user.click(toggleButton)

      // Details should be visible
      expect(screen.getByText('Summary Statistics')).toBeInTheDocument()
      expect(screen.getByText('Total Previous')).toBeInTheDocument()
      expect(screen.getByText('Total Current')).toBeInTheDocument()
      expect(screen.getByText('Net Change')).toBeInTheDocument()
      expect(screen.getByText('Avg Change %')).toBeInTheDocument()

      // Button text should change
      expect(screen.getByRole('button', { name: /hide details/i })).toBeInTheDocument()
    })

    test('calculates summary statistics correctly', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /show details/i }))

      // Wait for details section to appear
      await waitFor(() => {
        expect(screen.getByText('Summary Statistics')).toBeInTheDocument()
      })

      // Find the grid containing statistics
      const statisticsGrid = screen.getByText('Summary Statistics').nextElementSibling
      expect(statisticsGrid).toBeInTheDocument()
      
      // Check calculated values are present in the document
      // Total Previous: 100000 + 100000 + 60000 + 40000 + 25000 = 325000
      expect(screen.getByText('325,000')).toBeInTheDocument()
      // Total Current: 150000 + 80000 + 60000 + 45000 + 30000 = 365000  
      expect(screen.getByText('365,000')).toBeInTheDocument()
      // Net Change: 365000 - 325000 = 40000
      expect(screen.getByText('40,000')).toBeInTheDocument()
    })
  })

  describe('Side-by-Side View', () => {
    test('displays data in table format', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /side-by-side/i }))

      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      
      // Check for column headers - they are th elements with text content
      const headers = within(table).getAllByRole('columnheader')
      expect(headers).toHaveLength(5)
      expect(headers[0]).toHaveTextContent('Keyword')
      expect(headers[1]).toHaveTextContent('Previous')
      expect(headers[2]).toHaveTextContent('Current')
      expect(headers[3]).toHaveTextContent('Change')
      expect(headers[4]).toHaveTextContent('Trend')
    })

    test('shows trend icons in table', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /side-by-side/i }))

      // Check for trend icons
      expect(screen.getAllByTestId('trending-up-icon')).toHaveLength(3) // 3 positive changes
      expect(screen.getAllByTestId('trending-down-icon')).toHaveLength(1) // 1 negative change
      expect(screen.getAllByTestId('minus-icon')).toHaveLength(1) // 1 neutral change
    })

    test('formats numbers correctly in table', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /side-by-side/i }))

      const rows = screen.getAllByRole('row').slice(1) // Skip header
      const firstRow = rows[0]
      
      // Check knife sharpener row
      expect(within(firstRow).getByText('knife sharpener')).toBeInTheDocument()
      expect(within(firstRow).getByText('100,000')).toBeInTheDocument() // Previous
      expect(within(firstRow).getByText('150,000')).toBeInTheDocument() // Current
      expect(within(firstRow).getByText('50,000 (+50.0%)')).toBeInTheDocument() // Change
    })

    test('respects sorting in table view', async () => {
      const user = userEvent.setup()
      render(<WaterfallChartEnhanced {...defaultProps} />)

      // Switch to alphabetical sort
      await user.selectOptions(screen.getByText('Sort:').nextElementSibling as HTMLSelectElement, 'alphabetical')
      
      // Switch to table view
      await user.click(screen.getByRole('button', { name: /side-by-side/i }))

      const rows = screen.getAllByRole('row').slice(1)
      const firstKeyword = within(rows[0]).getAllByRole('cell')[0].textContent
      
      expect(firstKeyword).toBe('diamond sharpener for knive...') // Truncated long name
    })
  })

  describe('Hover Interactions', () => {
    test('handles mouse hover events', async () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const chartElement = screen.getByTestId('bar-chart')
      
      // Simulate mouse move
      fireEvent.mouseMove(chartElement, { activeTooltipIndex: 1 })
      
      // Simulate mouse leave
      fireEvent.mouseLeave(chartElement)
      
      // Component should render without errors
      expect(chartElement).toBeInTheDocument()
    })
  })

  describe('Chart Components', () => {
    test('renders all chart components', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      expect(screen.getByTestId('x-axis')).toBeInTheDocument()
      expect(screen.getByTestId('y-axis')).toBeInTheDocument()
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument()
      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
      expect(screen.getByTestId('reference-line')).toBeInTheDocument()
      expect(screen.getByTestId('bar')).toBeInTheDocument()
    })

    test('configures x-axis correctly', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const xAxis = screen.getByTestId('x-axis')
      expect(xAxis).toHaveAttribute('data-datakey', 'displayName')
      expect(xAxis).toHaveAttribute('data-angle', '-45')
      expect(xAxis).toHaveAttribute('data-textanchor', 'end')
    })

    test('y-axis has tick formatter', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const yAxis = screen.getByTestId('y-axis')
      expect(yAxis).toHaveAttribute('data-has-formatter', 'true')
    })

    test('tooltip has custom content', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveAttribute('data-custom-content', 'true')
    })

    test('reference line is at zero', () => {
      render(<WaterfallChartEnhanced {...defaultProps} />)

      const referenceLine = screen.getByTestId('reference-line')
      expect(referenceLine).toHaveAttribute('data-y', '0')
    })
  })

  describe('Edge Cases', () => {
    test('handles empty data array gracefully', () => {
      render(<WaterfallChartEnhanced {...defaultProps} data={[]} />)

      expect(screen.getByText('No comparison data available')).toBeInTheDocument()
    })

    test('handles null data gracefully', () => {
      render(<WaterfallChartEnhanced {...defaultProps} data={null as any} />)

      expect(screen.getByText('No comparison data available')).toBeInTheDocument()
    })

    test('handles all positive changes', () => {
      const allPositiveData = mockData.map(d => ({
        ...d,
        change: Math.abs(d.change),
        changePercent: Math.abs(d.changePercent)
      }))

      render(<WaterfallChartEnhanced {...defaultProps} data={allPositiveData} />)

      const cells = screen.getAllByTestId('cell')
      // Should have no red cells (except for totals which are blue)
      const redCells = cells.filter(cell => cell.getAttribute('data-fill') === '#EF4444')
      expect(redCells).toHaveLength(0)
    })

    test('handles all negative changes', () => {
      const allNegativeData = mockData.map(d => ({
        ...d,
        change: -Math.abs(d.change || 1),
        changePercent: -Math.abs(d.changePercent || 1)
      }))

      render(<WaterfallChartEnhanced {...defaultProps} data={allNegativeData} />)

      const cells = screen.getAllByTestId('cell')
      // Should have no green cells (except for totals which are blue)
      const greenCells = cells.filter(cell => cell.getAttribute('data-fill') === '#10B981')
      expect(greenCells).toHaveLength(0)
    })

    test('handles very large numbers', () => {
      const largeData = [{
        keyword: 'huge keyword',
        current: 5000000,
        previous: 4000000,
        change: 1000000,
        changePercent: 25
      }]

      render(<WaterfallChartEnhanced {...defaultProps} data={largeData} />)

      // Should format large numbers correctly
      const chartElement = screen.getByTestId('bar-chart')
      const chartData = JSON.parse(chartElement.getAttribute('data-chart-data') || '[]')
      
      expect(chartData[0].value).toBe(4000000) // Previous Total
      expect(chartData[1].value).toBe(1000000) // Change
      expect(chartData[2].value).toBe(5000000) // Current Total
    })
  })

  describe('Custom Class Names', () => {
    test('applies custom className', () => {
      render(<WaterfallChartEnhanced {...defaultProps} className="custom-chart-class" />)

      const chartContainer = screen.getByText('Keyword Performance Waterfall').closest('.bg-white')
      expect(chartContainer).toHaveClass('custom-chart-class')
    })
  })

  describe('Title Customization', () => {
    test('displays custom title', () => {
      render(<WaterfallChartEnhanced {...defaultProps} title="Custom Waterfall Title" />)

      expect(screen.getByText('Custom Waterfall Title')).toBeInTheDocument()
    })
  })
})