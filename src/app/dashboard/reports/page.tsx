'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ReportsPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to the first report category
    router.replace('/dashboard/reports/performance')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
  )
}