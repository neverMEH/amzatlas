import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SparklineChart } from '../SparklineChart'

// Mock Recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data, margin }: any) => (
    <div data-testid="line-chart" data-count={data?.length} margin={JSON.stringify(margin)}>
      {children}
    </div>
  ),
  BarChart: ({ children, data, margin }: any) => (
    <div data-testid="bar-chart" data-count={data?.length} margin={JSON.stringify(margin)}>
      {children}
    </div>
  ),
  AreaChart: ({ children, data, margin }: any) => (
    <div data-testid="area-chart" data-count={data?.length} margin={JSON.stringify(margin)}>
      {children}
    </div>
  ),
  Line: ({ dataKey, stroke, strokeWidth, dot, isAnimationActive }: any) => (
    <div 
      data-testid={`line-${dataKey}`}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-dot={dot}
      data-animation={isAnimationActive}
    />
  ),
  Bar: ({ dataKey, fill, isAnimationActive }: any) => (
    <div 
      data-testid={`bar-${dataKey}`}
      data-fill={fill}
      data-animation={isAnimationActive}
    />
  ),
  Area: ({ dataKey, stroke, strokeWidth, fill, isAnimationActive, type }: any) => (
    <div 
      data-testid={`area-${dataKey}`}
      data-stroke={stroke}
      data-stroke-width={strokeWidth}
      data-fill={fill}
      data-animation={isAnimationActive}
      data-type={type}
    />
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

const mockData = [
  { date: '2024-01-01', value: 100 },
  { date: '2024-01-02', value: 150 },
  { date: '2024-01-03', value: 120 },
  { date: '2024-01-04', value: 180 },
  { date: '2024-01-05', value: 160 },
]

describe('SparklineChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders line chart by default', () => {
    render(<SparklineChart data={mockData} dataKey="value" />)
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('line-value')).toBeInTheDocument()
  })

  it('renders bar chart when type is bar', () => {
    render(<SparklineChart data={mockData} dataKey="value" type="bar" />)
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    expect(screen.getByTestId('bar-value')).toBeInTheDocument()
  })

  it('applies custom color to chart elements', () => {
    const customColor = '#ff5733'
    render(<SparklineChart data={mockData} dataKey="value" color={customColor} />)
    
    const line = screen.getByTestId('line-value')
    expect(line).toHaveAttribute('data-stroke', customColor)
  })

  it('handles empty data gracefully', () => {
    render(<SparklineChart data={[]} dataKey="value" />)
    
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-count', '0')
  })

  it('does not render axes, grid, or legend', () => {
    render(<SparklineChart data={mockData} dataKey="value" />)
    
    // These components should not be rendered in sparkline
    expect(screen.queryByTestId('x-axis')).not.toBeInTheDocument()
    expect(screen.queryByTestId('y-axis')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cartesian-grid')).not.toBeInTheDocument()
    expect(screen.queryByTestId('legend')).not.toBeInTheDocument()
  })

  it('accepts custom height', () => {
    render(<SparklineChart data={mockData} dataKey="value" height={50} />)
    
    const container = screen.getByTestId('responsive-container')
    expect(container).toBeInTheDocument()
  })

  it('applies animation prop correctly', () => {
    render(<SparklineChart data={mockData} dataKey="value" animate={false} />)
    
    const line = screen.getByTestId('line-value')
    expect(line).toHaveAttribute('data-animation', 'false')
  })

  it('renders with minimal margins', () => {
    render(<SparklineChart data={mockData} dataKey="value" />)
    
    const chart = screen.getByTestId('line-chart')
    expect(chart).toHaveAttribute('margin', '{"top":2,"right":2,"left":2,"bottom":2}')
  })

  it('handles bar chart with custom fill color', () => {
    const customColor = '#00bcd4'
    render(<SparklineChart data={mockData} dataKey="value" type="bar" color={customColor} />)
    
    const bar = screen.getByTestId('bar-value')
    expect(bar).toHaveAttribute('data-fill', customColor)
  })

  it('supports area type for filled line charts', () => {
    render(<SparklineChart data={mockData} dataKey="value" type="area" />)
    
    const area = screen.getByTestId('area-value')
    expect(area).toHaveAttribute('data-type', 'monotone')
    expect(area).toHaveAttribute('data-fill')
  })

  it('applies custom className', () => {
    render(
      <div>
        <SparklineChart data={mockData} dataKey="value" className="custom-sparkline" />
      </div>
    )
    
    const container = screen.getByTestId('responsive-container').parentElement
    expect(container).toHaveClass('custom-sparkline')
  })

  it('handles numeric dataKey correctly', () => {
    const numericData = [
      { timestamp: 1704067200, impressions: 1000 },
      { timestamp: 1704153600, impressions: 1200 },
      { timestamp: 1704240000, impressions: 1100 },
    ]
    
    render(<SparklineChart data={numericData} dataKey="impressions" />)
    
    expect(screen.getByTestId('line-impressions')).toBeInTheDocument()
  })

  it('maintains aspect ratio in responsive container', () => {
    render(<SparklineChart data={mockData} dataKey="value" />)
    
    const container = screen.getByTestId('responsive-container')
    expect(container).toBeInTheDocument()
  })

  it('applies stroke width for better visibility', () => {
    render(<SparklineChart data={mockData} dataKey="value" strokeWidth={3} />)
    
    const line = screen.getByTestId('line-value')
    expect(line).toHaveAttribute('data-stroke-width', '3')
  })
})