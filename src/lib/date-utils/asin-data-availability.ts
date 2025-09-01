import { createClient } from '@/lib/supabase/server';
import { 
  startOfMonth, 
  endOfMonth, 
  format, 
  getDaysInMonth,
  isAfter,
  isBefore,
  parseISO,
  differenceInDays,
  subMonths
} from 'date-fns';

export interface DateRange {
  start_date: string;
  end_date: string;
  record_count: number;
}

export type DataGranularity = 'daily' | 'weekly';

export interface DataAvailabilityOptions {
  granularity?: DataGranularity;
  startDate?: string;
  endDate?: string;
}

export interface DailyDataAvailability {
  asin: string;
  year: number;
  month: number;
  dailyData: Record<string, number>; // date -> record count
  summary: {
    totalDays: number;
    totalRecords: number;
    density: number; // percentage of days with data
    hasData: boolean;
  };
}

export interface CompleteMonth {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

// Simple LRU cache for data availability
class DataAvailabilityCache {
  private cache: Map<string, { data: DateRange[], timestamp: number }> = new Map();
  private maxSize: number = 100;
  private ttl: number = 5 * 60 * 1000; // 5 minutes

  get(key: string): DateRange[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: DateRange[]): void {
    // Implement simple LRU eviction
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
  }

  static createKey(asin: string, options?: DataAvailabilityOptions): string {
    return JSON.stringify({ asin, ...options });
  }
}

const dataAvailabilityCache = new DataAvailabilityCache();

export function getDataAvailabilityCache(): DataAvailabilityCache {
  return dataAvailabilityCache;
}

/**
 * Fetches data availability date ranges for a given ASIN
 */
export async function getASINDataAvailability(
  asin: string, 
  options?: DataAvailabilityOptions
): Promise<DateRange[]> {
  const cacheKey = DataAvailabilityCache.createKey(asin, options);
  
  // Check cache first
  const cached = dataAvailabilityCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const supabase = createClient();
  
  // Build query
  let query = supabase
    .from('sqp.search_performance_summary')
    .select('start_date, end_date')
    .eq('asin', asin);
    
  // Apply date filters if provided
  if (options?.startDate) {
    query = query.gte('start_date', options.startDate);
  }
  if (options?.endDate) {
    query = query.lte('end_date', options.endDate);
  }
    
  query = query.order('start_date', { ascending: true });
  
  const { data, error } = await query;
  
  if (error) {
    throw error;
  }

  // Group by date range and count records
  const dateRangeMap = new Map<string, number>();
  
  if (options?.granularity === 'daily') {
    // For daily granularity, ensure each date is treated as a single day
    (data || []).forEach((row: { start_date: string; end_date: string }) => {
      // Extract just the date part (YYYY-MM-DD)
      const dateKey = row.start_date.split('T')[0];
      dateRangeMap.set(dateKey, (dateRangeMap.get(dateKey) || 0) + 1);
    });
    
    // Convert to array with same date for start and end
    const dateRanges = Array.from(dateRangeMap.entries()).map(([date, count]) => ({
      start_date: date,
      end_date: date,
      record_count: count
    })).sort((a, b) => a.start_date.localeCompare(b.start_date));
    
    // Cache the results
    dataAvailabilityCache.set(cacheKey, dateRanges);
    
    return dateRanges;
  } else {
    // Default weekly granularity - group by date range
    (data || []).forEach((row: { start_date: string; end_date: string }) => {
      const key = `${row.start_date}_${row.end_date}`;
      dateRangeMap.set(key, (dateRangeMap.get(key) || 0) + 1);
    });

    // Convert back to array format
    const dateRanges = Array.from(dateRangeMap.entries()).map(([key, count]) => {
      const [start_date, end_date] = key.split('_');
      return { start_date, end_date, record_count: count };
    }).sort((a, b) => a.start_date.localeCompare(b.start_date));
    
    // Cache the results
    dataAvailabilityCache.set(cacheKey, dateRanges);
    
    return dateRanges;
  }
}

/**
 * Checks if a month has complete data coverage
 */
export function isCompleteMonth(
  year: number, 
  month: number, 
  dateRanges: DateRange[],
  minRecordsThreshold: number = 50
): boolean {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const totalDaysInMonth = getDaysInMonth(monthStart);
  
  // Filter date ranges that overlap with this month
  const monthRanges = dateRanges.filter(range => {
    const rangeStart = parseISO(range.start_date);
    const rangeEnd = parseISO(range.end_date);
    
    return (
      (isAfter(rangeEnd, monthStart) || format(rangeEnd, 'yyyy-MM-dd') === format(monthStart, 'yyyy-MM-dd')) &&
      (isBefore(rangeStart, monthEnd) || format(rangeStart, 'yyyy-MM-dd') === format(monthEnd, 'yyyy-MM-dd'))
    );
  });
  
  if (monthRanges.length === 0) {
    return false;
  }
  
  // Check total records meet threshold
  const totalRecords = monthRanges.reduce((sum, range) => sum + range.record_count, 0);
  if (totalRecords < minRecordsThreshold) {
    return false;
  }
  
  // Calculate coverage by checking if we have data for all days
  const coveredDays = new Set<string>();
  
  monthRanges.forEach(range => {
    const rangeStart = parseISO(range.start_date);
    const rangeEnd = parseISO(range.end_date);
    
    // Adjust range to month boundaries
    const effectiveStart = isAfter(rangeStart, monthStart) ? rangeStart : monthStart;
    const effectiveEnd = isBefore(rangeEnd, monthEnd) ? rangeEnd : monthEnd;
    
    // Add all days in the range to the set
    let currentDate = effectiveStart;
    while (currentDate <= effectiveEnd) {
      coveredDays.add(format(currentDate, 'yyyy-MM-dd'));
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }
  });
  
  // Check if we have at least 90% coverage (allowing for some missing days)
  const coveragePercentage = coveredDays.size / totalDaysInMonth;
  return coveragePercentage >= 0.9;
}

/**
 * Finds the most recent month with complete data for an ASIN
 */
export async function findMostRecentCompleteMonth(asin: string): Promise<CompleteMonth | null> {
  const dateRanges = await getASINDataAvailability(asin);
  
  if (!dateRanges || dateRanges.length === 0) {
    return null;
  }
  
  // Get the latest date from the data
  const latestDate = dateRanges.reduce((latest, range) => {
    const rangeEnd = parseISO(range.end_date);
    return isAfter(rangeEnd, latest) ? rangeEnd : latest;
  }, parseISO(dateRanges[0].end_date));
  
  // Start from the month of the latest data and work backwards
  let checkDate = startOfMonth(latestDate);
  const earliestDate = parseISO(dateRanges[0].start_date);
  
  // Don't check the current month if we're still in it
  const currentMonthStart = startOfMonth(new Date());
  if (format(checkDate, 'yyyy-MM') === format(currentMonthStart, 'yyyy-MM')) {
    checkDate = subMonths(checkDate, 1);
  }
  
  // Check up to 24 months back
  let monthsChecked = 0;
  while (monthsChecked < 24 && !isBefore(checkDate, earliestDate)) {
    const year = checkDate.getFullYear();
    const month = checkDate.getMonth() + 1;
    
    if (isCompleteMonth(year, month, dateRanges)) {
      return {
        year,
        month,
        startDate: format(startOfMonth(checkDate), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(checkDate), 'yyyy-MM-dd')
      };
    }
    
    checkDate = subMonths(checkDate, 1);
    monthsChecked++;
  }
  
  return null;
}

/**
 * Get a fallback date range when no complete month is available
 */
export function getFallbackDateRange(dateRanges: DateRange[]): { startDate: string; endDate: string } | null {
  if (!dateRanges || dateRanges.length === 0) {
    return null;
  }
  
  // Sort by end date descending to get the most recent data
  const sortedRanges = [...dateRanges].sort((a, b) => 
    parseISO(b.end_date).getTime() - parseISO(a.end_date).getTime()
  );
  
  // Try to get the last 30 days of available data
  const latestEnd = parseISO(sortedRanges[0].end_date);
  const thirtyDaysAgo = new Date(latestEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Find ranges that cover this period
  const relevantRanges = sortedRanges.filter(range => 
    isAfter(parseISO(range.end_date), thirtyDaysAgo)
  );
  
  if (relevantRanges.length > 0) {
    const earliestStart = relevantRanges.reduce((earliest, range) => {
      const rangeStart = parseISO(range.start_date);
      return isBefore(rangeStart, earliest) ? rangeStart : earliest;
    }, parseISO(relevantRanges[0].start_date));
    
    return {
      startDate: format(earliestStart, 'yyyy-MM-dd'),
      endDate: format(latestEnd, 'yyyy-MM-dd')
    };
  }
  
  // If we can't get 30 days, just return the most recent week
  return {
    startDate: sortedRanges[0].start_date,
    endDate: sortedRanges[0].end_date
  };
}

/**
 * Fetches daily-level data availability for a specific month
 */
export async function getASINMonthlyDataAvailability(
  asin: string,
  year: number,
  month: number
): Promise<DailyDataAvailability> {
  const monthStart = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  
  // Create cache key for monthly data
  const cacheKey = DataAvailabilityCache.createKey(asin, {
    granularity: 'daily',
    startDate: monthStart,
    endDate: monthEnd
  });
  
  // Check cache first
  const cached = dataAvailabilityCache.get(cacheKey);
  
  let dateRanges: DateRange[];
  
  if (cached) {
    dateRanges = cached;
  } else {
    // Fetch daily data for the month
    dateRanges = await getASINDataAvailability(asin, {
      granularity: 'daily',
      startDate: monthStart,
      endDate: monthEnd
    });
  }
  
  // Build daily data map
  const dailyData: Record<string, number> = {};
  let totalRecords = 0;
  
  dateRanges.forEach(range => {
    const date = range.start_date; // For daily data, start_date === end_date
    dailyData[date] = range.record_count;
    totalRecords += range.record_count;
  });
  
  const totalDays = Object.keys(dailyData).length;
  const density = totalDays / daysInMonth;
  
  return {
    asin,
    year,
    month,
    dailyData,
    summary: {
      totalDays,
      totalRecords,
      density,
      hasData: totalDays > 0
    }
  };
}