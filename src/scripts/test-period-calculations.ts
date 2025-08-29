#!/usr/bin/env tsx
/**
 * Test script for period-over-period calculations
 * Validates the reporting engine functions with actual data
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import chalk from 'chalk'

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function testPeriodComparisons() {
  console.log(chalk.blue('\n=== Testing Period Comparison Functions ===\n'))
  
  try {
    // Get a sample brand for testing
    const { data: brands, error: brandError } = await supabase
      .from('brands')
      .select('id, brand_name')
      .neq('brand_name', 'Unknown')
      .limit(1)
    
    if (brandError) throw brandError
    if (!brands || brands.length === 0) {
      console.log(chalk.yellow('No brands found for testing'))
      return
    }
    
    const testBrandId = brands[0].id
    const testBrandName = brands[0].brand_name
    
    console.log(chalk.gray('Testing with brand:'), testBrandName)
    console.log()
    
    // Test weekly comparison
    console.log(chalk.blue('1. Weekly Period Comparison'))
    const { data: weeklyData, error: weeklyError } = await supabase
      .rpc('get_period_comparison', {
        p_period_type: 'week',
        p_brand_id: testBrandId
      })
    
    if (weeklyError) throw weeklyError
    
    if (weeklyData && weeklyData.length > 0) {
      console.log(chalk.gray('Latest 3 weeks:'))
      weeklyData.slice(0, 3).forEach(week => {
        console.log(`  ${week.period_label}: ${week.total_impressions} impressions, ${week.total_purchases} purchases`)
        if (week.impressions_change_pct !== null) {
          console.log(`    Change: ${week.impressions_change_pct > 0 ? '+' : ''}${week.impressions_change_pct}%`)
        }
      })
    }
    
    // Test monthly comparison
    console.log(chalk.blue('\n2. Monthly Period Comparison'))
    const { data: monthlyData, error: monthlyError } = await supabase
      .rpc('get_period_comparison', {
        p_period_type: 'month',
        p_brand_id: testBrandId
      })
    
    if (monthlyError) throw monthlyError
    
    if (monthlyData && monthlyData.length > 0) {
      console.log(chalk.gray('Latest 3 months:'))
      monthlyData.slice(0, 3).forEach(month => {
        console.log(`  ${month.period_label}: Revenue $${month.total_revenue}`)
        if (month.revenue_change_pct !== null) {
          console.log(`    MoM Change: ${month.revenue_change_pct > 0 ? '+' : ''}${month.revenue_change_pct}%`)
        }
      })
    }
    
    // Test performance summary
    console.log(chalk.blue('\n3. Period Performance Summary'))
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_period_performance_summary', {
        p_brand_id: testBrandId
      })
    
    if (summaryError) throw summaryError
    
    if (summary && summary.length > 0) {
      summary.forEach(s => {
        console.log(chalk.gray(`${s.period_type}:`))
        console.log(`  Latest: ${s.latest_period_label} - $${s.latest_period_revenue}`)
        console.log(`  Growth: ${s.period_over_period_growth > 0 ? '+' : ''}${s.period_over_period_growth}%`)
        console.log(`  Best: ${s.best_performing_period}`)
        console.log(`  Average: $${Math.round(s.avg_period_revenue)}`)
        console.log()
      })
    }
    
  } catch (error) {
    console.error(chalk.red('Error testing period comparisons:'), error)
  }
}

async function testRollingAverages() {
  console.log(chalk.blue('\n=== Testing Rolling Average Calculations ===\n'))
  
  try {
    // Get keyword trends for a brand
    const { data: trends, error } = await supabase
      .rpc('analyze_keyword_trends', {
        p_weeks: 12,
        p_min_impressions: 1000
      })
    
    if (error) throw error
    
    if (trends && trends.length > 0) {
      // Group by trend classification
      const trendGroups = trends.reduce((acc, trend) => {
        if (!acc[trend.trend_classification]) {
          acc[trend.trend_classification] = []
        }
        acc[trend.trend_classification].push(trend)
        return acc
      }, {} as Record<string, typeof trends>)
      
      console.log(chalk.gray('Trend Distribution:'))
      Object.entries(trendGroups).forEach(([classification, keywords]) => {
        console.log(`  ${classification}: ${keywords.length} keywords`)
      })
      
      console.log(chalk.blue('\nTop 3 Emerging Keywords:'))
      const emerging = trendGroups['emerging'] || []
      emerging.slice(0, 3).forEach(kw => {
        console.log(`  "${kw.search_query}"`)
        console.log(`    Current: ${kw.current_week_impressions} impressions`)
        console.log(`    Average: ${kw.avg_weekly_impressions} impressions`)
        console.log(`    Trend Strength: ${(kw.trend_strength * 100).toFixed(1)}%`)
      })
      
      console.log(chalk.blue('\nTop 3 Declining Keywords:'))
      const declining = trendGroups['declining'] || []
      declining.slice(0, 3).forEach(kw => {
        console.log(`  "${kw.search_query}"`)
        console.log(`    Current: ${kw.current_week_impressions} impressions`)
        console.log(`    Average: ${kw.avg_weekly_impressions} impressions`)
        console.log(`    Volatility: ${(kw.volatility_score * 100).toFixed(1)}%`)
      })
    } else {
      console.log(chalk.yellow('No keyword trends found'))
    }
    
  } catch (error) {
    console.error(chalk.red('Error testing rolling averages:'), error)
  }
}

async function testAnomalyDetection() {
  console.log(chalk.blue('\n=== Testing Anomaly Detection ===\n'))
  
  try {
    // Get anomaly summary
    const { data: summary, error: summaryError } = await supabase
      .rpc('get_anomaly_summary', {
        p_days_back: 30
      })
    
    if (summaryError) throw summaryError
    
    if (summary && summary.length > 0) {
      const s = summary[0]
      console.log(chalk.gray('Anomaly Summary (Last 30 Days):'))
      console.log(`  Total Anomalies: ${s.anomaly_count}`)
      console.log(`  Extreme: ${s.extreme_count}`)
      console.log(`  Moderate: ${s.moderate_count}`)
      console.log(`  Mild: ${s.mild_count}`)
      console.log(`  Affected Keywords: ${s.affected_keywords}`)
      console.log(`  Affected ASINs: ${s.affected_asins}`)
      
      if (s.top_positive_anomaly) {
        console.log(chalk.green('\nTop Positive Anomaly:'))
        console.log(`  Query: "${s.top_positive_anomaly.search_query}"`)
        console.log(`  Metric: ${s.top_positive_anomaly.metric}`)
        console.log(`  Z-Score: ${s.top_positive_anomaly.zscore}`)
        console.log(`  Actual: ${s.top_positive_anomaly.actual} vs Expected: ${s.top_positive_anomaly.expected}`)
      }
      
      if (s.top_negative_anomaly) {
        console.log(chalk.red('\nTop Negative Anomaly:'))
        console.log(`  Query: "${s.top_negative_anomaly.search_query}"`)
        console.log(`  Metric: ${s.top_negative_anomaly.metric}`)
        console.log(`  Z-Score: ${s.top_negative_anomaly.zscore}`)
        console.log(`  Actual: ${s.top_negative_anomaly.actual} vs Expected: ${s.top_negative_anomaly.expected}`)
      }
    }
    
    // Test market share anomalies
    console.log(chalk.blue('\n=== Market Share Anomalies ==='))
    const { data: marketAnomalies, error: marketError } = await supabase
      .rpc('detect_market_share_anomalies', {
        p_threshold: 0.1 // 10% change threshold
      })
    
    if (marketError) throw marketError
    
    if (marketAnomalies && marketAnomalies.length > 0) {
      console.log(chalk.gray(`Found ${marketAnomalies.length} market share anomalies`))
      marketAnomalies.slice(0, 5).forEach(anomaly => {
        console.log(`\n  Query: "${anomaly.search_query}"`)
        console.log(`  Brand: ${anomaly.brand_name}`)
        console.log(`  Current Share: ${anomaly.our_market_share}%`)
        console.log(`  Previous Share: ${anomaly.prev_week_market_share}%`)
        console.log(`  Change: ${anomaly.market_share_change}%`)
        console.log(`  Type: ${anomaly.anomaly_type}`)
      })
    } else {
      console.log(chalk.yellow('No significant market share changes detected'))
    }
    
  } catch (error) {
    console.error(chalk.red('Error testing anomaly detection:'), error)
  }
}

async function testCustomDateRanges() {
  console.log(chalk.blue('\n=== Testing Custom Date Range Comparison ===\n'))
  
  try {
    // Compare last 7 days vs previous 7 days
    const currentStart = new Date()
    currentStart.setDate(currentStart.getDate() - 7)
    
    const currentEnd = new Date()
    
    const previousStart = new Date()
    previousStart.setDate(previousStart.getDate() - 14)
    
    const previousEnd = new Date()
    previousEnd.setDate(previousEnd.getDate() - 8)
    
    const { data: comparison, error } = await supabase
      .rpc('compare_date_ranges', {
        p_current_start: currentStart.toISOString().split('T')[0],
        p_current_end: currentEnd.toISOString().split('T')[0],
        p_previous_start: previousStart.toISOString().split('T')[0],
        p_previous_end: previousEnd.toISOString().split('T')[0]
      })
    
    if (error) throw error
    
    if (comparison && comparison.length > 0) {
      console.log(chalk.gray('Last 7 Days vs Previous 7 Days:'))
      comparison.forEach(metric => {
        const arrow = metric.is_improvement ? chalk.green('↑') : chalk.red('↓')
        const change = metric.percent_change !== null 
          ? `(${metric.percent_change > 0 ? '+' : ''}${metric.percent_change.toFixed(1)}%)`
          : metric.absolute_change !== null && metric.metric_name.includes('%')
          ? `(${metric.absolute_change > 0 ? '+' : ''}${metric.absolute_change.toFixed(2)}pts)`
          : ''
        
        console.log(`  ${metric.metric_name}: ${metric.current_value} ${arrow} ${change}`)
      })
    }
    
  } catch (error) {
    console.error(chalk.red('Error testing custom date ranges:'), error)
  }
}

// Main execution
async function main() {
  try {
    await testPeriodComparisons()
    await testRollingAverages()
    await testAnomalyDetection()
    await testCustomDateRanges()
    
    console.log(chalk.green('\n✓ All period calculation tests completed'))
  } catch (error) {
    console.error(chalk.red('Test script failed:'), error)
    process.exit(1)
  }
}

main()