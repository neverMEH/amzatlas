import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PipelineStatusCard } from '../PipelineStatusCard'

describe('PipelineStatusCard', () => {
  const mockPipelineData = {
    source: {
      name: 'BigQuery',
      status: 'connected',
      lastCheck: '2025-09-07T10:00:00Z',
      details: {
        dataset: 'dataclient_amzatlas_agency_85',
        project: 'your-project-id',
        location: 'US'
      }
    },
    destination: {
      name: 'Supabase',
      status: 'healthy',
      lastCheck: '2025-09-07T10:01:00Z',
      details: {
        url: 'https://your-project.supabase.co',
        schema: 'sqp'
      }
    },
    pipeline: {
      status: 'active',
      lastSync: '2025-09-07T09:00:00Z',
      nextSync: '2025-09-07T11:00:00Z',
      recentSyncs: [
        {
          id: '1',
          table: 'search_query_performance',
          status: 'success',
          startedAt: '2025-09-07T09:00:00Z',
          completedAt: '2025-09-07T09:15:00Z',
          recordsProcessed: 50000,
          duration: 15
        },
        {
          id: '2',
          table: 'asin_performance_data',
          status: 'failed',
          startedAt: '2025-09-07T08:30:00Z',
          completedAt: '2025-09-07T08:31:00Z',
          recordsProcessed: 0,
          duration: 1,
          error: 'Connection timeout'
        }
      ]
    },
    flow: {
      stages: [
        {
          name: 'Extract',
          status: 'active',
          message: 'Reading from BigQuery',
          progress: 100
        },
        {
          name: 'Transform',
          status: 'active',
          message: 'Processing data',
          progress: 100
        },
        {
          name: 'Load',
          status: 'warning',
          message: 'Writing to Supabase (retrying)',
          progress: 85
        }
      ]
    }
  }

  it('displays pipeline source and destination', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    expect(screen.getByText('BigQuery')).toBeInTheDocument()
    expect(screen.getByText('Supabase')).toBeInTheDocument()
  })

  it('shows connection status indicators', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('displays pipeline flow visualization', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    expect(screen.getByText('Extract')).toBeInTheDocument()
    expect(screen.getByText('Transform')).toBeInTheDocument()
    expect(screen.getByText('Load')).toBeInTheDocument()
  })

  it('shows flow direction arrow', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    const arrow = screen.getByTestId('flow-arrow')
    expect(arrow).toBeInTheDocument()
  })

  it('displays recent sync activities', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('search_query_performance')).toBeInTheDocument()
    expect(screen.getByText('50,000 records')).toBeInTheDocument()
    expect(screen.getByText('15 min')).toBeInTheDocument()
  })

  it('shows sync failures with error messages', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    expect(screen.getByText('asin_performance_data')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Connection timeout')).toBeInTheDocument()
  })

  it('indicates next scheduled sync', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    expect(screen.getByText('Next sync')).toBeInTheDocument()
    expect(screen.getByText(/in \d+ (hours?|minutes?)/)).toBeInTheDocument()
  })

  it('shows warning indicator for pipeline issues', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    const loadStage = screen.getByText('Load').closest('div')
    expect(loadStage).toHaveClass('border-yellow-300')
    expect(screen.getByText('Writing to Supabase (retrying)')).toBeInTheDocument()
  })

  it('displays progress for each stage', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars).toHaveLength(3)
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '100')
    expect(progressBars[1]).toHaveAttribute('aria-valuenow', '100')
    expect(progressBars[2]).toHaveAttribute('aria-valuenow', '85')
  })

  it('handles missing pipeline data gracefully', () => {
    render(<PipelineStatusCard pipelineData={null} />)
    
    expect(screen.getByText('No pipeline data available')).toBeInTheDocument()
  })

  it('shows dataset and schema information', () => {
    render(<PipelineStatusCard pipelineData={mockPipelineData} />)
    
    expect(screen.getByText('dataclient_amzatlas_agency_85')).toBeInTheDocument()
    expect(screen.getByText('Schema: sqp')).toBeInTheDocument()
  })

  it('displays disconnected state correctly', () => {
    const disconnectedData = {
      ...mockPipelineData,
      source: {
        ...mockPipelineData.source,
        status: 'disconnected'
      }
    }
    
    render(<PipelineStatusCard pipelineData={disconnectedData} />)
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
    expect(screen.getByText('Disconnected').closest('div')).toHaveClass('text-red-600')
  })

  it('shows pipeline inactive state', () => {
    const inactiveData = {
      ...mockPipelineData,
      pipeline: {
        ...mockPipelineData.pipeline,
        status: 'inactive'
      }
    }
    
    render(<PipelineStatusCard pipelineData={inactiveData} />)
    
    expect(screen.getByText('Pipeline Inactive')).toBeInTheDocument()
  })
})