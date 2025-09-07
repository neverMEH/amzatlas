import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaterfallChart, WaterfallDataPoint } from '../WaterfallChart'

// Mock recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Cell: () => <div data-testid="cell" />,
}))

const mockWaterfallData: WaterfallDataPoint[] = [
  {
    keyword: 'electric knife sharpener',
    current: 15000,
    previous: 12000,
    change: 3000,
    changePercent: 25.0
  },
  {
    keyword: 'knife sharpener',
    current: 8000,
    previous: 10000,
    change: -2000,
    changePercent: -20.0
  },
  {
    keyword: 'manual knife sharpener',
    current: 5000,
    previous: 4000,
    change: 1000,
    changePercent: 25.0
  },
  {
    keyword: 'professional knife sharpener',
    current: 3000,
    previous: 3000,
    change: 0,
    changePercent: 0
  },
  {
    keyword: 'kitchen knife sharpener',
    current: 7500,
    previous: 6000,
    change: 1500,
    changePercent: 25.0
  }
]

describe('WaterfallChart', () => {
  it('renders loading state correctly', () => {
    const { container } = render(
      <WaterfallChart
        data={[]}
        metric="impressions"
        isLoading={true}
      />
    )

    // Check for loading skeleton
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders error state correctly', () => {
    const error = new Error('Test error message')
    render(
      <WaterfallChart
        data={[]}
        metric="impressions"
        error={error}
      />
    )

    expect(screen.getByText(/Error loading waterfall chart: Test error message/)).toBeInTheDocument()
  })

  it('renders empty state when no data provided', () => {
    render(
      <WaterfallChart
        data={[]}
        metric="impressions"
      />
    )

    expect(screen.getByText('No comparison data available')).toBeInTheDocument()
  })

  it('renders chart with data correctly', () => {
    render(
      <WaterfallChart
        data={mockWaterfallData}
        metric="impressions"
        title="Test Waterfall Chart"
      />
    )

    expect(screen.getByText('Test Waterfall Chart')).toBeInTheDocument()
    expect(screen.getByText('Impressions comparison - showing 5 of 5 keywords')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('displays correct metric labels', () => {
    const metrics = ['impressions', 'clicks', 'cartAdds', 'purchases'] as const
    const expectedLabels = ['Impressions', 'Clicks', 'Cart Adds', 'Purchases']

    metrics.forEach((metric, index) => {
      const { rerender } = render(
        <WaterfallChart
          data={mockWaterfallData}
          metric={metric}
        />
      )

      expect(screen.getByText(`${expectedLabels[index]} comparison - showing 5 of 5 keywords`)).toBeInTheDocument()

      if (index < metrics.length - 1) {
        rerender(<div />)
      }
    })
  })

  it('handles sort options correctly', () => {
    render(
      <WaterfallChart
        data={mockWaterfallData}
        metric="impressions"
      />
    )

    const sortSelect = screen.getByLabelText('Sort by:')
    
    // Check default sort option
    expect(sortSelect).toHaveValue('absolute')
    
    // Check all sort options are present
    fireEvent.click(sortSelect)
    expect(screen.getByText('Change (Absolute)')).toBeInTheDocument()
    expect(screen.getByText('Change (%)')).toBeInTheDocument()
    expect(screen.getByText('Current Value')).toBeInTheDocument()
    expect(screen.getByText('Previous Value')).toBeInTheDocument()
    expect(screen.getByText('Keyword A-Z')).toBeInTheDocument()
  })

  it('handles show top options correctly', () => {
    render(
      <WaterfallChart
        data={mockWaterfallData}
        metric="impressions"
      />
    )

    const showSelect = screen.getByLabelText('Show:')
    
    // Check default show option
    expect(showSelect).toHaveValue('10')
    
    // Check all show options are present
    fireEvent.click(showSelect)
    expect(screen.getByText('Top 5')).toBeInTheDocument()
    expect(screen.getByText('Top 10')).toBeInTheDocument()
    expect(screen.getByText('Top 15')).toBeInTheDocument()
    expect(screen.getByText('Top 20')).toBeInTheDocument()
  })

  it('changes sort order when sort option is changed', () => {
    render(
      <WaterfallChart
        data={mockWaterfallData}
        metric="impressions"
      />
    )

    const sortSelect = screen.getByLabelText('Sort by:')
    
    // Change to percentage sort
    fireEvent.change(sortSelect, { target: { value: 'percentage' } })
    expect(sortSelect).toHaveValue('percentage')
    
    // Change to alphabetical sort
    fireEvent.change(sortSelect, { target: { value: 'alphabetical' } })
    expect(sortSelect).toHaveValue('alphabetical')
  })

  it('changes number of items shown when show option is changed', () => {
    const largeDataSet = Array.from({ length: 15 }, (_, i) => ({
      keyword: `keyword ${i + 1}`,
      current: 1000 + i * 100,
      previous: 900 + i * 100,
      change: 100,
      changePercent: 11.1
    }))

    render(
      <WaterfallChart
        data={largeDataSet}
        metric="impressions"
      />
    )

    // Should show "showing 10 of 15 keywords" by default
    expect(screen.getByText('Impressions comparison - showing 10 of 15 keywords')).toBeInTheDocument()

    const showSelect = screen.getByLabelText('Show:')
    
    // Change to show top 5
    fireEvent.change(showSelect, { target: { value: '5' } })
    expect(screen.getByText('Impressions comparison - showing 5 of 15 keywords')).toBeInTheDocument()
    
    // Change to show top 15 (all items)
    fireEvent.change(showSelect, { target: { value: '15' } })
    expect(screen.getByText('Impressions comparison - showing 15 of 15 keywords')).toBeInTheDocument()
  })

  it('displays legend correctly', () => {
    render(
      <WaterfallChart
        data={mockWaterfallData}
        metric="impressions"
      />
    )

    expect(screen.getByText('Increase')).toBeInTheDocument()
    expect(screen.getByText('Decrease')).toBeInTheDocument()
    expect(screen.getByText('No Change')).toBeInTheDocument()
  })

  it('applies custom className correctly', () => {
    const { container } = render(
      <WaterfallChart
        data={mockWaterfallData}
        metric="impressions"
        className="custom-class"
      />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('truncates long keyword names correctly', () => {
    const dataWithLongKeyword = [
      {
        keyword: 'this is a very long keyword name that should be truncated',
        current: 1000,
        previous: 800,
        change: 200,
        changePercent: 25.0
      }
    ]

    render(
      <WaterfallChart
        data={dataWithLongKeyword}
        metric="impressions"
      />
    )

    // The chart should render without errors even with long keywords
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('handles data with zero values correctly', () => {
    const dataWithZeros = [
      {
        keyword: 'zero current',
        current: 0,
        previous: 100,
        change: -100,
        changePercent: -100.0
      },
      {
        keyword: 'zero previous',
        current: 100,
        previous: 0,
        change: 100,
        changePercent: Infinity
      }
    ]

    render(
      <WaterfallChart
        data={dataWithZeros}
        metric="impressions"
      />
    )

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    expect(screen.getByText('Impressions comparison - showing 2 of 2 keywords')).toBeInTheDocument()
  })

  it('handles negative changes correctly', () => {
    const dataWithNegativeChanges = [
      {
        keyword: 'declining keyword',
        current: 500,
        previous: 1000,
        change: -500,
        changePercent: -50.0
      }
    ]

    render(
      <WaterfallChart
        data={dataWithNegativeChanges}
        metric="impressions"
      />
    )

    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })
})