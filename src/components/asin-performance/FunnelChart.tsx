'use client'

import React, { useState } from 'react'
import { Eye, MousePointer, ShoppingCart, Package, TrendingUp, TrendingDown } from 'lucide-react'

interface FunnelData {
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
}

interface FunnelChartProps {
  data: FunnelData | null
  comparisonData?: FunnelData | null
  isLoading: boolean
  error: Error | null
}

interface FunnelStage {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number, decimals: number = 2): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function calculateConversionRate(from: number, to: number): number {
  return from > 0 ? to / from : 0
}

function calculatePercentageChange(current: number, previous: number): number {
  return previous > 0 ? (current - previous) / previous : 0
}

export function FunnelChart({ data, comparisonData, isLoading, error }: FunnelChartProps) {

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse" data-testid="funnel-skeleton">
        <div className="h-6 w-48 bg-gray-200 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
                <div className="h-4 w-16 bg-gray-200 rounded"></div>
              </div>
              <div className="h-16 bg-gray-200 rounded" style={{ width: `${100 - i * 20}%` }}></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <p className="text-red-800 font-medium">Error loading funnel</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No funnel data available</p>
          <p className="text-gray-500 text-sm mt-1">
            Select an ASIN and date range to view the conversion funnel
          </p>
        </div>
      </div>
    )
  }

  const stages: FunnelStage[] = [
    {
      label: 'Impressions',
      value: data.impressions,
      icon: <Eye className="h-5 w-5" />,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Clicks',
      value: data.clicks,
      icon: <MousePointer className="h-5 w-5" />,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Cart Adds',
      value: data.cartAdds,
      icon: <ShoppingCart className="h-5 w-5" />,
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
    },
    {
      label: 'Purchases',
      value: data.purchases,
      icon: <Package className="h-5 w-5" />,
      color: 'text-red-700',
      bgColor: 'bg-red-100',
    },
  ]

  const conversionRates = [
    { label: 'CTR', value: calculateConversionRate(data.impressions, data.clicks) },
    { label: 'Cart Add Rate', value: calculateConversionRate(data.clicks, data.cartAdds) },
    { label: 'Purchase Rate', value: calculateConversionRate(data.cartAdds, data.purchases) },
  ]

  const overallCVR = calculateConversionRate(data.impressions, data.purchases)
  const maxValue = data.impressions

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Conversion Funnel</h3>
          <p className="text-sm text-gray-500 mt-1">
            Overall CVR: <span className="font-medium text-gray-900">{formatPercentage(overallCVR)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-6" data-testid="funnel-container">
        {stages.map((stage, index) => {
          const widthPercentage = (stage.value / maxValue) * 100
          const prevStageValue = index > 0 ? stages[index - 1].value : 0
          const conversionRate = index > 0 ? calculateConversionRate(prevStageValue, stage.value) : 1
          
          const comparisonValue = comparisonData && 
            comparisonData[stage.label.toLowerCase().replace(' ', '') as keyof FunnelData]
          const percentageChange = comparisonData && comparisonValue !== undefined && typeof comparisonValue === 'number'
            ? calculatePercentageChange(stage.value, comparisonValue)
            : null

          return (
            <div key={stage.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`p-1.5 rounded-lg ${stage.bgColor} ${stage.color}`}>
                    {stage.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-semibold text-gray-900">
                    {formatNumber(stage.value)}
                  </span>
                  {percentageChange !== null && (
                    <div className={`flex items-center space-x-1 text-sm font-medium ${
                      percentageChange > 0 ? 'text-green-600' : percentageChange < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {percentageChange > 0 && (
                        <>
                          <TrendingUp className="h-4 w-4" />
                          <span>+{formatPercentage(percentageChange, 1)}</span>
                        </>
                      )}
                      {percentageChange < 0 && (
                        <>
                          <TrendingDown className="h-4 w-4" />
                          <span>{formatPercentage(percentageChange, 1)}</span>
                        </>
                      )}
                      {percentageChange === 0 && <span>0.0%</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <div 
                  className="h-12 rounded-lg bg-gray-100 overflow-hidden"
                  style={{ width: '100%' }}
                >
                  <div
                    data-testid={`funnel-bar-${index}`}
                    className={`h-full rounded-lg transition-all duration-500 ${stage.bgColor}`}
                    style={{ width: `${widthPercentage}%` }}
                  >
                    <div className={`h-full bg-gradient-to-r ${stage.bgColor} to-transparent opacity-50`} />
                  </div>
                </div>
                
                {index < stages.length - 1 && (
                  <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600">
                        {formatPercentage(conversionRates[index].value)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {index < stages.length - 1 && <div className="h-4" />}
            </div>
          )
        })}
      </div>

      {comparisonData && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-sm">
            {conversionRates.map((rate, index) => {
              const currentRate = rate.value
              const comparisonStages = [
                calculateConversionRate(comparisonData.impressions, comparisonData.clicks),
                calculateConversionRate(comparisonData.clicks, comparisonData.cartAdds),
                calculateConversionRate(comparisonData.cartAdds, comparisonData.purchases),
              ]
              const previousRate = comparisonStages[index]
              const rateChange = currentRate - previousRate

              return (
                <div key={rate.label} className="text-center">
                  <div className="text-gray-500">{rate.label}</div>
                  <div className="font-medium text-gray-900">{formatPercentage(currentRate)}</div>
                  <div className={`text-xs ${
                    rateChange > 0 ? 'text-green-600' : rateChange < 0 ? 'text-red-600' : 'text-gray-500'
                  }`}>
                    {rateChange > 0 && '+'}
                    {formatPercentage(rateChange)} pts
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}