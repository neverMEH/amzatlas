import { BigQueryConnectionPool } from '../connection-pool';
import { MarketShareData, MarketOpportunity } from '../types';
import { getFullTableName } from '@/config/bigquery.config';

export class MarketShareCalculator {
  /**
   * Calculate market share by keyword
   */
  calculateMarketShare(
    competitorData: Array<{
      query: string;
      asin: string;
      purchases: number;
    }>
  ): MarketShareData {
    const byKeyword = new Map<string, any[]>();
    const byAsin = new Map<string, number>();
    
    // Group by keyword and aggregate by ASIN
    for (const data of competitorData) {
      if (!byKeyword.has(data.query)) {
        byKeyword.set(data.query, []);
      }
      byKeyword.get(data.query)!.push(data);
      
      byAsin.set(data.asin, (byAsin.get(data.asin) || 0) + data.purchases);
    }

    // Calculate shares by keyword
    const sharesByKeyword: Record<string, Record<string, number>> = {};
    const topCompetitorsByKeyword: Record<string, Array<{ asin: string; share: number }>> = {};

    for (const [query, asins] of byKeyword.entries()) {
      const totalPurchases = asins.reduce((sum, a) => sum + a.purchases, 0);
      const shares: Record<string, number> = {};
      
      for (const asinData of asins) {
        shares[asinData.asin] = totalPurchases > 0 
          ? asinData.purchases / totalPurchases 
          : 0;
      }
      
      sharesByKeyword[query] = shares;
      
      // Get top competitors
      topCompetitorsByKeyword[query] = Object.entries(shares)
        .map(([asin, share]) => ({ asin, share }))
        .sort((a, b) => b.share - a.share)
        .slice(0, 5);
    }

    // Calculate overall shares
    const totalPurchases = Array.from(byAsin.values()).reduce((sum, p) => sum + p, 0);
    const overallShares: Record<string, number> = {};
    
    for (const [asin, purchases] of byAsin.entries()) {
      overallShares[asin] = totalPurchases > 0 ? purchases / totalPurchases : 0;
    }

    return {
      sharesByKeyword,
      overallShares,
      topCompetitorsByKeyword,
    };
  }

  /**
   * Calculate market share trends over time
   */
  async calculateShareTrends(
    historicalData: Array<{
      query: string;
      asin: string;
      purchases: number;
      week: string;
    }>
  ): Promise<Record<string, Record<string, any>>> {
    const byWeekAndKeyword = new Map<string, any[]>();
    
    // Group by week and keyword
    for (const data of historicalData) {
      const key = `${data.week}|${data.query}`;
      if (!byWeekAndKeyword.has(key)) {
        byWeekAndKeyword.set(key, []);
      }
      byWeekAndKeyword.get(key)!.push(data);
    }

    // Calculate shares for each week/keyword
    const trends: Record<string, Record<string, any>> = {};
    
    for (const [key, asins] of byWeekAndKeyword.entries()) {
      const [week, query] = key.split('|');
      
      if (!trends[query]) {
        trends[query] = {};
      }
      
      const totalPurchases = asins.reduce((sum, a) => sum + a.purchases, 0);
      const shares: Record<string, number> = {};
      
      for (const asinData of asins) {
        shares[asinData.asin] = totalPurchases > 0 
          ? asinData.purchases / totalPurchases 
          : 0;
      }
      
      trends[query][week] = shares;
    }

    return trends;
  }

  /**
   * Find market opportunities based on criteria
   */
  async findOpportunities(
    pool: BigQueryConnectionPool,
    criteria: {
      minMarketSize: number;
      maxCurrentShare: number;
      minGrowthRate: number;
    }
  ): Promise<MarketOpportunity[]> {
    const query = `
      WITH keyword_market_size AS (
        SELECT
          query,
          SUM(purchases) as total_purchases,
          COUNT(DISTINCT asin) as competitor_count,
          MAX(purchases) as leader_purchases
        FROM \`${getFullTableName('sqpRaw')}\`
        WHERE DATE(query_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY query
        HAVING total_purchases >= @minMarketSize
      ),
      asin_performance AS (
        SELECT
          query,
          asin,
          SUM(purchases) as purchases,
          AVG(SAFE_DIVIDE(purchases, impressions)) as avg_efficiency
        FROM \`${getFullTableName('sqpRaw')}\`
        WHERE DATE(query_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY query, asin
      ),
      market_shares AS (
        SELECT
          ap.query,
          ap.asin,
          ap.purchases,
          kms.total_purchases,
          SAFE_DIVIDE(ap.purchases, kms.total_purchases) as market_share,
          kms.competitor_count,
          kms.leader_purchases,
          ap.avg_efficiency
        FROM asin_performance ap
        JOIN keyword_market_size kms ON ap.query = kms.query
      ),
      growth_rates AS (
        SELECT
          query,
          asin,
          purchases as current_purchases,
          LAG(purchases, 7) OVER (PARTITION BY query, asin ORDER BY query_date) as week_ago_purchases,
          SAFE_DIVIDE(
            purchases - LAG(purchases, 7) OVER (PARTITION BY query, asin ORDER BY query_date),
            LAG(purchases, 7) OVER (PARTITION BY query, asin ORDER BY query_date)
          ) * 100 as growth_rate
        FROM (
          SELECT
            query,
            asin,
            DATE(query_date) as query_date,
            SUM(purchases) as purchases
          FROM \`${getFullTableName('sqpRaw')}\`
          WHERE DATE(query_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
          GROUP BY query, asin, query_date
        )
      )
      SELECT DISTINCT
        ms.query,
        ms.total_purchases as marketSize,
        ms.market_share as currentShare,
        AVG(gr.growth_rate) as avgGrowthRate,
        ms.competitor_count as competitorCount,
        SAFE_DIVIDE(ms.leader_purchases, ms.total_purchases) as leaderShare,
        ms.avg_efficiency as efficiency
      FROM market_shares ms
      LEFT JOIN growth_rates gr ON ms.query = gr.query AND ms.asin = gr.asin
      WHERE ms.market_share <= @maxCurrentShare
      GROUP BY ms.query, ms.total_purchases, ms.market_share, ms.competitor_count, ms.leader_purchases, ms.avg_efficiency
      HAVING avgGrowthRate >= @minGrowthRate OR avgGrowthRate IS NULL
      ORDER BY ms.total_purchases DESC
      LIMIT 100
    `;

    const results = await pool.withClient(async (client) => {
      return client.query<any>(query, criteria);
    });

    return results.map(row => ({
      query: row.query,
      marketSize: row.marketSize,
      currentShare: row.currentShare || 0,
      growthRate: row.avgGrowthRate || 0,
      competitorCount: row.competitorCount,
      leaderShare: row.leaderShare || 0,
      potentialShare: Math.min(0.3, row.leaderShare * 0.5), // Conservative estimate
      estimatedPotential: row.marketSize * Math.min(0.3, row.leaderShare * 0.5),
    }));
  }

  /**
   * Analyze competitive landscape
   */
  analyzeCompetitiveLandscape(
    marketData: Array<{
      query: string;
      asin: string;
      purchases: number;
      revenue?: number;
    }>
  ): {
    concentration: Record<string, {
      hhi: number;
      cr3: number;
      cr5: number;
      competitiveness: 'low' | 'moderate' | 'high';
    }>;
    dominantPlayers: Array<{
      asin: string;
      keywords: string[];
      totalShare: number;
    }>;
  } {
    const byKeyword = new Map<string, any[]>();
    const asinPerformance = new Map<string, { keywords: Set<string>; totalPurchases: number }>();
    
    // Group by keyword
    for (const data of marketData) {
      if (!byKeyword.has(data.query)) {
        byKeyword.set(data.query, []);
      }
      byKeyword.get(data.query)!.push(data);
      
      // Track ASIN performance
      if (!asinPerformance.has(data.asin)) {
        asinPerformance.set(data.asin, { keywords: new Set(), totalPurchases: 0 });
      }
      const perf = asinPerformance.get(data.asin)!;
      perf.keywords.add(data.query);
      perf.totalPurchases += data.purchases;
    }

    // Calculate concentration metrics
    const concentration: Record<string, any> = {};
    
    for (const [query, asins] of byKeyword.entries()) {
      const sorted = asins.sort((a, b) => b.purchases - a.purchases);
      const total = sorted.reduce((sum, a) => sum + a.purchases, 0);
      
      // Calculate HHI
      const hhi = sorted.reduce((sum, a) => {
        const share = total > 0 ? (a.purchases / total) * 100 : 0;
        return sum + share * share;
      }, 0);
      
      // Calculate CR3 and CR5
      const cr3 = sorted.slice(0, 3).reduce((sum, a) => sum + a.purchases, 0) / total;
      const cr5 = sorted.slice(0, 5).reduce((sum, a) => sum + a.purchases, 0) / total;
      
      // Determine competitiveness level
      let competitiveness: 'low' | 'moderate' | 'high';
      if (hhi > 2500) {
        competitiveness = 'low'; // Highly concentrated
      } else if (hhi > 1500) {
        competitiveness = 'moderate';
      } else {
        competitiveness = 'high'; // Very competitive
      }
      
      concentration[query] = {
        hhi,
        cr3: cr3 * 100,
        cr5: cr5 * 100,
        competitiveness,
      };
    }

    // Identify dominant players
    const totalMarketPurchases = Array.from(asinPerformance.values())
      .reduce((sum, perf) => sum + perf.totalPurchases, 0);
    
    const dominantPlayers = Array.from(asinPerformance.entries())
      .map(([asin, perf]) => ({
        asin,
        keywords: Array.from(perf.keywords),
        totalShare: totalMarketPurchases > 0 
          ? (perf.totalPurchases / totalMarketPurchases) * 100 
          : 0,
      }))
      .filter(player => player.totalShare >= 5) // At least 5% market share
      .sort((a, b) => b.totalShare - a.totalShare)
      .slice(0, 10);

    return {
      concentration,
      dominantPlayers,
    };
  }

  /**
   * Calculate market share velocity
   */
  calculateShareVelocity(
    currentShare: number,
    previousShare: number,
    daysElapsed: number
  ): {
    dailyChangeRate: number;
    projectedShareIn30Days: number;
    daysToReachTarget: (targetShare: number) => number;
  } {
    const dailyChangeRate = (currentShare - previousShare) / daysElapsed;
    const projectedShareIn30Days = currentShare + (dailyChangeRate * 30);
    
    const daysToReachTarget = (targetShare: number): number => {
      if (dailyChangeRate === 0) return Infinity;
      const daysNeeded = (targetShare - currentShare) / dailyChangeRate;
      return daysNeeded > 0 ? daysNeeded : -1;
    };

    return {
      dailyChangeRate,
      projectedShareIn30Days: Math.max(0, Math.min(1, projectedShareIn30Days)),
      daysToReachTarget,
    };
  }
}