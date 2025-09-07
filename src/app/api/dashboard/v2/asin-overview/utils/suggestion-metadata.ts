import { createClient } from '@/lib/supabase/server'
import { 
  calculateComparisonPeriod, 
  detectPeriodType,
  isValidComparisonPeriod,
  ComparisonMode,
  DateRange,
  ComparisonPeriod,
} from '@/lib/date-utils/comparison-period'
import { differenceInDays, parseISO } from 'date-fns'

export interface SuggestionMetadata {
  period: ComparisonPeriod
  dataAvailability: {
    hasData: boolean
    recordCount: number
    coverage: number // percentage of days with data
    dataQuality: 'high' | 'medium' | 'low'
  }
  confidence: {
    score: number // 0-100
    factors: {
      dataCompleteness: number
      recency: number
      periodAlignment: number
      seasonalRelevance: number
    }
  }
  warnings: string[]
}

export interface ComparisonSuggestions {
  suggestions: SuggestionMetadata[]
  selectedSuggestion?: SuggestionMetadata
  recommendedMode: ComparisonMode
}

/**
 * Generate smart comparison suggestions for a given date range and ASIN
 */
export async function generateComparisonSuggestions(
  asin: string,
  dateRange: DateRange
): Promise<ComparisonSuggestions> {
  const supabase = createClient()
  const periodType = detectPeriodType(dateRange)
  const suggestions: SuggestionMetadata[] = []

  // Generate potential comparison periods
  const modes: ComparisonMode[] = ['period-over-period', 'month-over-month', 'year-over-year']
  
  for (const mode of modes) {
    const period = calculateComparisonPeriod(dateRange, mode)
    
    if (!isValidComparisonPeriod(dateRange, period)) {
      continue
    }

    // Check data availability for this period
    const availability = await checkDataAvailability(supabase, asin, period)
    const confidence = calculateConfidence(dateRange, period, availability)
    const warnings = generateWarnings(period, availability)

    suggestions.push({
      period,
      dataAvailability: availability,
      confidence,
      warnings,
    })
  }

  // Sort by confidence score
  suggestions.sort((a, b) => b.confidence.score - a.confidence.score)

  // Determine recommended mode based on best confidence
  const recommendedMode = suggestions[0] ? 
    (suggestions[0].period.label.includes('Previous') ? 'period-over-period' :
     suggestions[0].period.label.includes('Month') ? 'month-over-month' : 
     'year-over-year') : 'auto'

  return {
    suggestions: suggestions.slice(0, 4), // Top 4 suggestions
    recommendedMode,
  }
}

/**
 * Check data availability for a specific period
 */
async function checkDataAvailability(
  supabase: any,
  asin: string,
  period: ComparisonPeriod
): Promise<SuggestionMetadata['dataAvailability']> {
  // Check if we have data for this period
  const { data, error } = await supabase
    .from('search_performance_summary')
    .select('start_date, end_date', { count: 'exact' })
    .eq('asin', asin)
    .gte('start_date', period.start)
    .lte('end_date', period.end)

  if (error || !data) {
    return {
      hasData: false,
      recordCount: 0,
      coverage: 0,
      dataQuality: 'low',
    }
  }

  const recordCount = data.length
  const totalDays = differenceInDays(parseISO(period.end), parseISO(period.start)) + 1
  const coverage = (recordCount / totalDays) * 100

  // Determine data quality based on coverage
  const dataQuality = coverage >= 90 ? 'high' : coverage >= 70 ? 'medium' : 'low'

  return {
    hasData: recordCount > 0,
    recordCount,
    coverage,
    dataQuality,
  }
}

/**
 * Calculate confidence score for a comparison suggestion
 */
function calculateConfidence(
  mainRange: DateRange,
  comparisonPeriod: ComparisonPeriod,
  availability: SuggestionMetadata['dataAvailability']
): SuggestionMetadata['confidence'] {
  // Data completeness factor (0-25 points)
  const dataCompleteness = availability.hasData ? 
    Math.min(25, (availability.coverage / 100) * 25) : 0

  // Recency factor (0-25 points) - more recent comparisons are better
  const daysSinceComparison = differenceInDays(
    parseISO(mainRange.start),
    parseISO(comparisonPeriod.end)
  )
  const recency = Math.max(0, 25 - (daysSinceComparison / 30) * 5)

  // Period alignment factor (0-25 points) - same duration is better
  const mainDuration = differenceInDays(parseISO(mainRange.end), parseISO(mainRange.start)) + 1
  const compDuration = differenceInDays(parseISO(comparisonPeriod.end), parseISO(comparisonPeriod.start)) + 1
  const durationDiff = Math.abs(mainDuration - compDuration)
  const periodAlignment = durationDiff === 0 ? 25 : Math.max(0, 25 - durationDiff * 2)

  // Seasonal relevance factor (0-25 points)
  const seasonalRelevance = calculateSeasonalRelevance(mainRange, comparisonPeriod)

  const totalScore = dataCompleteness + recency + periodAlignment + seasonalRelevance

  return {
    score: Math.round(totalScore),
    factors: {
      dataCompleteness: Math.round(dataCompleteness),
      recency: Math.round(recency),
      periodAlignment: Math.round(periodAlignment),
      seasonalRelevance: Math.round(seasonalRelevance),
    },
  }
}

/**
 * Calculate seasonal relevance score
 */
function calculateSeasonalRelevance(
  mainRange: DateRange,
  comparisonPeriod: ComparisonPeriod
): number {
  const mainStart = parseISO(mainRange.start)
  const compStart = parseISO(comparisonPeriod.start)

  // Same month across years gets high relevance
  if (mainStart.getMonth() === compStart.getMonth()) {
    return 25
  }

  // Same quarter gets medium relevance
  const mainQuarter = Math.floor(mainStart.getMonth() / 3)
  const compQuarter = Math.floor(compStart.getMonth() / 3)
  if (mainQuarter === compQuarter) {
    return 15
  }

  // Adjacent months get some relevance
  const monthDiff = Math.abs(mainStart.getMonth() - compStart.getMonth())
  if (monthDiff === 1 || monthDiff === 11) {
    return 10
  }

  return 5
}

/**
 * Generate warnings for a comparison suggestion
 */
function generateWarnings(
  period: ComparisonPeriod,
  availability: SuggestionMetadata['dataAvailability']
): string[] {
  const warnings: string[] = []

  if (!availability.hasData) {
    warnings.push('No data available for this comparison period')
  } else if (availability.coverage < 50) {
    warnings.push(`Limited data coverage (${Math.round(availability.coverage)}%)`)
  } else if (availability.coverage < 80) {
    warnings.push(`Partial data coverage (${Math.round(availability.coverage)}%)`)
  }

  // Check if period is very old
  const periodEnd = parseISO(period.end)
  const daysSinceEnd = differenceInDays(new Date(), periodEnd)
  if (daysSinceEnd > 365) {
    warnings.push('Comparison period is over 1 year old')
  } else if (daysSinceEnd > 180) {
    warnings.push('Comparison period is over 6 months old')
  }

  // Check for special periods
  const month = periodEnd.getMonth()
  if (month === 11) {
    warnings.push('Includes holiday shopping season')
  } else if (month === 6) {
    warnings.push('May include Prime Day activity')
  }

  return warnings
}

/**
 * Check if the selected comparison period has sufficient data
 */
export async function validateComparisonPeriod(
  asin: string,
  mainRange: DateRange,
  comparisonRange: DateRange
): Promise<{
  isValid: boolean
  metadata?: SuggestionMetadata
  errors?: string[]
}> {
  const supabase = createClient()
  
  // Create a comparison period object from the date range
  const comparisonPeriod: ComparisonPeriod = {
    start: comparisonRange.start,
    end: comparisonRange.end,
    type: detectPeriodType(comparisonRange),
    label: 'Selected Period',
  }

  // Validate the period
  if (!isValidComparisonPeriod(mainRange, comparisonPeriod)) {
    return {
      isValid: false,
      errors: ['Invalid comparison period selected'],
    }
  }

  // Check data availability
  const availability = await checkDataAvailability(supabase, asin, comparisonPeriod)
  const confidence = calculateConfidence(mainRange, comparisonPeriod, availability)
  const warnings = generateWarnings(comparisonPeriod, availability)

  const metadata: SuggestionMetadata = {
    period: comparisonPeriod,
    dataAvailability: availability,
    confidence,
    warnings,
  }

  if (!availability.hasData) {
    return {
      isValid: false,
      metadata,
      errors: ['No data available for the selected comparison period'],
    }
  }

  if (availability.coverage < 25) {
    return {
      isValid: false,
      metadata,
      errors: ['Insufficient data coverage for meaningful comparison'],
    }
  }

  return {
    isValid: true,
    metadata,
  }
}