export interface PurchaseMetrics {
  totalPurchases: number;
  weekOverWeekChange: number;
  marketShare: number;
  marketShareChange: number;
  purchaseCVR: number;
  cvrChange: number;
  zeroPurchaseKeywords: number;
  zeroPurchaseChange: number;
  purchaseROI: number;
  roiChange: number;
}

export interface KeywordPerformance {
  keyword: string;
  purchases: number;
  marketPurchases: number;
  share: number;
  cvr: number;
  spend: number;
  roi: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PurchaseTrend {
  week: string;
  purchases: number;
  market: number;
}