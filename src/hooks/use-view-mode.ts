'use client'

import { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export type ViewMode = 'popup' | 'full-page'

export interface ViewModeOptions {
  mode?: ViewMode
}

export interface ViewModeLayout {
  maxWidth: string
  padding: string
  chartHeight: number
  showFunnel: boolean
  showMarketShare: boolean
  showSparklines: boolean
}

export interface ViewModeResult {
  mode: ViewMode
  isPopup: boolean
  isFullPage: boolean
  shouldShowSparklines: boolean
  shouldShowFullCharts: boolean
  layout: ViewModeLayout
  queryParams: Record<string, string>
}

const POPUP_LAYOUT: ViewModeLayout = {
  maxWidth: 'max-w-4xl',
  padding: 'p-4',
  chartHeight: 60,
  showFunnel: false,
  showMarketShare: false,
  showSparklines: true,
}

const FULL_PAGE_LAYOUT: ViewModeLayout = {
  maxWidth: 'max-w-7xl',
  padding: 'p-6',
  chartHeight: 300,
  showFunnel: true,
  showMarketShare: true,
  showSparklines: false,
}

export function useViewMode(options: ViewModeOptions = {}): ViewModeResult {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const result = useMemo(() => {
    // Determine mode
    let mode: ViewMode
    
    if (options.mode && (options.mode === 'popup' || options.mode === 'full-page')) {
      // Use explicit mode if provided and valid
      mode = options.mode
    } else {
      // Auto-detect based on route
      mode = pathname === '/keyword-analysis' ? 'full-page' : 'popup'
    }

    // Parse query params
    const queryParams: Record<string, string> = {}
    if (searchParams) {
      searchParams.forEach((value, key) => {
        queryParams[key] = value
      })
    }

    // Derive states
    const isPopup = mode === 'popup'
    const isFullPage = mode === 'full-page'
    const shouldShowSparklines = isPopup
    const shouldShowFullCharts = isFullPage

    // Get layout config
    const layout = isPopup ? POPUP_LAYOUT : FULL_PAGE_LAYOUT

    return {
      mode,
      isPopup,
      isFullPage,
      shouldShowSparklines,
      shouldShowFullCharts,
      layout,
      queryParams,
    }
  }, [pathname, searchParams, options.mode])

  return result
}