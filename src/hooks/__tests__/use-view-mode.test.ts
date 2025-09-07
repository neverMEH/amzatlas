import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useViewMode } from '../use-view-mode'

// Mock Next.js router
import { usePathname, useSearchParams } from 'next/navigation'

describe('useViewMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Route-based detection', () => {
    it('returns "popup" for root route', () => {
      vi.mocked(usePathname).mockReturnValue('/')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.mode).toBe('popup')
      expect(result.current.isPopup).toBe(true)
      expect(result.current.isFullPage).toBe(false)
    })

    it('returns "full-page" for keyword analysis route', () => {
      vi.mocked(usePathname).mockReturnValue('/keyword-analysis')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.mode).toBe('full-page')
      expect(result.current.isPopup).toBe(false)
      expect(result.current.isFullPage).toBe(true)
    })

    it('detects full-page mode with query parameters', () => {
      vi.mocked(usePathname).mockReturnValue('/keyword-analysis')
      const searchParams = new URLSearchParams({
        asin: 'B08KTZ8249',
        keyword: 'knife sharpener',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      })
      vi.mocked(useSearchParams).mockReturnValue(searchParams)

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.mode).toBe('full-page')
      expect(result.current.queryParams).toEqual({
        asin: 'B08KTZ8249',
        keyword: 'knife sharpener',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      })
    })
  })

  describe('Prop-based override', () => {
    it('allows explicit mode override via prop', () => {
      vi.mocked(usePathname).mockReturnValue('/')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode({ mode: 'full-page' }))
      
      expect(result.current.mode).toBe('full-page')
      expect(result.current.isFullPage).toBe(true)
    })

    it('prop override takes precedence over route detection', () => {
      vi.mocked(usePathname).mockReturnValue('/keyword-analysis')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode({ mode: 'popup' }))
      
      expect(result.current.mode).toBe('popup')
      expect(result.current.isPopup).toBe(true)
    })
  })

  describe('Derived states', () => {
    it('provides correct boolean flags for popup mode', () => {
      vi.mocked(usePathname).mockReturnValue('/')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.isPopup).toBe(true)
      expect(result.current.isFullPage).toBe(false)
      expect(result.current.shouldShowSparklines).toBe(true)
      expect(result.current.shouldShowFullCharts).toBe(false)
    })

    it('provides correct boolean flags for full-page mode', () => {
      vi.mocked(usePathname).mockReturnValue('/keyword-analysis')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.isPopup).toBe(false)
      expect(result.current.isFullPage).toBe(true)
      expect(result.current.shouldShowSparklines).toBe(false)
      expect(result.current.shouldShowFullCharts).toBe(true)
    })
  })

  describe('Layout configuration', () => {
    it('returns popup layout config', () => {
      vi.mocked(usePathname).mockReturnValue('/')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.layout).toEqual({
        maxWidth: 'max-w-4xl',
        padding: 'p-4',
        chartHeight: 60,
        showFunnel: false,
        showMarketShare: false,
        showSparklines: true
      })
    })

    it('returns full-page layout config', () => {
      vi.mocked(usePathname).mockReturnValue('/keyword-analysis')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.layout).toEqual({
        maxWidth: 'max-w-7xl',
        padding: 'p-6',
        chartHeight: 300,
        showFunnel: true,
        showMarketShare: true,
        showSparklines: false
      })
    })
  })

  describe('Edge cases', () => {
    it('handles null pathname gracefully', () => {
      vi.mocked(usePathname).mockReturnValue(null as any)
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.mode).toBe('popup')
    })

    it('handles missing search params', () => {
      vi.mocked(usePathname).mockReturnValue('/keyword-analysis')
      vi.mocked(useSearchParams).mockReturnValue(null as any)

      const { result } = renderHook(() => useViewMode())
      
      expect(result.current.mode).toBe('full-page')
      expect(result.current.queryParams).toEqual({})
    })

    it('handles invalid mode prop', () => {
      vi.mocked(usePathname).mockReturnValue('/')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result } = renderHook(() => useViewMode({ mode: 'invalid' as any }))
      
      // Should fall back to route-based detection
      expect(result.current.mode).toBe('popup')
    })
  })

  describe('Memoization', () => {
    it('returns stable references when inputs do not change', () => {
      vi.mocked(usePathname).mockReturnValue('/')
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams())

      const { result, rerender } = renderHook(() => useViewMode())
      
      const firstResult = result.current
      
      rerender()
      
      const secondResult = result.current
      
      expect(firstResult).toBe(secondResult)
      expect(firstResult.layout).toBe(secondResult.layout)
    })
  })
})