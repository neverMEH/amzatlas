import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MultiKeywordSelector } from '../MultiKeywordSelector'
import '@testing-library/jest-dom'

// Mock the API hook
jest.mock('@/lib/api/keyword-analysis', () => ({
  useKeywordMetrics: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}))

describe('MultiKeywordSelector with KPI Data', () => {
  let mockOnSelectionChange: jest.Mock
  let queryClient: QueryClient

  const defaultProps = {
    availableKeywords: [
      'knife sharpener',
      'electric knife sharpener',
      'whetstone',
      'sharpening steel',
      'diamond sharpener',
      'ceramic sharpener',
      'pocket sharpener',
      'professional sharpener',
      'kitchen knife sharpener',
      'hunting knife sharpener',
    ],
    selectedKeywords: [],
    onSelectionChange: jest.fn(),
    maxKeywords: 5,
    asin: 'B07HJBWX8J',
    startDate: '2024-08-01',
    endDate: '2024-08-31',
  }

  const mockMetricsData = [
    {
      keyword: 'knife sharpener',
      impressions: 150000,
      clicks: 7500,
      cartAdds: 600,
      purchases: 300,
      ctr: 5.0,
      cvr: 4.0,
    },
    {
      keyword: 'electric knife sharpener',
      impressions: 120000,
      clicks: 4800,
      cartAdds: 400,
      purchases: 200,
      ctr: 4.0,
      cvr: 4.2,
    },
    {
      keyword: 'whetstone',
      impressions: 80000,
      clicks: 3200,
      cartAdds: 280,
      purchases: 140,
      ctr: 4.0,
      cvr: 4.4,
    },
    {
      keyword: 'sharpening steel',
      impressions: 60000,
      clicks: 2400,
      cartAdds: 180,
      purchases: 90,
      ctr: 4.0,
      cvr: 3.8,
    },
    {
      keyword: 'diamond sharpener',
      impressions: 40000,
      clicks: 2000,
      cartAdds: 160,
      purchases: 80,
      ctr: 5.0,
      cvr: 4.0,
    },
  ]

  beforeEach(() => {
    mockOnSelectionChange = jest.fn()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MultiKeywordSelector
          {...defaultProps}
          {...props}
          onSelectionChange={mockOnSelectionChange}
          keywordsWithMetrics={mockMetricsData}
        />
      </QueryClientProvider>
    )
  }

  describe('Rendering and Layout', () => {
    test('renders with KPI table layout', () => {
      renderComponent()

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('Keyword')).toBeInTheDocument()
      expect(screen.getByText('Impressions')).toBeInTheDocument()
      expect(screen.getByText('Clicks')).toBeInTheDocument()
      expect(screen.getByText('Purchases')).toBeInTheDocument()
      expect(screen.getByText('CTR')).toBeInTheDocument()
      expect(screen.getByText('CVR')).toBeInTheDocument()
    })

    test('displays metrics for each keyword', () => {
      renderComponent()

      // Check first keyword metrics
      const firstRow = screen.getByText('knife sharpener').closest('tr')!
      expect(within(firstRow).getByText('150K')).toBeInTheDocument() // impressions
      expect(within(firstRow).getByText('7.5K')).toBeInTheDocument() // clicks
      expect(within(firstRow).getByText('300')).toBeInTheDocument() // purchases
      expect(within(firstRow).getByText('5.0%')).toBeInTheDocument() // CTR
      expect(within(firstRow).getByText('4.0%')).toBeInTheDocument() // CVR
    })

    test('shows loading state while fetching metrics', () => {
      renderComponent({ metricsLoading: true })

      expect(screen.getByText(/Loading keyword metrics/i)).toBeInTheDocument()
    })

    test('formats large numbers correctly', () => {
      const largeNumberMetrics = [{
        ...mockMetricsData[0],
        impressions: 1500000,
        clicks: 75000,
        purchases: 3000,
      }]

      renderComponent({ keywordsWithMetrics: largeNumberMetrics })

      const row = screen.getByText('knife sharpener').closest('tr')!
      expect(within(row).getByText('1.5M')).toBeInTheDocument() // impressions
      expect(within(row).getByText('75K')).toBeInTheDocument() // clicks
      expect(within(row).getByText('3K')).toBeInTheDocument() // purchases
    })
  })

  describe('Sorting Functionality', () => {
    test('sorts by impressions by default (descending)', () => {
      renderComponent()

      const rows = screen.getAllByRole('row').slice(1) // Skip header
      const keywords = rows.map(row => within(row).getAllByRole('cell')[1].textContent)

      expect(keywords[0]).toBe('knife sharpener')
      expect(keywords[1]).toBe('electric knife sharpener')
      expect(keywords[2]).toBe('whetstone')
    })

    test('sorts by clicks when header clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      const clicksHeader = screen.getByRole('button', { name: /clicks/i })
      await user.click(clicksHeader)

      await waitFor(() => {
        const rows = screen.getAllByRole('row').slice(1)
        const firstRowKeyword = within(rows[0]).getAllByRole('cell')[1].textContent
        expect(firstRowKeyword).toBe('knife sharpener')
      })
    })

    test('toggles sort direction on repeated clicks', async () => {
      const user = userEvent.setup()
      renderComponent()

      const impressionsHeader = screen.getByRole('button', { name: /impressions/i })
      
      // First click - should be descending
      await user.click(impressionsHeader)
      let rows = screen.getAllByRole('row').slice(1)
      expect(within(rows[0]).getAllByRole('cell')[1].textContent).toBe('knife sharpener')

      // Second click - should be ascending
      await user.click(impressionsHeader)
      await waitFor(() => {
        rows = screen.getAllByRole('row').slice(1)
        const lastRow = rows[rows.length - 1]
        expect(within(lastRow).getAllByRole('cell')[1].textContent).toBe('knife sharpener')
      })
    })

    test('sorts by CVR correctly', async () => {
      const user = userEvent.setup()
      renderComponent()

      const cvrHeader = screen.getByRole('button', { name: /cvr/i })
      await user.click(cvrHeader)

      await waitFor(() => {
        const rows = screen.getAllByRole('row').slice(1)
        const firstRowKeyword = within(rows[0]).getAllByRole('cell')[1].textContent
        expect(firstRowKeyword).toBe('whetstone') // Has highest CVR (4.4%)
      })
    })
  })

  describe('Pagination', () => {
    const manyKeywords = Array.from({ length: 60 }, (_, i) => ({
      keyword: `keyword-${i}`,
      impressions: (60 - i) * 1000,
      clicks: (60 - i) * 50,
      purchases: (60 - i) * 2,
      ctr: 5.0,
      cvr: 4.0,
    }))

    test('limits display to 25 items per page', () => {
      renderComponent({ 
        availableKeywords: manyKeywords.map(k => k.keyword),
        keywordsWithMetrics: manyKeywords 
      })

      const rows = screen.getAllByRole('row').slice(1) // Skip header
      expect(rows).toHaveLength(25)
    })

    test('shows pagination controls when more than 25 items', () => {
      renderComponent({ 
        availableKeywords: manyKeywords.map(k => k.keyword),
        keywordsWithMetrics: manyKeywords 
      })

      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
      expect(screen.getByText('Showing 1-25 of 60 keywords')).toBeInTheDocument()
    })

    test('navigates between pages', async () => {
      const user = userEvent.setup()
      renderComponent({ 
        availableKeywords: manyKeywords.map(k => k.keyword),
        keywordsWithMetrics: manyKeywords 
      })

      // Click next page
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      await waitFor(() => {
        expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
        expect(screen.getByText('Showing 26-50 of 60 keywords')).toBeInTheDocument()
      })

      // Check that different keywords are displayed
      const rows = screen.getAllByRole('row').slice(1)
      expect(within(rows[0]).getAllByRole('cell')[1].textContent).toBe('keyword-25')
    })

    test('resets to page 1 when filters change', async () => {
      const user = userEvent.setup()
      renderComponent({ 
        availableKeywords: manyKeywords.map(k => k.keyword),
        keywordsWithMetrics: manyKeywords 
      })

      // Go to page 2
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      // Apply search filter
      const searchInput = screen.getByPlaceholderText('Search keywords...')
      await user.type(searchInput, 'keyword-1')

      await waitFor(() => {
        expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
      })
    })
  })

  describe('Filtering', () => {
    test('filters by search term', async () => {
      const user = userEvent.setup()
      renderComponent()

      const searchInput = screen.getByPlaceholderText('Search keywords...')
      await user.type(searchInput, 'electric')

      await waitFor(() => {
        const rows = screen.getAllByRole('row').slice(1)
        expect(rows).toHaveLength(1)
        expect(within(rows[0]).getByText('electric knife sharpener')).toBeInTheDocument()
      })
    })

    test('shows filters panel when clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      const filtersButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filtersButton)

      expect(screen.getByLabelText('Min Impressions')).toBeInTheDocument()
      expect(screen.getByLabelText('Min Purchases')).toBeInTheDocument()
    })

    test('filters by minimum impressions', async () => {
      const user = userEvent.setup()
      renderComponent()

      // Open filters
      const filtersButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filtersButton)

      // Set minimum impressions to 100000
      const minImpressionsInput = screen.getByLabelText('Min Impressions')
      await user.type(minImpressionsInput, '100000')

      await waitFor(() => {
        const rows = screen.getAllByRole('row').slice(1)
        expect(rows).toHaveLength(2) // Only two keywords have 100k+ impressions
      })
    })

    test('clears filters when clear button clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      // Apply filters
      const filtersButton = screen.getByRole('button', { name: /filters/i })
      await user.click(filtersButton)

      const minImpressionsInput = screen.getByLabelText('Min Impressions')
      await user.type(minImpressionsInput, '100000')

      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear filters/i })
      await user.click(clearButton)

      await waitFor(() => {
        expect(minImpressionsInput).toHaveValue('')
        const rows = screen.getAllByRole('row').slice(1)
        expect(rows.length).toBeGreaterThan(2)
      })
    })
  })

  describe('Selection Management', () => {
    test('selects keyword when checkbox clicked', async () => {
      const user = userEvent.setup()
      renderComponent()

      const firstCheckbox = screen.getAllByRole('checkbox')[1] // Skip header checkbox
      await user.click(firstCheckbox)

      expect(mockOnSelectionChange).toHaveBeenCalledWith(['knife sharpener'])
    })

    test('respects maxKeywords limit', async () => {
      const user = userEvent.setup()
      renderComponent({ 
        selectedKeywords: ['keyword1', 'keyword2', 'keyword3', 'keyword4', 'keyword5'],
        maxKeywords: 5 
      })

      expect(screen.getByText('Maximum keywords selected')).toBeInTheDocument()
      
      // Try to select another keyword
      const checkboxes = screen.getAllByRole('checkbox').slice(1)
      const unselectedCheckbox = checkboxes.find(cb => !cb.checked)
      expect(unselectedCheckbox).toBeDisabled()
    })

    test('select all selects visible keywords up to limit', async () => {
      const user = userEvent.setup()
      renderComponent({ maxKeywords: 3 })

      const selectAllButton = screen.getByRole('button', { name: /select visible/i })
      await user.click(selectAllButton)

      expect(mockOnSelectionChange).toHaveBeenCalledWith([
        'knife sharpener',
        'electric knife sharpener',
        'whetstone'
      ])
    })

    test('header checkbox shows indeterminate state', async () => {
      const user = userEvent.setup()
      renderComponent()

      // Select one keyword
      const firstCheckbox = screen.getAllByRole('checkbox')[1]
      await user.click(firstCheckbox)

      // Header checkbox should be indeterminate
      const headerCheckbox = screen.getAllByRole('checkbox')[0]
      expect(headerCheckbox).toHaveProperty('indeterminate', true)
    })

    test('clear all button deselects all keywords', async () => {
      const user = userEvent.setup()
      renderComponent({ 
        selectedKeywords: ['knife sharpener', 'electric knife sharpener'] 
      })

      const clearAllButton = screen.getByRole('button', { name: /clear all/i })
      await user.click(clearAllButton)

      expect(mockOnSelectionChange).toHaveBeenCalledWith([])
    })
  })

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      renderComponent()

      const checkboxes = screen.getAllByRole('checkbox').slice(1)
      checkboxes.forEach((checkbox, index) => {
        const keyword = defaultProps.availableKeywords[index]
        expect(checkbox).toHaveAttribute('aria-label', expect.stringContaining(keyword))
      })
    })

    test('table headers have sort buttons with proper labels', () => {
      renderComponent()

      expect(screen.getByRole('button', { name: /sort by keyword/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by impressions/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by ctr/i })).toBeInTheDocument()
    })

    test('disabled checkboxes have proper disabled state', () => {
      renderComponent({ 
        selectedKeywords: Array(5).fill('').map((_, i) => `keyword${i}`),
        maxKeywords: 5 
      })

      const unselectedCheckboxes = screen.getAllByRole('checkbox').filter(cb => !cb.checked)
      unselectedCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeDisabled()
      })
    })
  })

  describe('Performance Considerations', () => {
    test('handles empty metrics gracefully', () => {
      renderComponent({ keywordsWithMetrics: [] })

      const rows = screen.getAllByRole('row').slice(1)
      rows.forEach(row => {
        const cells = within(row).getAllByRole('cell')
        // Metrics columns should show '-'
        expect(cells[2].textContent).toBe('-') // impressions
        expect(cells[3].textContent).toBe('-') // clicks
        expect(cells[4].textContent).toBe('-') // purchases
        expect(cells[5].textContent).toBe('-') // CTR
        expect(cells[6].textContent).toBe('-') // CVR
      })
    })

    test('handles missing metric values', () => {
      const incompleteMetrics = [{
        keyword: 'knife sharpener',
        impressions: 150000,
        // Missing other fields
      }]

      renderComponent({ keywordsWithMetrics: incompleteMetrics as any })

      const row = screen.getByText('knife sharpener').closest('tr')!
      expect(within(row).getByText('150K')).toBeInTheDocument()
      expect(within(row).getAllByText('0').length).toBeGreaterThan(0)
    })

    test('maintains selection state across re-renders', () => {
      const { rerender } = renderComponent({ selectedKeywords: ['knife sharpener'] })

      // Verify initial selection
      const firstCheckbox = screen.getAllByRole('checkbox')[1]
      expect(firstCheckbox).toBeChecked()

      // Re-render with different props
      rerender(
        <QueryClientProvider client={queryClient}>
          <MultiKeywordSelector
            {...defaultProps}
            selectedKeywords={['knife sharpener']}
            onSelectionChange={mockOnSelectionChange}
            keywordsWithMetrics={mockMetricsData}
            asin="B07HJBWX8K" // Different ASIN
          />
        </QueryClientProvider>
      )

      // Selection should be maintained
      expect(firstCheckbox).toBeChecked()
    })
  })
})