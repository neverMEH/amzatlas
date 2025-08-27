import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}