import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for brand-related components
 */
export class BrandErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Brand component error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center p-4 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <div className="text-sm text-red-700">
            <p className="font-medium">Error loading brands</p>
            <p className="text-xs mt-1">{this.state.error?.message}</p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}