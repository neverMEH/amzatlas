import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header } from '../Header'

// Mock the API response
const mockBrands = [
  { id: '550e8400-e29b-41d4-a716-446655440000', display_name: 'Work Sharp' },
  { id: '660e8400-e29b-41d4-a716-446655440001', display_name: 'Amazon Basics' },
  { id: '770e8400-e29b-41d4-a716-446655440002', display_name: 'Nike' },
  { id: '880e8400-e29b-41d4-a716-446655440003', display_name: 'Apple' }
]

// Mock fetch
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      cacheTime: 0,
    },
  },
})

const renderWithProviders = (
  { 
    selectedBrand,
    onBrandChange 
  }: { 
    selectedBrand?: string
    onBrandChange?: (brandId: string) => void 
  } = {}
) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <Header 
        selectedBrand={selectedBrand}
        onBrandChange={onBrandChange || vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockBrands })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the header with AMZ Atlas branding', () => {
      renderWithProviders({ onBrandChange: vi.fn() })
      
      expect(screen.getByText('AMZ Atlas')).toBeInTheDocument()
    })

    it('should render the brand selector dropdown', () => {
      renderWithProviders({ onBrandChange: vi.fn() })
      
      expect(screen.getByTestId('brand-selector')).toBeInTheDocument()
    })

    it('should display "Select Brand" when no brand is selected', () => {
      renderWithProviders({ onBrandChange: vi.fn() })
      
      expect(screen.getByText('Select Brand')).toBeInTheDocument()
    })

    it('should display the selected brand name', async () => {
      renderWithProviders({
        selectedBrand: '550e8400-e29b-41d4-a716-446655440000',
        onBrandChange: vi.fn()
      })
      
      await waitFor(() => {
        expect(screen.getByText('Work Sharp')).toBeInTheDocument()
      })
    })

    it('should render user avatar with initials', () => {
      renderWithProviders({ onBrandChange: vi.fn() })
      
      expect(screen.getByText('JD')).toBeInTheDocument()
    })
  })

  describe('Brand Selector Dropdown', () => {
    it('should open dropdown when clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      await waitFor(() => {
        mockBrands.forEach(brand => {
          expect(screen.getByText(brand.display_name)).toBeInTheDocument()
        })
      })
    })

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      await waitFor(() => {
        expect(screen.getByText('Nike')).toBeInTheDocument()
      })
      
      // Click outside
      await user.click(document.body)
      
      await waitFor(() => {
        expect(screen.queryByText('Nike')).not.toBeInTheDocument()
      })
    })

    it('should call onBrandChange when selecting a brand', async () => {
      const user = userEvent.setup()
      const onBrandChange = vi.fn()
      renderWithProviders({ onBrandChange })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      await waitFor(() => {
        expect(screen.getByText('Amazon Basics')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Amazon Basics'))
      
      expect(onBrandChange).toHaveBeenCalledWith('660e8400-e29b-41d4-a716-446655440001')
    })

    it('should highlight the currently selected brand in dropdown', async () => {
      const user = userEvent.setup()
      renderWithProviders({
        selectedBrand: '550e8400-e29b-41d4-a716-446655440000',
        onBrandChange: vi.fn()
      })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      await waitFor(() => {
        const selectedItem = screen.getByTestId('brand-option-550e8400-e29b-41d4-a716-446655440000')
        expect(selectedItem).toHaveClass('bg-gray-100')
      })
    })
  })

  describe('API Integration', () => {
    it('should fetch brands on mount', async () => {
      renderWithProviders({ onBrandChange: vi.fn() })
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/brands')
      })
    })

    it('should handle API errors gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      })
      
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await userEvent.click(brandSelector)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load brands')).toBeInTheDocument()
      })
    })

    it('should show loading state while fetching brands', async () => {
      let resolvePromise: (value: any) => void
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      
      ;(global.fetch as any).mockReturnValueOnce(fetchPromise)
      
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await userEvent.click(brandSelector)
      
      expect(screen.getByText('Loading brands...')).toBeInTheDocument()
      
      resolvePromise!({
        ok: true,
        json: async () => ({ data: mockBrands })
      })
      
      await waitFor(() => {
        expect(screen.queryByText('Loading brands...')).not.toBeInTheDocument()
      })
    })
  })

  describe('LocalStorage Persistence', () => {
    it('should save selected brand to localStorage', async () => {
      const user = userEvent.setup()
      const onBrandChange = vi.fn()
      renderWithProviders(<Header onBrandChange={onBrandChange} />)
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      await waitFor(() => {
        expect(screen.getByText('Nike')).toBeInTheDocument()
      })
      
      await user.click(screen.getByText('Nike'))
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'selectedBrandId',
        '770e8400-e29b-41d4-a716-446655440002'
      )
    })

    it('should load selected brand from localStorage on mount', async () => {
      localStorageMock.getItem.mockReturnValue('770e8400-e29b-41d4-a716-446655440002')
      
      const onBrandChange = vi.fn()
      renderWithProviders({ onBrandChange })
      
      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith('selectedBrandId')
        expect(onBrandChange).toHaveBeenCalledWith('770e8400-e29b-41d4-a716-446655440002')
      })
    })
  })

  describe('Keyboard Navigation', () => {
    it('should open dropdown with Enter key', async () => {
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      brandSelector.focus()
      
      fireEvent.keyDown(brandSelector, { key: 'Enter' })
      
      await waitFor(() => {
        expect(screen.getByText('Nike')).toBeInTheDocument()
      })
    })

    it('should close dropdown with Escape key', async () => {
      const user = userEvent.setup()
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      await waitFor(() => {
        expect(screen.getByText('Nike')).toBeInTheDocument()
      })
      
      fireEvent.keyDown(document.body, { key: 'Escape' })
      
      await waitFor(() => {
        expect(screen.queryByText('Nike')).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      expect(brandSelector).toHaveAttribute('aria-label', 'Select brand')
      expect(brandSelector).toHaveAttribute('aria-haspopup', 'true')
      expect(brandSelector).toHaveAttribute('aria-expanded', 'false')
    })

    it('should update aria-expanded when dropdown is open', async () => {
      const user = userEvent.setup()
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      expect(brandSelector).toHaveAttribute('aria-expanded', 'true')
    })

    it('should have proper role attributes on dropdown items', async () => {
      const user = userEvent.setup()
      renderWithProviders({ onBrandChange: vi.fn() })
      
      const brandSelector = screen.getByTestId('brand-selector')
      await user.click(brandSelector)
      
      await waitFor(() => {
        const dropdownList = screen.getByRole('listbox')
        expect(dropdownList).toBeInTheDocument()
        
        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(mockBrands.length)
      })
    })
  })
})