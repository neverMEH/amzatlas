import { ReactNode } from 'react'
import EnhancedDashboardLayout from '@/components/dashboard/enhanced-dashboard-layout'

export const metadata = {
  title: 'Enhanced Dashboard - SQP Intelligence',
  description: 'Modern dashboard redesign with improved navigation and layout',
}

export default function EnhancedLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <EnhancedDashboardLayout>
      {children}
    </EnhancedDashboardLayout>
  )
}