import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import Breadcrumb from '@/components/navigation/breadcrumb'
import type { BreadcrumbItem } from '@/types/navigation'

// Mock our UI components
vi.mock('@/lib/untitled-ui', () => ({
  ChevronRightIcon: ({ className, ...props }: any) => (
    <svg data-testid="chevron-right-icon" className={className} {...props} />
  ),
  HomeIcon: ({ className, ...props }: any) => (
    <svg data-testid="home-icon" className={className} {...props} />
  ),
  Separator: (props: any) => <div data-testid="separator" {...props} />,
  BreadcrumbItem: ({ isActive, isEllipsis, href, onClick, className, children, ...props }: any) => {
    if (isEllipsis) {
      return <span className="text-gray-500 px-2" {...props}>{children}</span>
    }
    if (isActive) {
      return <span className={`text-gray-900 font-semibold ${className || ''}`} {...props}>{children}</span>
    }
    return href ? (
      <a href={href} onClick={onClick} className={`text-gray-500 hover:text-gray-700 ${className || ''}`} {...props}>{children}</a>
    ) : (
      <span className={className} {...props}>{children}</span>
    )
  },
  BreadcrumbSeparator: ({ className, children, ...props }: any) => (
    <span className={`flex items-center ${className || ''}`} aria-hidden="true" {...props}>
      {children || <svg data-testid="chevron-right-icon" className="h-4 w-4" />}
    </span>
  ),
}))

describe('Breadcrumb Component', () => {
  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any)
    vi.clearAllMocks()
  })

  describe('Breadcrumb Generation', () => {
    it('should render home breadcrumb for root dashboard route', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard')
      render(<Breadcrumb />)
      
      expect(screen.getByTestId('breadcrumb-container')).toBeInTheDocument()
      expect(screen.getByTestId('home-icon')).toBeInTheDocument()
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('should generate breadcrumbs from pathname', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      const breadcrumbContainer = screen.getByTestId('breadcrumb-container')
      
      // Should have home link
      expect(within(breadcrumbContainer).getByTestId('home-icon')).toBeInTheDocument()
      
      // Should have all path segments
      expect(within(breadcrumbContainer).getByText('Dashboard')).toBeInTheDocument()
      expect(within(breadcrumbContainer).getByText('Reports')).toBeInTheDocument()
      expect(within(breadcrumbContainer).getByText('Performance')).toBeInTheDocument()
      
      // Should have separators between items
      const separators = within(breadcrumbContainer).getAllByTestId('chevron-right-icon')
      expect(separators).toHaveLength(2) // Between Dashboard-Reports and Reports-Performance
    })

    it('should handle deep nested routes', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance/details/metrics')
      render(<Breadcrumb />)
      
      const breadcrumbContainer = screen.getByTestId('breadcrumb-container')
      
      expect(within(breadcrumbContainer).getByText('Dashboard')).toBeInTheDocument()
      expect(within(breadcrumbContainer).getByText('Reports')).toBeInTheDocument()
      expect(within(breadcrumbContainer).getByText('Performance')).toBeInTheDocument()
      expect(within(breadcrumbContainer).getByText('Details')).toBeInTheDocument()
      expect(within(breadcrumbContainer).getByText('Metrics')).toBeInTheDocument()
      
      // Should have 4 separators for 5 items
      const separators = within(breadcrumbContainer).getAllByTestId('chevron-right-icon')
      expect(separators).toHaveLength(4)
    })

    it('should handle custom breadcrumb items when provided', () => {
      const customBreadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/dashboard', isActive: false },
        { label: 'Custom Section', href: '/dashboard/custom', isActive: false },
        { label: 'Current Page', href: '/dashboard/custom/current', isActive: true },
      ]

      render(<Breadcrumb items={customBreadcrumbs} />)
      
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('Custom Section')).toBeInTheDocument()
      expect(screen.getByText('Current Page')).toBeInTheDocument()
    })
  })

  describe('Breadcrumb Navigation', () => {
    it('should navigate when breadcrumb link is clicked', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      const reportsLink = screen.getByText('Reports').closest('a')
      expect(reportsLink).toHaveAttribute('href', '/dashboard/reports')
      
      fireEvent.click(reportsLink!)
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/reports')
    })

    it('should not navigate for active (current) breadcrumb item', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      // The last item (Performance) should be active and not clickable
      const performanceText = screen.getByText('Performance')
      const performanceLink = performanceText.closest('a')
      expect(performanceLink).toBeNull() // Should not be wrapped in a link
    })

    it('should handle home breadcrumb navigation', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      const homeIcon = screen.getByTestId('home-icon')
      const homeLink = homeIcon.closest('a')
      expect(homeLink).toHaveAttribute('href', '/dashboard')
      
      fireEvent.click(homeLink!)
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('Breadcrumb Styling and Accessibility', () => {
    it('should apply correct styling to active breadcrumb item', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      const performanceText = screen.getByText('Performance')
      expect(performanceText).toHaveClass('text-gray-900', 'font-semibold')
      expect(performanceText.closest('a')).toBeNull() // Should not be clickable
    })

    it('should apply correct styling to non-active breadcrumb items', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      const reportsLink = screen.getByText('Reports').closest('a')
      expect(reportsLink).toHaveClass('text-gray-500', 'hover:text-gray-700')
    })

    it('should have proper accessibility attributes', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      const breadcrumbNav = screen.getByRole('navigation')
      expect(breadcrumbNav).toHaveAttribute('aria-label', 'Breadcrumb')
      
      const breadcrumbList = screen.getByRole('list')
      expect(breadcrumbList).toBeInTheDocument()
      
      const breadcrumbItems = screen.getAllByRole('listitem')
      expect(breadcrumbItems.length).toBeGreaterThan(0)
    })

    it('should have proper ARIA attributes for current page', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance')
      render(<Breadcrumb />)
      
      const performanceItem = screen.getByText('Performance').closest('li')
      expect(performanceItem).toHaveAttribute('aria-current', 'page')
    })
  })

  describe('Responsive Behavior', () => {
    it('should truncate breadcrumbs on mobile when maxItems is set', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/performance/details/metrics')
      render(<Breadcrumb maxItems={3} />)
      
      // Should show: Dashboard ... Metrics (with ellipsis)
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Metrics')).toBeInTheDocument()
      expect(screen.getByText('...')).toBeInTheDocument()
      
      // Should not show middle items
      expect(screen.queryByText('Reports')).not.toBeInTheDocument()
      expect(screen.queryByText('Performance')).not.toBeInTheDocument()
      expect(screen.queryByText('Details')).not.toBeInTheDocument()
    })

    it('should show all breadcrumbs when maxItems is not exceeded', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports')
      render(<Breadcrumb maxItems={5} />)
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
      expect(screen.queryByText('...')).not.toBeInTheDocument()
    })

    it('should handle single breadcrumb item', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard')
      render(<Breadcrumb />)
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.queryByTestId('chevron-right-icon')).not.toBeInTheDocument()
    })
  })

  describe('Route Parsing and Labels', () => {
    it('should convert kebab-case routes to readable labels', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/user-settings/account-preferences')
      render(<Breadcrumb />)
      
      expect(screen.getByText('User Settings')).toBeInTheDocument()
      expect(screen.getByText('Account Preferences')).toBeInTheDocument()
    })

    it('should handle special route names correctly', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports/roi-analysis')
      render(<Breadcrumb />)
      
      expect(screen.getByText('ROI Analysis')).toBeInTheDocument()
    })

    it('should filter out empty segments', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard//reports///performance/')
      render(<Breadcrumb />)
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
      expect(screen.getByText('Performance')).toBeInTheDocument()
      
      // Should only have 2 separators despite extra slashes
      const separators = screen.getAllByTestId('chevron-right-icon')
      expect(separators).toHaveLength(2)
    })
  })

  describe('Custom Configuration', () => {
    it('should accept custom separator component', () => {
      const CustomSeparator = () => <span data-testid="custom-separator">/</span>
      
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports')
      render(<Breadcrumb separator={<CustomSeparator />} />)
      
      expect(screen.getByTestId('custom-separator')).toBeInTheDocument()
      expect(screen.queryByTestId('chevron-right-icon')).not.toBeInTheDocument()
    })

    it('should accept custom home icon', () => {
      const CustomHomeIcon = () => <span data-testid="custom-home">🏠</span>
      
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports')
      render(<Breadcrumb homeIcon={<CustomHomeIcon />} />)
      
      expect(screen.getByTestId('custom-home')).toBeInTheDocument()
      expect(screen.queryByTestId('home-icon')).not.toBeInTheDocument()
    })

    it('should allow disabling home icon', () => {
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports')
      render(<Breadcrumb showHome={false} />)
      
      expect(screen.queryByTestId('home-icon')).not.toBeInTheDocument()
      expect(screen.getByText('Reports')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid pathname gracefully', () => {
      vi.mocked(usePathname).mockReturnValue('')
      render(<Breadcrumb />)
      
      // Should render without crashing
      expect(screen.getByTestId('breadcrumb-container')).toBeInTheDocument()
    })

    it('should handle missing router gracefully', () => {
      vi.mocked(useRouter).mockReturnValue(null as any)
      vi.mocked(usePathname).mockReturnValue('/dashboard/reports')
      
      render(<Breadcrumb />)
      
      // Should still render breadcrumbs
      expect(screen.getByText('Reports')).toBeInTheDocument()
    })
  })
})