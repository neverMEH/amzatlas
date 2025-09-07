import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiModules, KpiCard } from '../KpiModules'

describe('KpiCard', () => {
  const defaultProps = {
    title: 'Test Metric',
    value: 1000,
    data: [100, 120, 110, 130, 125, 140, 135, 150, 145, 160],
  }

  it('should render the title', () => {
    render(<KpiCard {...defaultProps} />)
    expect(screen.getByText('Test Metric')).toBeInTheDocument()
  })

  it('should render the formatted value', () => {
    render(<KpiCard {...defaultProps} />)
    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('should apply custom formatter', () => {
    const formatter = vi.fn((val) => `$${val}`)
    render(<KpiCard {...defaultProps} formatter={formatter} />)
    expect(formatter).toHaveBeenCalledWith(1000)
    expect(screen.getByText('$1000')).toBeInTheDocument()
  })

  it('should show comparison badge when comparison is provided', () => {
    render(<KpiCard {...defaultProps} comparison={12.5} />)
    expect(screen.getByText('+12.5%')).toBeInTheDocument()
  })

  it('should show negative comparison without plus sign', () => {
    render(<KpiCard {...defaultProps} comparison={-5.3} />)
    expect(screen.getByText('-5.3%')).toBeInTheDocument()
  })

  it('should apply green styling for positive comparison', () => {
    render(<KpiCard {...defaultProps} comparison={10} />)
    const badge = screen.getByText('+10%')
    expect(badge).toHaveClass('bg-green-50', 'text-green-600')
  })

  it('should apply red styling for negative comparison', () => {
    render(<KpiCard {...defaultProps} comparison={-10} />)
    const badge = screen.getByText('-10%')
    expect(badge).toHaveClass('bg-red-50', 'text-red-600')
  })

  it('should not show comparison badge when comparison is null', () => {
    render(<KpiCard {...defaultProps} comparison={null} />)
    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })

  it('should render sparkline SVG', () => {
    render(<KpiCard {...defaultProps} />)
    const svg = screen.getByRole('img', { hidden: true })
    expect(svg).toBeInTheDocument()
    expect(svg.tagName).toBe('svg')
  })

  it('should generate correct sparkline path', () => {
    const data = [10, 20, 15, 25, 30]
    render(<KpiCard {...defaultProps} data={data} />)
    const path = screen.getByRole('img', { hidden: true }).querySelector('path')
    expect(path).toBeInTheDocument()
    expect(path).toHaveAttribute('d')
    expect(path?.getAttribute('d')).toMatch(/^M/)
  })

  it('should use blue stroke for positive trend', () => {
    render(<KpiCard {...defaultProps} positive={true} />)
    const path = screen.getByRole('img', { hidden: true }).querySelector('path')
    expect(path).toHaveAttribute('stroke', '#3b82f6')
  })

  it('should use red stroke for negative trend', () => {
    render(<KpiCard {...defaultProps} positive={false} />)
    const path = screen.getByRole('img', { hidden: true }).querySelector('path')
    expect(path).toHaveAttribute('stroke', '#ef4444')
  })

  it('should handle empty data array', () => {
    render(<KpiCard {...defaultProps} data={[]} />)
    const path = screen.getByRole('img', { hidden: true }).querySelector('path')
    expect(path).toHaveAttribute('d', '')
  })

  it('should handle single data point', () => {
    render(<KpiCard {...defaultProps} data={[100]} />)
    const path = screen.getByRole('img', { hidden: true }).querySelector('path')
    expect(path).toBeInTheDocument()
  })
})

describe('KpiModules', () => {
  const mockData = {
    kpis: {
      impressions: {
        value: 24500,
        trend: [23000, 23500, 24000, 24200, 24500],
        comparison: 12.3,
      },
      clicks: {
        value: 4585,
        trend: [4200, 4300, 4400, 4500, 4585],
        comparison: 8.7,
      },
      cartAdds: {
        value: 1080,
        trend: [1100, 1090, 1085, 1082, 1080],
        comparison: -3.2,
      },
      purchases: {
        value: 631,
        trend: [550, 580, 600, 620, 631],
        comparison: 15.4,
      },
    },
  }

  it('should render all four KPI cards', () => {
    render(<KpiModules data={mockData} />)
    
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('Clicks')).toBeInTheDocument()
    expect(screen.getByText('Cart Adds')).toBeInTheDocument()
    expect(screen.getByText('Purchases')).toBeInTheDocument()
  })

  it('should display correct values for each metric', () => {
    render(<KpiModules data={mockData} />)
    
    expect(screen.getByText('24,500')).toBeInTheDocument()
    expect(screen.getByText('4,585')).toBeInTheDocument()
    expect(screen.getByText('1,080')).toBeInTheDocument()
    expect(screen.getByText('631')).toBeInTheDocument()
  })

  it('should show comparisons when showComparison is true', () => {
    render(<KpiModules data={mockData} showComparison={true} />)
    
    expect(screen.getByText('+12.3%')).toBeInTheDocument()
    expect(screen.getByText('+8.7%')).toBeInTheDocument()
    expect(screen.getByText('-3.2%')).toBeInTheDocument()
    expect(screen.getByText('+15.4%')).toBeInTheDocument()
  })

  it('should not show comparisons when showComparison is false', () => {
    render(<KpiModules data={mockData} showComparison={false} />)
    
    expect(screen.queryByText('+12.3%')).not.toBeInTheDocument()
    expect(screen.queryByText('+8.7%')).not.toBeInTheDocument()
    expect(screen.queryByText('-3.2%')).not.toBeInTheDocument()
    expect(screen.queryByText('+15.4%')).not.toBeInTheDocument()
  })

  it('should render in a grid layout', () => {
    const { container } = render(<KpiModules data={mockData} />)
    const grid = container.firstChild
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-4', 'gap-4')
  })

  it('should show loading state when loading prop is true', () => {
    render(<KpiModules loading={true} />)
    
    // Should show skeleton loaders
    const skeletons = screen.getAllByTestId('kpi-skeleton')
    expect(skeletons).toHaveLength(4)
  })

  it('should show error state when error prop is provided', () => {
    render(<KpiModules error="Failed to load KPIs" />)
    
    expect(screen.getByText('Failed to load KPIs')).toBeInTheDocument()
  })

  it('should handle null data gracefully', () => {
    render(<KpiModules data={null} />)
    
    // Should render empty cards or placeholders
    expect(screen.getByText('Impressions')).toBeInTheDocument()
    expect(screen.getByText('Clicks')).toBeInTheDocument()
    expect(screen.getByText('Cart Adds')).toBeInTheDocument()
    expect(screen.getByText('Purchases')).toBeInTheDocument()
  })

  it('should use correct positive/negative indicators for trends', () => {
    render(<KpiModules data={mockData} />)
    
    const svgs = screen.getAllByRole('img', { hidden: true })
    const paths = svgs.map(svg => svg.querySelector('path'))
    
    // Impressions, Clicks, Purchases should be blue (positive)
    expect(paths[0]).toHaveAttribute('stroke', '#3b82f6')
    expect(paths[1]).toHaveAttribute('stroke', '#3b82f6')
    expect(paths[3]).toHaveAttribute('stroke', '#3b82f6')
    
    // Cart Adds should be red (negative)
    expect(paths[2]).toHaveAttribute('stroke', '#ef4444')
  })
})