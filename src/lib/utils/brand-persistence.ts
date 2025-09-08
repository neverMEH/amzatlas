/**
 * Brand persistence utilities
 */

const STORAGE_KEY = 'selectedBrandId'
const SESSION_KEY = 'sessionBrandId'

/**
 * Storage interface for testing
 */
interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

class BrandPersistence {
  private localStorage: Storage
  private sessionStorage: Storage

  constructor(
    localStorage: Storage = window.localStorage,
    sessionStorage: Storage = window.sessionStorage
  ) {
    this.localStorage = localStorage
    this.sessionStorage = sessionStorage
  }

  /**
   * Save selected brand ID
   */
  saveBrandId(brandId: string): void {
    try {
      this.localStorage.setItem(STORAGE_KEY, brandId)
      this.sessionStorage.setItem(SESSION_KEY, brandId)
      this.broadcastChange(brandId)
    } catch (error) {
      console.error('Failed to save brand ID:', error)
    }
  }

  /**
   * Get saved brand ID
   */
  getBrandId(): string | null {
    try {
      // Try localStorage first
      const localBrandId = this.localStorage.getItem(STORAGE_KEY)
      if (localBrandId) return localBrandId

      // Fallback to sessionStorage
      const sessionBrandId = this.sessionStorage.getItem(SESSION_KEY)
      if (sessionBrandId) {
        // Sync to localStorage
        this.localStorage.setItem(STORAGE_KEY, sessionBrandId)
        return sessionBrandId
      }

      return null
    } catch (error) {
      console.error('Failed to get brand ID:', error)
      return null
    }
  }

  /**
   * Clear saved brand ID
   */
  clearBrandId(): void {
    try {
      this.localStorage.removeItem(STORAGE_KEY)
      this.sessionStorage.removeItem(SESSION_KEY)
      this.broadcastChange(null)
    } catch (error) {
      console.error('Failed to clear brand ID:', error)
    }
  }

  /**
   * Listen for brand changes across tabs
   */
  addChangeListener(callback: (brandId: string | null) => void): () => void {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        callback(event.newValue)
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }

  /**
   * Broadcast brand change to other tabs
   */
  private broadcastChange(brandId: string | null): void {
    // Create a custom event for same-tab updates
    const event = new CustomEvent('brandChanged', { 
      detail: { brandId } 
    })
    window.dispatchEvent(event)
  }

  /**
   * Listen for same-tab brand changes
   */
  addLocalChangeListener(callback: (brandId: string | null) => void): () => void {
    const handleBrandChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ brandId: string | null }>
      callback(customEvent.detail.brandId)
    }

    window.addEventListener('brandChanged', handleBrandChange)

    return () => {
      window.removeEventListener('brandChanged', handleBrandChange)
    }
  }
}

// Export singleton instance
export const brandPersistence = new BrandPersistence()

// Export class for testing
export { BrandPersistence }