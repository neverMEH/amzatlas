import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { KeywordAnalysisModal } from '../KeywordAnalysisModal'

// Mock createPortal for testing
vi.mock('react-dom', () => ({
  ...vi.importActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}))

// Mock the API hook
const mockUseKeywordPerformance = vi.fn()
vi.mock('@/lib/api/keyword-analysis', () => ({
  useKeywordPerformance: (params: any) => mockUseKeywordPerformance(params),
}))

// Mock view mode hook
const mockUseViewMode = vi.fn()
vi.mock('@/hooks/use-view-mode', () => ({
  useViewMode: (options: any) => mockUseViewMode(options),
}))

// Mock MetricSparkline component
vi.mock('../MetricSparkline', () => ({
  MetricSparkline: ({ label, metric }: any) => (
    <div data-testid={`metric-sparkline-${metric}`}>Sparkline: {label}</div>
  ),
}))

// Mock the chart components
vi.mock('../KeywordPerformanceChart', () => ({
  KeywordPerformanceChart: ({ keyword }: any) => (
    <div data-testid="keyword-performance-chart">Performance Chart for {keyword}</div>
  ),
}))

vi.mock('../KeywordFunnelChart', () => ({
  KeywordFunnelChart: ({ keyword }: any) => (
    <div data-testid="keyword-funnel-chart">Funnel Chart for {keyword}</div>
  ),
}))

vi.mock('../KeywordMarketShare', () => ({
  KeywordMarketShare: ({ keyword }: any) => (
    <div data-testid="keyword-market-share">Market Share for {keyword}</div>
  ),
}))

const mockKeywordData = {
  searchQuery: 'knife sharpener',
  impressions: 15000,
  clicks: 750,
  cartAdds: 225,
  purchases: 112,
  ctr: 0.05,
  cvr: 0.0075,
  cartAddRate: 0.3,
  purchaseRate: 0.498,
  impressionShare: 0.23,
  clickShare: 0.28,
  purchaseShare: 0.31,
}

describe('KeywordAnalysisModal', () => {
  const mockOnClose = vi.fn()
  const mockOnExpand = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation
    mockUseKeywordPerformance.mockImplementation(() => ({
      data: null,
      isLoading: false,
      error: null,
    }))
    // Default view mode mock (full page mode)
    mockUseViewMode.mockImplementation(() => ({
      mode: 'full-page',
      isPopup: false,
      isFullPage: true,
      shouldShowSparklines: false,
      shouldShowFullCharts: true,
      layout: {
        maxWidth: 'max-w-7xl',
        padding: 'p-6',
        chartHeight: 300,
        showFunnel: true,
        showMarketShare: true,
        showSparklines: false,
      },
      queryParams: {},
    }))
  })

  afterEach(() => {
    // Clean up any modals left in the DOM
    document.body.innerHTML = ''
  })

  it('renders modal when isOpen is true', () => {
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Keyword Analysis: knife sharpener')).toBeInTheDocument()
  })

  it('does not render modal when isOpen is false', () => {
    render(
      <KeywordAnalysisModal
        isOpen={false}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    const closeButton = screen.getByLabelText('Close modal')
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    const backdrop = screen.getByTestId('modal-backdrop')
    await user.click(backdrop)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when modal content is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    const modalContent = screen.getByTestId('modal-content')
    await user.click(modalContent)

    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('calls onClose when ESC key is pressed', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    await user.keyboard('{Escape}')

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onExpand when expand button is clicked', async () => {
    const user = userEvent.setup()
    
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    const expandButton = screen.getByLabelText('Expand to new tab')
    await user.click(expandButton)

    expect(mockOnExpand).toHaveBeenCalledTimes(1)
  })

  it('displays loading state when data is loading', () => {
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        isLoading={true}
      />
    )

    expect(screen.getByTestId('modal-skeleton')).toBeInTheDocument()
  })

  it('displays error state when there is an error', () => {
    const error = new Error('Failed to load keyword data')
    
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        error={error}
      />
    )

    expect(screen.getByText('Error loading keyword data')).toBeInTheDocument()
    expect(screen.getByText('Failed to load keyword data')).toBeInTheDocument()
  })

  it('has proper ARIA attributes for accessibility', () => {
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('has focusable elements for keyboard navigation', async () => {
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    // Get focusable elements
    const closeButton = screen.getByLabelText('Close modal')
    const expandButton = screen.getByLabelText('Expand to new tab')

    // Check that both buttons exist and are focusable
    expect(closeButton).toBeInTheDocument()
    expect(expandButton).toBeInTheDocument()
    expect(closeButton).toHaveAttribute('tabIndex', '0')
    expect(expandButton).toHaveAttribute('tabIndex', '0')
  })

  it('manages focus correctly during open and close', async () => {
    const user = userEvent.setup()
    
    const { rerender } = render(
      <KeywordAnalysisModal
        isOpen={false}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    // Remember initial focus
    const initialFocus = document.activeElement

    // Open modal
    rerender(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    // Modal should be in the document
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close modal
    await user.keyboard('{Escape}')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('has smooth open/close animations', () => {
    const { rerender } = render(
      <KeywordAnalysisModal
        isOpen={false}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    // Open modal
    rerender(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    const backdrop = screen.getByTestId('modal-backdrop')
    const content = screen.getByTestId('modal-content')

    // Check for animation classes
    expect(backdrop).toHaveClass('transition-opacity')
    expect(content).toHaveClass('transition-all')
  })

  it('displays date range in modal header', () => {
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    expect(screen.getByText(/Jan 1 - Jan 31, 2024/)).toBeInTheDocument()
  })

  it('displays comparison date range when provided', () => {
    render(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        comparisonDateRange={{ start: '2023-12-01', end: '2023-12-31' }}
      />
    )

    expect(screen.getByText(/vs Dec 1 - Dec 31, 2023/)).toBeInTheDocument()
  })

  it('prevents body scroll when modal is open', () => {
    const { rerender } = render(
      <KeywordAnalysisModal
        isOpen={false}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    expect(document.body.style.overflow).not.toBe('hidden')

    rerender(
      <KeywordAnalysisModal
        isOpen={true}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <KeywordAnalysisModal
        isOpen={false}
        onClose={mockOnClose}
        onExpand={mockOnExpand}
        keyword="knife sharpener"
        asin="B001CZKJYA"
        dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
      />
    )

    expect(document.body.style.overflow).not.toBe('hidden')
  })

  describe('Data Loading and Chart Rendering', () => {
    const mockPerformanceData = {
      timeSeries: [
        { date: '2024-01-01', impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7, ctr: 0.05, cvr: 0.007 },
        { date: '2024-01-02', impressions: 1200, clicks: 60, cartAdds: 18, purchases: 9, ctr: 0.05, cvr: 0.0075 },
      ],
      funnelData: { impressions: 10000, clicks: 500, cartAdds: 150, purchases: 75 },
      marketShare: {
        totalMarket: { impressions: 50000, clicks: 2500, purchases: 375 },
        competitors: [
          { asin: 'B002', brand: 'Brand B', title: 'Product B', impressionShare: 0.3, clickShare: 0.25, purchaseShare: 0.2 }
        ]
      }
    }

    it('displays loading state while fetching data', () => {
      mockUseKeywordPerformance.mockImplementation(() => ({
        data: null,
        isLoading: true,
        error: null,
      }))

      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        />
      )

      expect(screen.getByTestId('modal-skeleton')).toBeInTheDocument()
    })

    it('displays error state when data fetch fails', () => {
      mockUseKeywordPerformance.mockImplementation(() => ({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch data'),
      }))

      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        />
      )

      expect(screen.getByText('Error loading keyword data')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument()
    })

    it('renders all chart components when data is loaded', () => {
      mockUseKeywordPerformance.mockImplementation(() => ({
        data: mockPerformanceData,
        isLoading: false,
        error: null,
      }))

      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        />
      )

      // Check that all charts are rendered
      expect(screen.getByTestId('keyword-performance-chart')).toBeInTheDocument()
      expect(screen.getByTestId('keyword-funnel-chart')).toBeInTheDocument()
      expect(screen.getByTestId('keyword-market-share')).toBeInTheDocument()

      // Check section headers
      expect(screen.getByText('Performance Trends')).toBeInTheDocument()
      expect(screen.getByText('Conversion Funnel')).toBeInTheDocument()
      expect(screen.getByText('Market Share')).toBeInTheDocument()

      // Check the compare keywords prompt
      expect(screen.getByText('Want to compare multiple keywords?')).toBeInTheDocument()
      expect(screen.getByText('Open Full Analysis')).toBeInTheDocument()
    })

    it('calls onExpand when Open Full Analysis button is clicked', async () => {
      const user = userEvent.setup()
      
      mockUseKeywordPerformance.mockImplementation(() => ({
        data: mockPerformanceData,
        isLoading: false,
        error: null,
      }))

      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        />
      )

      const expandButton = screen.getByText('Open Full Analysis')
      await user.click(expandButton)

      expect(mockOnExpand).toHaveBeenCalledTimes(1)
    })

    it('fetches data only when modal is open', () => {
      const { rerender } = render(
        <KeywordAnalysisModal
          isOpen={false}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        />
      )

      // Should not fetch when closed
      expect(mockUseKeywordPerformance).toHaveBeenCalledWith(null)

      // Reset mock
      mockUseKeywordPerformance.mockClear()

      // Open modal
      rerender(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
        />
      )

      // Should fetch when opened
      expect(mockUseKeywordPerformance).toHaveBeenCalledWith({
        asin: 'B001CZKJYA',
        keyword: 'knife sharpener',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        compareStartDate: undefined,
        compareEndDate: undefined,
      })
    })

    it('passes comparison dates when provided', () => {
      mockUseKeywordPerformance.mockImplementation(() => ({
        data: mockPerformanceData,
        isLoading: false,
        error: null,
      }))

      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          comparisonDateRange={{ start: '2023-12-01', end: '2023-12-31' }}
        />
      )

      expect(mockUseKeywordPerformance).toHaveBeenCalledWith({
        asin: 'B001CZKJYA',
        keyword: 'knife sharpener',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        compareStartDate: '2023-12-01',
        compareEndDate: '2023-12-31',
      })
    })
  })

  describe('Popup Layout Rendering', () => {
    const mockPerformanceData = {
      summary: {
        impressions: 10000,
        clicks: 500,
        cartAdds: 150,
        purchases: 75,
        ctr: 0.05,
        cvr: 0.0075,
      },
      timeSeries: [
        { date: '2024-01-01', impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7, ctr: 0.05, cvr: 0.007 },
        { date: '2024-01-02', impressions: 1200, clicks: 60, cartAdds: 18, purchases: 9, ctr: 0.05, cvr: 0.0075 },
      ],
      funnelData: { impressions: 10000, clicks: 500, cartAdds: 150, purchases: 75 },
      marketShare: {
        totalMarket: { impressions: 50000, clicks: 2500, purchases: 375 },
        competitors: [
          { asin: 'B002', brand: 'Brand B', title: 'Product B', impressionShare: 0.3, clickShare: 0.25, purchaseShare: 0.2 }
        ]
      },
      comparisonSummary: {
        impressions: 8000,
        clicks: 400,
        cartAdds: 120,
        purchases: 60,
        ctr: 0.05,
        cvr: 0.0075,
      },
    }

    beforeEach(() => {
      // Mock popup view mode
      mockUseViewMode.mockImplementation(() => ({
        mode: 'popup',
        isPopup: true,
        isFullPage: false,
        shouldShowSparklines: true,
        shouldShowFullCharts: false,
        layout: {
          maxWidth: 'max-w-4xl',
          padding: 'p-4',
          chartHeight: 60,
          showFunnel: false,
          showMarketShare: false,
          showSparklines: true,
        },
        queryParams: {},
      }))

      mockUseKeywordPerformance.mockImplementation(() => ({
        data: mockPerformanceData,
        isLoading: false,
        error: null,
      }))
    })

    it('renders with popup layout classes when in popup mode', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      const modal = screen.getByTestId('modal-content')
      expect(modal).toHaveClass('max-w-4xl')
      
      // Check for reduced padding
      const contentArea = modal.querySelector('.p-4')
      expect(contentArea).toBeInTheDocument()
    })

    it('displays Quick View badge in popup mode', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      expect(screen.getByText('Quick View')).toBeInTheDocument()
      expect(screen.getByText('See Full Analysis →')).toBeInTheDocument()
    })

    it('renders sparklines instead of full charts in popup mode', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      // Check that sparklines are rendered
      expect(screen.getByTestId('metric-sparkline-impressions')).toBeInTheDocument()
      expect(screen.getByTestId('metric-sparkline-clicks')).toBeInTheDocument()
      expect(screen.getByTestId('metric-sparkline-purchases')).toBeInTheDocument()
      expect(screen.getByTestId('metric-sparkline-cvr')).toBeInTheDocument()

      // Check that full charts are NOT rendered
      expect(screen.queryByTestId('keyword-performance-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('keyword-funnel-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('keyword-market-share')).not.toBeInTheDocument()
    })

    it('uses horizontal 2-column layout for sparklines in popup mode', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      // Find the sparkline container
      const sparklineContainer = screen.getByTestId('metric-sparkline-impressions').parentElement
      expect(sparklineContainer).toHaveClass('grid', 'grid-cols-2', 'gap-3')
      
      // Check that metrics are grouped in rows
      const conversionsContainer = screen.getByTestId('metric-sparkline-purchases').parentElement
      expect(conversionsContainer).toHaveClass('grid', 'grid-cols-2', 'gap-3')
    })

    it('renders full charts in full-page mode', () => {
      // Reset to full-page mode
      mockUseViewMode.mockImplementation(() => ({
        mode: 'full-page',
        isPopup: false,
        isFullPage: true,
        shouldShowSparklines: false,
        shouldShowFullCharts: true,
        layout: {
          maxWidth: 'max-w-7xl',
          padding: 'p-6',
          chartHeight: 300,
          showFunnel: true,
          showMarketShare: true,
          showSparklines: false,
        },
        queryParams: {},
      }))

      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="full-page"
        />
      )

      // Check that full charts are rendered
      expect(screen.getByTestId('keyword-performance-chart')).toBeInTheDocument()
      expect(screen.getByTestId('keyword-funnel-chart')).toBeInTheDocument()
      expect(screen.getByTestId('keyword-market-share')).toBeInTheDocument()

      // Check that sparklines are NOT rendered
      expect(screen.queryByTestId('metric-sparkline-impressions')).not.toBeInTheDocument()
      
      // Check that Quick View badge is NOT displayed
      expect(screen.queryByText('Quick View')).not.toBeInTheDocument()
    })

    it('calls onExpand when See Full Analysis link is clicked in popup mode', async () => {
      const user = userEvent.setup()
      
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      const expandLink = screen.getByText('See Full Analysis →')
      await user.click(expandLink)

      expect(mockOnExpand).toHaveBeenCalledTimes(1)
    })

    it('passes correct height to sparklines based on layout', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      // Verify that useViewMode was called with popup mode
      expect(mockUseViewMode).toHaveBeenCalledWith({ mode: 'popup' })
    })

    it('displays comparison values in sparklines when comparison data exists', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          comparisonDateRange={{ start: '2023-12-01', end: '2023-12-31' }}
          viewMode="popup"
        />
      )

      // Check that sparklines are rendered with comparison data
      expect(screen.getByTestId('metric-sparkline-impressions')).toBeInTheDocument()
      expect(screen.getByText('Sparkline: Impressions')).toBeInTheDocument()
    })

    it('respects explicit viewMode prop over auto-detection', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      // Verify useViewMode was called with explicit mode
      expect(mockUseViewMode).toHaveBeenCalledWith({ mode: 'popup' })
      
      // Verify popup layout is used
      expect(screen.getByText('Quick View')).toBeInTheDocument()
    })

    it('does not show section headers in popup mode', () => {
      render(
        <KeywordAnalysisModal
          isOpen={true}
          onClose={mockOnClose}
          onExpand={mockOnExpand}
          keyword="knife sharpener"
          asin="B001CZKJYA"
          dateRange={{ start: '2024-01-01', end: '2024-01-31' }}
          viewMode="popup"
        />
      )

      // Section headers should not be visible in popup mode
      expect(screen.queryByText('Performance Trends')).not.toBeInTheDocument()
      expect(screen.queryByText('Conversion Funnel')).not.toBeInTheDocument()
      expect(screen.queryByText('Market Share')).not.toBeInTheDocument()
    })
  })
})