import React from 'react'
import { ChevronUpIcon, ChevronDownIcon } from 'lucide-react'

interface ComparisonIndicatorProps {
  value: number | null | undefined
  size?: 'sm' | 'md'
}

export const ComparisonIndicator: React.FC<ComparisonIndicatorProps> = ({
  value,
  size = 'sm',
}) => {
  if (value === null || value === undefined) {
    return null
  }

  const isPositive = value >= 0
  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm'
  const iconSize = size === 'sm' ? 12 : 16

  return (
    <div
      className={`flex items-center ${
        isPositive ? 'text-green-600' : 'text-red-600'
      } ${sizeClasses}`}
    >
      {isPositive ? (
        <ChevronUpIcon size={iconSize} className="mr-0.5" />
      ) : (
        <ChevronDownIcon size={iconSize} className="mr-0.5" />
      )}
      <span>{Math.abs(value)}%</span>
    </div>
  )
}