import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ASINSelector } from '../ASINSelector'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockASINs = [
  { asin: 'B001234567', productTitle: 'Work Sharp Knife Sharpener', brand: 'Work Sharp' },
  { asin: 'B002345678', productTitle: 'Professional Sharpening System', brand: 'Work Sharp' },
  { asin: 'B003456789', productTitle: 'Pocket Knife Sharpener', brand: 'Work Sharp' },
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('ASINSelector', () => {
  it('renders with placeholder text', () => {
    render(<ASINSelector value="" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })
    
    expect(screen.getByPlaceholderText('Search or select an ASIN...')).toBeInTheDocument()
  })

  it('displays loading state while fetching ASINs', async () => {
    // Don't resolve the fetch immediately to see the loading state
    global.fetch = vi.fn(() => new Promise(() => {}))

    render(<ASINSelector value="" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    const input = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('Loading ASINs...')).toBeInTheDocument()
    })
  })

  it('displays ASINs when dropdown is opened', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asins: mockASINs }),
    })

    render(<ASINSelector value="" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    const input = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('B001234567 - Work Sharp Knife Sharpener')).toBeInTheDocument()
      expect(screen.getByText('B002345678 - Professional Sharpening System')).toBeInTheDocument()
    })
  })

  it('filters ASINs based on search input', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asins: mockASINs }),
    })

    render(<ASINSelector value="" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    const input = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('B001234567 - Work Sharp Knife Sharpener')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: 'pocket' } })

    await waitFor(() => {
      expect(screen.queryByText('B001234567 - Work Sharp Knife Sharpener')).not.toBeInTheDocument()
      expect(screen.getByText('B003456789 - Pocket Knife Sharpener')).toBeInTheDocument()
    })
  })

  it('calls onChange when an ASIN is selected', async () => {
    const onChange = vi.fn()
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asins: mockASINs }),
    })

    render(<ASINSelector value="" onChange={onChange} />, {
      wrapper: createWrapper(),
    })

    const input = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('B001234567 - Work Sharp Knife Sharpener')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('B001234567 - Work Sharp Knife Sharpener'))

    expect(onChange).toHaveBeenCalledWith('B001234567')
  })

  it('displays selected ASIN in input', () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asins: mockASINs }),
    })

    const { rerender } = render(<ASINSelector value="" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    rerender(<ASINSelector value="B001234567" onChange={vi.fn()} />)

    const input = screen.getByDisplayValue('B001234567')
    expect(input).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('API Error'))

    render(<ASINSelector value="" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    const input = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('Error loading ASINs')).toBeInTheDocument()
    })
  })

  it('closes dropdown when clicking outside', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asins: mockASINs }),
    })

    render(
      <div>
        <ASINSelector value="" onChange={vi.fn()} />
        <button>Outside button</button>
      </div>,
      { wrapper: createWrapper() }
    )

    const input = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('B001234567 - Work Sharp Knife Sharpener')).toBeInTheDocument()
    })

    // Simulate mousedown event which is what the component listens for
    fireEvent.mouseDown(screen.getByText('Outside button'))

    await waitFor(() => {
      expect(screen.queryByText('B001234567 - Work Sharp Knife Sharpener')).not.toBeInTheDocument()
    })
  })

  it('shows empty state when no ASINs match search', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ asins: mockASINs }),
    })

    render(<ASINSelector value="" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    })

    const input = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.focus(input)

    await waitFor(() => {
      expect(screen.getByText('B001234567 - Work Sharp Knife Sharpener')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: 'nonexistent' } })

    await waitFor(() => {
      expect(screen.getByText('No ASINs found')).toBeInTheDocument()
    })
  })
})