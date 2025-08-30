import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Breadcrumb, BreadcrumbItem } from '../Breadcrumb'

describe('Breadcrumb', () => {
  it('renders a single breadcrumb item', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/', icon: 'home' }
    ]

    render(<Breadcrumb items={items} />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /dashboard/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('renders multiple breadcrumb items with separators', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/' },
      { label: 'Products', href: '/products' },
      { label: 'B001', href: '/products/B001' },
      { label: 'Details' }
    ]

    render(<Breadcrumb items={items} />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('B001')).toBeInTheDocument()
    expect(screen.getByText('Details')).toBeInTheDocument()

    // Check that separators are rendered (3 separators for 4 items)
    const separators = screen.getAllByTestId('breadcrumb-separator')
    expect(separators).toHaveLength(3)
  })

  it('renders last item as text instead of link', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/' },
      { label: 'Current Page' }
    ]

    render(<Breadcrumb items={items} />)

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' })
    expect(dashboardLink).toBeInTheDocument()

    // Last item should not be a link
    expect(screen.queryByRole('link', { name: 'Current Page' })).not.toBeInTheDocument()
    expect(screen.getByText('Current Page')).toBeInTheDocument()
  })

  it('renders with home icon when specified', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/', icon: 'home' },
      { label: 'Products', href: '/products' }
    ]

    render(<Breadcrumb items={items} />)

    const homeIcon = screen.getByTestId('breadcrumb-home-icon')
    expect(homeIcon).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/' }
    ]

    const { container } = render(<Breadcrumb items={items} className="custom-class" />)
    
    const nav = container.querySelector('nav')
    expect(nav).toHaveClass('custom-class')
  })

  it('handles items without href', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Step 1', href: '/step1' },
      { label: 'Step 2' },
      { label: 'Step 3' }
    ]

    render(<Breadcrumb items={items} />)

    // First item should be a link
    expect(screen.getByRole('link', { name: 'Step 1' })).toBeInTheDocument()
    
    // Items without href should not be links
    expect(screen.queryByRole('link', { name: 'Step 2' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Step 3' })).not.toBeInTheDocument()
  })

  it('renders with aria-label for navigation', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/' }
    ]

    render(<Breadcrumb items={items} />)

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb')
  })

  it('applies proper styles to links and text', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/' },
      { label: 'Current' }
    ]

    render(<Breadcrumb items={items} />)

    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link).toHaveClass('text-gray-500', 'hover:text-gray-700')

    const currentText = screen.getByText('Current')
    expect(currentText).toHaveClass('text-gray-900', 'font-medium')
  })
})