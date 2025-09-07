import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { 
  useKeywordPerformance, 
  useKeywordComparison, 
  usePrefetchKeywordPerformance,
  usePrefetchKeywordComparison,
  useInvalidateKeywordQueries,
  keywordQueryKeys 
} from '../keyword-analysis'

// Mock fetch
global.fetch = vi.fn()

describe('keyword-analysis hooks', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('useKeywordPerformance', () => {
    const mockParams = {
      asin: 'B001',
      keyword: 'test keyword',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    }

    const mockResponse = {
      timeSeries: [
        { date: '2024-01-01', impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7, ctr: 0.05, cvr: 0.007 },
      ],
      funnelData: { impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7 },
      marketShare: {
        totalMarket: { impressions: 10000, clicks: 500, purchases: 70 },
        competitors: [],
      },
    }

    it('fetches keyword performance data successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const { result } = renderHook(() => useKeywordPerformance(mockParams), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockResponse)
      expect(fetch).toHaveBeenCalledWith(
        '/api/dashboard/v2/keyword-performance?asin=B001&keyword=test+keyword&startDate=2024-01-01&endDate=2024-01-31'
      )
    })

    it('handles comparison dates', async () => {
      const paramsWithComparison = {
        ...mockParams,
        compareStartDate: '2023-12-01',
        compareEndDate: '2023-12-31',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      renderHook(() => useKeywordPerformance(paramsWithComparison), { wrapper })

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('compareStartDate=2023-12-01&compareEndDate=2023-12-31')
        )
      })
    })

    it.skip('handles errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Failed to fetch data' }),
      } as Response)

      const { result } = renderHook(() => useKeywordPerformance(mockParams), { wrapper })

      await waitFor(() => {
        return result.current.isError
      })
      
      // The error is thrown as an Error object with the message from the API
      expect(result.current.error).toBeInstanceOf(Error)
      expect((result.current.error as Error).message).toBe('Failed to fetch data')
    })

    it('does not fetch when params are null', () => {
      const { result } = renderHook(() => useKeywordPerformance(null), { wrapper })

      // When enabled is false, the query starts in pending state but doesn't fetch
      expect(result.current.data).toBeUndefined()
      expect(result.current.isError).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('useKeywordComparison', () => {
    const mockParams = {
      asin: 'B001',
      keywords: ['keyword1', 'keyword2'],
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    }

    const mockResponse = {
      timeSeries: [
        { date: '2024-01-01', keyword1: { impressions: 1000 }, keyword2: { impressions: 800 } },
      ],
      funnels: {
        keyword1: { impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7 },
        keyword2: { impressions: 800, clicks: 40, cartAdds: 12, purchases: 6 },
      },
      marketShare: {
        keyword1: 0.25,
        keyword2: 0.20,
      },
    }

    it('fetches keyword comparison data successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response)

      const { result } = renderHook(() => useKeywordComparison(mockParams), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockResponse)
      expect(fetch).toHaveBeenCalledWith(
        '/api/dashboard/v2/keyword-comparison?asin=B001&keywords=keyword1%2Ckeyword2&startDate=2024-01-01&endDate=2024-01-31'
      )
    })

    it('does not fetch when keywords array is empty', () => {
      const emptyParams = { ...mockParams, keywords: [] }
      const { result } = renderHook(() => useKeywordComparison(emptyParams), { wrapper })

      // When enabled is false, the query starts in pending state but doesn't fetch
      expect(result.current.data).toBeUndefined()
      expect(result.current.isError).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('prefetch hooks', () => {
    it('prefetches keyword performance data', async () => {
      const mockParams = {
        asin: 'B001',
        keyword: 'test',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeSeries: [] }),
      } as Response)

      const { result } = renderHook(() => usePrefetchKeywordPerformance(), { wrapper })

      await result.current(mockParams)

      expect(fetch).toHaveBeenCalled()
      expect(queryClient.getQueryData(keywordQueryKeys.performance(mockParams))).toBeDefined()
    })

    it('prefetches keyword comparison data', async () => {
      const mockParams = {
        asin: 'B001',
        keywords: ['test1', 'test2'],
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeSeries: [] }),
      } as Response)

      const { result } = renderHook(() => usePrefetchKeywordComparison(), { wrapper })

      await result.current(mockParams)

      expect(fetch).toHaveBeenCalled()
      expect(queryClient.getQueryData(keywordQueryKeys.comparison(mockParams))).toBeDefined()
    })
  })

  describe('invalidation hook', () => {
    it('invalidates all keyword queries', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      
      const { result } = renderHook(() => useInvalidateKeywordQueries(), { wrapper })
      
      await result.current.invalidateAll()

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: keywordQueryKeys.all })
    })

    it('invalidates specific performance query', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const mockParams = {
        asin: 'B001',
        keyword: 'test',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }
      
      const { result } = renderHook(() => useInvalidateKeywordQueries(), { wrapper })
      
      await result.current.invalidatePerformance(mockParams)

      expect(invalidateSpy).toHaveBeenCalledWith({ 
        queryKey: keywordQueryKeys.performance(mockParams) 
      })
    })

    it('invalidates all performance queries', async () => {
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      
      const { result } = renderHook(() => useInvalidateKeywordQueries(), { wrapper })
      
      await result.current.invalidatePerformance()

      expect(invalidateSpy).toHaveBeenCalledWith({ 
        queryKey: [...keywordQueryKeys.all, 'performance'] 
      })
    })
  })

  describe('query key factories', () => {
    it('generates correct performance query key', () => {
      const params = {
        asin: 'B001',
        keyword: 'test',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }

      expect(keywordQueryKeys.performance(params)).toEqual([
        'keyword-analysis',
        'performance',
        params,
      ])
    })

    it('generates correct comparison query key', () => {
      const params = {
        asin: 'B001',
        keywords: ['test1', 'test2'],
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }

      expect(keywordQueryKeys.comparison(params)).toEqual([
        'keyword-analysis',
        'comparison',
        params,
      ])
    })
  })
})