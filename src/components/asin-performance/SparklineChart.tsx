'use client'

import React, { memo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Area,
  AreaChart,
  Tooltip,
  Cell,
} from 'recharts'

export interface SparklineChartProps {
  /** Array of data points to visualize */
  data: Array<Record<string, any>>
  /** The key in data objects to use for chart values */
  dataKey: string
  /** Chart type: 'line' (default), 'bar' (best for 7 data points), or 'area' */
  type?: 'line' | 'bar' | 'area'
  /** Color for chart elements (hex format) */
  color?: string
  /** Height of the chart in pixels */
  height?: number
  /** Enable/disable animations */
  animate?: boolean
  /** Line stroke width (for line and area charts) */
  strokeWidth?: number
  /** Additional CSS classes */
  className?: string
}

function SparklineChartComponent({
  data,
  dataKey,
  type = 'line',
  color = '#3B82F6',
  height = 40,
  animate = true,
  strokeWidth = 2,
  className = '',
}: SparklineChartProps) {
  const margin = { top: 2, right: 2, left: 2, bottom: 2 }
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  const commonProps = {
    data,
    margin,
  }

  // Custom tooltip for sparklines
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
          {typeof payload[0].value === 'number' 
            ? payload[0].value.toLocaleString()
            : payload[0].value}
        </div>
      )
    }
    return null
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart 
            {...commonProps}
            onMouseMove={(state: any) => {
              // Track which bar is being hovered for visual feedback
              if (state?.activeTooltipIndex !== undefined) {
                setActiveIndex(state.activeTooltipIndex)
              }
            }}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ fill: 'transparent' }}
              allowEscapeViewBox={{ x: false, y: true }}
            />
            <Bar
              dataKey={dataKey}
              isAnimationActive={animate}
              radius={[3, 3, 0, 0]}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  // Highlight active bar on hover, others get reduced opacity
                  fill={activeIndex === index ? color : `${color}88`}
                  style={{ transition: 'fill 0.2s ease' }}
                />
              ))}
            </Bar>
          </BarChart>
        )
      
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: color, strokeOpacity: 0.3 }}
              allowEscapeViewBox={{ x: false, y: true }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={strokeWidth}
              fill={`url(#gradient-${dataKey})`}
              isAnimationActive={animate}
            />
          </AreaChart>
        )
      
      case 'line':
      default:
        return (
          <LineChart {...commonProps}>
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ stroke: color, strokeOpacity: 0.3 }}
              allowEscapeViewBox={{ x: false, y: true }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={strokeWidth}
              dot={false}
              isAnimationActive={animate}
            />
          </LineChart>
        )
    }
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  )
}

export const SparklineChart = memo(SparklineChartComponent)