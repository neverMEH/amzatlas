'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sheet, SheetContent, SheetTrigger, MenuIcon, XIcon } from '@/lib/untitled-ui'
import SidebarNavigation from './sidebar-navigation'

interface ApplicationShellProps {
  children: React.ReactNode
}

export default function ApplicationShell({ children }: ApplicationShellProps) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Restore sidebar state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sqp-sidebar-collapsed')
    if (saved !== null) {
      setSidebarCollapsed(JSON.parse(saved))
    }
  }, [])

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sqp-sidebar-collapsed', JSON.stringify(sidebarCollapsed))
  }, [sidebarCollapsed])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <div 
      className="flex h-screen bg-gray-50 dark:bg-gray-900"
      data-testid="application-shell"
    >
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={cn(
            'flex-shrink-0 transition-all duration-300 ease-in-out',
            sidebarCollapsed ? 'w-16' : 'w-64'
          )}
        >
          <SidebarNavigation
            collapsed={sidebarCollapsed}
            onCollapseToggle={toggleSidebar}
            activeRoute={pathname}
          />
        </aside>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button
              className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-sm border border-gray-200 lg:hidden"
              data-testid="mobile-menu-button"
              aria-label="Open navigation menu"
            >
              <MenuIcon className="h-5 w-5 text-gray-600" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                SQP Intelligence
              </h2>
              <button
                onClick={closeMobileMenu}
                className="p-1 hover:bg-gray-100 rounded-md"
                aria-label="Close navigation menu"
              >
                <XIcon className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <SidebarNavigation
              collapsed={false}
              activeRoute={pathname}
              onNavigate={closeMobileMenu}
              isMobile={true}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content Area */}
      <main 
        className={cn(
          'flex-1 overflow-hidden flex flex-col',
          isMobile && 'w-full'
        )}
        data-testid="main-content"
      >
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>

      {/* Mobile menu overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}
    </div>
  )
}