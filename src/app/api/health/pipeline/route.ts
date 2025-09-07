import { NextRequest, NextResponse } from 'next/server';
import { PipelineStateManager } from '@/lib/bigquery/state-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const pipelineId = searchParams.get('pipelineId') || 'sqp-data-pipeline';

    const stateManager = new PipelineStateManager(pipelineId);
    const health = await stateManager.getHealth();
    const state = await stateManager.getState();

    const isHealthy = health.status === 'healthy' || health.status === 'degraded';
    const status = isHealthy ? 200 : 503;

    return NextResponse.json({
      status: health.status,
      healthy: isHealthy,
      lastSuccessTime: health.lastSuccessTime,
      successRate: health.successRate,
      recentErrors: health.recentErrors,
      pipelineStatus: state.status,
      currentStep: state.currentStep,
      metadata: {
        timestamp: new Date().toISOString(),
        pipelineId
      }
    }, { status });

  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        healthy: false,
        error: 'Health check failed' 
      },
      { status: 503 }
    );
  }
}