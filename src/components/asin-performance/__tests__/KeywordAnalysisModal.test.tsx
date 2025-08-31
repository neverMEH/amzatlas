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
})