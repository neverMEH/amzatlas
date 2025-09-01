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
}

const dataAvailabilityCache = new DataAvailabilityCache();

export function getDataAvailabilityCache(): DataAvailabilityCache {
  return dataAvailabilityCache;
}

/**
 * Fetches data availability date ranges for a given ASIN
 */
export async function getASINDataAvailability(asin: string): Promise<DateRange[]> {
  // Check cache first
  const cached = dataAvailabilityCache.get(asin);
  if (cached) {
    return cached;
  }

  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('sqp.search_performance_summary')
    .select('start_date, end_date, COUNT(*) as record_count')
    .eq('asin', asin)
    .order('start_date', { ascending: true });

  if (error) {
    throw error;
  }

  const dateRanges = data || [];
  
  // Cache the results
  dataAvailabilityCache.set(asin, dateRanges);
  
  return dateRanges;
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