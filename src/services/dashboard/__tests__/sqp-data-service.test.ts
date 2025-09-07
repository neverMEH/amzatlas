import { describe, test, expect, vi } from 'vitest'
import { sqpDataService } from '../sqp-data-service'

// Mock the BigQuery client
vi.mock('@/lib/bigquery/client', () => ({
  createBigQueryClient: () => ({
    query: vi.fn().mockResolvedValue([[]]),
  }),
}))

describe('SQPDataService', () => {
  test('getPurchaseMetrics returns metrics data', async () => {
    const dateRange = {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-07'),
    }
    
    const metrics = await sqpDataService.getPurchaseMetrics(dateRange)
    
    expect(metrics).toHaveProperty('totalPurchases')
    expect(metrics).toHaveProperty('weekOverWeekChange')
    expect(metrics).toHaveProperty('marketShare')
    expect(metrics).toHaveProperty('purchaseCVR')
    expect(metrics).toHaveProperty('zeroPurchaseKeywords')
    expect(metrics).toHaveProperty('purchaseROI')
  })
  
  test('getTopKeywords returns keyword data', async () => {
    const keywords = await sqpDataService.getTopKeywords(5)
    
    expect(Array.isArray(keywords)).toBe(true)
    if (keywords.length > 0) {
      expect(keywords[0]).toHaveProperty('keyword')
      expect(keywords[0]).toHaveProperty('purchases')
      expect(keywords[0]).toHaveProperty('marketPurchases')
      expect(keywords[0]).toHaveProperty('share')
      expect(keywords[0]).toHaveProperty('cvr')
      expect(keywords[0]).toHaveProperty('spend')
      expect(keywords[0]).toHaveProperty('roi')
      expect(keywords[0]).toHaveProperty('trend')
    }
  })
  
  test('getPurchaseTrends returns trend data', async () => {
    const trends = await sqpDataService.getPurchaseTrends(12)
    
    expect(Array.isArray(trends)).toBe(true)
    if (trends.length > 0) {
      expect(trends[0]).toHaveProperty('week')
      expect(trends[0]).toHaveProperty('purchases')
      expect(trends[0]).toHaveProperty('market')
    }
  })
})