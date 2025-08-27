'use client'

import { useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import MetricsWidget from '@/components/dashboard/widgets/metrics-widget'
import ChartWidget from '@/components/dashboard/widgets/chart-widget'
import TableWidget from '@/components/dashboard/widgets/table-widget'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

const defaultLayouts = {
  lg: [
    { i: 'purchase-velocity', x: 0, y: 0, w: 6, h: 4 },
    { i: 'market-share', x: 6, y: 0, w: 6, h: 4 },
    { i: 'conversion-rate', x: 0, y: 4, w: 4, h: 4 },
    { i: 'zero-purchase', x: 4, y: 4, w: 4, h: 4 },
    { i: 'roi-summary', x: 8, y: 4, w: 4, h: 4 },
    { i: 'trending-keywords', x: 0, y: 8, w: 12, h: 6 },
    { i: 'performance-table', x: 0, y: 14, w: 12, h: 8 },
  ],
  md: [
    { i: 'purchase-velocity', x: 0, y: 0, w: 6, h: 4 },
    { i: 'market-share', x: 6, y: 0, w: 6, h: 4 },
    { i: 'conversion-rate', x: 0, y: 4, w: 4, h: 4 },
    { i: 'zero-purchase', x: 4, y: 4, w: 4, h: 4 },
    { i: 'roi-summary', x: 8, y: 4, w: 4, h: 4 },
    { i: 'trending-keywords', x: 0, y: 8, w: 12, h: 6 },
    { i: 'performance-table', x: 0, y: 14, w: 12, h: 8 },
  ],
  sm: [
    { i: 'purchase-velocity', x: 0, y: 0, w: 6, h: 4 },
    { i: 'market-share', x: 0, y: 4, w: 6, h: 4 },
    { i: 'conversion-rate', x: 0, y: 8, w: 6, h: 4 },
    { i: 'zero-purchase', x: 0, y: 12, w: 6, h: 4 },
    { i: 'roi-summary', x: 0, y: 16, w: 6, h: 4 },
    { i: 'trending-keywords', x: 0, y: 20, w: 6, h: 6 },
    { i: 'performance-table', x: 0, y: 26, w: 6, h: 8 },
  ],
}

export default function DashboardPage() {
  const [layouts, setLayouts] = useState(defaultLayouts)
  const [isDraggable, setIsDraggable] = useState(false)

  const handleLayoutChange = (layout: any, layouts: any) => {
    setLayouts(layouts)
    // TODO: Save layout to localStorage or database
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-display-xs font-semibold text-gray-900 dark:text-gray-50">
          SQP Purchase Dashboard
        </h1>
        <p className="mt-1 text-md text-gray-600 dark:text-gray-400">
          Monitor your keyword purchase performance and market insights
        </p>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setIsDraggable(!isDraggable)}
          className="inline-flex items-center gap-x-2 rounded-lg bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        >
          {isDraggable ? 'Lock Layout' : 'Customize Layout'}
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768 }}
        cols={{ lg: 12, md: 12, sm: 6 }}
        rowHeight={60}
        isDraggable={isDraggable}
        isResizable={isDraggable}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        <div key="purchase-velocity">
          <MetricsWidget
            title="Purchase Velocity"
            metric="2,547"
            change="+12.3%"
            trend="up"
            description="Weekly purchases"
          />
        </div>
        
        <div key="market-share">
          <MetricsWidget
            title="Market Share"
            metric="23.7%"
            change="+2.1%"
            trend="up"
            description="Of total market purchases"
          />
        </div>
        
        <div key="conversion-rate">
          <MetricsWidget
            title="Purchase CVR"
            metric="4.2%"
            change="-0.3%"
            trend="down"
            description="Clicks to purchases"
          />
        </div>
        
        <div key="zero-purchase">
          <MetricsWidget
            title="Zero Purchase Keywords"
            metric="127"
            change="-15"
            trend="up"
            description="Keywords with wasted spend"
          />
        </div>
        
        <div key="roi-summary">
          <MetricsWidget
            title="Purchase ROI"
            metric="247%"
            change="+18%"
            trend="up"
            description="Return on ad spend"
          />
        </div>
        
        <div key="trending-keywords">
          <ChartWidget
            title="Purchase Trend"
            description="12-week purchase velocity"
          />
        </div>
        
        <div key="performance-table">
          <TableWidget
            title="Top Keywords by Purchase"
            description="Keywords driving the most purchases"
          />
        </div>
      </ResponsiveGridLayout>
    </div>
  )
}