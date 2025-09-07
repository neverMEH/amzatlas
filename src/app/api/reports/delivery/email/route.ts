import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reportGenerationService } from '@/services/reports/report-generation-service'
import { emailDeliveryService } from '@/services/reports/email-delivery-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const { configurationId, executionId, recipients } = body

    if (!configurationId && !executionId) {
      return NextResponse.json(
        { error: 'Either configurationId or executionId is required' },
        { status: 400 }
      )
    }

    // Fetch configuration and recipients
    let configuration
    let configRecipients = []

    if (executionId) {
      const { data: execution, error } = await supabase
        .from('report_execution_history')
        .select('*, report_configurations(*, report_recipients(*))')
        .eq('id', executionId)
        .single()

      if (error || !execution) {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        )
      }

      configuration = execution.report_configurations
      configRecipients = execution.report_configurations.report_recipients || []
    } else {
      const { data: config, error } = await supabase
        .from('report_configurations')
        .select('*, report_recipients(*)')
        .eq('id', configurationId)
        .single()

      if (error || !config) {
        return NextResponse.json(
          { error: 'Configuration not found' },
          { status: 404 }
        )
      }

      configuration = config
      configRecipients = config.report_recipients || []
    }

    // Use provided recipients or configuration recipients
    const emailRecipients = recipients || configRecipients
      .filter((r: any) => r.is_active && r.delivery_method === 'email')
      .map((r: any) => ({
        email: r.email,
        name: r.name
      }))

    if (emailRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No active email recipients found' },
        { status: 400 }
      )
    }

    // Generate report
    const report = await reportGenerationService.generateReport(configuration.id)

    // Send emails
    const result = await emailDeliveryService.sendReportEmail(
      report,
      emailRecipients,
      configuration.export_formats || ['pdf']
    )

    // Update delivery timestamps
    if (result.success) {
      const recipientEmails = emailRecipients.map((r: any) => r.email)
      await supabase
        .from('report_recipients')
        .update({ last_delivered_at: new Date().toISOString() })
        .eq('report_configuration_id', configuration.id)
        .in('email', recipientEmails)
    }

    // Create delivery log entry in execution history
    if (executionId) {
      const { data: execution } = await supabase
        .from('report_execution_history')
        .select('delivery_status')
        .eq('id', executionId)
        .single()

      const deliveryStatus = execution?.delivery_status || {}
      
      emailRecipients.forEach((recipient: any) => {
        deliveryStatus[recipient.email] = {
          status: result.success ? 'delivered' : 'failed',
          timestamp: new Date().toISOString(),
          error: result.errors?.find(e => e.includes(recipient.email))
        }
      })

      await supabase
        .from('report_execution_history')
        .update({ delivery_status: deliveryStatus })
        .eq('id', executionId)
    }

    return NextResponse.json({
      success: result.success,
      recipientCount: emailRecipients.length,
      errors: result.errors,
      message: result.success 
        ? `Report successfully sent to ${emailRecipients.length} recipient(s)` 
        : 'Failed to send report emails'
    })
  } catch (error) {
    console.error('Email Delivery Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deliver emails' },
      { status: 500 }
    )
  }
}

// Test email configuration
export async function GET(request: NextRequest) {
  try {
    const result = await emailDeliveryService.testConnection()
    
    return NextResponse.json({
      ...result,
      configured: result.success,
      service: process.env.SENDGRID_API_KEY ? 'SendGrid' : 
               process.env.SMTP_HOST ? 'SMTP' : 'None',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM || 'Not configured'
    })
  } catch (error) {
    console.error('Email Test Error:', error)
    return NextResponse.json(
      { 
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test email configuration',
        configured: false
      },
      { status: 500 }
    )
  }
}