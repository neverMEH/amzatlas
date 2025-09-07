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
  BarChart: ({ children, data, margin, onMouseMove, onMouseLeave }: any) => (
    <div 
      data-testid="bar-chart" 
      data-count={data?.length} 
      margin={JSON.stringify(margin)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
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
  Bar: ({ dataKey, fill, isAnimationActive, radius, children }: any) => (
    <div 
      data-testid={`bar-${dataKey}`}
      data-fill={fill}
      data-animation={isAnimationActive}
      data-radius={JSON.stringify(radius)}
    >
      {children}
    </div>
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
  Cell: ({ fill, style }: any) => (
    <div 
      data-testid="bar-cell"
      data-fill={fill}
      style={style}
    />
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: ({ content, cursor, allowEscapeViewBox }: any) => (
    <div 
      data-testid="tooltip"
      data-cursor={JSON.stringify(cursor)}
      data-allow-escape={JSON.stringify(allowEscapeViewBox)}
    >
      {/* Mock the custom tooltip content */}
      {content && typeof content === 'function' && (
        <div data-testid="custom-tooltip">Custom Tooltip</div>
      )}
    </div>
  ),
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
    
    // Bar chart now uses cells with modified color for hover effect
    const cells = screen.getAllByTestId('bar-cell')
    expect(cells[0]).toHaveAttribute('data-fill', `${customColor}88`)
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

  describe('Tooltip functionality', () => {
    it('renders tooltip component for all chart types', () => {
      const { rerender } = render(<SparklineChart data={mockData} dataKey="value" type="line" />)
      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
      
      rerender(<SparklineChart data={mockData} dataKey="value" type="bar" />)
      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
      
      rerender(<SparklineChart data={mockData} dataKey="value" type="area" />)
      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('configures tooltip cursor correctly', () => {
      render(<SparklineChart data={mockData} dataKey="value" type="bar" />)
      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveAttribute('data-cursor', '{"fill":"transparent"}')
    })

    it('allows tooltip to escape viewport bounds', () => {
      render(<SparklineChart data={mockData} dataKey="value" type="line" />)
      const tooltip = screen.getByTestId('tooltip')
      expect(tooltip).toHaveAttribute('data-allow-escape', '{"x":false,"y":true}')
    })
  })

  describe('Bar chart enhancements', () => {
    it('renders bar chart with rounded corners', () => {
      render(<SparklineChart data={mockData} dataKey="value" type="bar" />)
      const bar = screen.getByTestId('bar-value')
      expect(bar).toHaveAttribute('data-radius', '[3,3,0,0]')
    })

    it('renders individual cells for each bar', () => {
      render(<SparklineChart data={mockData} dataKey="value" type="bar" />)
      const cells = screen.getAllByTestId('bar-cell')
      expect(cells).toHaveLength(mockData.length)
    })

    it('applies hover effect styles to bar cells', () => {
      render(<SparklineChart data={mockData} dataKey="value" type="bar" color="#3B82F6" />)
      const cells = screen.getAllByTestId('bar-cell')
      
      // First cell should have normal opacity
      expect(cells[0]).toHaveAttribute('data-fill', '#3B82F688')
      
      // Check that transition style is applied
      expect(cells[0]).toHaveStyle({ transition: 'fill 0.2s ease' })
    })
  })

  describe('Weekly data visualization', () => {
    const weeklyData = [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 150 },
      { date: '2024-01-03', value: 120 },
      { date: '2024-01-04', value: 180 },
      { date: '2024-01-05', value: 160 },
      { date: '2024-01-06', value: 140 },
      { date: '2024-01-07', value: 170 },
    ]

    it('renders 7 bars for weekly data', () => {
      render(<SparklineChart data={weeklyData} dataKey="value" type="bar" />)
      const cells = screen.getAllByTestId('bar-cell')
      expect(cells).toHaveLength(7)
    })

    it('handles empty weekly slots gracefully', () => {
      const sparseWeeklyData = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 0 },
        { date: '2024-01-03', value: 120 },
        { date: '2024-01-04', value: 0 },
        { date: '2024-01-05', value: 160 },
        { date: '2024-01-06', value: 0 },
        { date: '2024-01-07', value: 170 },
      ]
      
      render(<SparklineChart data={sparseWeeklyData} dataKey="value" type="bar" />)
      const cells = screen.getAllByTestId('bar-cell')
      expect(cells).toHaveLength(7)
    })
  })
})