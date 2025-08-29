'use client'

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'

// Additional types for enhanced functionality
interface Breadcrumb {
  label: string
  href?: string
  isActive?: boolean
}

interface LayoutState {
  sidebarCollapsed: boolean
  mobileMenuOpen: boolean
  activeSection: string
  pageTitle: string
  breadcrumbs: Breadcrumb[]
}

interface FilterState {
  selectedAsins: string[]
  selectedBrands: string[]
  searchQuery: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

interface DashboardContextType {
  // Existing properties
  isDarkMode: boolean
  toggleDarkMode: () => void
  dateRange: { start: Date; end: Date }
  setDateRange: (range: { start: Date; end: Date }) => void
  refreshInterval: number
  setRefreshInterval: (interval: number) => void
  
  // New layout properties
  layout: LayoutState
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setActiveSection: (section: string) => void
  setPageInfo: (title: string, breadcrumbs?: Breadcrumb[]) => void
  
  // New filter properties
  filters: FilterState
  updateSelectedAsins: (asins: string[]) => void
  updateSelectedBrands: (brands: string[]) => void
  updateSearchQuery: (query: string) => void
  updateSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  resetFilters: () => void
  
  // Metrics state
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  lastUpdated: Date | null
  updateLastRefresh: () => void
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export function DashboardProvider({ children }: { children: ReactNode }) {
  // Existing state
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date(),
  })
  const [refreshInterval, setRefreshInterval] = useState(24 * 60 * 60 * 1000) // 24 hours
  
  // New state
  const [layout, setLayout] = useState<LayoutState>({
    sidebarCollapsed: false,
    mobileMenuOpen: false,
    activeSection: 'dashboard',
    pageTitle: 'Dashboard',
    breadcrumbs: [],
  })
  
  const [filters, setFilters] = useState<FilterState>({
    selectedAsins: [],
    selectedBrands: [],
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
  })
  
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    // Check for saved preferences
    const savedDarkMode = localStorage.getItem('darkMode')
    if (savedDarkMode !== null) {
      setIsDarkMode(JSON.parse(savedDarkMode))
    } else {
      // Check system preference
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    
    // Restore sidebar state
    const savedSidebarState = localStorage.getItem('sqp-sidebar-collapsed')
    if (savedSidebarState !== null) {
      setLayout(prev => ({
        ...prev,
        sidebarCollapsed: JSON.parse(savedSidebarState)
      }))
    }
    
    // Restore filter state
    const savedFilters = localStorage.getItem('sqp-dashboard-filters')
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters)
        setFilters(prev => ({
          ...prev,
          ...parsed,
        }))
      } catch (error) {
        console.warn('Failed to restore filter state:', error)
      }
    }
  }, [])

  useEffect(() => {
    // Apply dark mode class to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Save layout state to localStorage
  useEffect(() => {
    localStorage.setItem('sqp-sidebar-collapsed', JSON.stringify(layout.sidebarCollapsed))
  }, [layout.sidebarCollapsed])

  // Save filter state to localStorage
  useEffect(() => {
    localStorage.setItem('sqp-dashboard-filters', JSON.stringify(filters))
  }, [filters])

  // Existing methods
  const toggleDarkMode = () => {
    const newValue = !isDarkMode
    setIsDarkMode(newValue)
    localStorage.setItem('darkMode', JSON.stringify(newValue))
  }

  // New layout methods
  const toggleSidebar = useCallback(() => {
    setLayout(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }))
  }, [])

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setLayout(prev => ({
      ...prev,
      sidebarCollapsed: collapsed
    }))
  }, [])

  const setActiveSection = useCallback((section: string) => {
    setLayout(prev => ({
      ...prev,
      activeSection: section
    }))
  }, [])

  const setPageInfo = useCallback((title: string, breadcrumbs: Breadcrumb[] = []) => {
    setLayout(prev => ({
      ...prev,
      pageTitle: title,
      breadcrumbs
    }))
  }, [])

  // New filter methods
  const updateSelectedAsins = useCallback((asins: string[]) => {
    setFilters(prev => ({
      ...prev,
      selectedAsins: asins
    }))
  }, [])

  const updateSelectedBrands = useCallback((brands: string[]) => {
    setFilters(prev => ({
      ...prev,
      selectedBrands: brands
    }))
  }, [])

  const updateSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({
      ...prev,
      searchQuery: query
    }))
  }, [])

  const updateSorting = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder
    }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      selectedAsins: [],
      selectedBrands: [],
      searchQuery: '',
      sortBy: 'date',
      sortOrder: 'desc',
    })
  }, [])

  // New metrics methods
  const updateLastRefresh = useCallback(() => {
    setLastUpdated(new Date())
  }, [])

  return (
    <DashboardContext.Provider
      value={{
        // Existing properties
        isDarkMode,
        toggleDarkMode,
        dateRange,
        setDateRange,
        refreshInterval,
        setRefreshInterval,
        
        // New layout properties
        layout,
        toggleSidebar,
        setSidebarCollapsed,
        setActiveSection,
        setPageInfo,
        
        // New filter properties
        filters,
        updateSelectedAsins,
        updateSelectedBrands,
        updateSearchQuery,
        updateSorting,
        resetFilters,
        
        // New metrics properties
        isLoading,
        setIsLoading,
        lastUpdated,
        updateLastRefresh,
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}

// Export types for use in components
export type {
  DashboardContextType,
  LayoutState,
  FilterState,
  Breadcrumb,
}