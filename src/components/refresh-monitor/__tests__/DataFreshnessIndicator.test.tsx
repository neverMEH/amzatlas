import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DataFreshnessIndicator } from '../DataFreshnessIndicator'

describe('DataFreshnessIndicator', () => {
  const mockTableData = [
    {
      table_name: 'sync_log',
      schema: 'public',
      priority: 99,
      freshness_score: 95,
      last_refresh: '2025-09-07T10:00:00Z',
      hours_since_refresh: 0.5,
      status: 'fresh',
      is_core: true
    },
    {
      table_name: 'search_query_performance',
      schema: 'sqp',
      priority: 95,
      freshness_score: 83,
      last_refresh: '2025-09-07T08:00:00Z',
      hours_since_refresh: 2.5,
      status: 'fresh',
      is_core: true
    },
    {
      table_name: 'asin_performance_data',
      schema: 'sqp',
      priority: 90,
      freshness_score: 45,
      last_refresh: '2025-09-06T10:00:00Z',
      hours_since_refresh: 24.5,
      status: 'stale',
      is_core: true
    },
    {
      table_name: 'brands',
      schema: 'public',
      priority: 75,
      freshness_score: 20,
      last_refresh: '2025-09-05T10:00:00Z',
      hours_since_refresh: 48.5,
      status: 'critical',
      is_core: true
    }
  ]

  it('displays table freshness indicators', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    expect(screen.getByText('Data Freshness')).toBeInTheDocument()
    mockTableData.forEach(table => {
      expect(screen.getByText(table.table_name)).toBeInTheDocument()
    })
  })

  it('shows freshness scores as percentages', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('83%')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
  })

  it('applies correct color coding based on freshness', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    // Fresh tables (>80%) should be green
    const freshTable = screen.getByText('95%').closest('div')
    expect(freshTable).toHaveClass('text-green-600')
    
    // Stale tables (30-80%) should be yellow
    const staleTable = screen.getByText('45%').closest('div')
    expect(staleTable).toHaveClass('text-yellow-600')
    
    // Critical tables (<30%) should be red
    const criticalTable = screen.getByText('20%').closest('div')
    expect(criticalTable).toHaveClass('text-red-600')
  })

  it('displays time since last refresh', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    expect(screen.getByText('30 minutes ago')).toBeInTheDocument()
    expect(screen.getByText('2.5 hours ago')).toBeInTheDocument()
    expect(screen.getByText('1 day ago')).toBeInTheDocument()
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })

  it('shows visual freshness bars', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars).toHaveLength(4)
    
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '95')
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '83')
    expect(progressBars[2]).toHaveAttribute('aria-valuenow', '45')
    expect(progressBars[3]).toHaveAttribute('aria-valuenow', '20')
  })

  it('highlights core tables', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    const coreTables = mockTableData.filter(t => t.is_core)
    coreTables.forEach(table => {
      const tableElement = screen.getByText(table.table_name).closest('div')
      expect(tableElement?.querySelector('[data-testid="core-badge"]')).toBeInTheDocument()
    })
  })

  it('shows overall freshness summary', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    expect(screen.getByText('Overall Freshness')).toBeInTheDocument()
    // Average freshness: (95 + 83 + 45 + 20) / 4 = 60.75
    expect(screen.getByText(/61%/)).toBeInTheDocument()
  })

  it('displays critical alert for very stale data', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    const criticalAlert = screen.getByText(/2 tables need immediate attention/)
    expect(criticalAlert).toBeInTheDocument()
    expect(criticalAlert).toHaveClass('text-red-600')
  })

  it('shows refresh needed indicator', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    const staleCount = mockTableData.filter(t => t.freshness_score < 50).length
    expect(screen.getByText(`${staleCount} tables need refresh`)).toBeInTheDocument()
  })

  it('handles empty table list', () => {
    render(<DataFreshnessIndicator tables={[]} />)
    
    expect(screen.getByText('No tables to monitor')).toBeInTheDocument()
  })

  it('sorts tables by priority', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    const tableNames = screen.getAllByTestId('table-name').map(el => el.textContent)
    expect(tableNames).toEqual([
      'sync_log',
      'search_query_performance', 
      'asin_performance_data',
      'brands'
    ])
  })

  it('shows freshness trend indicator', () => {
    const tablesWithTrend = mockTableData.map(table => ({
      ...table,
      freshness_trend: table.freshness_score > 50 ? 'improving' : 'declining'
    }))
    
    render(<DataFreshnessIndicator tables={tablesWithTrend} />)
    
    expect(screen.getByTestId('trend-up-sync_log')).toBeInTheDocument()
    expect(screen.getByTestId('trend-down-brands')).toBeInTheDocument()
  })

  it('displays last successful sync timestamp', () => {
    render(<DataFreshnessIndicator tables={mockTableData} />)
    
    const timestamps = screen.getAllByTestId('last-sync-time')
    expect(timestamps).toHaveLength(4)
    timestamps.forEach(timestamp => {
      expect(timestamp.textContent).toMatch(/\d{1,2}:\d{2} [AP]M/)
    })
  })
})