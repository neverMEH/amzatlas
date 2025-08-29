import React from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
  icon?: React.ReactNode
}

export interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  maxItems?: number
  separator?: React.ReactNode
  homeIcon?: React.ReactNode
  showHome?: boolean
  className?: string
  onNavigate?: (href: string) => void
}

export interface NavigationItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<any>
  badge?: string | number
  children?: NavigationItem[]
  permissions?: string[]
}

export interface NavigationState {
  currentRoute: string
  previousRoute: string | null
  breadcrumbs: BreadcrumbItem[]
}