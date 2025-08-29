import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reportGenerationService } from '@/services/reports/report-generation-service'
import { csvExcelExportService } from '@/services/reports/csv-excel-export-service'

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

      // Re-generate report data
      report = await reportGenerationService.generateReport(execution.report_configuration_id)
    } else {
      // Generate new report
      report = await reportGenerationService.generateReport(configurationId)
    }

    // Generate CSV
    const csvBuffer = await csvExcelExportService.exportToCsv(report)

    // Return CSV as response
    // Convert Buffer to string for Response
    const csvString = csvBuffer.toString()
    return new Response(csvString, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${report.configuration.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv"`,
        'Content-Length': csvString.length.toString(),
      },
    })
  } catch (error) {
    console.error('CSV Export Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate CSV' },
      { status: 500 }
    )
  }
}