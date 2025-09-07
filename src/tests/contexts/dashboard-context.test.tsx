import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, act, renderHook } from '@testing-library/react'
import { DashboardProvider, useDashboard } from '@/contexts/dashboard-context'

describe('DashboardContext', () => {
  describe('DashboardProvider', () => {
    it('should provide dashboard context to children', () => {
      const TestComponent = () => {
        const context = useDashboard()
        return <div>{context ? 'Context Available' : 'No Context'}</div>
      }

      render(
        <DashboardProvider>
          <TestComponent />
        </DashboardProvider>
      )

      expect(screen.getByText('Context Available')).toBeInTheDocument()
    })

    it('should initialize with default values', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      expect(result.current.layout).toEqual({
        sidebarCollapsed: false,
        activeSection: 'dashboard',
        pageTitle: 'Dashboard',
        breadcrumbs: [],
      })

      expect(result.current.filters).toEqual({
        dateRange: expect.any(Object),
        selectedAsins: [],
        selectedBrands: [],
        searchQuery: '',
        sortBy: 'date',
        sortOrder: 'desc',
      })
    })
  })

  describe('Layout State Management', () => {
    it('should toggle sidebar collapse', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      expect(result.current.layout.sidebarCollapsed).toBe(false)

      act(() => {
        result.current.toggleSidebar()
      })

      expect(result.current.layout.sidebarCollapsed).toBe(true)
    })

    it('should update active section', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      act(() => {
        result.current.setActiveSection('reports')
      })

      expect(result.current.layout.activeSection).toBe('reports')
    })

    it('should update page title and breadcrumbs', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      const breadcrumbs = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports', href: '/dashboard/reports' },
      ]

      act(() => {
        result.current.setPageInfo('Reports', breadcrumbs)
      })

      expect(result.current.layout.pageTitle).toBe('Reports')
      expect(result.current.layout.breadcrumbs).toEqual(breadcrumbs)
    })
  })

  describe('Filter State Management', () => {
    it('should update date range', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      const newDateRange = {
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
      }

      act(() => {
        result.current.updateDateRange(newDateRange)
      })

      expect(result.current.filters.dateRange).toEqual(newDateRange)
    })

    it('should update selected ASINs', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      const asins = ['ASIN1', 'ASIN2', 'ASIN3']

      act(() => {
        result.current.updateSelectedAsins(asins)
      })

      expect(result.current.filters.selectedAsins).toEqual(asins)
    })

    it('should update search query', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      act(() => {
        result.current.updateSearchQuery('test query')
      })

      expect(result.current.filters.searchQuery).toBe('test query')
    })

    it('should reset filters', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      // Set some filters
      act(() => {
        result.current.updateSearchQuery('test')
        result.current.updateSelectedAsins(['ASIN1'])
      })

      // Reset filters
      act(() => {
        result.current.resetFilters()
      })

      expect(result.current.filters.searchQuery).toBe('')
      expect(result.current.filters.selectedAsins).toEqual([])
    })
  })

  describe('Local Storage Persistence', () => {
    it('should persist sidebar state to localStorage', () => {
      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      act(() => {
        result.current.toggleSidebar()
      })

      expect(localStorage.getItem('sqp-sidebar-collapsed')).toBe('true')
    })

    it('should restore sidebar state from localStorage', () => {
      localStorage.setItem('sqp-sidebar-collapsed', 'true')

      const { result } = renderHook(() => useDashboard(), {
        wrapper: DashboardProvider,
      })

      expect(result.current.layout.sidebarCollapsed).toBe(true)
    })
  })
})