import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MultiKeywordSelector } from '../MultiKeywordSelector'

// Mock the keyword metrics hook
vi.mock('@/lib/api/keyword-analysis', () => ({
  useKeywordMetrics: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  type: {
    KeywordKPI: {},
  }
}))

const mockKeywords = [
  'knife sharpener',
  'electric knife sharpener',
  'manual knife sharpener',
  'kitchen knife sharpener',
  'professional knife sharpener',
  'knife sharpening stone',
  'whetstone',
  'sharpening steel',
  'knife sharpening system',
  'portable knife sharpener',
  'ceramic knife sharpener',
  'diamond knife sharpener',
]

// Test wrapper with QueryClient
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('MultiKeywordSelector', () => {
  it('renders keyword selector with search', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={[]}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    expect(screen.getByPlaceholderText('Search keywords...')).toBeInTheDocument()
    expect(screen.getByText('0 / 10 keywords selected')).toBeInTheDocument()
  })

  it('displays available keywords', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={[]}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    expect(screen.getByText('knife sharpener')).toBeInTheDocument()
    expect(screen.getByText('electric knife sharpener')).toBeInTheDocument()
    expect(screen.getByText('whetstone')).toBeInTheDocument()
  })

  it('filters keywords based on search', async () => {
    const user = userEvent.setup()
    
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={[]}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    const searchInput = screen.getByPlaceholderText('Search keywords...')
    await user.type(searchInput, 'electric')

    expect(screen.getByText('electric knife sharpener')).toBeInTheDocument()
    expect(screen.queryByText('manual knife sharpener')).not.toBeInTheDocument()
    expect(screen.queryByText('whetstone')).not.toBeInTheDocument()
  })

  it('allows selecting keywords', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={[]}
        onSelectionChange={onSelectionChange}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    const keyword = screen.getByText('knife sharpener')
    await user.click(keyword)

    expect(onSelectionChange).toHaveBeenCalledWith(['knife sharpener'])
  })

  it('shows selected keywords', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={['knife sharpener', 'whetstone']}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    expect(screen.getByText('2 / 10 keywords selected')).toBeInTheDocument()
    
    // Check for selected state
    const selectedKeyword = screen.getByText('knife sharpener').closest('[data-testid="keyword-item"]')
    expect(selectedKeyword).toHaveClass('bg-blue-50')
  })

  it('allows deselecting keywords', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={['knife sharpener']}
        onSelectionChange={onSelectionChange}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    const keyword = screen.getByText('knife sharpener')
    await user.click(keyword)

    expect(onSelectionChange).toHaveBeenCalledWith([])
  })

  it('prevents selecting more than max keywords', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={['keyword1', 'keyword2', 'keyword3']}
        onSelectionChange={onSelectionChange}
        maxKeywords={3}
      />,
      { wrapper: TestWrapper }
    )

    expect(screen.getByText('3 / 3 keywords selected')).toBeInTheDocument()
    
    const unselectedKeyword = screen.getByText('knife sharpener')
    await user.click(unselectedKeyword)

    // Should not call onSelectionChange when at max
    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('shows warning when at max selection', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={['keyword1', 'keyword2', 'keyword3']}
        onSelectionChange={() => {}}
        maxKeywords={3}
      />,
      { wrapper: TestWrapper }
    )

    expect(screen.getByText('Maximum keywords selected')).toBeInTheDocument()
  })

  it('has clear all button', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={['knife sharpener', 'whetstone']}
        onSelectionChange={onSelectionChange}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    const clearButton = screen.getByRole('button', { name: /clear all/i })
    await user.click(clearButton)

    expect(onSelectionChange).toHaveBeenCalledWith([])
  })

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={[]}
        onSelectionChange={onSelectionChange}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    const keywordItem = screen.getByText('knife sharpener').closest('[data-testid="keyword-item"]') as HTMLElement
    keywordItem.focus()
    
    await user.keyboard('{Enter}')
    expect(onSelectionChange).toHaveBeenCalledWith(['knife sharpener'])
  })

  it('shows selected keywords first', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={['whetstone', 'ceramic knife sharpener']}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    const keywords = screen.getAllByTestId('keyword-item')
    expect(keywords[0]).toHaveTextContent('whetstone')
    expect(keywords[1]).toHaveTextContent('ceramic knife sharpener')
  })

  it('displays keyword count info', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={[]}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    expect(screen.getByText(`${mockKeywords.length} keywords available`)).toBeInTheDocument()
  })

  it('handles empty keyword list', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={[]}
        selectedKeywords={[]}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    expect(screen.getByText('No keywords available')).toBeInTheDocument()
  })

  it('shows checkmarks on selected keywords', () => {
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={['knife sharpener']}
        onSelectionChange={() => {}}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    const selectedKeyword = screen.getByText('knife sharpener').closest('[data-testid="keyword-item"]')
    expect(selectedKeyword?.querySelector('[data-testid="check-icon"]')).toBeInTheDocument()
  })

  it('maintains search when selecting keywords', async () => {
    const user = userEvent.setup()
    const onSelectionChange = vi.fn()
    
    render(
      <MultiKeywordSelector
        availableKeywords={mockKeywords}
        selectedKeywords={[]}
        onSelectionChange={onSelectionChange}
        maxKeywords={10}
      />,
      { wrapper: TestWrapper }
    )

    // Search for electric
    const searchInput = screen.getByPlaceholderText('Search keywords...')
    await user.type(searchInput, 'electric')

    // Select a keyword
    const keyword = screen.getByText('electric knife sharpener')
    await user.click(keyword)

    // Search should still be active
    expect(searchInput).toHaveValue('electric')
    expect(screen.getByText('electric knife sharpener')).toBeInTheDocument()
  })
})