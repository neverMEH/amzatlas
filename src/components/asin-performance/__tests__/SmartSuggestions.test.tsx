import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SmartSuggestions } from '../SmartSuggestions'
import type { DateRange, ComparisonPeriod } from '@/lib/date-utils/comparison-period'

describe('SmartSuggestions', () => {
  const mockOnSelect = vi.fn()
  const defaultDateRange: DateRange = {
    start: '2024-01-08',
    end: '2024-01-14',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders smart suggestions based on date range', () => {
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
      />
    )

    // Should show suggestions for a weekly period
    expect(screen.getByText('Previous Week')).toBeInTheDocument()
    expect(screen.getByText('Same Week Last Month')).toBeInTheDocument()
    expect(screen.getByText('Same Week Last Year')).toBeInTheDocument()
  })

  it('shows loading state while calculating suggestions', async () => {
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
        isCalculating={true}
      />
    )

    expect(screen.getByTestId('suggestions-loading')).toBeInTheDocument()
    expect(screen.queryByText('Previous Week')).not.toBeInTheDocument()
  })

  it('displays suggestion metadata on hover', async () => {
    const user = userEvent.setup()
    
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
      />
    )

    const firstSuggestion = screen.getByText('Previous Week').closest('[role="button"]')
    await user.hover(firstSuggestion!)

    // Wait for tooltip to appear
    await waitFor(() => {
      const tooltips = screen.getAllByRole('tooltip')
      // Get the visible tooltip (not the aria-hidden one)
      const visibleTooltip = tooltips.find(t => !t.getAttribute('style')?.includes('position: absolute'))
      expect(visibleTooltip).toBeInTheDocument()
    })

    // Check tooltip content
    const tooltips = screen.getAllByRole('tooltip')
    const visibleTooltip = tooltips.find(t => !t.getAttribute('style')?.includes('position: absolute'))!
    expect(visibleTooltip).toHaveTextContent('Jan 1 - 7, 2024')
    expect(visibleTooltip).toHaveTextContent('Most recent comparable period')
  })

  it('handles suggestion selection', async () => {
    const user = userEvent.setup()
    
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
      />
    )

    const suggestion = screen.getByText('Previous Week').closest('[role="button"]')
    await user.click(suggestion!)

    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        start: '2024-01-01',
        end: '2024-01-07',
        type: 'weekly',
        label: 'Previous Week',
      })
    )
  })

  it('shows selected state for current comparison', () => {
    const currentComparison: ComparisonPeriod = {
      start: '2024-01-01',
      end: '2024-01-07',
      type: 'weekly',
      label: 'Previous Week',
    }

    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        currentComparison={currentComparison}
        onSelect={mockOnSelect}
      />
    )

    const selectedSuggestion = screen.getByText('Previous Week').closest('[role="button"]')
    expect(selectedSuggestion).toHaveClass('ring-2', 'ring-blue-500')
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
      />
    )

    // Tab to first suggestion
    await user.tab()
    const firstSuggestion = screen.getByText('Previous Week').closest('[role="button"]')
    expect(firstSuggestion).toHaveFocus()

    // Press Enter to select
    await user.keyboard('{Enter}')
    expect(mockOnSelect).toHaveBeenCalled()
  })

  it('displays monthly suggestions for monthly date ranges', () => {
    const monthlyRange: DateRange = {
      start: '2024-01-01',
      end: '2024-01-31',
    }

    render(
      <SmartSuggestions
        dateRange={monthlyRange}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('Previous Month')).toBeInTheDocument()
    expect(screen.getByText('Same Month Last Year')).toBeInTheDocument()
  })

  it('shows data availability warnings', () => {
    const oldDateRange: DateRange = {
      start: '2021-01-01',
      end: '2021-01-31',
    }

    render(
      <SmartSuggestions
        dateRange={oldDateRange}
        onSelect={mockOnSelect}
      />
    )

    // Should show multiple warnings for old data
    const warnings = screen.getAllByText(/Limited data availability/)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('displays confidence indicators', () => {
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
      />
    )

    // High confidence for recent comparisons
    const recentSuggestion = screen.getByText('Previous Week').closest('[data-testid="suggestion-card"]')
    const highConfidenceInRecentSuggestion = recentSuggestion?.querySelector('[data-testid="confidence-high"]')
    expect(highConfidenceInRecentSuggestion).toBeInTheDocument()

    // Lower confidence for older comparisons
    const yearAgoSuggestion = screen.getByText('Same Week Last Year').closest('[data-testid="suggestion-card"]')
    const mediumConfidenceInYearAgoSuggestion = yearAgoSuggestion?.querySelector('[data-testid="confidence-medium"]')
    expect(mediumConfidenceInYearAgoSuggestion).toBeInTheDocument()
  })

  it('handles custom period suggestions', () => {
    const customRange: DateRange = {
      start: '2024-01-10',
      end: '2024-01-20',
    }

    render(
      <SmartSuggestions
        dateRange={customRange}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('Previous 11 Days')).toBeInTheDocument()
  })

  it('limits suggestions to maxSuggestions prop', () => {
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
        maxSuggestions={2}
      />
    )

    const suggestions = screen.getAllByTestId('suggestion-card')
    expect(suggestions).toHaveLength(2)
  })

  it('applies custom className', () => {
    render(
      <SmartSuggestions
        dateRange={defaultDateRange}
        onSelect={mockOnSelect}
        className="custom-class"
      />
    )

    const container = screen.getByTestId('smart-suggestions')
    expect(container).toHaveClass('custom-class')
  })

  it('handles error states gracefully', () => {
    // Test with invalid date range
    const invalidRange: DateRange = {
      start: 'invalid-date',
      end: '2024-01-14',
    }

    render(
      <SmartSuggestions
        dateRange={invalidRange}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText(/Unable to generate suggestions/)).toBeInTheDocument()
  })
})