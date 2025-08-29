import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock fetch for tests
global.fetch = vi.fn()

// Mock ResizeObserver for Recharts
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})