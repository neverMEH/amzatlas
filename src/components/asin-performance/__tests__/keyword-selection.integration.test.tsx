import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Import components
import { MultiKeywordSelector } from '../MultiKeywordSelector'
import { KeywordComparisonView } from '../KeywordComparisonView'
import { WaterfallChartEnhanced } from '../WaterfallChartEnhanced'

// Mock data
const mockKeywords = [
  'knife sharpener',
  'electric knife sharpener',
  'whetstone',
  'sharpening steel',
  'knife sharpening system',
  'manual knife sharpener',
  'professional knife sharpener',
  'ceramic knife sharpener',
  'diamond knife sharpener',
  'pocket knife sharpener'
]

const mockKeywordsWithMetrics = [
  {
    keyword: 'knife sharpener',
    impressions: 150000,
    clicks: 7500,
    purchases: 300,
    ctr: 5.0,
    cvr: 4.0
  },
  {
    keyword: 'electric knife sharpener',
    impressions: 80000,
    clicks: 3200,
    purchases: 96,
    ctr: 4.0,
    cvr: 3.0
  },
  {
    keyword: 'whetstone',
    impressions: 60000,
    clicks: 3000,
    purchases: 150,
    ctr: 5.0,
    cvr: 5.0
  },
  {
    keyword: 'sharpening steel',
    impressions: 45000,
    clicks: 1800,
    purchases: 54,
    ctr: 4.0,
    cvr: 3.0
  },
  {
    keyword: 'knife sharpening system',
    impressions: 30000,
    clicks: 1500,
    purchases: 60,
    ctr: 5.0,
    cvr: 4.0
  },
  {
    keyword: 'manual knife sharpener',
    impressions: 25000,
    clicks: 1250,
    purchases: 50,
    ctr: 5.0,
    cvr: 4.0
  },
  {
    keyword: 'professional knife sharpener',
    impressions: 20000,
    clicks: 800,
    purchases: 32,
    ctr: 4.0,
    cvr: 4.0
  },
  {
    keyword: 'ceramic knife sharpener',
    impressions: 15000,
    clicks: 600,
    purchases: 24,
    ctr: 4.0,
    cvr: 4.0
  },
  {
    keyword: 'diamond knife sharpener',
    impressions: 10000,
    clicks: 500,
    purchases: 25,
    ctr: 5.0,
    cvr: 5.0
  },
  {
    keyword: 'pocket knife sharpener',
    impressions: 8000,
    clicks: 320,
    purchases: 16,
    ctr: 4.0,
    cvr: 5.0
  }
]

// Mock API hooks
vi.mock('@/lib/api/keyword-analysis', () => ({
  useKeywordMetrics: vi.fn(() => ({
    data: {
      keywords: mockKeywordsWithMetrics
    },
    isLoading: false,
    error: null
  })),
  useKeywordComparison: vi.fn((params) => {
    const mockData = {
      'knife sharpener': {
        impressions: { current: 150000, previous: 100000, change: 50000, changePercent: 50 },
        clicks: { current: 7500, previous: 4000, change: 3500, changePercent: 87.5 },
        cartAdds: { current: 600, previous: 400, change: 200, changePercent: 50 },
        purchases: { current: 300, previous: 150, change: 150, changePercent: 100 }
      },
      'electric knife sharpener': {
        impressions: { current: 80000, previous: 100000, change: -20000, changePercent: -20 },
        clicks: { current: 3200, previous: 4000, change: -800, changePercent: -20 },
        cartAdds: { current: 192, previous: 240, change: -48, changePercent: -20 },
        purchases: { current: 96, previous: 120, change: -24, changePercent: -20 }
      },
      'whetstone': {
        impressions: { current: 60000, previous: 60000, change: 0, changePercent: 0 },
        clicks: { current: 3000, previous: 3000, change: 0, changePercent: 0 },
        cartAdds: { current: 300, previous: 300, change: 0, changePercent: 0 },
        purchases: { current: 150, previous: 150, change: 0, changePercent: 0 }
      }
    }

    const selectedKeywords = params.keywords || []
    const filteredData: any = {}
    selectedKeywords.forEach(keyword => {
      if (mockData[keyword]) {
        filteredData[keyword] = mockData[keyword]
      }
    })

    return {
      data: { comparisons: filteredData },
      isLoading: false,
      error: null
    }
  }),
  useKeywordTimeSeries: vi.fn(() => ({
    data: {
      timeSeries: [
        { date: '2024-08-01', 'knife sharpener': 140000, 'electric knife sharpener': 90000, 'whetstone': 58000 },
        { date: '2024-08-08', 'knife sharpener': 145000, 'electric knife sharpener': 85000, 'whetstone': 59000 },
        { date: '2024-08-15', 'knife sharpener': 148000, 'electric knife sharpener': 82000, 'whetstone': 60000 },
        { date: '2024-08-22', 'knife sharpener': 150000, 'electric knife sharpener': 80000, 'whetstone': 60000 }
      ]
    },
    isLoading: false,
    error: null
  }))
}))

// Integration Test Component
function KeywordSelectionFlow({ onSelectionComplete }: { onSelectionComplete?: (keywords: string[]) => void }) {
  const [selectedKeywords, setSelectedKeywords] = React.useState<string[]>([])
  const [showComparison, setShowComparison] = React.useState(false)

  const handleSelectionChange = (keywords: string[]) => {
    setSelectedKeywords(keywords)
    if (keywords.length >= 2 && onSelectionComplete) {
      onSelectionComplete(keywords)
    }
  }

  const handleCompare = () => {
    if (selectedKeywords.length >= 2) {
      setShowComparison(true)
    }
  }

  return (
    <div>
      {!showComparison ? (
        <div>
          <MultiKeywordSelector
            asin="B07KF7XKN1"
            availableKeywords={mockKeywords}
            keywordsWithMetrics={mockKeywordsWithMetrics}
            selectedKeywords={selectedKeywords}
            onSelectionChange={handleSelectionChange}
            maxKeywords={5}
          />
          {selectedKeywords.length >= 2 && (
            <button 
              onClick={handleCompare}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
            >
              Compare Selected Keywords
            </button>
          )}
        </div>
      ) : (
        <KeywordComparisonView
          asin="B07KF7XKN1"
          keywords={selectedKeywords}
          dateRange={{ startDate: '2024-08-01', endDate: '2024-08-22' }}
          comparisonDateRange={{ startDate: '2024-07-01', endDate: '2024-07-22' }}
        />
      )}
    </div>
  )
}

describe('Keyword Selection Integration Flow', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const renderWithProvider = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    )
  }

  test('complete flow: select keywords → view comparison → interact with charts', async () => {
    const user = userEvent.setup()
    const onSelectionComplete = vi.fn()
    
    renderWithProvider(<KeywordSelectionFlow onSelectionComplete={onSelectionComplete} />)

    // Step 1: Verify keyword selector is displayed with KPIs
    expect(screen.getByPlaceholderText('Search keywords...')).toBeInTheDocument()
    
    // Wait for keywords to load
    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    // Verify KPI columns are shown
    expect(screen.getByText('Keyword')).toBeInTheDocument()
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('Clicks')).toBeInTheDocument()
    expect(screen.getByText('Purchases')).toBeInTheDocument()
    expect(screen.getByText('CTR')).toBeInTheDocument()
    expect(screen.getByText('CVR')).toBeInTheDocument()

    // Step 2: Select multiple keywords
    const rows = screen.getAllByRole('row').slice(1) // Skip header row
    
    // Click first keyword checkbox
    const firstCheckbox = within(rows[0]).getByRole('checkbox')
    await user.click(firstCheckbox)
    expect(firstCheckbox).toBeChecked()

    // Click second keyword checkbox
    const secondCheckbox = within(rows[1]).getByRole('checkbox')
    await user.click(secondCheckbox)
    expect(secondCheckbox).toBeChecked()

    // Click third keyword checkbox
    const thirdCheckbox = within(rows[2]).getByRole('checkbox')
    await user.click(thirdCheckbox)
    expect(thirdCheckbox).toBeChecked()

    // Verify selection callback
    expect(onSelectionComplete).toHaveBeenCalledWith(['knife sharpener', 'electric knife sharpener', 'whetstone'])

    // Step 3: Click compare button
    const compareButton = screen.getByText('Compare Selected Keywords')
    expect(compareButton).toBeInTheDocument()
    await user.click(compareButton)

    // Step 4: Verify comparison view is displayed
    await waitFor(() => {
      expect(screen.getByText('Keyword Comparison')).toBeInTheDocument()
    })

    // Verify tabs are present
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Market Share')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
    expect(screen.getByText('Waterfall')).toBeInTheDocument()

    // Step 5: Test tab switching
    const marketShareTab = screen.getByText('Market Share')
    await user.click(marketShareTab)

    // Verify market share content
    await waitFor(() => {
      expect(screen.getByText(/View:/)).toBeInTheDocument()
    })

    // Step 6: Test waterfall chart functionality
    const waterfallTab = screen.getByText('Waterfall')
    await user.click(waterfallTab)

    // Verify waterfall chart controls
    await waitFor(() => {
      expect(screen.getByText('Sort:')).toBeInTheDocument()
      expect(screen.getByText('Show:')).toBeInTheDocument()
    })
  })

  test('validates minimum keyword selection', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(<KeywordSelectionFlow />)

    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    // Select only one keyword
    const rows = screen.getAllByRole('row').slice(1)
    const firstCheckbox = within(rows[0]).getByRole('checkbox')
    await user.click(firstCheckbox)

    // Compare button should not appear with only one selection
    expect(screen.queryByText('Compare Selected Keywords')).not.toBeInTheDocument()

    // Select second keyword
    const secondCheckbox = within(rows[1]).getByRole('checkbox')
    await user.click(secondCheckbox)

    // Now compare button should appear
    expect(screen.getByText('Compare Selected Keywords')).toBeInTheDocument()
  })

  test('handles keyword search and filtering', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(<KeywordSelectionFlow />)

    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    // Search for specific keyword
    const searchInput = screen.getByPlaceholderText('Search keywords...')
    await user.type(searchInput, 'electric')

    // Verify filtered results
    expect(screen.getByText('electric knife sharpener')).toBeInTheDocument()
    expect(screen.queryByText('whetstone')).not.toBeInTheDocument()
    expect(screen.queryByText('sharpening steel')).not.toBeInTheDocument()

    // Clear search
    await user.clear(searchInput)

    // All keywords should be visible again
    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
      expect(screen.getByText('whetstone')).toBeInTheDocument()
      expect(screen.getByText('sharpening steel')).toBeInTheDocument()
    })
  })

  test('handles sorting in keyword selector', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(<KeywordSelectionFlow />)

    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    // Click impressions header to sort
    const impressionsHeader = screen.getByRole('columnheader', { name: /impressions/i })
    await user.click(impressionsHeader)

    // Verify sorting (descending by default)
    const rows = screen.getAllByRole('row').slice(1)
    const firstRowText = within(rows[0]).getByText('knife sharpener')
    expect(firstRowText).toBeInTheDocument()

    // Click again for ascending
    await user.click(impressionsHeader)

    // Verify reversed order
    const updatedRows = screen.getAllByRole('row').slice(1)
    const lastRowText = within(updatedRows[4]).getByText('knife sharpener')
    expect(lastRowText).toBeInTheDocument()
  })

  test('respects maximum selection limit', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(<KeywordSelectionFlow />)

    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    // Select 5 keywords (the max)
    const rows = screen.getAllByRole('row').slice(1)
    
    for (let i = 0; i < 5; i++) {
      const checkbox = within(rows[i]).getByRole('checkbox')
      await user.click(checkbox)
      expect(checkbox).toBeChecked()
    }

    // Verify selection count
    expect(screen.getByText('5 of 5 keywords selected')).toBeInTheDocument()

    // Try to select 6th keyword - it should be disabled
    if (rows.length > 5) {
      const sixthCheckbox = within(rows[5]).getByRole('checkbox')
      expect(sixthCheckbox).toBeDisabled()
    }
  })

  test('handles errors gracefully', async () => {
    // Component needs to handle missing data gracefully
    renderWithProvider(<KeywordSelectionFlow />)

    // With empty keywords array, should show appropriate state
    const searchInput = screen.getByPlaceholderText('Search keywords...')
    expect(searchInput).toBeInTheDocument()
    
    // Should show no results message when no keywords available
    expect(screen.getByText(/no keywords found/i)).toBeInTheDocument()
  })

  test('shows loading state during data fetch', async () => {
    // Mock loading state
    const keywordAnalysis = await import('@/lib/api/keyword-analysis')
    vi.mocked(keywordAnalysis.useKeywordMetrics).mockReturnValueOnce({
      data: null,
      isLoading: true,
      error: null
    } as any)

    renderWithProvider(<KeywordSelectionFlow />)

    // Should show loading indicator
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  test('waterfall chart interaction in comparison view', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(<KeywordSelectionFlow />)

    // Quick selection and navigation to comparison
    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row').slice(1)
    await user.click(within(rows[0]).getByRole('checkbox'))
    await user.click(within(rows[1]).getByRole('checkbox'))
    await user.click(within(rows[2]).getByRole('checkbox'))
    
    await user.click(screen.getByText('Compare Selected Keywords'))

    // Navigate to waterfall tab
    await user.click(screen.getByText('Waterfall'))

    // Test view mode toggle
    await waitFor(() => {
      expect(screen.getByText('Waterfall')).toBeInTheDocument()
      expect(screen.getByText('Side-by-Side')).toBeInTheDocument()
    })

    // Switch to side-by-side view
    await user.click(screen.getByRole('button', { name: /side-by-side/i }))

    // Should show table
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    // Test sorting change
    const sortSelect = screen.getByText('Sort:').nextElementSibling as HTMLSelectElement
    await user.selectOptions(sortSelect, 'alphabetical')

    // Test show top N change
    const showSelect = screen.getByText('Show:').nextElementSibling as HTMLSelectElement
    await user.selectOptions(showSelect, '5')
  })

  test('market share chart interactions', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(<KeywordSelectionFlow />)

    // Quick selection
    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row').slice(1)
    await user.click(within(rows[0]).getByRole('checkbox'))
    await user.click(within(rows[1]).getByRole('checkbox'))
    
    await user.click(screen.getByText('Compare Selected Keywords'))

    // Navigate to market share tab
    await user.click(screen.getByText('Market Share'))

    // Test view toggle
    await waitFor(() => {
      expect(screen.getByLabelText(/view/i)).toBeInTheDocument()
    })

    const viewSelect = screen.getByLabelText(/view/i) as HTMLSelectElement
    
    // Should default to bar chart based on implementation
    expect(viewSelect.value).toBe('bar')

    // Switch to pie chart
    await user.selectOptions(viewSelect, 'pie')
    
    // Verify metric selector is present
    expect(screen.getByText('Metric:')).toBeInTheDocument()
  })

  test('maintains state when switching between tabs', async () => {
    const user = userEvent.setup()
    
    renderWithProvider(<KeywordSelectionFlow />)

    // Select keywords and navigate to comparison
    await waitFor(() => {
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    })

    const rows = screen.getAllByRole('row').slice(1)
    await user.click(within(rows[0]).getByRole('checkbox'))
    await user.click(within(rows[1]).getByRole('checkbox'))
    
    await user.click(screen.getByText('Compare Selected Keywords'))

    // Navigate to waterfall and change settings
    await user.click(screen.getByText('Waterfall'))
    
    await waitFor(() => {
      expect(screen.getByText('Sort:')).toBeInTheDocument()
    })

    const sortSelect = screen.getByText('Sort:').nextElementSibling as HTMLSelectElement
    await user.selectOptions(sortSelect, 'percentage')

    // Switch to another tab
    await user.click(screen.getByText('Overview'))

    // Come back to waterfall
    await user.click(screen.getByText('Waterfall'))

    // Settings should be maintained (component state persistence)
    expect(sortSelect.value).toBe('percentage')
  })
})