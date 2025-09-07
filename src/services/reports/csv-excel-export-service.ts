import { GeneratedReport, ReportSection } from './report-generation-service'
import { stringify } from 'csv-stringify/sync'
import * as XLSX from 'xlsx'

export class CsvExcelExportService {
  async exportToCsv(report: GeneratedReport): Promise<Buffer> {
    const rows: any[] = []
    
    // Add report metadata
    rows.push(['Report Name', report.configuration.name])
    rows.push(['Generated At', new Date(report.metadata.generated_at).toISOString()])
    rows.push(['Period Start', new Date(report.metadata.period_start).toLocaleDateString()])
    rows.push(['Period End', new Date(report.metadata.period_end).toLocaleDateString()])
    rows.push([]) // Empty row
    
    // Process each section
    for (const section of report.sections) {
      rows.push([`=== ${section.title} ===`])
      
      const sectionData = this.extractSectionData(section)
      if (sectionData.length > 0) {
        // Add headers
        const headers = Object.keys(sectionData[0])
        rows.push(headers)
        
        // Add data rows
        sectionData.forEach(row => {
          rows.push(headers.map(header => {
            const value = row[header]
            // Format values appropriately
            if (typeof value === 'number') {
              return value
            } else if (value instanceof Date) {
              return value.toISOString()
            } else if (value === null || value === undefined) {
              return ''
            } else {
              return String(value)
            }
          }))
        })
      }
      
      rows.push([]) // Empty row between sections
    }
    
    // Convert to CSV using sync version
    const output = stringify(rows, {
      header: false,
      quoted: true,
      quoted_empty: false
    })
    
    return Buffer.from(output)
  }
  
  async exportToExcel(report: GeneratedReport): Promise<Buffer> {
    const workbook = XLSX.utils.book_new()
    
    // Create summary sheet
    const summaryData = [
      ['Report Name', report.configuration.name],
      ['Generated At', new Date(report.metadata.generated_at).toISOString()],
      ['Period Start', new Date(report.metadata.period_start).toLocaleDateString()],
      ['Period End', new Date(report.metadata.period_end).toLocaleDateString()],
      [],
      ['Report Type', report.configuration.report_type],
      ['Frequency', report.configuration.frequency],
    ]
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
    
    // Process each section as a separate sheet
    report.sections.forEach((section, index) => {
      const sheetName = this.sanitizeSheetName(section.title, index)
      const sectionData = this.extractSectionData(section)
      
      if (sectionData.length > 0) {
        // Create worksheet from data
        const worksheet = XLSX.utils.json_to_sheet(sectionData)
        
        // Apply formatting
        this.applyExcelFormatting(worksheet, sectionData)
        
        // Add to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      }
    })
    
    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    })
    
    return Buffer.from(excelBuffer)
  }
  
  private extractSectionData(section: ReportSection): any[] {
    const { data } = section
    
    if (!data) return []
    
    // Handle different data structures
    if (Array.isArray(data)) {
      return data
    }
    
    if (data.keywords && Array.isArray(data.keywords)) {
      return data.keywords
    }
    
    if (data.data && Array.isArray(data.data)) {
      return data.data
    }
    
    if (data.trends && Array.isArray(data.trends)) {
      return data.trends
    }
    
    if (data.anomalies && Array.isArray(data.anomalies)) {
      return data.anomalies
    }
    
    // Handle period comparison data
    if (data.topGainers || data.topDecliners) {
      const results: any[] = []
      
      if (data.topGainers) {
        data.topGainers.forEach((item: any) => {
          results.push({
            type: 'Gainer',
            ...item
          })
        })
      }
      
      if (data.topDecliners) {
        data.topDecliners.forEach((item: any) => {
          results.push({
            type: 'Decliner',
            ...item
          })
        })
      }
      
      return results
    }
    
    // Handle metrics/summary data
    if (data.metrics) {
      // Convert metrics object to array format
      return Object.entries(data.metrics).map(([key, value]) => ({
        metric: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value
      }))
    }
    
    // Handle single object data
    if (typeof data === 'object' && !Array.isArray(data)) {
      // Check if it has numeric properties that should be converted to rows
      const hasNumericProps = Object.values(data).some(v => typeof v === 'number')
      
      if (hasNumericProps) {
        return Object.entries(data).map(([key, value]) => ({
          metric: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value
        }))
      }
      
      // Otherwise, return as single row
      return [data]
    }
    
    return []
  }
  
  private sanitizeSheetName(name: string, index: number): string {
    // Excel sheet names have restrictions
    let sanitized = name
      .substring(0, 31) // Max 31 characters
      .replace(/[\\/:*?\[\]]/g, '') // Remove invalid characters
      .trim()
    
    // Ensure unique names
    if (!sanitized) {
      sanitized = `Sheet ${index + 1}`
    }
    
    return sanitized
  }
  
  private applyExcelFormatting(worksheet: XLSX.WorkSheet, data: any[]): void {
    if (data.length === 0) return
    
    // Get range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    
    // Style header row
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col })
      const cell = worksheet[cellRef]
      
      if (cell) {
        cell.s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E0E0E0' } },
          alignment: { horizontal: 'center' }
        }
      }
    }
    
    // Auto-size columns (estimate based on content)
    const columnWidths: number[] = []
    const headers = Object.keys(data[0] || {})
    
    headers.forEach((header, idx) => {
      let maxWidth = header.length
      
      data.forEach(row => {
        const value = String(row[header] || '')
        maxWidth = Math.max(maxWidth, value.length)
      })
      
      columnWidths[idx] = Math.min(maxWidth + 2, 50) // Cap at 50 characters
    })
    
    worksheet['!cols'] = columnWidths.map(width => ({ wch: width }))
    
    // Format numeric columns
    for (let row = 1; row <= data.length; row++) {
      const dataRow = data[row - 1]
      let col = 0
      
      for (const key of headers) {
        const value = dataRow[key]
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = worksheet[cellRef]
        
        if (cell && typeof value === 'number') {
          // Apply number formatting
          if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('pct')) {
            cell.z = '0.0%'
          } else if (key.toLowerCase().includes('price') || key.toLowerCase().includes('revenue')) {
            cell.z = '$#,##0.00'
          } else if (Number.isInteger(value)) {
            cell.z = '#,##0'
          } else {
            cell.z = '#,##0.00'
          }
        }
        
        col++
      }
    }
  }
}

export const csvExcelExportService = new CsvExcelExportService()