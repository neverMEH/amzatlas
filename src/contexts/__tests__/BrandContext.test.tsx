import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { BrandProvider, useBrand } from '../BrandContext'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
global.localStorage = localStorageMock as any

describe('BrandContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BrandProvider', () => {
    it('should provide brand context to children', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrandProvider>{children}</BrandProvider>
      )

      const { result } = renderHook(() => useBrand(), { wrapper })

      expect(result.current).toHaveProperty('selectedBrandId')
      expect(result.current).toHaveProperty('setSelectedBrandId')
      expect(result.current).toHaveProperty('isLoading')
    })

    it('should initialize with null selectedBrandId', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrandProvider>{children}</BrandProvider>
      )

      const { result } = renderHook(() => useBrand(), { wrapper })

      expect(result.current.selectedBrandId).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('should load selectedBrandId from localStorage on mount', () => {
      const savedBrandId = '550e8400-e29b-41d4-a716-446655440000'
      localStorageMock.getItem.mockReturnValue(savedBrandId)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrandProvider>{children}</BrandProvider>
      )

      const { result } = renderHook(() => useBrand(), { wrapper })

      expect(localStorageMock.getItem).toHaveBeenCalledWith('selectedBrandId')
      expect(result.current.selectedBrandId).toBe(savedBrandId)
    })

    it('should save selectedBrandId to localStorage when changed', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrandProvider>{children}</BrandProvider>
      )

      const { result } = renderHook(() => useBrand(), { wrapper })

      const newBrandId = '660e8400-e29b-41d4-a716-446655440001'
      act(() => {
        result.current.setSelectedBrandId(newBrandId)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('selectedBrandId', newBrandId)
      expect(result.current.selectedBrandId).toBe(newBrandId)
    })

    it('should remove from localStorage when selectedBrandId is set to null', () => {
      const savedBrandId = '550e8400-e29b-41d4-a716-446655440000'
      localStorageMock.getItem.mockReturnValue(savedBrandId)

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrandProvider>{children}</BrandProvider>
      )

      const { result } = renderHook(() => useBrand(), { wrapper })

      act(() => {
        result.current.setSelectedBrandId(null)
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('selectedBrandId')
      expect(result.current.selectedBrandId).toBeNull()
    })

    it('should set isLoading to false after initialization', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <BrandProvider>{children}</BrandProvider>
      )

      const { result } = renderHook(() => useBrand(), { wrapper })

      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('useBrand', () => {
    it('should throw error when used outside of BrandProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useBrand())
      }).toThrow('useBrand must be used within a BrandProvider')

      consoleError.mockRestore()
    })
  })
})