import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RefreshMonitorPage from '../page'

// Mock the components
vi.mock('@/components/refresh-monitor/RefreshStatusCard', () => ({
  RefreshStatusCard: ({ statusData }: any) => (
    <div data-testid="refresh-status-card">
      Status: {statusData?.overall_status || 'No data'}
    </div>
  )
}))

vi.mock('@/components/refresh-monitor/RefreshHistoryTable', () => ({
  RefreshHistoryTable: () => <div data-testid="refresh-history-table">History Table</div>
}))

vi.mock('@/components/refresh-monitor/RefreshMetricsChart', () => ({
  RefreshMetricsChart: () => <div data-testid="refresh-metrics-chart">Metrics Chart</div>
}))

vi.mock('@/components/refresh-monitor/RefreshConfigPanel', () => ({
  RefreshConfigPanel: () => <div data-testid="refresh-config-panel">Config Panel</div>
}))

vi.mock('@/components/refresh-monitor/WebhookPanel', () => ({
  WebhookPanel: () => <div data-testid="webhook-panel">Webhook Panel</div>
}))

// Mock fetch
global.fetch = vi.fn()

describe('RefreshMonitorPage', () => {
  const mockStatusResponse = {
    overall_status: 'healthy',
    statistics: {
      total_tables: 7,
      enabled_tables: 7,
      successful_today: 15,
      failed_today: 2,
      stale_tables: 1,
      overdue_tables: 0
    },
    tables: [],
    alerts: [],
    alert_summary: {
      critical: 0,
      warning: 1,
      info: 0
    },
    last_updated: '2025-09-07T10:30:00Z'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    ;(global.fetch as any).mockResolvedValue({
      json: async () => mockStatusResponse
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders page header correctly', async () => {
    render(<RefreshMonitorPage />)
    
    expect(screen.getByText('Data Pipeline Monitor')).toBeInTheDocument()
    expect(screen.getByText('Monitor and manage data synchronization pipeline')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<RefreshMonitorPage />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('fetches status data on mount', async () => {
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/refresh/status')
    })
  })

  it('displays status data after loading', async () => {
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      expect(screen.getByText('Status: healthy')).toBeInTheDocument()
    })
  })

  it('shows correct tabs', async () => {
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Pipeline')).toBeInTheDocument()
      expect(screen.getByText('History')).toBeInTheDocument()
      expect(screen.getByText('Configuration')).toBeInTheDocument()
    })
  })

  it('switches tabs correctly', async () => {
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
    
    // Default tab is overview
    expect(screen.getByTestId('refresh-status-card')).toBeInTheDocument()
    
    // Click on Pipeline tab
    fireEvent.click(screen.getByText('Pipeline'))
    expect(screen.getByTestId('pipeline-status')).toBeInTheDocument()
    
    // Click on History tab
    fireEvent.click(screen.getByText('History'))
    expect(screen.getByTestId('refresh-history-table')).toBeInTheDocument()
    
    // Click on Configuration tab
    fireEvent.click(screen.getByText('Configuration'))
    expect(screen.getByTestId('refresh-config-panel')).toBeInTheDocument()
  })

  it('auto-refreshes data every 30 seconds', async () => {
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
    
    // Advance timer by 30 seconds
    vi.advanceTimersByTime(30000)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('shows last update time', async () => {
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })
  })

  it('handles refresh button click', async () => {
    const { rerender } = render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
    
    const originalReload = window.location.reload
    window.location.reload = vi.fn()
    
    fireEvent.click(screen.getByText('Refresh'))
    
    expect(window.location.reload).toHaveBeenCalled()
    
    window.location.reload = originalReload
  })

  it('handles fetch error gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))
    
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to fetch status:', expect.any(Error))
    })
    
    consoleError.mockRestore()
  })

  it('shows alert indicators when alerts exist', async () => {
    const dataWithAlerts = {
      ...mockStatusResponse,
      alert_summary: {
        critical: 2,
        warning: 3,
        info: 1
      }
    }
    
    ;(global.fetch as any).mockResolvedValue({
      json: async () => dataWithAlerts
    })
    
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument() // Critical count
      expect(screen.getByText('3')).toBeInTheDocument() // Warning count
    })
  })

  it('displays health endpoint data in overview', async () => {
    // Mock both status and health endpoints
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url === '/api/refresh/status') {
        return Promise.resolve({
          json: async () => mockStatusResponse
        })
      }
      if (url === '/api/refresh/health') {
        return Promise.resolve({
          json: async () => ({
            status: 'healthy',
            health_score: 95,
            checks: [
              { name: 'database_connectivity', status: 'pass' },
              { name: 'core_tables_configured', status: 'pass' },
              { name: 'sync_activity', status: 'pass' },
              { name: 'data_freshness', status: 'pass' }
            ]
          })
        })
      }
    })
    
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/refresh/health')
    })
  })

  it('removes webhook tab when webhooks are not actively used', async () => {
    render(<RefreshMonitorPage />)
    
    await waitFor(() => {
      // Webhook tab should not be present in new design
      expect(screen.queryByText('Webhooks')).not.toBeInTheDocument()
    })
  })
})