import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComparisonIndicator } from '../ComparisonIndicator'

describe('ComparisonIndicator', () => {
  it('should render positive value with up arrow', () => {
    render(<ComparisonIndicator value={10.5} />)
    
    expect(screen.getByText('10.5%')).toBeInTheDocument()
    const container = screen.getByText('10.5%').parentElement
    expect(container).toHaveClass('text-green-600')
  })

  it('should render negative value with down arrow', () => {
    render(<ComparisonIndicator value={-5.3} />)
    
    expect(screen.getByText('5.3%')).toBeInTheDocument()
    const container = screen.getByText('5.3%').parentElement
    expect(container).toHaveClass('text-red-600')
  })

  it('should render zero as positive', () => {
    render(<ComparisonIndicator value={0} />)
    
    expect(screen.getByText('0%')).toBeInTheDocument()
    const container = screen.getByText('0%').parentElement
    expect(container).toHaveClass('text-green-600')
  })

  it('should render null value as empty', () => {
    const { container } = render(<ComparisonIndicator value={null} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should render undefined value as empty', () => {
    const { container } = render(<ComparisonIndicator value={undefined} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should apply small size classes', () => {
    render(<ComparisonIndicator value={10} size="sm" />)
    
    const container = screen.getByText('10%').parentElement
    expect(container).toHaveClass('text-xs')
  })

  it('should apply medium size classes', () => {
    render(<ComparisonIndicator value={10} size="md" />)
    
    const container = screen.getByText('10%').parentElement
    expect(container).toHaveClass('text-sm')
  })

  it('should show absolute value for negative numbers', () => {
    render(<ComparisonIndicator value={-25.7} />)
    
    expect(screen.getByText('25.7%')).toBeInTheDocument()
  })

  it('should render decimal values correctly', () => {
    render(<ComparisonIndicator value={12.345} />)
    
    expect(screen.getByText('12.345%')).toBeInTheDocument()
  })

  it('should handle very small values', () => {
    render(<ComparisonIndicator value={0.1} />)
    
    expect(screen.getByText('0.1%')).toBeInTheDocument()
  })

  it('should handle very large values', () => {
    render(<ComparisonIndicator value={999.9} />)
    
    expect(screen.getByText('999.9%')).toBeInTheDocument()
  })
})