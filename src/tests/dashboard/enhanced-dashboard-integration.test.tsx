import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import EnhancedDashboardPage from '@/app/dashboard/enhanced/page'
import EnhancedDashboardLayout from '@/components/dashboard/enhanced-dashboard-layout'

// Mock the child components
vi.mock('@/components/layout/application-shell', () => ({
  default: ({ children }: any) => (
    <div data-testid="application-shell">
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
    >
      <button 
        data-testid="sidebar-collapse-button" 
        onClick={onCollapseToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? 'Expand' : 'Collapse'}
      </button>
      <a 
        href="/dashboard" 
        onClick={(e) => { e.preventDefault(); onNavigate?.('/dashboard'); }}
        data-testid="nav-dashboard"
      >
        Dashboard
      </a>
      <a 
        href="/dashboard/reports" 
        onClick={(e) => { e.preventDefault(); onNavigate?.('/dashboard/reports'); }}
        data-testid="nav-reports"
      >
        Reports
      </a>
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
      <a 
        href="/dashboard" 
        onClick={(e) => { e.preventDefault(); onNavigate?.('/dashboard'); }}
        data-testid="breadcrumb-dashboard"
      >
        Dashboard
      </a>
      <span aria-hidden="true">/</span>
      <span data-testid="breadcrumb-current">Enhanced</span>
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

// Mock Untitled UI components
vi.mock('@/components/ui/untitled-ui', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="ui-card" className={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div data-testid="card-header" className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div data-testid="card-content" className={className} {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className, ...props }: any) => (
    <h3 data-testid="card-title" className={className} {...props}>
      {children}
    </h3>
  ),
  CardDescription: ({ children, className, ...props }: any) => (
    <p data-testid="card-description" className={className} {...props}>
      {children}
    </p>
  ),
}))

describe('Enhanced Dashboard Integration', () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any)
    vi.mocked(usePathname).mockReturnValue('/dashboard/enhanced')
    vi.clearAllMocks()
  })

  describe('Full Page Integration', () => {
    it('should render the complete enhanced dashboard with layout', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      // Verify layout components
      expect(screen.getByTestId('dashboard-provider')).toBeInTheDocument()
      expect(screen.getByTestId('application-shell')).toBeInTheDocument()
      expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument()
      expect(screen.getByTestId('breadcrumb-navigation')).toBeInTheDocument()
      
      // Verify page content
      expect(screen.getByText('Enhanced Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Welcome to the redesigned SQP Intelligence Dashboard with modern navigation and layout.')).toBeInTheDocument()
    })

    it('should display all key metrics cards', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      // Check for stats cards
      expect(screen.getByText('Total ASINs')).toBeInTheDocument()
      expect(screen.getByText('85')).toBeInTheDocument()
      
      expect(screen.getByText('Search Queries')).toBeInTheDocument()
      expect(screen.getByText('40,731')).toBeInTheDocument()
      
      expect(screen.getByText('Avg. Market Share')).toBeInTheDocument()
      expect(screen.getByText('24.3%')).toBeInTheDocument()
      
      expect(screen.getByText('Total Revenue')).toBeInTheDocument()
      expect(screen.getByText('$847K')).toBeInTheDocument()
    })

    it('should render layout redesign features section', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      expect(screen.getByText('Layout Redesign Features')).toBeInTheDocument()
      expect(screen.getByText('✅ Collapsible Sidebar Navigation')).toBeInTheDocument()
      expect(screen.getByText('✅ Dynamic Breadcrumb Navigation')).toBeInTheDocument()
      expect(screen.getByText('✅ Untitled UI Components')).toBeInTheDocument()
      expect(screen.getByText('✅ Responsive Design')).toBeInTheDocument()
    })
  })

  describe('Navigation Integration', () => {
    it('should handle sidebar navigation clicks', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      const dashboardLink = screen.getByTestId('nav-dashboard')
      const reportsLink = screen.getByTestId('nav-reports')
      
      fireEvent.click(dashboardLink)
      fireEvent.click(reportsLink)
      
      // Verify navigation exists and is clickable
      expect(dashboardLink).toBeInTheDocument()
      expect(reportsLink).toBeInTheDocument()
    })

    it('should handle breadcrumb navigation', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      const breadcrumbDashboard = screen.getByTestId('breadcrumb-dashboard')
      const breadcrumbCurrent = screen.getByTestId('breadcrumb-current')
      
      fireEvent.click(breadcrumbDashboard)
      
      expect(breadcrumbDashboard).toBeInTheDocument()
      expect(breadcrumbCurrent).toHaveTextContent('Enhanced')
    })

    it('should handle sidebar collapse toggle', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      const collapseButton = screen.getByTestId('sidebar-collapse-button')
      expect(collapseButton).toHaveAttribute('aria-label', 'Collapse sidebar')
      
      fireEvent.click(collapseButton)
      
      // Button should exist and be clickable
      expect(collapseButton).toBeInTheDocument()
    })
  })

  describe('Content Sections', () => {
    it('should display recent activity section', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      expect(screen.getByText('Recent Activity')).toBeInTheDocument()
      expect(screen.getByText('Data sync completed')).toBeInTheDocument()
      expect(screen.getByText('Brand extraction updated')).toBeInTheDocument()
      expect(screen.getByText('Performance report generated')).toBeInTheDocument()
    })

    it('should display top performing keywords', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      expect(screen.getByText('Top Performing Keywords')).toBeInTheDocument()
      expect(screen.getByText('knife sharpener')).toBeInTheDocument()
      expect(screen.getByText('sharpening system')).toBeInTheDocument()
      expect(screen.getByText('work sharp')).toBeInTheDocument()
      expect(screen.getByText('electric sharpener')).toBeInTheDocument()
    })

    it('should display market insights with color-coded alerts', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      expect(screen.getByText('Market Insights')).toBeInTheDocument()
      expect(screen.getByText('🎯 Opportunity')).toBeInTheDocument()
      expect(screen.getByText('📈 Trend')).toBeInTheDocument()
      expect(screen.getByText('⚠️ Watch')).toBeInTheDocument()
      
      expect(screen.getByText('Premium sharpener market showing 23% growth')).toBeInTheDocument()
      expect(screen.getByText('Professional-grade tools gaining traction')).toBeInTheDocument()
      expect(screen.getByText('Competitor pricing changes detected')).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('should handle mobile layout configuration', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      const breadcrumb = screen.getByTestId('breadcrumb-navigation')
      const sidebar = screen.getByTestId('sidebar-navigation')
      
      // Should be configured for desktop initially
      expect(sidebar).toHaveAttribute('data-mobile', 'false')
      expect(breadcrumb).toHaveAttribute('data-max-items', '4')
    })
  })

  describe('UI Component Integration', () => {
    it('should use Untitled UI components consistently', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      // Verify UI components are being used
      const cards = screen.getAllByTestId('ui-card')
      const cardHeaders = screen.getAllByTestId('card-header')
      const cardContents = screen.getAllByTestId('card-content')
      const cardTitles = screen.getAllByTestId('card-title')
      const cardDescriptions = screen.getAllByTestId('card-description')
      
      expect(cards.length).toBeGreaterThan(0)
      expect(cardHeaders.length).toBeGreaterThan(0)
      expect(cardContents.length).toBeGreaterThan(0)
      expect(cardTitles.length).toBeGreaterThan(0)
      expect(cardDescriptions.length).toBeGreaterThan(0)
    })
  })

  describe('Accessibility', () => {
    it('should maintain proper semantic structure', () => {
      render(
        <EnhancedDashboardLayout>
          <EnhancedDashboardPage />
        </EnhancedDashboardLayout>
      )
      
      // Check for proper heading hierarchy
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('Enhanced Dashboard')
      
      // Check for navigation landmarks
      const navElements = screen.getAllByRole('navigation')
      expect(navElements.length).toBeGreaterThan(0)
    })
  })
})