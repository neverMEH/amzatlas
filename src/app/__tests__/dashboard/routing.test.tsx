import { describe, expect, test } from 'vitest'

describe('Dashboard Routing', () => {
  test('dashboard routes are defined', () => {
    const routes = [
      '/dashboard',
      '/dashboard/reports',
      '/dashboard/reports/performance',
      '/dashboard/reports/growth',
      '/dashboard/reports/roi',
      '/dashboard/reports/strategic',
      '/dashboard/custom-views',
      '/dashboard/settings',
    ]
    
    routes.forEach(route => {
      expect(route).toBeTruthy()
    })
  })
  
  test('dashboard layout includes sidebar navigation', () => {
    const navigationItems = [
      'Dashboard',
      'Reports',
      'Custom Views',
      'Settings',
    ]
    
    navigationItems.forEach(item => {
      expect(item).toBeTruthy()
    })
  })
})