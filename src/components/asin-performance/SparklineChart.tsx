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
} from 'recharts'

export interface SparklineChartProps {
  data: Array<Record<string, any>>
  dataKey: string
  type?: 'line' | 'bar' | 'area'
  color?: string
  height?: number
  animate?: boolean
  strokeWidth?: number
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

  const commonProps = {
    data,
    margin,
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <Bar
              dataKey={dataKey}
              fill={color}
              isAnimationActive={animate}
              radius={[2, 2, 0, 0]}
            />
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