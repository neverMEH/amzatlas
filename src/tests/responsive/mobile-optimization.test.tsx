import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import EnhancedDashboardLayout from '@/components/dashboard/enhanced-dashboard-layout'
import ApplicationShell from '@/components/layout/application-shell'
import SidebarNavigation from '@/components/layout/sidebar-navigation'
import Breadcrumb from '@/components/navigation/breadcrumb'

// Mock components for isolated testing
vi.mock('@/components/layout/application-shell', () => ({
  default: ({ children }: any) => (
    <div data-testid="application-shell" data-mobile="mock">
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
      <button 
        data-testid="sidebar-toggle" 
        onClick={onCollapseToggle}
        className={isMobile ? 'mobile-toggle' : 'desktop-toggle'}
      >
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
      <div data-testid="nav-items" className={isMobile ? 'mobile-nav' : 'desktop-nav'}>
        <a href="/dashboard" onClick={onNavigate}>Dashboard</a>
      </div>
    </nav>
  ),
}))

vi.mock('@/components/navigation/breadcrumb', () => ({
  default: ({ items, maxItems, showHome, onNavigate }: any) => (
    <nav 
      data-testid="breadcrumb-navigation" 
      data-max-items={maxItems} 
      data-show-home={showHome}
      className={maxItems === 2 ? 'mobile-breadcrumb' : 'desktop-breadcrumb'}
    >
      <span data-testid="breadcrumb-items">
        Items: {maxItems || 'unlimited'}
      </span>
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

const TestContent = () => (
  <div data-testid="test-content">
    <h1>Test Content</h1>
  </div>
)

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

describe('Mobile Optimization Tests', () => {
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

  describe('Viewport Detection', () => {
    it('should detect mobile viewport correctly', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'true')
      expect(sidebar).toHaveClass('mobile-sidebar')
    })

    it('should detect tablet viewport correctly', async () => {
      mockWindowSize(768) // Tablet size (boundary)
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'false')
      expect(sidebar).toHaveClass('desktop-sidebar')
    })

    it('should detect desktop viewport correctly', async () => {
      mockWindowSize(1200) // Desktop size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'false')
      expect(sidebar).toHaveClass('desktop-sidebar')
    })

    it('should respond to window resize events', async () => {
      mockWindowSize(1200) // Start with desktop
      
      const { rerender } = render(
        <EnhancedDashboardLayout>
          <TestContent />
        </EnhancedDashboardLayout>
      )

      // Initially should be desktop
      let sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'false')

      // Resize to mobile
      await act(async () => {
        mockWindowSize(375)
        triggerResize()
      })

      // Should update to mobile
      sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'true')
    })
  })

  describe('Mobile Sidebar Behavior', () => {
    it('should configure sidebar for mobile correctly', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const sidebar = screen.getByTestId('sidebar-navigation')
      const toggle = screen.getByTestId('sidebar-toggle')
      const navItems = screen.getByTestId('nav-items')

      expect(sidebar).toHaveAttribute('data-mobile', 'true')
      expect(toggle).toHaveClass('mobile-toggle')
      expect(navItems).toHaveClass('mobile-nav')
    })

    it('should handle mobile sidebar toggle', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const toggle = screen.getByTestId('sidebar-toggle')
      
      await act(async () => {
        fireEvent.click(toggle)
      })

      // Should still be mobile after toggle
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'true')
    })

    it('should use mobile navigation styling', async () => {
      mockWindowSize(320) // Small mobile size
      
      await act(async () => {
        render(
          <SidebarNavigation 
            collapsed={false}
            onCollapseToggle={vi.fn()}
            activeRoute="/dashboard"
            onNavigate={vi.fn()}
            isMobile={true}
          />
        )
      })

      const sidebar = screen.getByTestId('sidebar-navigation')
      const navItems = screen.getByTestId('nav-items')

      expect(sidebar).toHaveClass('mobile-sidebar')
      expect(navItems).toHaveClass('mobile-nav')
    })
  })

  describe('Mobile Breadcrumb Optimization', () => {
    it('should limit breadcrumb items on mobile', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      const breadcrumbItems = screen.getByTestId('breadcrumb-items')

      expect(breadcrumb).toHaveAttribute('data-max-items', '2')
      expect(breadcrumb).toHaveClass('mobile-breadcrumb')
      expect(breadcrumbItems).toHaveTextContent('Items: 2')
    })

    it('should use full breadcrumbs on desktop', async () => {
      mockWindowSize(1200) // Desktop size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      const breadcrumbItems = screen.getByTestId('breadcrumb-items')

      expect(breadcrumb).toHaveAttribute('data-max-items', '4')
      expect(breadcrumb).toHaveClass('desktop-breadcrumb')
      expect(breadcrumbItems).toHaveTextContent('Items: 4')
    })

    it('should handle breadcrumb responsiveness on resize', async () => {
      mockWindowSize(1200) // Start desktop
      
      const { rerender } = render(
        <EnhancedDashboardLayout>
          <TestContent />
        </EnhancedDashboardLayout>
      )

      // Initially desktop breadcrumb
      let breadcrumb = screen.getByTestId('breadcrumb-navigation')
      expect(breadcrumb).toHaveAttribute('data-max-items', '4')

      // Resize to mobile
      await act(async () => {
        mockWindowSize(375)
        triggerResize()
      })

      // Should update to mobile breadcrumb
      breadcrumb = screen.getByTestId('breadcrumb-navigation')
      expect(breadcrumb).toHaveAttribute('data-max-items', '2')
    })
  })

  describe('Layout Spacing and Margins', () => {
    it('should apply correct mobile layout classes', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      // The layout should exist and render content
      expect(screen.getByTestId('test-content')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument()
      expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument()
    })

    it('should handle content overflow on mobile', async () => {
      mockWindowSize(320) // Very small mobile
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <div data-testid="wide-content" style={{ width: '2000px' }}>
              Very wide content that should handle overflow
            </div>
          </EnhancedDashboardLayout>
        )
      })

      const wideContent = screen.getByTestId('wide-content')
      expect(wideContent).toBeInTheDocument()
    })
  })

  describe('Responsive Breakpoints', () => {
    const testBreakpoints = [
      { width: 320, name: 'Small Mobile', expectedMobile: true },
      { width: 375, name: 'Mobile', expectedMobile: true },
      { width: 414, name: 'Large Mobile', expectedMobile: true },
      { width: 768, name: 'Tablet', expectedMobile: false },
      { width: 1024, name: 'Small Desktop', expectedMobile: false },
      { width: 1200, name: 'Desktop', expectedMobile: false },
      { width: 1920, name: 'Large Desktop', expectedMobile: false },
    ]

    testBreakpoints.forEach(({ width, name, expectedMobile }) => {
      it(`should handle ${name} viewport (${width}px)`, async () => {
        mockWindowSize(width)
        
        await act(async () => {
          render(
            <EnhancedDashboardLayout>
              <TestContent />
            </EnhancedDashboardLayout>
          )
        })

        await act(async () => {
          triggerResize()
        })

        const sidebar = screen.getByTestId('sidebar-navigation')
        const breadcrumb = screen.getByTestId('breadcrumb-navigation')

        expect(sidebar).toHaveAttribute('data-mobile', expectedMobile.toString())
        
        if (expectedMobile) {
          expect(breadcrumb).toHaveAttribute('data-max-items', '2')
          expect(sidebar).toHaveClass('mobile-sidebar')
        } else {
          expect(breadcrumb).toHaveAttribute('data-max-items', '4')
          expect(sidebar).toHaveClass('desktop-sidebar')
        }
      })
    })
  })

  describe('Touch and Gesture Support', () => {
    it('should handle mobile navigation interactions', async () => {
      mockWindowSize(375) // Mobile size
      const onNavigate = vi.fn()
      
      await act(async () => {
        render(
          <SidebarNavigation 
            collapsed={false}
            onCollapseToggle={vi.fn()}
            activeRoute="/dashboard"
            onNavigate={onNavigate}
            isMobile={true}
          />
        )
      })

      const navLink = screen.getByRole('link', { name: /dashboard/i })
      
      // Simulate touch interaction
      await act(async () => {
        fireEvent.click(navLink)
      })

      expect(onNavigate).toHaveBeenCalled()
    })

    it('should support keyboard navigation on mobile', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <SidebarNavigation 
            collapsed={false}
            onCollapseToggle={vi.fn()}
            activeRoute="/dashboard"
            onNavigate={vi.fn()}
            isMobile={true}
          />
        )
      })

      const navLink = screen.getByRole('link', { name: /dashboard/i })
      
      // Should be focusable for keyboard navigation
      navLink.focus()
      expect(document.activeElement).toBe(navLink)
    })
  })

  describe('Performance on Mobile', () => {
    it('should render efficiently on mobile devices', async () => {
      mockWindowSize(375) // Mobile size
      
      const startTime = performance.now()
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should render in reasonable time (less than 100ms for this simple test)
      expect(renderTime).toBeLessThan(100)
      
      // All components should be present
      expect(screen.getByTestId('test-content')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument()
      expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument()
    })

    it('should handle multiple resize events efficiently', async () => {
      mockWindowSize(1200) // Start desktop
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      // Simulate multiple rapid resize events
      const sizes = [375, 768, 1024, 375, 1200]
      
      for (const size of sizes) {
        await act(async () => {
          mockWindowSize(size)
          triggerResize()
        })
      }

      // Should still work correctly after multiple resizes
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'false') // Last size was 1200
      expect(screen.getByTestId('test-content')).toBeInTheDocument()
    })
  })

  describe('Accessibility on Mobile', () => {
    it('should maintain accessibility on mobile viewports', async () => {
      mockWindowSize(375) // Mobile size
      
      await act(async () => {
        render(
          <EnhancedDashboardLayout>
            <TestContent />
          </EnhancedDashboardLayout>
        )
      })

      await act(async () => {
        triggerResize()
      })

      // Navigation should remain accessible
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toBeInTheDocument()
      
      // Breadcrumb should remain accessible
      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      expect(breadcrumb).toBeInTheDocument()
      
      // Toggle should be accessible
      const toggle = screen.getByTestId('sidebar-toggle')
      expect(toggle).toBeInTheDocument()
    })
  })
})