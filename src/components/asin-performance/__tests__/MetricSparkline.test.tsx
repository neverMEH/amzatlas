import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { MetricSparkline } from '../MetricSparkline'

// Mock SparklineChart component
vi.mock('../SparklineChart', () => ({
  SparklineChart: ({ data, dataKey, type, color, height, className }: any) => (
    <div 
      data-testid="sparkline-chart"
      data-type={type}
      data-color={color}
      data-height={height}
      data-datakey={dataKey}
      data-points={data?.length}
      className={className}
    />
  ),
}))

const mockData = [
  { date: '2024-01-01', impressions: 1000, clicks: 50 },
  { date: '2024-01-02', impressions: 1200, clicks: 65 },
  { date: '2024-01-03', impressions: 1100, clicks: 55 },
  { date: '2024-01-04', impressions: 1300, clicks: 70 },
  { date: '2024-01-05', impressions: 1250, clicks: 68 },
]

describe('MetricSparkline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with metric label and value', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1250}
      />
    )
    
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('1,250')).toBeInTheDocument()
  })

  it('displays sparkline chart with correct props', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="clicks"
        label="Clicks"
        currentValue={68}
      />
    )
    
    const sparkline = screen.getByTestId('sparkline-chart')
    expect(sparkline).toHaveAttribute('data-datakey', 'clicks')
    expect(sparkline).toHaveAttribute('data-points', '5')
  })

  it('shows percentage change when comparison value provided', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1250}
        comparisonValue={1000}
      />
    )
    
    // 1250 vs 1000 = +25%
    expect(screen.getByText('+25.0%')).toBeInTheDocument()
  })

  it('shows negative percentage change with red color', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="clicks"
        label="Clicks"
        currentValue={50}
        comparisonValue={60}
      />
    )
    
    // 50 vs 60 = -16.7%
    const changeElement = screen.getByText('-16.7%')
    expect(changeElement).toBeInTheDocument()
    expect(changeElement).toHaveClass('text-red-600')
  })

  it('shows positive percentage change with green color', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1200}
        comparisonValue={1000}
      />
    )
    
    const changeElement = screen.getByText('+20.0%')
    expect(changeElement).toHaveClass('text-green-600')
  })

  it('handles zero comparison value', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1000}
        comparisonValue={0}
      />
    )
    
    expect(screen.getByText('+∞')).toBeInTheDocument()
  })

  it('formats large numbers correctly', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1234567}
      />
    )
    
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
  })

  it('applies custom chart type', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="clicks"
        label="Clicks"
        currentValue={68}
        chartType="bar"
      />
    )
    
    const sparkline = screen.getByTestId('sparkline-chart')
    expect(sparkline).toHaveAttribute('data-type', 'bar')
  })

  it('applies custom color', () => {
    const customColor = '#10B981'
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1250}
        color={customColor}
      />
    )
    
    const sparkline = screen.getByTestId('sparkline-chart')
    expect(sparkline).toHaveAttribute('data-color', customColor)
  })

  it('handles decimal values with format function', () => {
    const formatValue = (value: number) => `${(value * 100).toFixed(1)}%`
    
    render(
      <MetricSparkline
        data={mockData}
        metric="ctr"
        label="CTR"
        currentValue={0.0456}
        formatValue={formatValue}
      />
    )
    
    expect(screen.getByText('4.6%')).toBeInTheDocument()
  })

  it('renders with custom height', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1250}
        height={60}
      />
    )
    
    const sparkline = screen.getByTestId('sparkline-chart')
    expect(sparkline).toHaveAttribute('data-height', '60')
  })

  it('applies custom className', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="clicks"
        label="Clicks"
        currentValue={68}
        className="custom-metric"
      />
    )
    
    const container = screen.getByTestId('sparkline-chart').closest('.custom-metric')
    expect(container).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1250}
        isLoading={true}
      />
    )
    
    expect(screen.getByTestId('metric-sparkline-skeleton')).toBeInTheDocument()
  })

  it('handles empty data array', () => {
    render(
      <MetricSparkline
        data={[]}
        metric="impressions"
        label="Impressions"
        currentValue={0}
      />
    )
    
    const sparkline = screen.getByTestId('sparkline-chart')
    expect(sparkline).toHaveAttribute('data-points', '0')
  })

  it('does not show change when comparison value equals current value', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1000}
        comparisonValue={1000}
      />
    )
    
    const changeElement = screen.getByText('0.0%')
    expect(changeElement).toHaveClass('text-gray-500')
  })

  it('truncates long labels with ellipsis', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Very Long Metric Label That Should Be Truncated"
        currentValue={1250}
      />
    )
    
    const label = screen.getByText('Very Long Metric Label That Should Be Truncated')
    expect(label).toHaveClass('truncate')
  })

  it('supports area chart type', () => {
    render(
      <MetricSparkline
        data={mockData}
        metric="impressions"
        label="Impressions"
        currentValue={1250}
        chartType="area"
      />
    )
    
    const sparkline = screen.getByTestId('sparkline-chart')
    expect(sparkline).toHaveAttribute('data-type', 'area')
  })
})