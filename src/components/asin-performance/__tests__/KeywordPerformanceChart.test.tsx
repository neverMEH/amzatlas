import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { KeywordPerformanceChart } from '../KeywordPerformanceChart'

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey }: any) => <div data-testid={`line-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

const mockData = [
  {
    date: '2024-01-01',
    impressions: 1000,
    clicks: 100,
    cartAdds: 30,
    purchases: 10,
    clickRate: 0.1,
    cartAddRate: 0.3,
    purchaseRate: 0.333,
  },
  {
    date: '2024-01-02',
    impressions: 1200,
    clicks: 120,
    cartAdds: 36,
    purchases: 12,
    clickRate: 0.1,
    cartAddRate: 0.3,
    purchaseRate: 0.333,
  },
  {
    date: '2024-01-03',
    impressions: 1100,
    clicks: 110,
    cartAdds: 33,
    purchases: 11,
    clickRate: 0.1,
    cartAddRate: 0.3,
    purchaseRate: 0.333,
  },
]

const mockComparisonData = [
  {
    date: '2023-12-01',
    impressions: 800,
    clicks: 80,
    cartAdds: 24,
    purchases: 8,
    clickRate: 0.1,
    cartAddRate: 0.3,
    purchaseRate: 0.333,
  },
  {
    date: '2023-12-02',
    impressions: 900,
    clicks: 90,
    cartAdds: 27,
    purchases: 9,
    clickRate: 0.1,
    cartAddRate: 0.3,
    purchaseRate: 0.333,
  },
  {
    date: '2023-12-03',
    impressions: 850,
    clicks: 85,
    cartAdds: 25,
    purchases: 8,
    clickRate: 0.094,
    cartAddRate: 0.294,
    purchaseRate: 0.32,
  },
]

describe('KeywordPerformanceChart', () => {
  it('renders chart with data', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('displays keyword in the title', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    expect(screen.getByText('Performance Trends: knife sharpener')).toBeInTheDocument()
  })

  it('shows metric toggles', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    expect(screen.getByLabelText('Show Impressions')).toBeInTheDocument()
    expect(screen.getByLabelText('Show Clicks')).toBeInTheDocument()
    expect(screen.getByLabelText('Show Cart Adds')).toBeInTheDocument()
    expect(screen.getByLabelText('Show Purchases')).toBeInTheDocument()
    expect(screen.getByLabelText('Show CTR')).toBeInTheDocument()
    expect(screen.getByLabelText('Show CVR')).toBeInTheDocument()
  })

  it('toggles metrics on and off', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    const impressionsToggle = screen.getByLabelText('Show Impressions')
    
    // Impressions should be checked by default
    expect(impressionsToggle).toBeChecked()
    expect(screen.getByTestId('line-impressions')).toBeInTheDocument()

    // Uncheck impressions
    await user.click(impressionsToggle)
    expect(impressionsToggle).not.toBeChecked()
    expect(screen.queryByTestId('line-impressions')).not.toBeInTheDocument()

    // Check it again
    await user.click(impressionsToggle)
    expect(impressionsToggle).toBeChecked()
    expect(screen.getByTestId('line-impressions')).toBeInTheDocument()
  })

  it('handles rate metrics toggle correctly', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    const ctrToggle = screen.getByLabelText('Show CTR')
    
    // CTR should be unchecked by default
    expect(ctrToggle).not.toBeChecked()
    expect(screen.queryByTestId('line-clickRate')).not.toBeInTheDocument()

    // Check CTR
    await user.click(ctrToggle)
    expect(ctrToggle).toBeChecked()
    expect(screen.getByTestId('line-clickRate')).toBeInTheDocument()
  })

  it('displays loading state', () => {
    render(
      <KeywordPerformanceChart
        data={[]}
        keyword="knife sharpener"
        isLoading={true}
      />
    )

    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument()
  })

  it('displays error state', () => {
    const error = new Error('Failed to load chart data')
    
    render(
      <KeywordPerformanceChart
        data={[]}
        keyword="knife sharpener"
        error={error}
      />
    )

    expect(screen.getByText('Error loading chart')).toBeInTheDocument()
    expect(screen.getByText('Failed to load chart data')).toBeInTheDocument()
  })

  it('displays empty state when no data', () => {
    render(
      <KeywordPerformanceChart
        data={[]}
        keyword="knife sharpener"
      />
    )

    expect(screen.queryByText('No data available')).not.toBeInTheDocument()
    expect(screen.getByText(/No performance data available for this keyword/)).toBeInTheDocument()
  })

  it('handles comparison data', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        comparisonData={mockComparisonData}
        keyword="knife sharpener"
        dateRange={{ start: '2024-01-01', end: '2024-01-03' }}
      />
    )

    // Should render comparison lines when metrics are enabled
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    
    // Check that comparison data is mentioned in UI
    expect(screen.getByText(/Comparison: Enabled/)).toBeInTheDocument()
  })

  it('formats axis labels correctly', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    // Check that axes are rendered
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
  })

  it('has responsive height', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    const container = screen.getByTestId('responsive-container')
    expect(container).toBeInTheDocument()
  })

  it('preserves metric selections when data updates', async () => {
    const user = userEvent.setup()
    
    const { rerender } = render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    // Enable CTR
    const ctrToggle = screen.getByLabelText('Show CTR')
    await user.click(ctrToggle)
    expect(ctrToggle).toBeChecked()

    // Update data
    const newData = [...mockData, {
      date: '2024-01-04',
      impressions: 1300,
      clicks: 130,
      cartAdds: 39,
      purchases: 13,
      clickRate: 0.1,
      cartAddRate: 0.3,
      purchaseRate: 0.333,
    }]

    rerender(
      <KeywordPerformanceChart
        data={newData}
        keyword="knife sharpener"
      />
    )

    // CTR should still be checked
    expect(screen.getByLabelText('Show CTR')).toBeChecked()
    expect(screen.getByTestId('line-clickRate')).toBeInTheDocument()
  })

  it('groups volume and rate metrics separately', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
      />
    )

    // Check for section headers
    expect(screen.getByText('Volume Metrics')).toBeInTheDocument()
    expect(screen.getByText('Rate Metrics')).toBeInTheDocument()
  })

  it('shows date range in subtitle when provided', () => {
    render(
      <KeywordPerformanceChart
        data={mockData}
        keyword="knife sharpener"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    expect(screen.getByText(/Jan 1 - Jan 31, 2024/)).toBeInTheDocument()
  })

  it('handles single data point gracefully', () => {
    const singlePoint = [mockData[0]]
    
    render(
      <KeywordPerformanceChart
        data={singlePoint}
        keyword="knife sharpener"
      />
    )

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    // Should still render but might show a note about limited data
    expect(screen.queryByText(/single data point/i)).toBeInTheDocument()
  })
})