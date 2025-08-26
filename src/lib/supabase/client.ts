import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseAdminClient } from '@/config/supabase.config';

// Database types based on our schema
export interface WeeklySummary {
  id?: number;
  period_start: string;
  period_end: string;
  query: string;
  asin: string;
  total_impressions: number;
  total_clicks: number;
  total_purchases: number;
  avg_ctr: number;
  avg_cvr: number;
  purchases_per_impression: number;
  impression_share: number;
  click_share: number;
  purchase_share: number;
  min_impressions?: number;
  max_impressions?: number;
  avg_impressions?: number;
  stddev_impressions?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MonthlySummary extends Omit<WeeklySummary, 'period_start' | 'period_end'> {
  period_start: string;
  period_end: string;
  year: number;
  month: number;
  active_weeks: number;
}

export interface QuarterlySummary extends Omit<MonthlySummary, 'month' | 'active_weeks'> {
  quarter: number;
  active_weeks: number;
  active_months: number;
}

export interface YearlySummary extends Omit<QuarterlySummary, 'quarter' | 'period_start' | 'period_end' | 'active_months'> {
  year: number;
  active_weeks: number;
  active_months: number;
  active_quarters: number;
}

export interface PeriodComparison {
  id?: number;
  period_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  current_period_start: string;
  current_period_end: string;
  previous_period_start: string;
  previous_period_end: string;
  query: string;
  asin: string;
  current_impressions: number;
  current_clicks: number;
  current_purchases: number;
  current_ctr: number;
  current_cvr: number;
  previous_impressions: number;
  previous_clicks: number;
  previous_purchases: number;
  previous_ctr: number;
  previous_cvr: number;
  impressions_change: number;
  clicks_change: number;
  purchases_change: number;
  ctr_change: number;
  cvr_change: number;
  impressions_change_pct: number;
  clicks_change_pct: number;
  purchases_change_pct: number;
  created_at?: string;
}

export class SupabaseService {
  private client: SupabaseClient;
  private adminClient: SupabaseClient;

  constructor() {
    this.client = getSupabaseClient();
    this.adminClient = getSupabaseAdminClient();
  }

  // Weekly Summary Operations
  async upsertWeeklySummary(data: WeeklySummary | WeeklySummary[]) {
    return this.client
      .from('sqp_weekly_summary')
      .upsert(data, { onConflict: 'period_start,query,asin' });
  }

  async getWeeklySummaries(filters: {
    startDate?: string;
    endDate?: string;
    query?: string;
    asin?: string;
    limit?: number;
  }) {
    let query = this.client
      .from('sqp_weekly_summary')
      .select('*');

    if (filters.startDate) {
      query = query.gte('period_start', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('period_end', filters.endDate);
    }
    if (filters.query) {
      query = query.eq('query', filters.query);
    }
    if (filters.asin) {
      query = query.eq('asin', filters.asin);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    return query.order('period_start', { ascending: false });
  }

  // Monthly Summary Operations
  async upsertMonthlySummary(data: MonthlySummary | MonthlySummary[]) {
    return this.client
      .from('sqp_monthly_summary')
      .upsert(data, { onConflict: 'year,month,query,asin' });
  }

  async getMonthlySummaries(filters: {
    year?: number;
    month?: number;
    query?: string;
    asin?: string;
    limit?: number;
  }) {
    let query = this.client
      .from('sqp_monthly_summary')
      .select('*');

    if (filters.year) {
      query = query.eq('year', filters.year);
    }
    if (filters.month) {
      query = query.eq('month', filters.month);
    }
    if (filters.query) {
      query = query.eq('query', filters.query);
    }
    if (filters.asin) {
      query = query.eq('asin', filters.asin);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    return query.order('year', { ascending: false }).order('month', { ascending: false });
  }

  // Period Comparison Operations
  async upsertPeriodComparison(data: PeriodComparison | PeriodComparison[]) {
    return this.client
      .from('sqp_period_comparisons')
      .upsert(data, { onConflict: 'period_type,current_period_start,query,asin' });
  }

  async getPeriodComparisons(filters: {
    periodType?: string;
    query?: string;
    asin?: string;
    currentPeriodStart?: string;
  }) {
    let query = this.client
      .from('sqp_period_comparisons')
      .select('*');

    if (filters.periodType) {
      query = query.eq('period_type', filters.periodType);
    }
    if (filters.query) {
      query = query.eq('query', filters.query);
    }
    if (filters.asin) {
      query = query.eq('asin', filters.asin);
    }
    if (filters.currentPeriodStart) {
      query = query.eq('current_period_start', filters.currentPeriodStart);
    }

    return query.order('current_period_start', { ascending: false });
  }

  // View Operations
  async getWeeklyTrends(query: string, asin?: string) {
    let dbQuery = this.client
      .from('sqp_weekly_trends')
      .select('*')
      .eq('query', query);

    if (asin) {
      dbQuery = dbQuery.eq('asin', asin);
    }

    return dbQuery.order('period_start', { ascending: false });
  }

  async getMarketShare(periodStart: string, query: string) {
    return this.client
      .from('sqp_market_share')
      .select('*')
      .eq('period_start', periodStart)
      .eq('query', query)
      .order('purchase_market_share', { ascending: false });
  }

  async getTopKeywords(periodType: 'weekly' | 'monthly', periodStart: string, limit: number = 10) {
    return this.client
      .from('sqp_top_keywords_by_period')
      .select('*')
      .eq('period_type', periodType)
      .eq('period_start', periodStart)
      .lte('purchase_rank', limit)
      .order('purchase_rank');
  }

  // Admin Operations
  async runMigrations(sqlContent: string) {
    // This would typically be done through Supabase CLI or dashboard
    // But we can execute raw SQL if needed
    const { data, error } = await this.adminClient.rpc('exec_sql', {
      sql: sqlContent,
    });

    if (error) throw error;
    return data;
  }

  async refreshMaterializedViews() {
    return this.adminClient.rpc('refresh_sqp_views');
  }

  // Utility Methods
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('sqp_weekly_summary')
        .select('count')
        .limit(1);

      return !error || error.code === 'PGRST116'; // No rows is OK
    } catch {
      return false;
    }
  }
}