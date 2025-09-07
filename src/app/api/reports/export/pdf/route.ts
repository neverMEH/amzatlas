import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reportGenerationService } from '@/services/reports/report-generation-service'
import { pdfExportService } from '@/services/reports/pdf-export-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { configurationId, executionId } = body

    if (!configurationId && !executionId) {
      return NextResponse.json(
        { error: 'Either configurationId or executionId is required' },
        { status: 400 }
      )
    }

    // Generate or fetch report data
    let report
    
    if (executionId) {
      // Fetch existing execution data
      const supabase = createClient()
      const { data: execution, error } = await supabase
        .from('report_execution_history')
        .select('*, report_configurations(*)')
        .eq('id', executionId)
        .single()

      if (error || !execution) {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        )
      }

      // Re-generate report data (in production, this would be cached)
      report = await reportGenerationService.generateReport(execution.report_configuration_id)
    } else {
      // Generate new report
      report = await reportGenerationService.generateReport(configurationId)
    }

    // Generate PDF
    const pdfBuffer = await pdfExportService.generatePdf(report)

    // Return PDF as response
    // Convert Buffer to Uint8Array for Response
    const uint8Array = new Uint8Array(pdfBuffer)
    return new Response(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.configuration.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('PDF Export Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}

// Preview PDF in browser
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const configurationId = searchParams.get('configurationId')
    const executionId = searchParams.get('executionId')

    if (!configurationId && !executionId) {
      return NextResponse.json(
        { error: 'Either configurationId or executionId is required' },
        { status: 400 }
      )
    }

    // Generate or fetch report data
    let report
    
    if (executionId) {
      const supabase = createClient()
      const { data: execution, error } = await supabase
        .from('report_execution_history')
        .select('*, report_configurations(*)')
        .eq('id', executionId)
        .single()

      if (error || !execution) {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        )
      }

      report = await reportGenerationService.generateReport(execution.report_configuration_id)
    } else {
      report = await reportGenerationService.generateReport(configurationId!)
    }

    // Generate PDF
    const pdfBuffer = await pdfExportService.generatePdf(report)

    // Return PDF for preview
    // Convert Buffer to Uint8Array for Response
    const uint8Array = new Uint8Array(pdfBuffer)
    return new Response(uint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline', // Display in browser instead of downloading
      },
    })
  } catch (error) {
    console.error('PDF Preview Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}