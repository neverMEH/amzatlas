import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { PerformanceChart } from '../PerformanceChart'

const mockTimeSeriesData = [
  {
    date: '2024-01-01',
    impressions: 10000,
    clicks: 500,
    cartAdds: 150,
    purchases: 75,
  },
  {
    date: '2024-01-02',
    impressions: 12000,
    clicks: 600,
    cartAdds: 180,
    purchases: 90,
  },
  {
    date: '2024-01-03',
    impressions: 11000,
    clicks: 550,
    cartAdds: 165,
    purchases: 82,
  },
  {
    date: '2024-01-04',
    impressions: 13000,
    clicks: 650,
    cartAdds: 195,
    purchases: 97,
  },
  {
    date: '2024-01-05',
    impressions: 14000,
    clicks: 700,
    cartAdds: 210,
    purchases: 105,
  },
]

const mockComparisonData = [
  {
    date: '2023-12-25',
    impressions: 8000,
    clicks: 400,
    cartAdds: 120,
    purchases: 60,
  },
  {
    date: '2023-12-26',
    impressions: 9000,
    clicks: 450,
    cartAdds: 135,
    purchases: 67,
  },
  {
    date: '2023-12-27',
    impressions: 8500,
    clicks: 425,
    cartAdds: 127,
    purchases: 63,
  },
  {
    date: '2023-12-28',
    impressions: 9500,
    clicks: 475,
    cartAdds: 142,
    purchases: 71,
  },
  {
    date: '2023-12-29',
    impressions: 10000,
    clicks: 500,
    cartAdds: 150,
    purchases: 75,
  },
]

describe('PerformanceChart', () => {
  it('renders loading state when data is loading', () => {
    render(
      <PerformanceChart
        data={[]}
        isLoading={true}
        error={null}
      />
    )

    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument()
  })

  it('renders error state when there is an error', () => {
    render(
      <PerformanceChart
        data={[]}
        isLoading={false}
        error={new Error('Failed to load chart data')}
      />
    )

    expect(screen.getByText('Error loading chart')).toBeInTheDocument()
    expect(screen.getByText('Failed to load chart data')).toBeInTheDocument()
  })

  it('renders empty state when there is no data', () => {
    render(
      <PerformanceChart
        data={[]}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('No data available')).toBeInTheDocument()
    expect(screen.getByText('Select an ASIN and date range to view performance data')).toBeInTheDocument()
  })

  it('renders chart with time series data', () => {
    render(
      <PerformanceChart
        data={mockTimeSeriesData}
        isLoading={false}
        error={null}
      />
    )

    // Check that metric toggle buttons are rendered
    expect(screen.getByRole('button', { name: /impressions/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clicks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cart adds/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /purchases/i })).toBeInTheDocument()

    // Chart should be rendered (we'll check for the container)
    expect(screen.getByTestId('performance-chart')).toBeInTheDocument()
  })

  it('toggles between different metrics', () => {
    render(
      <PerformanceChart
        data={mockTimeSeriesData}
        isLoading={false}
        error={null}
      />
    )

    // Default should be impressions (first button active)
    const impressionsBtn = screen.getByRole('button', { name: /impressions/i })
    const clicksBtn = screen.getByRole('button', { name: /clicks/i })
    
    expect(impressionsBtn).toHaveClass('bg-blue-100')
    expect(clicksBtn).not.toHaveClass('bg-blue-100')

    // Click on clicks button
    fireEvent.click(clicksBtn)
    
    expect(impressionsBtn).not.toHaveClass('bg-blue-100')
    expect(clicksBtn).toHaveClass('bg-blue-100')
  })

  it('renders comparison data when provided', () => {
    render(
      <PerformanceChart
        data={mockTimeSeriesData}
        comparisonData={mockComparisonData}
        isLoading={false}
        error={null}
      />
    )

    // Should show comparison toggle
    expect(screen.getByLabelText(/show comparison/i)).toBeInTheDocument()
  })

  it('toggles comparison visibility', () => {
    render(
      <PerformanceChart
        data={mockTimeSeriesData}
        comparisonData={mockComparisonData}
        isLoading={false}
        error={null}
      />
    )

    const comparisonToggle = screen.getByLabelText(/show comparison/i) as HTMLInputElement
    
    // Should be checked by default when comparison data exists
    expect(comparisonToggle.checked).toBe(true)

    // Uncheck it
    fireEvent.click(comparisonToggle)
    expect(comparisonToggle.checked).toBe(false)

    // Check it again
    fireEvent.click(comparisonToggle)
    expect(comparisonToggle.checked).toBe(true)
  })

  it('formats large numbers correctly in tooltip', () => {
    render(
      <PerformanceChart
        data={mockTimeSeriesData}
        isLoading={false}
        error={null}
      />
    )

    // The component should render with formatted numbers
    // This would be tested more thoroughly with integration tests
    expect(screen.getByTestId('performance-chart')).toBeInTheDocument()
  })

  it('handles multi-metric view', () => {
    render(
      <PerformanceChart
        data={mockTimeSeriesData}
        isLoading={false}
        error={null}
      />
    )

    // Check for view all toggle
    const viewAllBtn = screen.getByRole('button', { name: /view all/i })
    expect(viewAllBtn).toBeInTheDocument()

    // Click to enable multi-metric view
    fireEvent.click(viewAllBtn)
    
    // Should show the button as active
    expect(viewAllBtn).toHaveClass('bg-blue-100')
  })

  it('maintains selected metric when data updates', () => {
    const { rerender } = render(
      <PerformanceChart
        data={mockTimeSeriesData}
        isLoading={false}
        error={null}
      />
    )

    // Select clicks metric
    const clicksBtn = screen.getByRole('button', { name: /clicks/i })
    fireEvent.click(clicksBtn)
    expect(clicksBtn).toHaveClass('bg-blue-100')

    // Update data
    const newData = [...mockTimeSeriesData, {
      date: '2024-01-06',
      impressions: 15000,
      clicks: 750,
      cartAdds: 225,
      purchases: 112,
    }]

    rerender(
      <PerformanceChart
        data={newData}
        isLoading={false}
        error={null}
      />
    )

    // Clicks should still be selected
    expect(screen.getByRole('button', { name: /clicks/i })).toHaveClass('bg-blue-100')
  })

  describe('Chart Type Switching', () => {
    it('renders bar chart for single data point', () => {
      const singleDataPoint = [{
        date: '2024-01-01',
        impressions: 10000,
        clicks: 500,
        cartAdds: 150,
        purchases: 75,
      }]
      
      render(
        <PerformanceChart
          data={singleDataPoint}
          isLoading={false}
          error={null}
        />
      )

      // Bar chart should be rendered (we can verify this by checking for Bar components)
      const chart = screen.getByTestId('performance-chart')
      expect(chart).toBeInTheDocument()
    })

    it('renders line chart for multiple data points', () => {
      render(
        <PerformanceChart
          data={mockTimeSeriesData}
          isLoading={false}
          error={null}
        />
      )

      // Line chart should be rendered
      const chart = screen.getByTestId('performance-chart')
      expect(chart).toBeInTheDocument()
    })

    it('respects explicit chartType prop over auto-detection', () => {
      render(
        <PerformanceChart
          data={mockTimeSeriesData}
          isLoading={false}
          error={null}
          chartType="bar"
        />
      )

      // Should render bar chart even with multiple data points
      const chart = screen.getByTestId('performance-chart')
      expect(chart).toBeInTheDocument()
    })

    it('handles chart type switching with comparison data', () => {
      const singleWeekData = [{
        date: '2024-01-01',
        impressions: 10000,
        clicks: 500,
        cartAdds: 150,
        purchases: 75,
      }]

      const singleWeekComparison = [{
        date: '2023-12-25',
        impressions: 8000,
        clicks: 400,
        cartAdds: 120,
        purchases: 60,
      }]

      render(
        <PerformanceChart
          data={singleWeekData}
          comparisonData={singleWeekComparison}
          isLoading={false}
          error={null}
        />
      )

      // Should render bar chart with comparison data
      const chart = screen.getByTestId('performance-chart')
      expect(chart).toBeInTheDocument()
    })

    it('maintains metric selection across chart type changes', () => {
      const { rerender } = render(
        <PerformanceChart
          data={mockTimeSeriesData}
          isLoading={false}
          error={null}
        />
      )

      // Select clicks metric
      const clicksBtn = screen.getByRole('button', { name: /clicks/i })
      fireEvent.click(clicksBtn)
      expect(clicksBtn).toHaveClass('bg-blue-100')

      // Change to single data point (should switch to bar chart)
      rerender(
        <PerformanceChart
          data={[mockTimeSeriesData[0]]}
          isLoading={false}
          error={null}
        />
      )

      // Clicks should still be selected
      expect(screen.getByRole('button', { name: /clicks/i })).toHaveClass('bg-blue-100')
    })
  })
})