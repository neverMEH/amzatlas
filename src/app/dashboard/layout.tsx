import { ReactNode } from 'react'
import { DashboardProvider } from '@/contexts/dashboard-context'
import EnhancedDashboardLayout from '@/components/dashboard/enhanced-dashboard-layout'

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <DashboardProvider>
      <EnhancedDashboardLayout>
        {children}
      </EnhancedDashboardLayout>
    </DashboardProvider>
  )
}