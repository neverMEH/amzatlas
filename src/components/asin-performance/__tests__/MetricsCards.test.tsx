import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MetricsCards } from '../MetricsCards'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockMetricsData = {
  totals: {
    impressions: 150000,
    clicks: 3000,
    cartAdds: 900,
    purchases: 450,
  },
  rates: {
    clickThroughRate: 0.02,
    cartAddRate: 0.30,
    purchaseRate: 0.50,
    overallConversionRate: 0.003,
  },
}

const mockComparisonData = {
  metrics: {
    totals: {
      impressions: 120000,
      clicks: 2400,
      cartAdds: 720,
      purchases: 360,
    },
    rates: {
      clickThroughRate: 0.02,
      cartAddRate: 0.30,
      purchaseRate: 0.50,
      overallConversionRate: 0.003,
    },
  },
  changes: {
    impressions: 0.25,
    clicks: 0.25,
    purchases: 0.25,
    conversionRate: 0,
  },
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('MetricsCards', () => {
  it('renders loading state when data is loading', () => {
    render(
      <MetricsCards
        data={undefined}
        isLoading={true}
        error={null}
      />,
      { wrapper: createWrapper() }
    )

    const skeletons = screen.getAllByTestId('metric-card-skeleton')
    expect(skeletons).toHaveLength(4)
  })

  it('renders error state when there is an error', () => {
    render(
      <MetricsCards
        data={undefined}
        isLoading={false}
        error={new Error('Failed to fetch metrics')}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Error loading metrics')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch metrics')).toBeInTheDocument()
  })

  it('displays all metric cards with correct values', () => {
    render(
      <MetricsCards
        data={mockMetricsData}
        isLoading={false}
        error={null}
      />,
      { wrapper: createWrapper() }
    )

    // Check impressions
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('150,000')).toBeInTheDocument()

    // Check clicks
    expect(screen.getByText('Clicks')).toBeInTheDocument()
    expect(screen.getByText('3,000')).toBeInTheDocument()
    expect(screen.getByText('2.00% CTR')).toBeInTheDocument()

    // Check cart adds
    expect(screen.getByText('Cart Adds')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
    expect(screen.getByText('30.00% of clicks')).toBeInTheDocument()

    // Check purchases
    expect(screen.getByText('Purchases')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
    expect(screen.getByText('0.30% CVR')).toBeInTheDocument()
  })

  it('displays comparison data when provided', () => {
    render(
      <MetricsCards
        data={mockMetricsData}
        comparisonData={mockComparisonData}
        isLoading={false}
        error={null}
      />,
      { wrapper: createWrapper() }
    )

    // Check for positive change indicators
    const upArrows = screen.getAllByTestId('trend-up')
    expect(upArrows).toHaveLength(4) // impressions, clicks, cart adds, purchases increased

    // Check percentage changes (multiple instances due to all metrics increasing)
    const percentageChanges = screen.getAllByText('+25.0%')
    expect(percentageChanges.length).toBeGreaterThan(0)
  })

  it('shows negative trend indicators for decreases', () => {
    const negativeComparisonData = {
      ...mockComparisonData,
      changes: {
        impressions: -0.15,
        clicks: -0.10,
        purchases: -0.20,
        conversionRate: -0.05,
      },
    }

    render(
      <MetricsCards
        data={mockMetricsData}
        comparisonData={negativeComparisonData}
        isLoading={false}
        error={null}
      />,
      { wrapper: createWrapper() }
    )

    // Check for negative change indicators
    const downArrows = screen.getAllByTestId('trend-down')
    expect(downArrows).toHaveLength(3) // impressions, clicks, purchases show negative trend (cart adds calculation is custom)

    // Check percentage changes
    expect(screen.getByText('-15.0%')).toBeInTheDocument()
    expect(screen.getByText('-10.0%')).toBeInTheDocument()
    expect(screen.getByText('-20.0%')).toBeInTheDocument()
  })

  it('handles zero values gracefully', () => {
    const zeroData = {
      totals: {
        impressions: 0,
        clicks: 0,
        cartAdds: 0,
        purchases: 0,
      },
      rates: {
        clickThroughRate: 0,
        cartAddRate: 0,
        purchaseRate: 0,
        overallConversionRate: 0,
      },
    }

    render(
      <MetricsCards
        data={zeroData}
        isLoading={false}
        error={null}
      />,
      { wrapper: createWrapper() }
    )

    // All metric cards show '0' as their main value
    const zeroValues = screen.getAllByText('0')
    expect(zeroValues).toHaveLength(4) // One for each metric
    expect(screen.getByText('0.00% CTR')).toBeInTheDocument()
    expect(screen.getByText('0.00% of clicks')).toBeInTheDocument()
    expect(screen.getByText('0.00% CVR')).toBeInTheDocument()
  })

  it('formats large numbers correctly', () => {
    const largeNumberData = {
      totals: {
        impressions: 1234567,
        clicks: 12345,
        cartAdds: 1234,
        purchases: 123,
      },
      rates: {
        clickThroughRate: 0.01,
        cartAddRate: 0.10,
        purchaseRate: 0.10,
        overallConversionRate: 0.0001,
      },
    }

    render(
      <MetricsCards
        data={largeNumberData}
        isLoading={false}
        error={null}
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('1,234,567')).toBeInTheDocument()
    expect(screen.getByText('12,345')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
  })

  it('applies correct styling for metric cards', () => {
    const { container } = render(
      <MetricsCards
        data={mockMetricsData}
        isLoading={false}
        error={null}
      />,
      { wrapper: createWrapper() }
    )

    // Check grid layout
    const grid = container.querySelector('[class*="grid-cols-4"]')
    expect(grid).toBeInTheDocument()

    // Check card styling
    const cards = container.querySelectorAll('[class*="bg-white"]')
    expect(cards.length).toBeGreaterThan(0)
  })
})