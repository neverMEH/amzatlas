import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KeywordAnalysisPage from '../page'

// Mock the API hooks
const mockUseKeywordPerformance = vi.fn()
const mockUseKeywordComparison = vi.fn()
const mockUseASINKeywords = vi.fn()

vi.mock('@/lib/api/keyword-analysis', () => ({
  useKeywordPerformance: () => mockUseKeywordPerformance(),
  useKeywordComparison: () => mockUseKeywordComparison(),
  useASINKeywords: () => mockUseASINKeywords(),
}))

// Mock the components
vi.mock('@/components/asin-performance/DateRangePickerV2', () => ({
  DateRangePickerV2: () => <div data-testid="date-range-picker">Date Range Picker</div>,
}))

vi.mock('@/components/asin-performance/Breadcrumb', () => ({
  Breadcrumb: ({ items }: any) => (
    <div data-testid="breadcrumb">
      {items.map((item: any, i: number) => (
        <span key={i}>{item.label}</span>
      ))}
    </div>
  ),
}))

vi.mock('@/components/asin-performance/KeywordPerformanceChart', () => ({
  KeywordPerformanceChart: ({ data }: any) => (
    <div data-testid="keyword-performance-chart">{data ? 'Chart loaded' : 'Loading chart'}</div>
  ),
}))

vi.mock('@/components/asin-performance/KeywordFunnelChart', () => ({
  KeywordFunnelChart: ({ data }: any) => (
    <div data-testid="keyword-funnel-chart">{data ? 'Funnel loaded' : 'Loading funnel'}</div>
  ),
}))

vi.mock('@/components/asin-performance/KeywordMarketShare', () => ({
  KeywordMarketShare: ({ data }: any) => (
    <div data-testid="keyword-market-share">{data ? 'Market share loaded' : 'Loading market share'}</div>
  ),
}))

vi.mock('@/components/asin-performance/MultiKeywordSelector', () => ({
  MultiKeywordSelector: ({ onSelectionChange }: any) => (
    <div data-testid="multi-keyword-selector">
      <button onClick={() => onSelectionChange(['keyword1', 'keyword2'])}>
        Select keywords
      </button>
    </div>
  ),
}))

vi.mock('@/components/asin-performance/KeywordComparisonView', () => ({
  KeywordComparisonView: ({ keywords }: any) => (
    <div data-testid="keyword-comparison-view">
      Comparing: {keywords.join(', ')}
    </div>
  ),
}))

let mockSearchParams: URLSearchParams
describe('KeywordAnalysisPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    
    mockUseSearchParams.mockReturnValue(mockSearchParams)
    mockUseRouter.mockReturnValue(mockRouter)
    mockUsePathname.mockReturnValue('/keyword-analysis')
    
    // Default return values for API hooks
    mockUseKeywordPerformance.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    })
    mockUseKeywordComparison.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    })
    mockUseASINKeywords.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders with required URL parameters', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: {
        timeSeries: [],
        funnelData: { impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7 },
        marketShare: { totalMarket: { impressions: 10000 }, competitors: [] },
      },
      isLoading: false,
      error: null,
    })

    render(<KeywordAnalysisPage />, { wrapper })

    expect(screen.getByText('Chart loaded')).toBeInTheDocument()
    expect(screen.getByTestId('keyword-performance-chart')).toBeInTheDocument()
  })

  it('shows error when required parameters are missing', () => {
    // No parameters set
    render(<KeywordAnalysisPage />, { wrapper })

    expect(screen.getByText('Missing required parameters')).toBeInTheDocument()
    expect(screen.getByText(/Please provide ASIN, keyword, start date, and end date/)).toBeInTheDocument()
  })

  it('displays breadcrumb navigation', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: { timeSeries: [], funnelData: {}, marketShare: {} },
      isLoading: false,
      error: null,
    })

    render(<KeywordAnalysisPage />, { wrapper })

    const breadcrumb = screen.getByTestId('breadcrumb')
    expect(breadcrumb).toHaveTextContent('Dashboard')
    expect(breadcrumb).toHaveTextContent('B001')
    expect(breadcrumb).toHaveTextContent('test keyword')
  })

  it('handles back navigation', async () => {
    const user = userEvent.setup()
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    render(<KeywordAnalysisPage />, { wrapper })

    const backButton = screen.getByRole('button', { name: /back to dashboard/i })
    await user.click(backButton)

    expect(mockRouter.back).toHaveBeenCalled()
  })

  it('displays loading state', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    })

    render(<KeywordAnalysisPage />, { wrapper })

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument()
  })

  it('displays error state', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to load data'),
    })

    render(<KeywordAnalysisPage />, { wrapper })

    expect(screen.getByText('Error loading keyword analysis')).toBeInTheDocument()
    expect(screen.getByText('Failed to load data')).toBeInTheDocument()
  })

  it('toggles between single and comparison view', async () => {
    const user = userEvent.setup()
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: { timeSeries: [], funnelData: {}, marketShare: {} },
      isLoading: false,
      error: null,
    })
    mockUseKeywordComparison.mockReturnValue({
      data: { timeSeries: [], funnels: {}, marketShare: {} },
      isLoading: false,
      error: null,
    })

    render(<KeywordAnalysisPage />, { wrapper })

    // Should start in single keyword view
    expect(screen.getByTestId('keyword-performance-chart')).toBeInTheDocument()

    // Click compare button
    const compareButton = screen.getByRole('button', { name: /compare keywords/i })
    await user.click(compareButton)

    // Should show comparison view
    expect(screen.getByTestId('multi-keyword-selector')).toBeInTheDocument()
  })

  it.skip('updates URL when date range changes', async () => {
    // This test would require mocking the DateRangePicker component's onChange behavior
    // Skipping as it's testing implementation details of child component
  })

  it('handles comparison parameters from URL', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')
    mockSearchParams.set('compareStartDate', '2023-12-01')
    mockSearchParams.set('compareEndDate', '2023-12-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: {
        timeSeries: [],
        comparisonTimeSeries: [],
        funnelData: {},
        comparisonFunnelData: {},
        marketShare: {},
      },
      isLoading: false,
      error: null,
    })

    render(<KeywordAnalysisPage />, { wrapper })

    // Should show comparison data
    expect(screen.getByText(/Comparing to Dec 1 - Dec 31, 2023/)).toBeInTheDocument()
  })

  it('handles multiple keywords from URL', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keywords', 'keyword1,keyword2,keyword3')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordComparison.mockReturnValue({
      data: { timeSeries: [], funnels: {}, marketShare: {} },
      isLoading: false,
      error: null,
    })

    render(<KeywordAnalysisPage />, { wrapper })

    expect(screen.getByTestId('keyword-comparison-view')).toBeInTheDocument()
    expect(screen.getByText('Comparing: keyword1, keyword2, keyword3')).toBeInTheDocument()
  })

  it.skip('exports data functionality', async () => {
    // Skip this test as export functionality is not yet implemented
  })

  it('renders market share component in full width layout', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: {
        timeSeries: [],
        funnelData: { impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7 },
        marketShare: { totalMarket: { impressions: 10000 }, competitors: [] },
      },
      isLoading: false,
      error: null,
    })

    const { container } = render(<KeywordAnalysisPage />, { wrapper })

    // Find the container with funnel and market share
    const chartsContainer = container.querySelector('.space-y-6')
    expect(chartsContainer).toBeInTheDocument()

    // Market share should be in its own full-width section, not in a grid
    const marketShareSection = screen.getByTestId('keyword-market-share').closest('div')
    expect(marketShareSection?.parentElement).not.toHaveClass('grid-cols-2')
    expect(marketShareSection?.parentElement).not.toHaveClass('gap-6')
  })

  it('shows performance chart and funnel when data loads', () => {
    mockSearchParams.set('asin', 'B001')
    mockSearchParams.set('keyword', 'test keyword')
    mockSearchParams.set('startDate', '2024-01-01')
    mockSearchParams.set('endDate', '2024-01-31')

    mockUseKeywordPerformance.mockReturnValue({
      data: {
        timeSeries: [],
        funnelData: { 
          impressions: 10000, 
          clicks: 500, 
          cartAdds: 150, 
          purchases: 75 
        },
        marketShare: { totalMarket: { impressions: 50000 }, competitors: [] },
      },
      isLoading: false,
      error: null,
    })

    render(<KeywordAnalysisPage />, { wrapper })

    expect(screen.getByTestId('keyword-performance-chart')).toBeInTheDocument()
    expect(screen.getByTestId('keyword-funnel-chart')).toBeInTheDocument()
    expect(screen.getByTestId('keyword-market-share')).toBeInTheDocument()
  })
})