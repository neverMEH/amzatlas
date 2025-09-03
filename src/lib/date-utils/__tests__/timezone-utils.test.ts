import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_TIMEZONE,
  getUserTimezone,
  toTimezone,
  fromTimezone,
  formatInTimezone,
  startOfDayInTimezone,
  endOfDayInTimezone,
  isDST,
  toAPIDateString,
  fromAPIDateString,
  getCurrentDateInTimezone,
  isSameDateInTimezone,
} from '../timezone-utils'

describe('Timezone Utilities', () => {
  // Mock current date to September 3, 2025 12:00 PM UTC
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-03T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Constants and Defaults', () => {
    it('should use PST/PDT as default timezone', () => {
      expect(DEFAULT_TIMEZONE).toBe('America/Los_Angeles')
    })
  })

  describe('getUserTimezone', () => {
    it('should return user timezone when available', () => {
      const mockTimeZone = 'America/New_York'
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
        timeZone: mockTimeZone,
      } as any)
      
      expect(getUserTimezone()).toBe(mockTimeZone)
    })

    it('should fallback to default timezone on error', () => {
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
        throw new Error('Not supported')
      })
      
      expect(getUserTimezone()).toBe(DEFAULT_TIMEZONE)
    })
  })

  describe('toTimezone and fromTimezone', () => {
    it('should convert UTC to PST correctly', () => {
      // September 3, 2025 12:00 PM UTC = 5:00 AM PST (PDT active)
      const utcDate = new Date('2025-09-03T12:00:00Z')
      const pstDate = toTimezone(utcDate)
      
      expect(formatInTimezone(pstDate, 'yyyy-MM-dd HH:mm')).toBe('2025-09-03 05:00')
    })

    it('should convert PST to UTC correctly', () => {
      // September 3, 2025 5:00 AM PST
      const pstDate = new Date('2025-09-03T05:00:00')
      const utcDate = fromTimezone(pstDate)
      
      // Should be 12:00 PM UTC
      expect(utcDate.toISOString()).toBe('2025-09-03T12:00:00.000Z')
    })

    it('should handle string inputs', () => {
      const dateStr = '2025-09-03T12:00:00Z'
      const pstDate = toTimezone(dateStr)
      
      expect(formatInTimezone(pstDate, 'yyyy-MM-dd HH:mm')).toBe('2025-09-03 05:00')
    })
  })

  describe('formatInTimezone', () => {
    it('should format date in specified timezone', () => {
      const utcDate = new Date('2025-09-03T12:00:00Z')
      
      // PST formatting
      expect(formatInTimezone(utcDate, 'yyyy-MM-dd HH:mm', 'America/Los_Angeles'))
        .toBe('2025-09-03 05:00')
      
      // EST formatting
      expect(formatInTimezone(utcDate, 'yyyy-MM-dd HH:mm', 'America/New_York'))
        .toBe('2025-09-03 08:00')
      
      // Default (PST)
      expect(formatInTimezone(utcDate, 'yyyy-MM-dd HH:mm'))
        .toBe('2025-09-03 05:00')
    })
  })

  describe('startOfDayInTimezone and endOfDayInTimezone', () => {
    it('should calculate start of day in PST', () => {
      // September 3, 2025 2:00 PM UTC
      const date = new Date('2025-09-03T14:00:00Z')
      const startOfDayPST = startOfDayInTimezone(date)
      
      // Start of day PST (00:00) = 7:00 AM UTC
      expect(startOfDayPST.toISOString()).toBe('2025-09-03T07:00:00.000Z')
    })

    it('should calculate end of day in PST', () => {
      // September 3, 2025 2:00 PM UTC
      const date = new Date('2025-09-03T14:00:00Z')
      const endOfDayPST = endOfDayInTimezone(date)
      
      // End of day PST (23:59:59.999) = 6:59:59.999 AM UTC next day
      expect(endOfDayPST.toISOString()).toBe('2025-09-04T06:59:59.999Z')
    })

    it('should handle date boundary correctly', () => {
      // UTC date that's different day in PST
      // September 3, 2025 2:00 AM UTC = September 2, 2025 7:00 PM PST
      const date = new Date('2025-09-03T02:00:00Z')
      const startOfDayPST = startOfDayInTimezone(date)
      
      // Should be start of September 2 in PST
      expect(formatInTimezone(startOfDayPST, 'yyyy-MM-dd HH:mm'))
        .toBe('2025-09-02 00:00')
    })
  })

  describe('isDST', () => {
    it('should detect DST correctly', () => {
      // September (DST active in PST)
      expect(isDST(new Date('2025-09-03T12:00:00Z'))).toBe(true)
      
      // December (DST not active in PST)
      expect(isDST(new Date('2025-12-03T12:00:00Z'))).toBe(false)
      
      // March (transition month)
      expect(isDST(new Date('2025-03-15T12:00:00Z'))).toBe(true)
    })
  })

  describe('toAPIDateString and fromAPIDateString', () => {
    it('should convert to API date string in PST', () => {
      // UTC times that cross date boundary
      expect(toAPIDateString(new Date('2025-09-03T06:59:00Z'))).toBe('2025-09-02') // Still Sep 2 in PST
      expect(toAPIDateString(new Date('2025-09-03T07:00:00Z'))).toBe('2025-09-03') // Sep 3 in PST
      expect(toAPIDateString(new Date('2025-09-03T23:59:00Z'))).toBe('2025-09-03') // Still Sep 3 in PST
    })

    it('should parse API date string as PST', () => {
      const date = fromAPIDateString('2025-09-03')
      
      // Should be September 3, 2025 00:00 PST = 07:00 UTC
      expect(date.toISOString()).toBe('2025-09-03T07:00:00.000Z')
      expect(formatInTimezone(date, 'yyyy-MM-dd HH:mm')).toBe('2025-09-03 00:00')
    })

    it('should round-trip correctly', () => {
      const originalDateStr = '2025-09-03'
      const parsed = fromAPIDateString(originalDateStr)
      const formatted = toAPIDateString(parsed)
      
      expect(formatted).toBe(originalDateStr)
    })
  })

  describe('getCurrentDateInTimezone', () => {
    it('should get current date in PST', () => {
      // Current time is September 3, 2025 12:00 PM UTC = 5:00 AM PST
      const currentPST = getCurrentDateInTimezone()
      
      expect(formatInTimezone(currentPST, 'yyyy-MM-dd HH:mm')).toBe('2025-09-03 05:00')
    })

    it('should get current date in different timezone', () => {
      const currentEST = getCurrentDateInTimezone('America/New_York')
      
      expect(formatInTimezone(currentEST, 'yyyy-MM-dd HH:mm', 'America/New_York'))
        .toBe('2025-09-03 08:00')
    })
  })

  describe('isSameDateInTimezone', () => {
    it('should compare dates ignoring time', () => {
      const date1 = new Date('2025-09-03T08:00:00Z') // 1 AM PST
      const date2 = new Date('2025-09-03T22:00:00Z') // 3 PM PST
      
      expect(isSameDateInTimezone(date1, date2)).toBe(true)
    })

    it('should handle dates across timezone boundary', () => {
      const date1 = new Date('2025-09-03T06:00:00Z') // Sep 2 11 PM PST
      const date2 = new Date('2025-09-03T08:00:00Z') // Sep 3 1 AM PST
      
      expect(isSameDateInTimezone(date1, date2)).toBe(false)
    })

    it('should work with string inputs', () => {
      expect(isSameDateInTimezone('2025-09-03', '2025-09-03T23:59:59Z')).toBe(true)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle week calculation across DST boundary', () => {
      // Test week that includes DST change (March 9, 2025)
      const dstWeekStart = new Date('2025-03-09T08:00:00Z') // March 9, 00:00 PST
      const weekStart = toAPIDateString(dstWeekStart)
      
      expect(weekStart).toBe('2025-03-09')
    })

    it('should maintain consistency for API calls', () => {
      // Simulate user in different timezone selecting a date
      const userInNYC = new Date('2025-09-03T04:00:00Z') // Midnight in NYC
      
      // Convert to API format (should be Sep 2 in PST)
      const apiDate = toAPIDateString(userInNYC)
      expect(apiDate).toBe('2025-09-02')
      
      // Parse back from API
      const parsed = fromAPIDateString(apiDate)
      expect(formatInTimezone(parsed, 'yyyy-MM-dd')).toBe('2025-09-02')
    })
  })
})