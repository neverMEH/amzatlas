import { vi } from 'vitest'

export const useASINs = vi.fn(() => ({
  data: [],
  isLoading: false,
  error: null,
}))

export const useASINPerformance = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))

export const useTimeSeries = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))

export const useFunnelData = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))

export const useSearchQueries = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))

export const useComparisonSuggestions = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))

export const useComparisonValidation = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))

export const useASINDataAvailability = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))

export const useASINMonthlyDataAvailability = vi.fn(() => ({
  data: null,
  isLoading: false,
  error: null,
}))