import { describe, it, expect } from 'vitest'
import { 
  shouldAggregateKeywords, 
  aggregateSearchQueries,
  transformSearchQueryData 
} from '../keyword-aggregation'

describe('Keyword Aggregation Utilities', () => {
  describe('shouldAggregateKeywords', () => {
    it('should return true for date ranges > 7 days', () => {
      expect(shouldAggregateKeywords('2024-01-01', '2024-01-09')).toBe(true)
      expect(shouldAggregateKeywords('2024-01-01', '2024-01-15')).toBe(true)
      expect(shouldAggregateKeywords('2024-01-01', '2024-02-01')).toBe(true)
    })

    it('should return false for date ranges <= 7 days', () => {
      expect(shouldAggregateKeywords('2024-01-01', '2024-01-07')).toBe(false)
      expect(shouldAggregateKeywords('2024-01-01', '2024-01-08')).toBe(false)
      expect(shouldAggregateKeywords('2024-01-01', '2024-01-05')).toBe(false)
    })
  })

  describe('aggregateSearchQueries', () => {
    it('should aggregate multiple weeks of the same keyword', () => {
      const data = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          cart_adds: 50,
          purchases: 10,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          cart_add_rate: 0.5,
          purchase_rate: 0.2,
          impression_share: 0.2,
          click_share: 0.25,
          purchase_share: 0.3,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 1500,
          clicks: 120,
          cart_adds: 60,
          purchases: 15,
          click_through_rate: 0.08,
          conversion_rate: 0.125,
          cart_add_rate: 0.5,
          purchase_rate: 0.25,
          impression_share: 0.25,
          click_share: 0.3,
          purchase_share: 0.35,
        },
      ]

      const result = aggregateSearchQueries(data)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        searchQuery: 'knife sharpener',
        impressions: 2500,
        clicks: 220,
        cartAdds: 110,
        purchases: 25,
      })

      // Check recalculated rates
      expect(result[0].ctr).toBeCloseTo(220 / 2500, 4)
      expect(result[0].cvr).toBeCloseTo(25 / 220, 4)
      expect(result[0].cartAddRate).toBeCloseTo(110 / 220, 4)
      expect(result[0].purchaseRate).toBeCloseTo(25 / 110, 4)
    })

    it('should calculate weighted averages for share metrics', () => {
      const data = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          cart_adds: 50,
          purchases: 10,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          cart_add_rate: 0.5,
          purchase_rate: 0.2,
          impression_share: 0.2, // 20% share with 1000 impressions
          click_share: 0.25,
          purchase_share: 0.3,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 2000,
          clicks: 200,
          cart_adds: 100,
          purchases: 20,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          cart_add_rate: 0.5,
          purchase_rate: 0.2,
          impression_share: 0.4, // 40% share with 2000 impressions
          click_share: 0.35,
          purchase_share: 0.45,
        },
      ]

      const result = aggregateSearchQueries(data)

      // Weighted average for impression share: (0.2 * 1000 + 0.4 * 2000) / 3000 = 0.333...
      expect(result[0].impressionShare).toBeCloseTo(0.333, 3)
      
      // Weighted average for click share: (0.25 * 100 + 0.35 * 200) / 300 = 0.3166...
      expect(result[0].clickShare).toBeCloseTo(0.3167, 3)
      
      // Weighted average for purchase share: (0.3 * 10 + 0.45 * 20) / 30 = 0.4
      expect(result[0].purchaseShare).toBeCloseTo(0.4, 3)
    })

    it('should handle multiple different keywords', () => {
      const data = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          cart_adds: 50,
          purchases: 10,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          cart_add_rate: 0.5,
          purchase_rate: 0.2,
          impression_share: 0.4,
          click_share: 0.4,
          purchase_share: 0.4,
        },
        {
          search_query: 'sharpening stone',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 800,
          clicks: 60,
          cart_adds: 30,
          purchases: 5,
          click_through_rate: 0.075,
          conversion_rate: 0.083,
          cart_add_rate: 0.5,
          purchase_rate: 0.167,
          impression_share: 0.32,
          click_share: 0.3,
          purchase_share: 0.25,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 1200,
          clicks: 110,
          cart_adds: 55,
          purchases: 12,
          click_through_rate: 0.092,
          conversion_rate: 0.109,
          cart_add_rate: 0.5,
          purchase_rate: 0.218,
          impression_share: 0.45,
          click_share: 0.45,
          purchase_share: 0.48,
        },
      ]

      const result = aggregateSearchQueries(data)

      expect(result).toHaveLength(2)
      
      const knifeSharpener = result.find(r => r.searchQuery === 'knife sharpener')
      expect(knifeSharpener).toMatchObject({
        impressions: 2200,
        clicks: 210,
        cartAdds: 105,
        purchases: 22,
      })

      const sharpeningStone = result.find(r => r.searchQuery === 'sharpening stone')
      expect(sharpeningStone).toMatchObject({
        impressions: 800,
        clicks: 60,
        cartAdds: 30,
        purchases: 5,
      })
    })

    it('should sort results by impressions descending', () => {
      const data = [
        {
          search_query: 'low volume',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 100,
          clicks: 10,
          cart_adds: 5,
          purchases: 1,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          cart_add_rate: 0.5,
          purchase_rate: 0.2,
          impression_share: 0.01,
          click_share: 0.01,
          purchase_share: 0.01,
        },
        {
          search_query: 'high volume',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 5000,
          clicks: 500,
          cart_adds: 250,
          purchases: 50,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          cart_add_rate: 0.5,
          purchase_rate: 0.2,
          impression_share: 0.5,
          click_share: 0.5,
          purchase_share: 0.5,
        },
      ]

      const result = aggregateSearchQueries(data)

      expect(result[0].searchQuery).toBe('high volume')
      expect(result[1].searchQuery).toBe('low volume')
    })

    it('should handle empty data', () => {
      const result = aggregateSearchQueries([])
      expect(result).toEqual([])
    })

    it('should handle division by zero gracefully', () => {
      const data = [
        {
          search_query: 'no conversions',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 0,
          cart_adds: 0,
          purchases: 0,
          click_through_rate: 0,
          conversion_rate: 0,
          cart_add_rate: 0,
          purchase_rate: 0,
          impression_share: 0.1,
          click_share: 0,
          purchase_share: 0,
        },
      ]

      const result = aggregateSearchQueries(data)

      expect(result[0]).toMatchObject({
        ctr: 0,
        cvr: 0,
        cartAddRate: 0,
        purchaseRate: 0,
        impressionShare: 0.1,
        clickShare: 0,
        purchaseShare: 0,
      })
    })
  })

  describe('transformSearchQueryData', () => {
    it('should transform raw database data to expected format', () => {
      const rawData = [
        {
          search_query: 'test query',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          cart_adds: 50,
          purchases: 10,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          cart_add_rate: 0.5,
          purchase_rate: 0.2,
          impression_share: 0.2,
          click_share: 0.25,
          cart_add_share: 0.15,
          purchase_share: 0.3,
        },
      ]

      const result = transformSearchQueryData(rawData)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(rawData[0])
    })

    it('should handle missing fields with defaults', () => {
      const rawData = [
        {
          search_query: 'test query',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
        },
      ]

      const result = transformSearchQueryData(rawData)

      expect(result[0]).toMatchObject({
        search_query: 'test query',
        impressions: 0,
        clicks: 0,
        cart_adds: 0,
        purchases: 0,
        click_through_rate: 0,
        conversion_rate: 0,
        cart_add_rate: 0,
        purchase_rate: 0,
        impression_share: 0,
        click_share: 0,
        purchase_share: 0,
      })
    })
  })
})