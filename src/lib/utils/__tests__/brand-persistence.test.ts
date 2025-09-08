import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrandPersistence } from '../brand-persistence'

describe('BrandPersistence', () => {
  let mockLocalStorage: any
  let mockSessionStorage: any
  let brandPersistence: BrandPersistence

  beforeEach(() => {
    // Create mock storage
    mockLocalStorage = {
      storage: new Map(),
      getItem: vi.fn((key: string) => mockLocalStorage.storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => mockLocalStorage.storage.set(key, value)),
      removeItem: vi.fn((key: string) => mockLocalStorage.storage.delete(key)),
    }

    mockSessionStorage = {
      storage: new Map(),
      getItem: vi.fn((key: string) => mockSessionStorage.storage.get(key) || null),
      setItem: vi.fn((key: string, value: string) => mockSessionStorage.storage.set(key, value)),
      removeItem: vi.fn((key: string) => mockSessionStorage.storage.delete(key)),
    }

    brandPersistence = new BrandPersistence(mockLocalStorage, mockSessionStorage)
  })

  describe('saveBrandId', () => {
    it('should save brand ID to both storages', () => {
      const brandId = 'brand-123'
      brandPersistence.saveBrandId(brandId)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('selectedBrandId', brandId)
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith('sessionBrandId', brandId)
    })

    it('should handle storage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })

      // Should not throw
      expect(() => brandPersistence.saveBrandId('brand-123')).not.toThrow()
    })
  })

  describe('getBrandId', () => {
    it('should retrieve brand ID from localStorage', () => {
      mockLocalStorage.storage.set('selectedBrandId', 'brand-123')
      
      const result = brandPersistence.getBrandId()
      expect(result).toBe('brand-123')
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('selectedBrandId')
    })

    it('should fallback to sessionStorage if localStorage is empty', () => {
      mockSessionStorage.storage.set('sessionBrandId', 'brand-456')
      
      const result = brandPersistence.getBrandId()
      expect(result).toBe('brand-456')
      expect(mockSessionStorage.getItem).toHaveBeenCalledWith('sessionBrandId')
    })

    it('should sync sessionStorage value to localStorage', () => {
      mockSessionStorage.storage.set('sessionBrandId', 'brand-456')
      
      brandPersistence.getBrandId()
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('selectedBrandId', 'brand-456')
    })

    it('should return null if no brand ID is saved', () => {
      const result = brandPersistence.getBrandId()
      expect(result).toBeNull()
    })

    it('should handle storage errors and return null', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied')
      })

      const result = brandPersistence.getBrandId()
      expect(result).toBeNull()
    })
  })

  describe('clearBrandId', () => {
    it('should clear brand ID from both storages', () => {
      brandPersistence.clearBrandId()

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('selectedBrandId')
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('sessionBrandId')
    })

    it('should handle storage errors gracefully', () => {
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      expect(() => brandPersistence.clearBrandId()).not.toThrow()
    })
  })
})