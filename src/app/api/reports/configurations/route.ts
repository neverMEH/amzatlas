import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    const isActive = searchParams.get('active')
    const reportType = searchParams.get('type')
    const frequency = searchParams.get('frequency')
    
    let query = supabase
      .from('report_configurations')
      .select(`
        *,
        report_recipients (
          id,
          email,
          name,
          delivery_method,
          is_active
        )
      `)
      .order('created_at', { ascending: false })
    
    // Apply filters
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }
    if (reportType) {
      query = query.eq('report_type', reportType)
    }
    if (frequency) {
      query = query.eq('frequency', frequency)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching report configurations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch report configurations' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      configurations: data || [],
      total: data?.length || 0
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const {
      name,
      description,
      report_type,
      frequency,
      config = {},
      filters = {},
      schedule_day_of_week,
      schedule_time,
      schedule_day_of_month,
      export_formats = ['pdf'],
      include_charts = true,
      include_raw_data = false,
      recipients = []
    } = body
    
    // Validate required fields
    if (!name || !report_type || !frequency) {
      return NextResponse.json(
        { error: 'Name, report type, and frequency are required' },
        { status: 400 }
      )
    }
    
    // Validate report type
    const validReportTypes = [
      'period_comparison',
      'keyword_trends',
      'market_share_analysis',
      'anomaly_detection',
      'comprehensive_dashboard',
      'custom'
    ]
    if (!validReportTypes.includes(report_type)) {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      )
    }
    
    // Validate frequency
    const validFrequencies = [
      'daily',
      'weekly',
      'bi_weekly',
      'monthly',
      'quarterly',
      'on_demand'
    ]
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency' },
        { status: 400 }
      )
    }
    
    // Start transaction
    const { data: configuration, error: configError } = await supabase
      .from('report_configurations')
      .insert({
        name,
        description,
        report_type,
        frequency,
        config,
        filters,
        schedule_day_of_week,
        schedule_time,
        schedule_day_of_month,
        export_formats,
        include_charts,
        include_raw_data
      })
      .select()
      .single()
    
    if (configError) {
      console.error('Error creating report configuration:', configError)
      return NextResponse.json(
        { error: 'Failed to create report configuration' },
        { status: 500 }
      )
    }
    
    // Add recipients if provided
    if (recipients.length > 0) {
      const recipientRecords = recipients.map((recipient: any) => ({
        report_configuration_id: configuration.id,
        email: recipient.email,
        name: recipient.name,
        delivery_method: recipient.delivery_method || 'email',
        webhook_url: recipient.webhook_url,
        sftp_credentials: recipient.sftp_credentials
      }))
      
      const { error: recipientError } = await supabase
        .from('report_recipients')
        .insert(recipientRecords)
      
      if (recipientError) {
        console.error('Error adding recipients:', recipientError)
        // Note: Configuration is already created, so we don't rollback
      }
    }
    
    // If it's an on-demand report, add it to the queue immediately
    if (frequency === 'on_demand') {
      const { error: queueError } = await supabase
        .from('report_queue')
        .insert({
          report_configuration_id: configuration.id,
          scheduled_for: new Date().toISOString(),
          priority: 8 // Higher priority for on-demand
        })
      
      if (queueError) {
        console.error('Error queueing on-demand report:', queueError)
      }
    }
    
    return NextResponse.json({
      success: true,
      configuration,
      message: frequency === 'on_demand' 
        ? 'Report created and queued for generation' 
        : `Report scheduled successfully. Next run: ${configuration.next_run_at || 'Not scheduled'}`
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}