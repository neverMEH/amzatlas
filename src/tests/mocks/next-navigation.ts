import { vi } from 'vitest'

// Create mock implementations
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockPrefetch = vi.fn()
const mockBack = vi.fn()
const mockForward = vi.fn()
const mockRefresh = vi.fn()

export const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  prefetch: mockPrefetch,
  back: mockBack,
  forward: mockForward,
  refresh: mockRefresh,
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
}

// Mock searchParams with a simple map
const mockSearchParamsMap = new Map<string, string>()

export const mockSearchParams = {
  get: vi.fn((key: string) => mockSearchParamsMap.get(key) || null),
  set: vi.fn((key: string, value: string) => mockSearchParamsMap.set(key, value)),
  has: vi.fn((key: string) => mockSearchParamsMap.has(key)),
  getAll: vi.fn((key: string) => {
    const value = mockSearchParamsMap.get(key)
    return value ? [value] : []
  }),
  forEach: vi.fn((fn: (value: string, key: string) => void) => {
    mockSearchParamsMap.forEach(fn)
  }),
  entries: vi.fn(() => mockSearchParamsMap.entries()),
  keys: vi.fn(() => mockSearchParamsMap.keys()),
  values: vi.fn(() => mockSearchParamsMap.values()),
  toString: vi.fn(() => {
    const params = new URLSearchParams()
    mockSearchParamsMap.forEach((value, key) => params.set(key, value))
    return params.toString()
  }),
  clear: () => mockSearchParamsMap.clear(),
}

export const mockUseSearchParams = vi.fn(() => mockSearchParams)

// Mock pathname
export const mockUsePathname = vi.fn(() => '/')

// Mock params
export const mockUseParams = vi.fn(() => ({}))

// Create navigation module mock
export const createNavigationMock = () => ({
  useRouter: vi.fn(() => mockRouter),
  useSearchParams: mockUseSearchParams,
  usePathname: mockUsePathname,
  useParams: mockUseParams,
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  notFound: vi.fn(),
})

// Reset all mocks
export const resetNavigationMocks = () => {
  mockPush.mockClear()
  mockReplace.mockClear()
  mockPrefetch.mockClear()
  mockBack.mockClear()
  mockForward.mockClear()
  mockRefresh.mockClear()
  mockSearchParams.get.mockClear()
  mockSearchParams.set.mockClear()
  mockSearchParams.has.mockClear()
  mockSearchParams.getAll.mockClear()
  mockSearchParams.forEach.mockClear()
  mockSearchParams.entries.mockClear()
  mockSearchParams.keys.mockClear()
  mockSearchParams.values.mockClear()
  mockSearchParams.toString.mockClear()
  mockUseSearchParams.mockClear()
  mockUsePathname.mockClear()
  mockUseParams.mockClear()
  mockSearchParamsMap.clear()
}