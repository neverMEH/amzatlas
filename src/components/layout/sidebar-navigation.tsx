'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  FileTextIcon,
  ChartBarIcon,
  CogIcon,
  TrendingUpIcon,
  DollarSignIcon,
  TargetIcon,
  FilterIcon,
  Avatar,
  Separator,
  Badge,
} from '@/lib/untitled-ui'

interface NavigationItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<any>
  badge?: string | number
  children?: NavigationItem[]
}

interface SidebarNavigationProps {
  collapsed?: boolean
  onCollapseToggle?: () => void
  activeRoute?: string
  onNavigate?: () => void
  isMobile?: boolean
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/dashboard/reports',
    icon: FileTextIcon,
    children: [
      {
        id: 'performance',
        label: 'Performance',
        href: '/dashboard/reports/performance',
        icon: ChartBarIcon,
      },
      {
        id: 'growth',
        label: 'Growth & Trends',
        href: '/dashboard/reports/growth',
        icon: TrendingUpIcon,
      },
      {
        id: 'roi',
        label: 'ROI & Investment',
        href: '/dashboard/reports/roi',
        icon: DollarSignIcon,
      },
      {
        id: 'strategic',
        label: 'Strategic Actions',
        href: '/dashboard/reports/strategic',
        icon: TargetIcon,
      },
    ],
  },
  {
    id: 'enhanced-metrics',
    label: 'Enhanced Metrics',
    href: '/dashboard/enhanced-metrics',
    icon: ChartBarIcon,
  },
  {
    id: 'custom-views',
    label: 'Custom Views',
    href: '/dashboard/custom-views',
    icon: FilterIcon,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/dashboard/settings',
    icon: CogIcon,
  },
]

export default function SidebarNavigation({
  collapsed = false,
  onCollapseToggle,
  activeRoute = '',
  onNavigate,
  isMobile = false,
}: SidebarNavigationProps) {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>(['reports'])

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleNavigation = () => {
    if (onNavigate) {
      onNavigate()
    }
  }

  return (
    <div
      className={cn(
        'h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col',
        collapsed && 'w-16',
        !collapsed && 'w-64'
      )}
      data-testid="sidebar-navigation"
      data-active-route={activeRoute}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SQP</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                SQP Intelligence
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Dashboard
              </p>
            </div>
          </div>
        )}
        
        {!isMobile && (
          <button
            onClick={onCollapseToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            data-testid="sidebar-collapse-button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const isExpanded = expandedItems.includes(item.id)
          const hasChildren = item.children && item.children.length > 0

          return (
            <div key={item.id}>
              <Link
                href={item.href}
                onClick={(e) => {
                  if (hasChildren && !collapsed) {
                    e.preventDefault()
                    toggleExpanded(item.id)
                  } else {
                    handleNavigation()
                  }
                }}
                className={cn(
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
                  'hover:bg-gray-100 dark:hover:bg-gray-800',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-r-2 border-primary-600'
                    : 'text-gray-700 dark:text-gray-300',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0 transition-colors',
                    isActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300',
                    !collapsed && 'mr-3'
                  )}
                />
                
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    
                    {item.badge && (
                      <Badge variant="primary" size="sm">
                        {item.badge}
                      </Badge>
                    )}
                    
                    {hasChildren && (
                      <ChevronRightIcon
                        className={cn(
                          'h-4 w-4 ml-2 transition-transform duration-200',
                          isExpanded && 'rotate-90'
                        )}
                      />
                    )}
                  </>
                )}
              </Link>

              {/* Submenu */}
              {hasChildren && isExpanded && !collapsed && (
                <div className="ml-6 mt-1 space-y-1">
                  {item.children!.map((child) => {
                    const isChildActive = pathname === child.href
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        onClick={handleNavigation}
                        className={cn(
                          'group flex items-center px-3 py-2 text-sm rounded-lg transition-all duration-200',
                          'hover:bg-gray-100 dark:hover:bg-gray-800',
                          isChildActive
                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                            : 'text-gray-600 dark:text-gray-400'
                        )}
                      >
                        <child.icon
                          className={cn(
                            'h-4 w-4 mr-3 flex-shrink-0',
                            isChildActive
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                          )}
                        />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User Profile Section */}
      {!collapsed && (
        <>
          <Separator />
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar size="sm" alt="User" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">
                  Dashboard User
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  user@example.com
                </p>
              </div>
              <button
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="User menu"
              >
                <CogIcon className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}