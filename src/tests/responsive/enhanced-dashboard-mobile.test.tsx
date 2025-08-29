import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import EnhancedDashboardLayout from '@/components/dashboard/enhanced-dashboard-layout'
import EnhancedDashboardPage from '@/app/dashboard/enhanced/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}))

// Mock components
vi.mock('@/components/layout/application-shell', () => ({
  default: ({ children }: any) => (
    <div data-testid="application-shell" className="mock-shell">
      {children}
    </div>
  ),
}))

vi.mock('@/components/layout/sidebar-navigation', () => ({
  default: ({ collapsed, onCollapseToggle, activeRoute, onNavigate, isMobile }: any) => (
    <nav 
      data-testid="sidebar-navigation"
      data-collapsed={collapsed}
      data-active-route={activeRoute}
      data-mobile={isMobile}
      className={isMobile ? 'mobile-sidebar' : 'desktop-sidebar'}
    >
      <button data-testid="sidebar-toggle" onClick={onCollapseToggle}>
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
    </nav>
  ),
}))

vi.mock('@/components/navigation/breadcrumb', () => ({
  default: ({ items, maxItems, showHome, onNavigate }: any) => (
    <nav 
      data-testid="breadcrumb-navigation" 
      data-max-items={maxItems} 
      data-show-home={showHome}
    >
      <span>Breadcrumb (max: {maxItems || 'unlimited'})</span>
    </nav>
  ),
}))

// Mock the DashboardProvider
vi.mock('@/contexts/dashboard-context', () => ({
  DashboardProvider: ({ children }: any) => (
    <div data-testid="dashboard-provider">{children}</div>
  ),
  useDashboard: () => ({
    layout: {
      sidebarCollapsed: false,
      mobileMenuOpen: false,
    },
    toggleSidebar: vi.fn(),
    isDarkMode: false,
    toggleDarkMode: vi.fn(),
  }),
}))

const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
}

// Helper to mock window.innerWidth
const mockWindowSize = (width: number, height: number = 768) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
}

// Helper to trigger resize event
const triggerResize = () => {
  const resizeEvent = new Event('resize')
  window.dispatchEvent(resizeEvent)
}

describe('Enhanced Dashboard Mobile Optimization', () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any)
    vi.mocked(usePathname).mockReturnValue('/dashboard/enhanced')
    vi.clearAllMocks()
    
    // Default to desktop size
    mockWindowSize(1024)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Mobile Layout Adaptation', () => {
    it('should adapt layout for mobile viewports', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      // Should use mobile layout
      const sidebar = screen.getByTestId('sidebar-navigation')
      const breadcrumb = screen.getByTestId('breadcrumb-navigation')

      expect(sidebar).toHaveAttribute('data-mobile', 'true')
      expect(breadcrumb).toHaveAttribute('data-max-items', '2')
    })

    it('should handle content responsiveness on different screen sizes', async () => {
      const screenSizes = [
        { width: 320, name: 'Small Mobile' },
        { width: 375, name: 'Mobile' },
        { width: 768, name: 'Tablet' },
        { width: 1024, name: 'Desktop' },
      ]

      for (const { width, name } of screenSizes) {
        await act(async () => {
          mockWindowSize(width)
        })
        
        const { unmount } = render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )

        await act(async () => {
          triggerResize()
        })

        // Verify layout exists and renders properly for each size
        expect(screen.getByTestId('dashboard-provider')).toBeInTheDocument()
        expect(screen.getByText('Enhanced Dashboard')).toBeInTheDocument()
        
        // Check that key content is present
        expect(screen.getByText('Total ASINs')).toBeInTheDocument()
        expect(screen.getByText('85')).toBeInTheDocument()

        unmount()
      }
    })
  })

  describe('Mobile Content Layout', () => {
    it('should display stats cards in mobile-friendly grid', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      // All key metrics should be visible
      expect(screen.getByText('Total ASINs')).toBeInTheDocument()
      expect(screen.getByText('Search Queries')).toBeInTheDocument()
      expect(screen.getByText('Avg. Market Share')).toBeInTheDocument()
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      
      // Values should be displayed
      expect(screen.getByText('85')).toBeInTheDocument()
      expect(screen.getByText('40,731')).toBeInTheDocument()
      expect(screen.getByText('24.3%')).toBeInTheDocument()
      expect(screen.getByText('$847K')).toBeInTheDocument()
    })

    it('should handle layout redesign features section on mobile', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      // Feature highlights should be visible
      expect(screen.getByText('Layout Redesign Features')).toBeInTheDocument()
      expect(screen.getByText('✅ Collapsible Sidebar Navigation')).toBeInTheDocument()
      expect(screen.getByText('✅ Dynamic Breadcrumb Navigation')).toBeInTheDocument()
      expect(screen.getByText('✅ Untitled UI Components')).toBeInTheDocument()
      expect(screen.getByText('✅ Responsive Design')).toBeInTheDocument()
    })

    it('should display activity and insights sections on mobile', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      // Activity section
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      expect(screen.getByText('Data sync completed')).toBeInTheDocument()
      expect(screen.getByText('Brand extraction updated')).toBeInTheDocument()

      // Keywords section
      expect(screen.getByText('Top Performing Keywords')).toBeInTheDocument()
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
      expect(screen.getByText('sharpening system')).toBeInTheDocument()

      // Market insights
      expect(screen.getByText('Market Insights')).toBeInTheDocument()
      expect(screen.getByText('🎯 Opportunity')).toBeInTheDocument()
      expect(screen.getByText('📈 Trend')).toBeInTheDocument()
      expect(screen.getByText('⚠️ Watch')).toBeInTheDocument()
    })
  })

  describe('Mobile Navigation Integration', () => {
    it('should integrate properly with mobile sidebar', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveClass('mobile-sidebar')
      expect(sidebar).toHaveAttribute('data-mobile', 'true')
    })

    it('should show mobile-optimized breadcrumbs', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      expect(breadcrumb).toHaveAttribute('data-max-items', '2')
      expect(screen.getByText('Breadcrumb (max: 2)')).toBeInTheDocument()
    })
  })

  describe('Responsive Typography and Spacing', () => {
    it('should use appropriate text sizes for mobile', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      // Main heading should be present and readable
      const mainHeading = screen.getByText('Enhanced Dashboard')
      expect(mainHeading).toBeInTheDocument()

      // Description should be present
      const description = screen.getByText(/Welcome to the redesigned SQP Intelligence Dashboard/)
      expect(description).toBeInTheDocument()

      // Card titles should be present
      expect(screen.getByText('Total ASINs')).toBeInTheDocument()
      expect(screen.getByText('Layout Redesign Features')).toBeInTheDocument()
    })

    it('should maintain readability across different mobile sizes', async () => {
      const mobileSizes = [
        { width: 320, name: 'iPhone 5/SE' },
        { width: 375, name: 'iPhone 6/7/8' },
        { width: 414, name: 'iPhone 6/7/8 Plus' },
      ]

      for (const { width, name } of mobileSizes) {
        await act(async () => {
          mockWindowSize(width)
        })
        
        const { unmount } = render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )

        await act(async () => {
          triggerResize()
        })

        // Text should be readable at all mobile sizes
        expect(screen.getByText('Enhanced Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Total ASINs')).toBeInTheDocument()
        expect(screen.getByText('85')).toBeInTheDocument()

        unmount()
      }
    })
  })

  describe('Touch and Interaction Optimization', () => {
    it('should handle touch interactions on mobile dashboard', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      // Sidebar toggle should be accessible
      const sidebarToggle = screen.getByTestId('sidebar-toggle')
      
      await act(async () => {
        fireEvent.click(sidebarToggle)
      })

      expect(sidebarToggle).toBeInTheDocument()
    })

    it('should maintain accessibility on mobile', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      // Should have proper heading structure
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('Enhanced Dashboard')

      // Navigation should be accessible
      expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument()
      expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument()
    })
  })

  describe('Performance on Mobile', () => {
    it('should render efficiently on mobile devices', async () => {
      mockWindowSize(375) // Mobile size
      
      const startTime = performance.now()
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render reasonably quickly
      expect(renderTime).toBeLessThan(200) // Allow more time for full page render

      // All key elements should be present
      expect(screen.getByText('Enhanced Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Total ASINs')).toBeInTheDocument()
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    })

    it('should handle orientation changes gracefully', async () => {
      // Start in portrait mobile
      mockWindowSize(375, 667)
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <EnhancedDashboardPage />
          </EnhancedDashboardLayout>
        )
      })

      // Verify initial state
      expect(screen.getByText('Enhanced Dashboard')).toBeInTheDocument()

      // Switch to landscape mobile
      await act(async () => {
        mockWindowSize(667, 375)
        triggerResize()
      })

      // Content should still be accessible
      expect(screen.getByText('Enhanced Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Total ASINs')).toBeInTheDocument()
    })
  })
})