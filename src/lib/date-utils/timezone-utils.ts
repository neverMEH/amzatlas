import { format, parseISO, startOfDay, endOfDay } from 'date-fns'
// Import as namespace to ensure proper function imports
import * as dateFnsTz from 'date-fns-tz'

const { formatInTimeZone, toZonedTime: utcToZonedTime, fromZonedTime: zonedTimeToUtc } = dateFnsTz

/**
 * Default timezone for the application
 * Amazon SQP data is typically in PST/PDT
 */
export const DEFAULT_TIMEZONE = 'America/Los_Angeles'

/**
 * Get the user's timezone or fall back to default
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/**
 * Convert a date to a specific timezone
 */
export function toTimezone(date: Date | string, timezone: string = DEFAULT_TIMEZONE): Date {
  const inputDate = typeof date === 'string' ? parseISO(date) : date
  return utcToZonedTime(inputDate, timezone)
}

/**
 * Convert a timezone date to UTC
 */
export function fromTimezone(date: Date | string, timezone: string = DEFAULT_TIMEZONE): Date {
  const inputDate = typeof date === 'string' ? parseISO(date) : date
  return zonedTimeToUtc(inputDate, timezone)
}

/**
 * Format a date in a specific timezone
 */
export function formatInTimezone(
  date: Date | string, 
  formatStr: string, 
  timezone: string = DEFAULT_TIMEZONE
): string {
  const inputDate = typeof date === 'string' ? parseISO(date) : date
  return formatInTimeZone(inputDate, timezone, formatStr)
}

/**
 * Get start of day in a specific timezone
 */
export function startOfDayInTimezone(
  date: Date | string, 
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const inputDate = typeof date === 'string' ? parseISO(date) : date
  const zonedDate = utcToZonedTime(inputDate, timezone)
  const startOfZonedDay = startOfDay(zonedDate)
  return zonedTimeToUtc(startOfZonedDay, timezone)
}

/**
 * Get end of day in a specific timezone
 */
export function endOfDayInTimezone(
  date: Date | string, 
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const inputDate = typeof date === 'string' ? parseISO(date) : date
  const zonedDate = utcToZonedTime(inputDate, timezone)
  const endOfZonedDay = endOfDay(zonedDate)
  return zonedTimeToUtc(endOfZonedDay, timezone)
}

/**
 * Check if DST is active for a date in a timezone
 */
export function isDST(date: Date | string, timezone: string = DEFAULT_TIMEZONE): boolean {
  const inputDate = typeof date === 'string' ? parseISO(date) : date
  const january = new Date(inputDate.getFullYear(), 0, 1)
  const july = new Date(inputDate.getFullYear(), 6, 1)
  
  const januaryOffset = formatInTimeZone(january, timezone, 'XXX')
  const julyOffset = formatInTimeZone(july, timezone, 'XXX')
  const currentOffset = formatInTimeZone(inputDate, timezone, 'XXX')
  
  const standardOffset = Math.max(
    parseInt(januaryOffset.replace(':', '')), 
    parseInt(julyOffset.replace(':', ''))
  )
  
  return parseInt(currentOffset.replace(':', '')) !== standardOffset
}

/**
 * Get a consistent date string for API calls (always in PST/PDT)
 */
export function toAPIDateString(date: Date | string): string {
  const inputDate = typeof date === 'string' ? parseISO(date) : date
  return format(toTimezone(inputDate, DEFAULT_TIMEZONE), 'yyyy-MM-dd')
}

/**
 * Parse a date string from API (assumes PST/PDT)
 */
export function fromAPIDateString(dateStr: string): Date {
  // Parse the date string as if it's in PST/PDT
  const parsed = parseISO(dateStr + 'T00:00:00')
  return fromTimezone(parsed, DEFAULT_TIMEZONE)
}

/**
 * Get current date in a specific timezone
 */
export function getCurrentDateInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  return toTimezone(new Date(), timezone)
}

/**
 * Compare dates ignoring time and timezone differences
 */
export function isSameDateInTimezone(
  date1: Date | string,
  date2: Date | string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const d1 = formatInTimezone(date1, 'yyyy-MM-dd', timezone)
  const d2 = formatInTimezone(date2, 'yyyy-MM-dd', timezone)
  return d1 === d2
}