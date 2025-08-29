import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/providers/query-provider'
import Navigation from '@/components/layout/navigation'

export const metadata: Metadata = {
  title: 'SQP Intelligence Platform',
  description: 'AI-powered analytics platform for Amazon sellers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <Navigation />
          <main className="min-h-screen bg-gray-50">
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  )
}