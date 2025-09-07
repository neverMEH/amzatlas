import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { KeywordFunnelChart } from '../KeywordFunnelChart'

const mockData = {
  impressions: 15000,
  clicks: 750,
  cartAdds: 225,
  purchases: 112,
}

const mockComparisonData = {
  impressions: 12000,
  clicks: 600,
  cartAdds: 180,
  purchases: 90,
}

describe('KeywordFunnelChart', () => {
  it('renders funnel chart with keyword data', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('Conversion Funnel: knife sharpener')).toBeInTheDocument()
    expect(screen.getByText('15,000')).toBeInTheDocument() // Impressions
    expect(screen.getByText('750')).toBeInTheDocument() // Clicks
    expect(screen.getByText('225')).toBeInTheDocument() // Cart Adds
    expect(screen.getByText('112')).toBeInTheDocument() // Purchases
  })

  it('displays conversion rates', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText(/CTR: 5.00%/)).toBeInTheDocument() // 750/15000
    expect(screen.getByText(/Cart Add Rate: 30.00%/)).toBeInTheDocument() // 225/750
    expect(screen.getByText(/Purchase Rate: 49.78%/)).toBeInTheDocument() // 112/225
  })

  it('shows overall CVR', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText(/Overall CVR:/)).toBeInTheDocument()
    expect(screen.getByText('0.75%')).toBeInTheDocument() // 112/15000
  })

  it('displays comparison data when provided', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        comparisonData={mockComparisonData}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    // Check for trend indicators
    expect(screen.getByTestId('impressions-trend')).toBeInTheDocument()
    expect(screen.getByTestId('clicks-trend')).toBeInTheDocument()
    expect(screen.getByTestId('cart-adds-trend')).toBeInTheDocument()
    expect(screen.getByTestId('purchases-trend')).toBeInTheDocument()
  })

  it('shows positive trends correctly', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        comparisonData={mockComparisonData}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    // All values increased
    const impressionsTrend = screen.getByTestId('impressions-trend')
    expect(impressionsTrend).toHaveTextContent('+25.0%')
    expect(impressionsTrend).toHaveClass('text-green-600')
  })

  it('displays loading state', () => {
    render(
      <KeywordFunnelChart
        data={null}
        keyword="knife sharpener"
        isLoading={true}
        error={null}
      />
    )

    expect(screen.getByTestId('funnel-skeleton')).toBeInTheDocument()
  })

  it('displays error state', () => {
    const error = new Error('Failed to load funnel data')
    
    render(
      <KeywordFunnelChart
        data={null}
        keyword="knife sharpener"
        isLoading={false}
        error={error}
      />
    )

    expect(screen.getByText('Error loading funnel data')).toBeInTheDocument()
    expect(screen.getByText('Failed to load funnel data')).toBeInTheDocument()
  })

  it('handles empty data gracefully', () => {
    render(
      <KeywordFunnelChart
        data={null}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('No funnel data available')).toBeInTheDocument()
  })

  it('calculates funnel widths correctly', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    // Check that funnel bars have appropriate widths
    const impressionsBar = screen.getByTestId('funnel-bar-impressions')
    const clicksBar = screen.getByTestId('funnel-bar-clicks')
    const cartAddsBar = screen.getByTestId('funnel-bar-cart-adds')
    const purchasesBar = screen.getByTestId('funnel-bar-purchases')

    expect(impressionsBar).toHaveStyle({ width: '100%' })
    expect(clicksBar).toHaveStyle({ width: '5%' }) // 750/15000
    expect(cartAddsBar).toHaveStyle({ width: '1.5%' }) // 225/15000
    expect(purchasesBar).toHaveStyle({ width: '0.75%' }) // 112/15000 with min width
  })

  it('shows date ranges when provided', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        keyword="knife sharpener"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText(/Jan 1 - Jan 31, 2024/)).toBeInTheDocument()
  })

  it('shows comparison date range when provided', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        comparisonData={mockComparisonData}
        keyword="knife sharpener"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        comparisonDateRange={{ start: '2023-12-01', end: '2023-12-31' }}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText(/vs Dec 1 - Dec 31, 2023/)).toBeInTheDocument()
  })

  it('handles zero values without errors', () => {
    const zeroData = {
      impressions: 1000,
      clicks: 0,
      cartAdds: 0,
      purchases: 0,
    }

    render(
      <KeywordFunnelChart
        data={zeroData}
        keyword="knife sharpener"
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText(/CTR: 0.00%/)).toBeInTheDocument() // CTR
    expect(screen.getAllByText('0')).toHaveLength(3) // Zero clicks, cart adds, purchases
  })

  it('includes trend tooltips for comparison data', () => {
    render(
      <KeywordFunnelChart
        data={mockData}
        comparisonData={mockComparisonData}
        keyword="knife sharpener"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        comparisonDateRange={{ start: '2023-12-01', end: '2023-12-31' }}
        isLoading={false}
        error={null}
      />
    )

    const impressionsTrend = screen.getByTestId('impressions-trend')
    expect(impressionsTrend).toHaveAttribute('title', expect.stringContaining('vs Dec 1 - Dec 31, 2023'))
  })
})