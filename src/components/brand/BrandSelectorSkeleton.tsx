import React from 'react'

/**
 * Loading skeleton for brand selector
 */
export function BrandSelectorSkeleton() {
  return (
    <div className="relative">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 border border-gray-200 rounded-md animate-pulse">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 bg-gray-300 rounded"></div>
          <div className="h-4 w-24 bg-gray-300 rounded"></div>
        </div>
        <div className="w-4 h-4 bg-gray-300 rounded"></div>
      </div>
    </div>
  )
}

/**
 * Loading skeleton for brand list
 */
export function BrandListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center px-3 py-2 animate-pulse">
          <div className="flex items-center flex-1 min-w-0">
            <div className="w-5 h-5 bg-gray-200 rounded mr-2"></div>
            <div className="h-4 bg-gray-200 rounded" style={{ width: `${60 + Math.random() * 40}%` }}></div>
          </div>
          <div className="h-3 w-12 bg-gray-200 rounded ml-2"></div>
        </div>
      ))}
    </div>
  )
}