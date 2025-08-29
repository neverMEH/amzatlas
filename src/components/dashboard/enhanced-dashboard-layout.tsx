'use client'

import React, { ReactNode, useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ApplicationShell from '@/components/layout/application-shell'
import SidebarNavigation from '@/components/layout/sidebar-navigation'
import Breadcrumb from '@/components/navigation/breadcrumb'
import { DashboardProvider, useDashboard } from '@/contexts/dashboard-context'
import { cn } from '@/lib/utils'

interface EnhancedDashboardLayoutProps {
  children: ReactNode
}

function EnhancedDashboardLayoutContent({ children }: EnhancedDashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { layout, toggleSidebar } = useDashboard()
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

  const handleNavigate = (href: string) => {
    if (router) {
      router.push(href)
    }
  }

  const handleSidebarToggle = () => {
    toggleSidebar()
  }

  return (
    <ApplicationShell>
      <div className="flex h-full">
        {/* Sidebar Navigation */}
        <SidebarNavigation
          collapsed={layout.sidebarCollapsed}
          onCollapseToggle={handleSidebarToggle}
          activeRoute={pathname}
          onNavigate={() => {
            // Close mobile menu after navigation
            if (isMobile && layout.mobileMenuOpen) {
              // Toggle mobile menu closed
              // This would be handled by the ApplicationShell's mobile menu state
            }
          }}
          isMobile={isMobile}
        />

        {/* Main Content Area */}
        <div 
          className={cn(
            'flex-1 flex flex-col min-h-screen transition-all duration-300',
            layout.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64',
            isMobile && 'ml-0'
          )}
        >
          {/* Breadcrumb Navigation */}
          <div className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className={cn(
              'py-3',
              isMobile ? 'px-2 sm:px-4' : 'px-4 sm:px-6 lg:px-8'
            )}>
              <Breadcrumb
                maxItems={isMobile ? 2 : 4}
                showHome={true}
                onNavigate={handleNavigate}
              />
            </div>
          </div>

          {/* Page Content */}
          <main className={cn(
            'flex-1',
            isMobile ? 'px-2 sm:px-4 py-4' : 'px-4 sm:px-6 lg:px-8 py-6'
          )}>
            <div className={cn(
              'mx-auto',
              isMobile ? 'max-w-full' : 'max-w-7xl'
            )}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </ApplicationShell>
  )
}

export default function EnhancedDashboardLayout({ children }: EnhancedDashboardLayoutProps) {
  return (
    <DashboardProvider>
      <EnhancedDashboardLayoutContent>
        {children}
      </EnhancedDashboardLayoutContent>
    </DashboardProvider>
  )
}