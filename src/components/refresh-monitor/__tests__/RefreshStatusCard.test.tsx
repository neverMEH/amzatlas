import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RefreshStatusCard } from '../RefreshStatusCard'

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: (date: Date) => '5 minutes ago'
}))

describe('RefreshStatusCard', () => {
  const mockStatusData = {
    overall_status: 'healthy',
    statistics: {
      total_tables: 7,
      enabled_tables: 7,
      disabled_tables: 0,
      successful_today: 15,
      failed_today: 2,
      running_now: 1,
      stale_tables: 1,
      overdue_tables: 0
    },
    tables: [
      {
        table_name: 'sync_log',
        schema: 'public',
        enabled: true,
        status: 'success',
        is_stale: false,
        is_core: true,
        last_refresh: '2025-09-07T10:00:00Z',
        next_refresh: '2025-09-07T11:00:00Z',
        hours_until_refresh: 0.5,
        frequency_hours: 1,
        priority: 99,
        freshness_score: 95,
        recent_error: null
      },
      {
        table_name: 'search_query_performance',
        schema: 'sqp',
        enabled: true,
        status: 'running',
        is_stale: false,
        is_core: true,
        last_refresh: '2025-09-07T08:00:00Z',
        next_refresh: '2025-09-07T20:00:00Z',
        hours_until_refresh: 10,
        frequency_hours: 12,
        priority: 95,
        freshness_score: 83,
        recent_error: null
      },
      {
        table_name: 'asin_performance_data',
        schema: 'sqp',
        enabled: true,
        status: 'failed',
        is_stale: false,
        is_core: true,
        last_refresh: '2025-09-07T06:00:00Z',
        next_refresh: '2025-09-07T18:00:00Z',
        hours_until_refresh: 8,
        frequency_hours: 12,
        priority: 90,
        freshness_score: 75,
        recent_error: 'Connection timeout'
      },
      {
        table_name: 'webhook_configs',
        schema: 'public',
        enabled: true,
        status: 'overdue',
        is_stale: true,
        is_core: false,
        last_refresh: '2025-09-05T10:00:00Z',
        next_refresh: '2025-09-06T10:00:00Z',
        hours_until_refresh: -24,
        frequency_hours: 24,
        priority: 30,
        freshness_score: 0,
        recent_error: null
      }
    ],
    alerts: [
      {
        id: 'core-table-error-asin_performance_data',
        severity: 'critical',
        type: 'core_table_failure',
        message: 'Critical table asin_performance_data is failing',
        table_name: 'asin_performance_data',
        details: {
          last_error: 'Connection timeout',
          priority: 90,
          hours_since_refresh: 4
        },
        timestamp: '2025-09-07T10:30:00Z'
      },
      {
        id: 'multiple-stale-tables',
        severity: 'warning',
        type: 'multiple_stale_tables',
        message: '1 tables are stale and need refresh',
        details: {
          stale_count: 1,
          sample_tables: ['webhook_configs'],
          total_tables: 7
        },
        timestamp: '2025-09-07T10:30:00Z'
      }
    ],
    alert_summary: {
      critical: 1,
      warning: 1,
      info: 0
    },
    pipeline_activity: [
      {
        id: '1',
        operation_type: 'full_sync',
        table_name: 'search_query_performance',
        status: 'success',
        started_at: '2025-09-07T09:00:00Z',
        completed_at: '2025-09-07T09:15:00Z',
        duration_minutes: 15,
        records_processed: 50000,
        error: null,
        source: 'sync_log'
      }
    ],
    last_updated: '2025-09-07T10:30:00Z'
  }

  it('renders nothing when no status data is provided', () => {
    const { container } = render(<RefreshStatusCard statusData={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('displays overall system status correctly', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText('HEALTHY')).toBeInTheDocument()
  })

  it('shows correct status icon based on overall status', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    const statusCard = screen.getByText('System Health').closest('div')
    const icon = statusCard?.querySelector('svg')
    expect(icon).toBeInTheDocument()
    expect(icon?.classList.toString()).toContain('text-green-500')
  })

  it('displays core statistics correctly', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    expect(screen.getByText('Core Tables')).toBeInTheDocument()
    expect(screen.getByText('3 of 7')).toBeInTheDocument() // 3 core tables out of 7 total
    
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('88.2%')).toBeInTheDocument() // 15/(15+2) * 100
  })

  it('displays alerts section when alerts exist', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    expect(screen.getByText('Active Alerts')).toBeInTheDocument()
    expect(screen.getByText('1 Critical')).toBeInTheDocument()
    expect(screen.getByText('1 Warning')).toBeInTheDocument()
    expect(screen.getByText('0 Info')).toBeInTheDocument()
  })

  it('shows critical alert details', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    expect(screen.getByText('Critical table asin_performance_data is failing')).toBeInTheDocument()
  })

  it('displays pipeline activity when available', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    expect(screen.getByText('Recent Pipeline Activity')).toBeInTheDocument()
    expect(screen.getByText('search_query_performance')).toBeInTheDocument()
    expect(screen.getByText('full_sync')).toBeInTheDocument()
    expect(screen.getByText('50,000 records')).toBeInTheDocument()
  })

  it('shows correct status colors for different statuses', () => {
    const warningStatus = {
      ...mockStatusData,
      overall_status: 'warning'
    }
    
    const { rerender } = render(<RefreshStatusCard statusData={warningStatus} />)
    expect(screen.getByText('WARNING')).toHaveClass('bg-yellow-100', 'text-yellow-800')
    
    const errorStatus = {
      ...mockStatusData,
      overall_status: 'error'
    }
    
    rerender(<RefreshStatusCard statusData={errorStatus} />)
    expect(screen.getByText('ERROR')).toHaveClass('bg-red-100', 'text-red-800')
  })

  it('displays freshness scores for core tables', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    const tableList = screen.getByText('Core Table Status').closest('div')
    
    expect(within(tableList!).getByText('sync_log')).toBeInTheDocument()
    expect(within(tableList!).getByText('95%')).toBeInTheDocument()
    
    expect(within(tableList!).getByText('search_query_performance')).toBeInTheDocument()
    expect(within(tableList!).getByText('83%')).toBeInTheDocument()
    
    expect(within(tableList!).getByText('asin_performance_data')).toBeInTheDocument()
    expect(within(tableList!).getByText('75%')).toBeInTheDocument()
  })

  it('filters table list to show only core tables', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    const tableList = screen.getByText('Core Table Status').closest('div')
    
    // Core tables should be shown
    expect(within(tableList!).getByText('sync_log')).toBeInTheDocument()
    expect(within(tableList!).getByText('search_query_performance')).toBeInTheDocument()
    expect(within(tableList!).getByText('asin_performance_data')).toBeInTheDocument()
    
    // Non-core tables should not be shown
    expect(within(tableList!).queryByText('webhook_configs')).not.toBeInTheDocument()
  })

  it('shows data freshness indicator', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    expect(screen.getByText('Data Freshness')).toBeInTheDocument()
    expect(screen.getByText('Last Update')).toBeInTheDocument()
    expect(screen.getByText(/ago$/)).toBeInTheDocument()
  })

  it('handles missing pipeline activity gracefully', () => {
    const noPipelineData = {
      ...mockStatusData,
      pipeline_activity: []
    }
    
    render(<RefreshStatusCard statusData={noPipelineData} />)
    expect(screen.getByText('No recent pipeline activity')).toBeInTheDocument()
  })

  it('shows health score calculation', () => {
    render(<RefreshStatusCard statusData={mockStatusData} />)
    
    expect(screen.getByText('Health Score')).toBeInTheDocument()
    // Average freshness of core tables: (95 + 83 + 75) / 3 = 84.3
    expect(screen.getByText(/84/)).toBeInTheDocument()
  })
})