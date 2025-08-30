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
})