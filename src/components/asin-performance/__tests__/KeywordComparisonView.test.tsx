import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { KeywordComparisonView } from '../KeywordComparisonView'

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

const mockData = {
  timeSeries: [
    {
      date: '2024-01-01',
      'knife sharpener': { impressions: 15000, clicks: 750, purchases: 112 },
      'electric knife sharpener': { impressions: 8000, clicks: 480, purchases: 72 },
    },
    {
      date: '2024-01-08',
      'knife sharpener': { impressions: 16500, clicks: 825, purchases: 123 },
      'electric knife sharpener': { impressions: 8800, clicks: 528, purchases: 79 },
    },
  ],
  marketShare: {
    'knife sharpener': 0.35,
    'electric knife sharpener': 0.20,
  },
  funnels: {
    'knife sharpener': {
      impressions: 31500,
      clicks: 1575,
      cartAdds: 472,
      purchases: 235,
    },
    'electric knife sharpener': {
      impressions: 16800,
      clicks: 1008,
      cartAdds: 302,
      purchases: 151,
    },
  },
}

describe('KeywordComparisonView', () => {
  it('renders comparison view with tabs', () => {
    render(
      <KeywordComparisonView
        keywords={['knife sharpener', 'electric knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('Keyword Comparison')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /performance trends/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conversion funnels/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /market share/i })).toBeInTheDocument()
  })

  it('displays keyword pills', () => {
    render(
      <KeywordComparisonView
        keywords={['knife sharpener', 'electric knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    expect(screen.getByText('electric knife sharpener')).toBeInTheDocument()
  })

  it('switches between tabs', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordComparisonView
        keywords={['knife sharpener', 'electric knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    // Default tab should be performance trends
    expect(screen.getByTestId('performance-trends-content')).toBeInTheDocument()

    // Click on conversion funnels tab
    await user.click(screen.getByRole('button', { name: /conversion funnels/i }))
    expect(screen.getByTestId('conversion-funnels-content')).toBeInTheDocument()

    // Click on market share tab
    await user.click(screen.getByRole('button', { name: /market share/i }))
    expect(screen.getByTestId('market-share-content')).toBeInTheDocument()
  })

  it('displays performance chart in trends tab', () => {
    render(
      <KeywordComparisonView
        keywords={['knife sharpener', 'electric knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByTestId('comparison-performance-chart')).toBeInTheDocument()
  })

  it('displays funnel comparisons', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordComparisonView
        keywords={['knife sharpener', 'electric knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    await user.click(screen.getByRole('button', { name: /conversion funnels/i }))

    // Should show both funnels
    expect(screen.getAllByText(/Conversion Funnel:/)).toHaveLength(2)
    // Check specific funnel headers
    expect(screen.getByText('Conversion Funnel: knife sharpener')).toBeInTheDocument()
    expect(screen.getByText('Conversion Funnel: electric knife sharpener')).toBeInTheDocument()
  })

  it('displays market share comparison', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordComparisonView
        keywords={['knife sharpener', 'electric knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    await user.click(screen.getByRole('button', { name: /market share/i }))

    expect(screen.getByTestId('market-share-comparison')).toBeInTheDocument()
    expect(screen.getByText('35.0%')).toBeInTheDocument() // knife sharpener share
    expect(screen.getByText('20.0%')).toBeInTheDocument() // electric knife sharpener share
  })

  it('handles loading state', () => {
    render(
      <KeywordComparisonView
        keywords={['knife sharpener']}
        data={null}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={true}
        error={null}
      />
    )

    expect(screen.getByTestId('comparison-skeleton')).toBeInTheDocument()
  })

  it('handles error state', () => {
    const error = new Error('Failed to load comparison data')
    
    render(
      <KeywordComparisonView
        keywords={['knife sharpener']}
        data={null}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={error}
      />
    )

    expect(screen.getByText('Error loading comparison')).toBeInTheDocument()
    expect(screen.getByText('Failed to load comparison data')).toBeInTheDocument()
  })

  it('handles no keywords selected', () => {
    render(
      <KeywordComparisonView
        keywords={[]}
        data={null}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText('No keywords selected')).toBeInTheDocument()
    expect(screen.getByText('Select keywords to compare their performance')).toBeInTheDocument()
  })

  it('limits displayed keywords to 10', () => {
    const manyKeywords = Array.from({ length: 15 }, (_, i) => `keyword ${i + 1}`)
    
    render(
      <KeywordComparisonView
        keywords={manyKeywords}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    // Should show first 10 keywords
    expect(screen.getByText('keyword 1')).toBeInTheDocument()
    expect(screen.getByText('keyword 10')).toBeInTheDocument()
    expect(screen.queryByText('keyword 11')).not.toBeInTheDocument()
    
    // Should show truncation message
    expect(screen.getByText('and 5 more...')).toBeInTheDocument()
  })

  it('displays date range', () => {
    render(
      <KeywordComparisonView
        keywords={['knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    expect(screen.getByText(/Jan 1 - Jan 31, 2024/)).toBeInTheDocument()
  })

  it('shows summary statistics', () => {
    render(
      <KeywordComparisonView
        keywords={['knife sharpener', 'electric knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    // Should show total impressions, clicks, purchases
    expect(screen.getByText(/Total Impressions:/)).toBeInTheDocument()
    expect(screen.getByText(/48,300/)).toBeInTheDocument() // 31500 + 16800
  })

  it('supports keyboard navigation for tabs', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordComparisonView
        keywords={['knife sharpener']}
        data={mockData}
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={false}
        error={null}
      />
    )

    const funnelsTab = screen.getByRole('button', { name: /conversion funnels/i })
    funnelsTab.focus()
    
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('conversion-funnels-content')).toBeInTheDocument()
  })
})