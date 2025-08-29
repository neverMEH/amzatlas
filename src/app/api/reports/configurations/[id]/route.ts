import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('report_configurations')
      .select(`
        *,
        report_recipients (
          id,
          email,
          name,
          delivery_method,
          is_active,
          last_delivered_at
        ),
        report_execution_history (
          id,
          started_at,
          completed_at,
          status,
          generated_files,
          execution_time_ms
        )
      `)
      .eq('id', params.id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Report configuration not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching report configuration:', error)
      return NextResponse.json(
        { error: 'Failed to fetch report configuration' },
        { status: 500 }
      )
    }
    
    // Get latest execution history
    const latestHistory = data.report_execution_history
      ?.sort((a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
    
    return NextResponse.json({
      ...data,
      latest_execution: latestHistory || null,
      execution_history: data.report_execution_history || []
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    // Remove fields that shouldn't be updated directly
    const {
      id,
      created_at,
      created_by,
      last_run_at,
      next_run_at,
      ...updateData
    } = body
    
    const { data, error } = await supabase
      .from('report_configurations')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Report configuration not found' },
          { status: 404 }
        )
      }
      console.error('Error updating report configuration:', error)
      return NextResponse.json(
        { error: 'Failed to update report configuration' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      configuration: data,
      message: 'Report configuration updated successfully'
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    
    const { error } = await supabase
      .from('report_configurations')
      .delete()
      .eq('id', params.id)
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Report configuration not found' },
          { status: 404 }
        )
      }
      console.error('Error deleting report configuration:', error)
      return NextResponse.json(
        { error: 'Failed to delete report configuration' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Report configuration deleted successfully'
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}