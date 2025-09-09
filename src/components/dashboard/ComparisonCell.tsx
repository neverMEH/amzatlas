import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface ComparisonCellProps {
  value: string | number
  comparison?: number
  showComparison: boolean
  align?: 'left' | 'center' | 'right'
}

export const ComparisonCell: React.FC<ComparisonCellProps> = ({
  value,
  comparison,
  showComparison,
  align = 'left'
}) => {
  const getTrendIcon = (value: number) => {
    if (value > 0) {
      return <TrendingUp size={12} className="text-green-600" />
    } else if (value < 0) {
      return <TrendingDown size={12} className="text-red-600" />
    } else {
      return <Minus size={12} className="text-gray-400" />
    }
  }

  const getTrendClass = (value: number) => {
    if (value > 0) {
      return 'text-green-600'
    } else if (value < 0) {
      return 'text-red-600'
    } else {
      return 'text-gray-500'
    }
  }

  const formatComparisonValue = (value: number) => {
    const percentage = Math.abs(value)
    return percentage < 0.1 ? '< 0.1%' : `${percentage.toFixed(1)}%`
  }

  const alignClass = {
    left: 'text-left',
    center: 'text-center', 
    right: 'text-right'
  }[align]

  return (
    <div className={alignClass}>
      <div className="text-sm text-gray-900">
        {value}
      </div>
      {showComparison && comparison !== undefined && (
        <div className={`flex items-center text-xs ${getTrendClass(comparison)} mt-1`}>
          {getTrendIcon(comparison)}
          <span className="ml-1">
            {comparison > 0 ? '+' : ''}{formatComparisonValue(comparison)}
          </span>
        </div>
      )}
    </div>
  )
}