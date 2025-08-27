import { NextRequest, NextResponse } from 'next/server';
import { PipelineMonitor } from '@/lib/bigquery/monitor';
import { PipelineStateManager } from '@/lib/bigquery/state-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pipelineId = searchParams.get('pipelineId') || 'sqp-data-pipeline';

    // Initialize monitor and state manager
    const monitor = new PipelineMonitor({
      pipelineId,
      enableCloudLogging: false,
      enableMetrics: true,
      enableAlerts: true,
      alertThresholds: {
        errorRate: 0.05,
        executionTime: 3600000,
        dataFreshness: 86400000
      },
      alertChannels: ['email', 'slack'],
      logLevel: 'info'
    });

    const stateManager = new PipelineStateManager(pipelineId);

    // Get dashboard metrics
    const [dashboardMetrics, pipelineState, health] = await Promise.all([
      monitor.getDashboardMetrics(),
      stateManager.getState(),
      stateManager.getHealth()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        dashboard: dashboardMetrics,
        state: pipelineState,
        health
      }
    });
  } catch (error) {
    console.error('Failed to get pipeline monitoring data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get monitoring data' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, pipelineId = 'sqp-data-pipeline' } = body;

    const monitor = new PipelineMonitor({
      pipelineId,
      enableCloudLogging: false,
      enableMetrics: true,
      enableAlerts: true,
      alertThresholds: {
        errorRate: 0.05,
        executionTime: 3600000,
        dataFreshness: 86400000
      },
      alertChannels: ['email', 'slack'],
      logLevel: 'info'
    });

    const stateManager = new PipelineStateManager(pipelineId);

    let result;

    switch (action) {
      case 'checkAlerts':
        result = await monitor.checkAlerts();
        break;

      case 'getHistory':
        result = await stateManager.getHistory({
          limit: body.limit || 50,
          offset: body.offset || 0
        });
        break;

      case 'getRecentErrors':
        result = await monitor.getRecentErrors();
        break;

      case 'exportMetrics':
        result = await monitor.exportMetrics({
          format: body.format || 'json',
          includeRawData: body.includeRawData || false
        });
        break;

      case 'cleanupOldData':
        await monitor.cleanupOldData({
          daysToKeep: body.daysToKeep || 30
        });
        result = { success: true };
        break;

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid action' 
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Failed to execute monitoring action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to execute action' 
      },
      { status: 500 }
    );
  }
}