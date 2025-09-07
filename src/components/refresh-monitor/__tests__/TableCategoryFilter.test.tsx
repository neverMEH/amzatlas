import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TableCategoryFilter } from '../TableCategoryFilter'

describe('TableCategoryFilter', () => {
  const mockCategories = [
    { id: 'all', label: 'All Tables', count: 15 },
    { id: 'core', label: 'Core Pipeline', count: 7 },
    { id: 'brand', label: 'Brand Management', count: 3 },
    { id: 'reporting', label: 'Reporting', count: 3 },
    { id: 'legacy', label: 'Legacy', count: 2 }
  ]

  const mockOnCategoryChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays all category options', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    mockCategories.forEach(category => {
      expect(screen.getByText(category.label)).toBeInTheDocument()
      expect(screen.getByText(`(${category.count})`)).toBeInTheDocument()
    })
  })

  it('highlights selected category', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="core"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    const coreButton = screen.getByText('Core Pipeline').closest('button')
    expect(coreButton).toHaveClass('bg-blue-100', 'text-blue-700')
    
    const allButton = screen.getByText('All Tables').closest('button')
    expect(allButton).not.toHaveClass('bg-blue-100')
  })

  it('calls onCategoryChange when category is clicked', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    fireEvent.click(screen.getByText('Core Pipeline'))
    expect(mockOnCategoryChange).toHaveBeenCalledWith('core')
    
    fireEvent.click(screen.getByText('Brand Management'))
    expect(mockOnCategoryChange).toHaveBeenCalledWith('brand')
  })

  it('shows category icons', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    expect(screen.getByTestId('icon-all')).toBeInTheDocument()
    expect(screen.getByTestId('icon-core')).toBeInTheDocument()
    expect(screen.getByTestId('icon-brand')).toBeInTheDocument()
    expect(screen.getByTestId('icon-reporting')).toBeInTheDocument()
  })

  it('disables categories with zero count', () => {
    const categoriesWithZero = [
      ...mockCategories,
      { id: 'empty', label: 'Empty Category', count: 0 }
    ]
    
    render(
      <TableCategoryFilter
        categories={categoriesWithZero}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    const emptyButton = screen.getByText('Empty Category').closest('button')
    expect(emptyButton).toBeDisabled()
    expect(emptyButton).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('shows tooltip on hover for category descriptions', async () => {
    const categoriesWithDescriptions = mockCategories.map(cat => ({
      ...cat,
      description: `Tables related to ${cat.label}`
    }))
    
    render(
      <TableCategoryFilter
        categories={categoriesWithDescriptions}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    const coreButton = screen.getByText('Core Pipeline').closest('button')
    fireEvent.mouseEnter(coreButton!)
    
    expect(await screen.findByText('Tables related to Core Pipeline')).toBeInTheDocument()
  })

  it('handles keyboard navigation', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    const firstButton = screen.getByText('All Tables').closest('button')
    firstButton?.focus()
    
    fireEvent.keyDown(firstButton!, { key: 'ArrowRight' })
    expect(document.activeElement).toHaveTextContent('Core Pipeline')
    
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(mockOnCategoryChange).toHaveBeenCalledWith('core')
  })

  it('shows active filter indicator', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="core"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    expect(screen.getByText('Filtered: Core Pipeline')).toBeInTheDocument()
    expect(screen.getByTestId('clear-filter')).toBeInTheDocument()
  })

  it('clears filter when clear button is clicked', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="core"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    fireEvent.click(screen.getByTestId('clear-filter'))
    expect(mockOnCategoryChange).toHaveBeenCalledWith('all')
  })

  it('renders in compact mode', () => {
    render(
      <TableCategoryFilter
        categories={mockCategories}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
        compact
      />
    )
    
    const container = screen.getByTestId('category-filter-compact')
    expect(container).toHaveClass('flex-wrap')
  })

  it('shows category health indicators', () => {
    const categoriesWithHealth = mockCategories.map(cat => ({
      ...cat,
      health: cat.id === 'legacy' ? 'warning' : 'healthy'
    }))
    
    render(
      <TableCategoryFilter
        categories={categoriesWithHealth}
        selectedCategory="all"
        onCategoryChange={mockOnCategoryChange}
      />
    )
    
    const legacyButton = screen.getByText('Legacy').closest('button')
    expect(legacyButton?.querySelector('.text-yellow-500')).toBeInTheDocument()
  })
})