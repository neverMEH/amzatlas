'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  ChevronRightIcon, 
  HomeIcon, 
  BreadcrumbItem as UBreadcrumbItem,
  BreadcrumbSeparator
} from '@/lib/untitled-ui'
import type { BreadcrumbProps, BreadcrumbItem } from '@/types/navigation'

// Route label mappings for better display names
const routeLabelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  reports: 'Reports',
  analytics: 'Analytics',
  settings: 'Settings',
  performance: 'Performance',
  growth: 'Growth & Trends',
  roi: 'ROI Analysis',
  strategic: 'Strategic Actions',
  'user-settings': 'User Settings',
  'account-preferences': 'Account Preferences',
  'roi-analysis': 'ROI Analysis',
  details: 'Details',
  metrics: 'Metrics',
}

function formatSegmentLabel(segment: string): string {
  // Check if we have a specific mapping
  if (routeLabelMap[segment]) {
    return routeLabelMap[segment]
  }
  
  // Convert kebab-case to Title Case
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  // Remove leading/trailing slashes and filter out empty segments
  const segments = pathname.split('/').filter(segment => segment.length > 0)
  
  if (segments.length === 0) {
    return [{ label: 'Dashboard', href: '/dashboard', isActive: true }]
  }
  
  const breadcrumbs: BreadcrumbItem[] = []
  let currentPath = ''
  
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`
    const isActive = index === segments.length - 1
    
    breadcrumbs.push({
      label: formatSegmentLabel(segment),
      href: currentPath,
      isActive,
    })
  })
  
  return breadcrumbs
}

function truncateBreadcrumbs(
  breadcrumbs: BreadcrumbItem[],
  maxItems: number
): BreadcrumbItem[] {
  if (breadcrumbs.length <= maxItems) {
    return breadcrumbs
  }
  
  // Always show first item, last item, and ellipsis
  // If maxItems is 3: [first, ..., last]
  // If maxItems is 4: [first, ..., second-to-last, last]
  
  const first = breadcrumbs[0]
  const last = breadcrumbs[breadcrumbs.length - 1]
  
  if (maxItems <= 2) {
    return [first, last]
  }
  
  const result: BreadcrumbItem[] = [first]
  
  // Add ellipsis placeholder
  result.push({
    label: '...',
    isActive: false,
  })
  
  // Add remaining items based on maxItems
  const remainingSlots = maxItems - 2 // Subtract first and ellipsis
  const startIndex = breadcrumbs.length - remainingSlots
  
  for (let i = Math.max(startIndex, 1); i < breadcrumbs.length; i++) {
    result.push(breadcrumbs[i])
  }
  
  return result
}

export default function Breadcrumb({
  items,
  maxItems,
  separator = <ChevronRightIcon className="h-4 w-4 text-gray-400" />,
  homeIcon = <HomeIcon className="h-4 w-4" />,
  showHome = true,
  className,
  onNavigate,
}: BreadcrumbProps) {
  const pathname = usePathname()
  const router = useRouter()
  
  // Generate breadcrumbs from pathname if items not provided
  const breadcrumbItems = items || generateBreadcrumbsFromPath(pathname)
  
  // Apply truncation if maxItems is specified
  const finalBreadcrumbs = maxItems 
    ? truncateBreadcrumbs(breadcrumbItems, maxItems)
    : breadcrumbItems
  
  const handleNavigate = (href: string) => {
    if (onNavigate) {
      onNavigate(href)
    } else if (router) {
      router.push(href)
    }
  }
  
  const renderBreadcrumbItem = (item: BreadcrumbItem, index: number) => {
    const isLast = index === finalBreadcrumbs.length - 1
    const isEllipsis = item.label === '...'
    
    return (
      <li 
        key={`${item.label}-${index}`}
        className="flex items-center"
        {...(isLast && !isEllipsis ? { 'aria-current': 'page' } : {})}
      >
        {/* Breadcrumb Item using Untitled UI component */}
        {isEllipsis ? (
          <UBreadcrumbItem isEllipsis={true}>
            {item.label}
          </UBreadcrumbItem>
        ) : item.isActive || isLast ? (
          <UBreadcrumbItem 
            isActive={true}
            className={item.icon ? 'flex items-center gap-2' : undefined}
          >
            {item.icon}
            {item.label}
          </UBreadcrumbItem>
        ) : (
          <UBreadcrumbItem
            href={item.href || '#'}
            onClick={(e: React.MouseEvent) => {
              if (item.href) {
                e.preventDefault()
                handleNavigate(item.href)
              }
            }}
            className={item.icon ? 'flex items-center gap-2' : undefined}
          >
            {item.icon}
            {item.label}
          </UBreadcrumbItem>
        )}
        
        {/* Separator using Untitled UI component */}
        {!isLast && (
          <BreadcrumbSeparator className="mx-2">
            {separator}
          </BreadcrumbSeparator>
        )}
      </li>
    )
  }
  
  return (
    <nav
      role="navigation"
      aria-label="Breadcrumb"
      className={cn('flex', className)}
      data-testid="breadcrumb-container"
    >
      <ol className="flex items-center space-x-1">
        {/* Home breadcrumb */}
        {showHome && finalBreadcrumbs[0]?.label !== 'Dashboard' && (
          <li className="flex items-center">
            <UBreadcrumbItem
              href="/dashboard"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault()
                handleNavigate('/dashboard')
              }}
              className="flex items-center gap-1"
            >
              {homeIcon}
              <span className="sr-only">Dashboard</span>
            </UBreadcrumbItem>
            <BreadcrumbSeparator className="mx-2">
              {separator}
            </BreadcrumbSeparator>
          </li>
        )}
        
        {/* Dynamic breadcrumbs */}
        {finalBreadcrumbs.map((item, index) => {
          // If showing home and first item is Dashboard, add home icon
          if (showHome && index === 0 && item.label === 'Dashboard') {
            return (
              <li key={`${item.label}-${index}`} className="flex items-center">
                {item.isActive ? (
                  <UBreadcrumbItem 
                    isActive={true}
                    className="flex items-center gap-2"
                  >
                    {homeIcon}
                    {item.label}
                  </UBreadcrumbItem>
                ) : (
                  <UBreadcrumbItem
                    href={item.href || '/dashboard'}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault()
                      handleNavigate(item.href || '/dashboard')
                    }}
                    className="flex items-center gap-2"
                  >
                    {homeIcon}
                    {item.label}
                  </UBreadcrumbItem>
                )}
                {index < finalBreadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="mx-2">
                    {separator}
                  </BreadcrumbSeparator>
                )}
              </li>
            )
          }
          
          return renderBreadcrumbItem(item, index)
        })}
      </ol>
    </nav>
  )
}