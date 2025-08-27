import { ReactNode } from 'react'
import DashboardSidebar from '@/components/dashboard/sidebar'
import DashboardHeader from '@/components/dashboard/header'
import { DashboardProvider } from '@/contexts/dashboard-context'

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <DashboardProvider>
      <div className="min-h-screen bg-gray-25 dark:bg-gray-950">
        <DashboardSidebar />
        <div className="lg:pl-64">
          <DashboardHeader />
          <main className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </DashboardProvider>
  )
}