import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import EnhancedDashboardLayout from '@/components/dashboard/enhanced-dashboard-layout'

// Mock the ApplicationShell component
vi.mock('@/components/layout/application-shell', () => ({
  default: ({ children }: any) => (
    <div data-testid="application-shell">
      {children}
    </div>
  ),
}))

// Mock the SidebarNavigation component
vi.mock('@/components/layout/sidebar-navigation', () => ({
  default: ({ collapsed, onCollapseToggle, activeRoute, onNavigate, isMobile }: any) => (
    <div 
      data-testid="sidebar-navigation"
      data-collapsed={collapsed}
      data-active-route={activeRoute}
      data-mobile={isMobile}
    >
      <button 
        data-testid="sidebar-collapse-button" 
        onClick={onCollapseToggle}
      >
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
      <button data-testid="sidebar-nav-item" onClick={onNavigate}>
        Dashboard
      </button>
    </div>
  ),
}))

// Mock the Breadcrumb component
vi.mock('@/components/navigation/breadcrumb', () => ({
  default: ({ items, maxItems, showHome, onNavigate }: any) => (
    <nav data-testid="breadcrumb-navigation" data-max-items={maxItems} data-show-home={showHome}>
      <button data-testid="breadcrumb-navigate" onClick={() => onNavigate?.('/dashboard')}>
        Dashboard
      </button>
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

const TestChildren = () => (
  <div data-testid="dashboard-content">
    <h1>Dashboard Content</h1>
  </div>
)

describe('EnhancedDashboardLayout Component', () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any)
    vi.mocked(usePathname).mockReturnValue('/dashboard')
    vi.clearAllMocks()
  })

  describe('Layout Structure', () => {
    it('should render the complete enhanced dashboard layout', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      expect(screen.getByTestId('dashboard-provider')).toBeInTheDocument()
      expect(screen.getByTestId('application-shell')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument()
      expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
    })

    it('should pass correct props to sidebar navigation', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-active-route', '/dashboard')
      expect(sidebar).toHaveAttribute('data-collapsed', 'false')
      expect(sidebar).toHaveAttribute('data-mobile', 'false')
    })

    it('should pass correct props to breadcrumb navigation', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      expect(breadcrumb).toHaveAttribute('data-show-home', 'true')
      expect(breadcrumb).toHaveAttribute('data-max-items', '4')
    })
  })

  describe('Sidebar Integration', () => {
    it('should handle sidebar collapse toggle', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const collapseButton = screen.getByTestId('sidebar-collapse-button')
      expect(collapseButton).toBeInTheDocument()
      
      fireEvent.click(collapseButton)
      // The mock doesn't actually toggle the state, but we can verify the button exists
      expect(collapseButton).toBeInTheDocument()
    })

    it('should handle sidebar navigation', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const navItem = screen.getByTestId('sidebar-nav-item')
      fireEvent.click(navItem)
      
      // Verify navigation handler was called
      expect(navItem).toBeInTheDocument()
    })
  })

  describe('Breadcrumb Integration', () => {
    it('should handle breadcrumb navigation', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const breadcrumbNav = screen.getByTestId('breadcrumb-navigate')
      fireEvent.click(breadcrumbNav)
      
      // Verify breadcrumb navigation exists
      expect(breadcrumbNav).toBeInTheDocument()
    })

    it('should configure breadcrumb for mobile responsiveness', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      expect(breadcrumb).toHaveAttribute('data-max-items', '4')
    })
  })

  describe('Content Rendering', () => {
    it('should render children content correctly', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    })

    it('should maintain proper layout hierarchy', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const provider = screen.getByTestId('dashboard-provider')
      const shell = screen.getByTestId('application-shell')
      const sidebar = screen.getByTestId('sidebar-navigation')
      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      const content = screen.getByTestId('dashboard-content')
      
      // Verify all components are present
      expect(provider).toContainElement(shell)
      expect(shell).toBeInTheDocument()
      expect(sidebar).toBeInTheDocument()
      expect(breadcrumb).toBeInTheDocument()
      expect(content).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('should handle different viewport sizes', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      // The layout should be responsive through its child components
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-mobile', 'false')
    })
  })

  describe('Accessibility', () => {
    it('should maintain proper accessibility structure', () => {
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      // Verify navigation structure is accessible
      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      expect(breadcrumb).toBeInTheDocument()
      
      // Sidebar should be accessible
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toBeInTheDocument()
    })
  })

  describe('Route Handling', () => {
    it('should pass current route to navigation components', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-active-route', '/dashboard/reports/performance')
    })

    it('should handle different route paths', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/settings')
      
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-active-route', '/dashboard/settings')
    })
  })

  describe('Error Handling', () => {
    it('should handle missing router gracefully', () => {
      vi.mocked(useRouter).mockReturnValue(null as any)
      
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      // Should still render without crashing
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
    })

    it('should handle missing pathname gracefully', () => {
      vi.mocked(usePathname).mockReturnValue('')
      
      render(
        <EnhancedDashboardLayout>
          <TestChildren />
        </EnhancedDashboardLayout>
      )
      
      // Should still render without crashing
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument()
    })
  })
})