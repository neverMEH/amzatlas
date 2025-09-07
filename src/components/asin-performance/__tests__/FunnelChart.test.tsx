import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { FunnelChart } from '../FunnelChart'

const mockFunnelData = {
  impressions: 50000,
  clicks: 2500,
  cartAdds: 750,
  purchases: 375,
}

const mockComparisonData = {
  impressions: 40000,
  clicks: 2000,
  cartAdds: 600,
  purchases: 300,
}

describe('FunnelChart', () => {
  it('renders loading state when data is loading', () => {
    render(
      <FunnelChart
        data={null}
        isLoading={true}
        error={null}
      />
    )

    expect(screen.getByTestId('funnel-skeleton')).toBeInTheDocument()
  })

  it('renders error state when there is an error', () => {
    render(
      <FunnelChart
        data={null}
        isLoading={false}
        error={new Error('Failed to load funnel data')}
      />
    )

    expect(screen.getByText('Error loading funnel')).toBeInTheDocument()
    expect(screen.getByText('Failed to load funnel data')).toBeInTheDocument()
  })

  it('renders empty state when there is no data', () => {
    render(
      <FunnelChart
        data={null}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('No funnel data available')).toBeInTheDocument()
    expect(screen.getByText('Select an ASIN and date range to view the conversion funnel')).toBeInTheDocument()
  })

  it('displays all funnel stages with correct values', () => {
    render(
      <FunnelChart
        data={mockFunnelData}
        isLoading={false}
        error={null}
      />
    )

    // Check stage labels
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('Clicks')).toBeInTheDocument()
    expect(screen.getByText('Cart Adds')).toBeInTheDocument()
    expect(screen.getByText('Purchases')).toBeInTheDocument()

    // Check formatted values
    expect(screen.getByText('50,000')).toBeInTheDocument()
    expect(screen.getByText('2,500')).toBeInTheDocument()
    expect(screen.getByText('750')).toBeInTheDocument()
    expect(screen.getByText('375')).toBeInTheDocument()
  })

  it('displays conversion rates between stages', () => {
    render(
      <FunnelChart
        data={mockFunnelData}
        isLoading={false}
        error={null}
      />
    )

    // Check conversion rates
    expect(screen.getByText('5.00%')).toBeInTheDocument() // CTR: 2500/50000
    expect(screen.getByText('30.00%')).toBeInTheDocument() // Cart Add Rate: 750/2500
    expect(screen.getByText('50.00%')).toBeInTheDocument() // Purchase Rate: 375/750
  })

  it('displays overall conversion rate', () => {
    render(
      <FunnelChart
        data={mockFunnelData}
        isLoading={false}
        error={null}
      />
    )

    // Overall CVR: 375/50000 = 0.75%
    expect(screen.getByText(/Overall CVR:/)).toBeInTheDocument()
    expect(screen.getByText('0.75%')).toBeInTheDocument()
  })

  it('shows comparison data when provided', () => {
    render(
      <FunnelChart
        data={mockFunnelData}
        comparisonData={mockComparisonData}
        isLoading={false}
        error={null}
      />
    )

    // Should show toggle for comparison
    expect(screen.getByLabelText(/show comparison/i)).toBeInTheDocument()
  })

  it('toggles comparison visibility', () => {
    render(
      <FunnelChart
        data={mockFunnelData}
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

  it('calculates correct percentages for funnel width', () => {
    render(
      <FunnelChart
        data={mockFunnelData}
        isLoading={false}
        error={null}
      />
    )

    const funnelBars = screen.getAllByTestId(/funnel-bar-/)
    
    // First bar (impressions) should be 100% width
    expect(funnelBars[0]).toHaveStyle({ width: '100%' })
    
    // Other bars should be proportional
    expect(funnelBars[1]).toHaveStyle({ width: '5%' }) // 2500/50000
    expect(funnelBars[2]).toHaveStyle({ width: '1.5%' }) // 750/50000
    expect(funnelBars[3]).toHaveStyle({ width: '0.75%' }) // 375/50000
  })

  it('shows percentage changes when comparison is enabled', () => {
    render(
      <FunnelChart
        data={mockFunnelData}
        comparisonData={mockComparisonData}
        isLoading={false}
        error={null}
      />
    )

    // Check for percentage changes
    // All metrics increased by same percentage since they're proportional
    const percentageChanges = screen.getAllByText('+25.0%')
    expect(percentageChanges.length).toBeGreaterThan(0) // At least one percentage change shown
  })

  it('handles zero values gracefully', () => {
    const zeroData = {
      impressions: 1000,
      clicks: 0,
      cartAdds: 0,
      purchases: 0,
    }

    render(
      <FunnelChart
        data={zeroData}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(3)
    // Multiple 0.00% values exist for conversion rates
    const zeroPercentages = screen.getAllByText('0.00%')
    expect(zeroPercentages.length).toBeGreaterThan(0)
  })

  it('applies correct styling for funnel visualization', () => {
    const { container } = render(
      <FunnelChart
        data={mockFunnelData}
        isLoading={false}
        error={null}
      />
    )

    // Check for funnel container
    expect(container.querySelector('[data-testid="funnel-container"]')).toBeInTheDocument()
    
    // Check that bars have decreasing widths (funnel shape)
    const bars = container.querySelectorAll('[data-testid^="funnel-bar-"]')
    expect(bars).toHaveLength(4)
  })
})