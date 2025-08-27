'use client'

import { useQuery } from '@tanstack/react-query'
import { PurchaseMetrics, KeywordPerformance, PurchaseTrend } from '@/types/dashboard'
import { useDashboard } from '@/contexts/dashboard-context'

async function fetchMetrics(dateRange: { start: Date; end: Date }): Promise<PurchaseMetrics> {
  const params = new URLSearchParams({
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  })
  
  const response = await fetch(`/api/dashboard/metrics?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch metrics')
  }
  
  return response.json()
}

async function fetchKeywords(limit: number): Promise<KeywordPerformance[]> {
  const params = new URLSearchParams({ limit: limit.toString() })
  
  const response = await fetch(`/api/dashboard/keywords?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch keywords')
  }
  
  return response.json()
}

async function fetchTrends(weeks: number): Promise<PurchaseTrend[]> {
  const params = new URLSearchParams({ weeks: weeks.toString() })
  
  const response = await fetch(`/api/dashboard/trends?${params}`)
  if (!response.ok) {
    throw new Error('Failed to fetch trends')
  }
  
  return response.json()
}

export function usePurchaseMetrics() {
  const { dateRange, refreshInterval } = useDashboard()
  
  return useQuery<PurchaseMetrics>({
    queryKey: ['purchase-metrics', dateRange],
    queryFn: () => fetchMetrics(dateRange),
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  })
}

export function useTopKeywords(limit: number = 10) {
  const { refreshInterval } = useDashboard()
  
  return useQuery<KeywordPerformance[]>({
    queryKey: ['top-keywords', limit],
    queryFn: () => fetchKeywords(limit),
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePurchaseTrends(weeks: number = 12) {
  const { refreshInterval } = useDashboard()
  
  return useQuery<PurchaseTrend[]>({
    queryKey: ['purchase-trends', weeks],
    queryFn: () => fetchTrends(weeks),
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
  })
}

// Hook for zero-purchase keywords (keywords with clicks but no purchases)
export function useZeroPurchaseKeywords(limit: number = 20) {
  const { refreshInterval } = useDashboard()
  
  return useQuery<KeywordPerformance[]>({
    queryKey: ['zero-purchase-keywords', limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limit.toString(), type: 'zero-purchase' })
      const response = await fetch(`/api/dashboard/keywords?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch zero-purchase keywords')
      }
      return response.json()
    },
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
  })
}

// Hook for rising keywords (fast-growing purchase keywords)
export function useRisingKeywords(limit: number = 20) {
  const { refreshInterval } = useDashboard()
  
  return useQuery<KeywordPerformance[]>({
    queryKey: ['rising-keywords', limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limit.toString(), type: 'rising' })
      const response = await fetch(`/api/dashboard/keywords?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch rising keywords')
      }
      return response.json()
    },
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
  })
}

// Hook for negative ROI keywords
export function useNegativeROIKeywords(limit: number = 20) {
  const { refreshInterval } = useDashboard()
  
  return useQuery<KeywordPerformance[]>({
    queryKey: ['negative-roi-keywords', limit],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limit.toString(), type: 'negative-roi' })
      const response = await fetch(`/api/dashboard/keywords?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch negative ROI keywords')
      }
      return response.json()
    },
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
  })
}