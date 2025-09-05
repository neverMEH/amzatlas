import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ApplicationShell from '@/components/layout/application-shell'
import { usePathname } from 'next/navigation'

// Mock Untitled UI components
vi.mock('@untitled-ui/react', () => ({
  Sheet: ({ children }: any) => <div data-testid="sheet">{children}</div>,
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetTrigger: ({ children }: any) => <button data-testid="sheet-trigger">{children}</button>,
}))

describe('ApplicationShell Component', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/dashboard')
  })

  it('should render with sidebar and main content', () => {
    render(
      <ApplicationShell>
        <div>Main Content</div>
      </ApplicationShell>
    )
    
    expect(screen.getByTestId('application-shell')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar-navigation')).toBeInTheDocument()
    expect(screen.getByText('Main Content')).toBeInTheDocument()
  })

  it('should handle sidebar collapse state', () => {
    render(
      <ApplicationShell>
        <div>Main Content</div>
      </ApplicationShell>
    )
    
    const collapseButton = screen.getByTestId('sidebar-collapse-button')
    fireEvent.click(collapseButton)
    
    const sidebar = screen.getByTestId('sidebar-navigation')
    expect(sidebar).toHaveClass('collapsed')
  })

  it('should show mobile menu on small screens', () => {
    // Mock window size
    global.innerWidth = 500
    global.dispatchEvent(new Event('resize'))
    
    render(
      <ApplicationShell>
        <div>Main Content</div>
      </ApplicationShell>
    )
    
    expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument()
  })

  it('should pass active route to sidebar', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard/reports')
    
    render(
      <ApplicationShell>
        <div>Main Content</div>
      </ApplicationShell>
    )
    
    const sidebar = screen.getByTestId('sidebar-navigation')
    expect(sidebar).toHaveAttribute('data-active-route', '/dashboard/reports')
  })

  it('should apply correct layout classes', () => {
    render(
      <ApplicationShell>
        <div>Main Content</div>
      </ApplicationShell>
    )
    
    const shell = screen.getByTestId('application-shell')
    expect(shell).toHaveClass('flex', 'h-screen', 'bg-gray-50')
    
    const mainContent = screen.getByTestId('main-content')
    expect(mainContent).toHaveClass('flex-1', 'overflow-hidden')
  })
})