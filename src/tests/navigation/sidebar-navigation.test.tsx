import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import SidebarNavigation from '@/components/layout/sidebar-navigation'

// Mock our UI components
vi.mock('@/lib/untitled-ui', () => ({
  ChevronLeftIcon: ({ className, ...props }: any) => (
    <svg data-testid="chevron-left-icon" className={className} {...props} />
  ),
  ChevronRightIcon: ({ className, ...props }: any) => (
    <svg data-testid="chevron-right-icon" className={className} {...props} />
  ),
  HomeIcon: ({ className, ...props }: any) => (
    <svg data-testid="home-icon" className={className} {...props} />
  ),
  FileTextIcon: ({ className, ...props }: any) => (
    <svg data-testid="file-text-icon" className={className} {...props} />
  ),
  ChartBarIcon: ({ className, ...props }: any) => (
    <svg data-testid="chart-bar-icon" className={className} {...props} />
  ),
  CogIcon: ({ className, ...props }: any) => (
    <svg data-testid="cog-icon" className={className} {...props} />
  ),
  TrendingUpIcon: ({ className, ...props }: any) => (
    <svg data-testid="trending-up-icon" className={className} {...props} />
  ),
  DollarSignIcon: ({ className, ...props }: any) => (
    <svg data-testid="dollar-sign-icon" className={className} {...props} />
  ),
  TargetIcon: ({ className, ...props }: any) => (
    <svg data-testid="target-icon" className={className} {...props} />
  ),
  FilterIcon: ({ className, ...props }: any) => (
    <svg data-testid="filter-icon" className={className} {...props} />
  ),
  Avatar: ({ alt, ...props }: any) => (
    <div data-testid="avatar" {...props}>
      {alt?.charAt(0) || '?'}
    </div>
  ),
  Separator: (props: any) => <div data-testid="separator" {...props} />,
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}))

describe('SidebarNavigation Component', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/dashboard')
  })

  describe('Sidebar Collapse/Expand Functionality', () => {
    it('should render sidebar in expanded state by default', () => {
      render(<SidebarNavigation />)
      
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveClass('w-64')
      expect(sidebar).not.toHaveClass('w-16')
    })

    it('should render sidebar in collapsed state when prop is true', () => {
      render(<SidebarNavigation collapsed={true} />)
      
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveClass('w-16')
      expect(sidebar).not.toHaveClass('w-64')
    })

    it('should show collapse button when not mobile', () => {
      const onToggle = vi.fn()
      render(<SidebarNavigation onCollapseToggle={onToggle} />)
      
      const collapseButton = screen.getByTestId('sidebar-collapse-button')
      expect(collapseButton).toBeInTheDocument()
      expect(collapseButton).toHaveAttribute('aria-label', 'Collapse sidebar')
    })

    it('should call onCollapseToggle when collapse button is clicked', () => {
      const onToggle = vi.fn()
      render(<SidebarNavigation onCollapseToggle={onToggle} />)
      
      const collapseButton = screen.getByTestId('sidebar-collapse-button')
      fireEvent.click(collapseButton)
      
      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('should not show collapse button when mobile', () => {
      const onToggle = vi.fn()
      render(<SidebarNavigation onCollapseToggle={onToggle} isMobile={true} />)
      
      const collapseButton = screen.queryByTestId('sidebar-collapse-button')
      expect(collapseButton).not.toBeInTheDocument()
    })

    it('should show correct icon when expanded', () => {
      render(<SidebarNavigation collapsed={false} />)
      
      const collapseButton = screen.getByTestId('sidebar-collapse-button')
      const leftIcon = within(collapseButton).getByTestId('chevron-left-icon')
      const rightIcon = within(collapseButton).queryByTestId('chevron-right-icon')
      
      expect(leftIcon).toBeInTheDocument()
      expect(rightIcon).not.toBeInTheDocument()
    })

    it('should show correct icon when collapsed', () => {
      render(<SidebarNavigation collapsed={true} />)
      
      const collapseButton = screen.getByTestId('sidebar-collapse-button')
      const leftIcon = within(collapseButton).queryByTestId('chevron-left-icon')
      const rightIcon = within(collapseButton).getByTestId('chevron-right-icon')
      
      expect(leftIcon).not.toBeInTheDocument()
      expect(rightIcon).toBeInTheDocument()
    })

    it('should hide text content when collapsed', () => {
      render(<SidebarNavigation collapsed={true} />)
      
      // Company name should be hidden
      expect(screen.queryByText('SQP Intelligence')).not.toBeInTheDocument()
      
      // Navigation labels should be hidden
      expect(screen.queryByText('Reports')).not.toBeInTheDocument()
      expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
    })

    it('should show text content when expanded', () => {
      render(<SidebarNavigation collapsed={false} />)
      
      // Company name should be visible
      expect(screen.getByText('SQP Intelligence')).toBeInTheDocument()
      
      // Navigation labels should be visible (use getAllByText to handle multiple instances)
      const dashboardTexts = screen.getAllByText('Dashboard')
      expect(dashboardTexts.length).toBeGreaterThan(0)
      expect(screen.getByText('Reports')).toBeInTheDocument()
    })
  })

  describe('Navigation Menu Structure', () => {
    it('should render all main navigation items', () => {
      render(<SidebarNavigation />)
      
      // Use getAllByText for Dashboard to handle multiple instances
      const dashboardItems = screen.getAllByText('Dashboard')
      expect(dashboardItems.length).toBeGreaterThan(0)
      expect(screen.getByText('Enhanced Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
      expect(screen.getByText('Enhanced Metrics')).toBeInTheDocument()
      expect(screen.getByText('Custom Views')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should render navigation icons for each item', () => {
      render(<SidebarNavigation />)
      
      expect(screen.getAllByTestId('home-icon').length).toBeGreaterThanOrEqual(2) // Dashboard + Enhanced Dashboard
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument()
      expect(screen.getAllByTestId('chart-bar-icon').length).toBeGreaterThan(0)
      expect(screen.getByTestId('filter-icon')).toBeInTheDocument() // Custom Views
      expect(screen.getAllByTestId('cog-icon').length).toBeGreaterThan(0)
    })

    it('should render submenu items when Reports is expanded', () => {
      render(<SidebarNavigation />)
      
      // Reports should be expanded by default
      expect(screen.getByText('Performance')).toBeInTheDocument()
      expect(screen.getByText('Growth & Trends')).toBeInTheDocument()
      expect(screen.getByText('ROI & Investment')).toBeInTheDocument()
      expect(screen.getByText('Strategic Actions')).toBeInTheDocument()
    })

    it('should show badge for Enhanced Dashboard item', () => {
      render(<SidebarNavigation />)
      
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveTextContent('New')
    })

    it('should highlight active navigation item', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard')
      render(<SidebarNavigation activeRoute="/dashboard" />)
      
      // Find the Dashboard navigation link (should be the exact match)
      const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i })
      const exactDashboardLink = dashboardLinks.find(link => 
        link.getAttribute('href') === '/dashboard' && 
        link.textContent === 'Dashboard'
      )
      expect(exactDashboardLink).toHaveClass('bg-primary-50', 'text-primary-700')
    })

    it('should highlight active submenu item', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<SidebarNavigation activeRoute="/dashboard/reports/performance" />)
      
      const performanceLink = screen.getByText('Performance').closest('a')
      expect(performanceLink).toHaveClass('bg-primary-50', 'text-primary-700')
    })
  })

  describe('Navigation Behavior', () => {
    it('should call onNavigate when navigation item is clicked', () => {
      const onNavigate = vi.fn()
      render(<SidebarNavigation onNavigate={onNavigate} />)
      
      // Find the exact Dashboard navigation link
      const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i })
      const exactDashboardLink = dashboardLinks.find(link => 
        link.getAttribute('href') === '/dashboard' && 
        link.textContent === 'Dashboard'
      )
      fireEvent.click(exactDashboardLink!)
      
      expect(onNavigate).toHaveBeenCalledTimes(1)
    })

    it('should expand/collapse submenu when parent item is clicked', () => {
      render(<SidebarNavigation />)
      
      // Reports should be expanded by default, submenu should be visible
      expect(screen.getByText('Performance')).toBeInTheDocument()
      
      // Click on the reports link to collapse/expand
      const reportsLink = screen.getByText('Reports')
      fireEvent.click(reportsLink)
      
      // After clicking, the submenu should be collapsed (toggled from expanded to collapsed)
      expect(screen.queryByText('Performance')).not.toBeInTheDocument()
    })

    it('should prevent navigation when clicking expandable menu item', () => {
      const onNavigate = vi.fn()
      render(<SidebarNavigation onNavigate={onNavigate} />)
      
      const reportsLink = screen.getByText('Reports').closest('a')
      fireEvent.click(reportsLink!)
      
      // onNavigate should not be called for expandable items when expanded/collapsed
      // The click handler prevents default for expandable items
      expect(onNavigate).not.toHaveBeenCalled()
    })
  })

  describe('User Profile Section', () => {
    it('should render user profile section when not collapsed', () => {
      render(<SidebarNavigation collapsed={false} />)
      
      expect(screen.getByTestId('separator')).toBeInTheDocument()
      expect(screen.getByTestId('avatar')).toBeInTheDocument()
      expect(screen.getByText('Dashboard User')).toBeInTheDocument()
      expect(screen.getByText('user@example.com')).toBeInTheDocument()
    })

    it('should hide user profile section when collapsed', () => {
      render(<SidebarNavigation collapsed={true} />)
      
      expect(screen.queryByText('Dashboard User')).not.toBeInTheDocument()
      expect(screen.queryByText('user@example.com')).not.toBeInTheDocument()
    })

    it('should render user menu button', () => {
      render(<SidebarNavigation collapsed={false} />)
      
      const userMenuButton = screen.getByRole('button', { name: 'User menu' })
      expect(userMenuButton).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria-labels for collapse button', () => {
      const onToggle = vi.fn()
      
      const { rerender } = render(
        <SidebarNavigation onCollapseToggle={onToggle} collapsed={false} />
      )
      
      let collapseButton = screen.getByTestId('sidebar-collapse-button')
      expect(collapseButton).toHaveAttribute('aria-label', 'Collapse sidebar')
      
      rerender(<SidebarNavigation onCollapseToggle={onToggle} collapsed={true} />)
      
      collapseButton = screen.getByTestId('sidebar-collapse-button')
      expect(collapseButton).toHaveAttribute('aria-label', 'Expand sidebar')
    })

    it('should have proper data attributes for testing', () => {
      render(<SidebarNavigation activeRoute="/dashboard" />)
      
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveAttribute('data-active-route', '/dashboard')
    })

    it('should maintain keyboard navigation support', () => {
      render(<SidebarNavigation />)
      
      // Find the exact Dashboard navigation link
      const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i })
      const exactDashboardLink = dashboardLinks.find(link => 
        link.getAttribute('href') === '/dashboard' && 
        link.textContent === 'Dashboard'
      )
      expect(exactDashboardLink).toHaveAttribute('href', '/dashboard')
      
      const performanceLink = screen.getByRole('link', { name: /performance/i })
      expect(performanceLink).toHaveAttribute('href', '/dashboard/reports/performance')
    })
  })

  describe('Responsive Behavior', () => {
    it('should handle mobile prop correctly', () => {
      render(<SidebarNavigation isMobile={true} />)
      
      // Should not show collapse button on mobile
      const collapseButton = screen.queryByTestId('sidebar-collapse-button')
      expect(collapseButton).not.toBeInTheDocument()
    })

    it('should apply correct styling for mobile', () => {
      render(<SidebarNavigation isMobile={true} collapsed={false} />)
      
      const sidebar = screen.getByTestId('sidebar-navigation')
      expect(sidebar).toHaveClass('w-64')
    })
  })
})