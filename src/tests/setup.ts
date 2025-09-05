import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'
import React from 'react'
import { createNavigationMock, resetNavigationMocks } from './mocks/next-navigation'

// Make React globally available for tests
// @ts-ignore
global.React = React

// Mock fetch for tests
global.fetch = vi.fn()

// Mock ResizeObserver for Recharts
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => createNavigationMock())

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  resetNavigationMocks()
})