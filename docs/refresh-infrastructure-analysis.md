# Refresh Infrastructure Analysis & Discrepancies

> Analysis Date: September 6, 2025  
> Purpose: Audit refresh monitor to track correct tables for SQP Intelligence pipeline

## Executive Summary

The current refresh monitoring system has **critical misalignment** with the actual data pipeline. 80% of monitored tables are inactive, while core pipeline tables are unmonitored.

### Key Findings

- ❌ **8 out of 10 monitored tables have NEVER been refreshed**
- ❌ **Real data pipeline (sync_log) is not monitored**
- ❌ **Critical tables missing from monitoring**: sync_log, data_quality_checks, brands
- ✅ **Only 2 tables actually working**: asin_performance_data, search_query_performance

## Current vs Actual Data Pipeline

### What's Being Monitored (refresh_config)
```
❌ webhook_configs (Priority 100) - Never refreshed
❌ webhook_deliveries (Priority 100) - Never refreshed  
✅ asin_performance_data (Priority 90) - Active, last: Sep 5
✅ search_query_performance (Priority 85) - Active, last: Sep 5
❌ monthly_summary (Priority 80) - Never refreshed
❌ quarterly_summary (Priority 80) - Never refreshed
❌ search_performance_summary (Priority 80) - Never refreshed
❌ weekly_summary (Priority 80) - Never refreshed
❌ yearly_summary (Priority 80) - Never refreshed
❌ daily_sqp_data (Priority 75) - Never refreshed
```

### What Should Be Monitored (Actual Pipeline)
```
🔥 sync_log - 60 operations, tracks BigQuery sync health
🔥 data_quality_checks - 54 checks, validates data integrity  
🔥 asin_performance_data - 204K records, core dashboard data
🔥 search_query_performance - 3.6K records, main metrics source
🔥 brands - 137 entries, product categorization
🔥 asin_brand_mapping - 186 mappings, brand intelligence
🔥 product_type_mapping - 52 mappings, product classification
```

## Real Data Flow Analysis

### Actual Sync Activity (sync_log analysis)
- **Primary Sync Type**: Weekly BigQuery sync
- **Target Table**: sqp.search_query_performance 
- **Recent Activity**: 57 successful operations (Aug 28)
- **Data Volume**: 210,087 records processed
- **Success Rate**: 95% (57 success, 2 started, 1 failed)
- **Last Sync**: August 28, 2025

### Table Activity Levels
| Table | Records | Activity | Importance | Monitor Status |
|-------|---------|----------|------------|----------------|
| search_query_performance | 204,515 | HIGH | CORE | ✅ Monitored |
| asin_performance_data | 3,659 | HIGH | CORE | ✅ Monitored |
| sync_log | 60 | MEDIUM | CRITICAL | ❌ Not monitored |
| data_quality_checks | 54 | MEDIUM | CRITICAL | ❌ Not monitored |
| asin_brand_mapping | 186 | LOW | CORE | ❌ Not monitored |
| brands | 137 | LOW | CORE | ❌ Not monitored |
| webhook_configs | 1 | NONE | OBSOLETE | ❌ Monitored (waste) |
| webhook_deliveries | 0 | NONE | OBSOLETE | ❌ Monitored (waste) |

## Specific Discrepancies

### 1. Wrong Priorities
**Current Priority Order vs Actual Importance:**
- webhook_configs (100) → Should be REMOVED
- webhook_deliveries (100) → Should be REMOVED  
- asin_performance_data (90) → Correct (HIGH priority)
- search_query_performance (85) → Should be 95+ (HIGHEST priority)
- All summary tables (80) → Should be REMOVED or 20-30
- Missing: sync_log should be priority 99
- Missing: data_quality_checks should be priority 95

### 2. Missing Critical Infrastructure Monitoring
**Not monitored but essential:**
- `sync_log` - The heartbeat of data pipeline
- `data_quality_checks` - Data integrity validation
- `brands` - Core business intelligence  
- `asin_brand_mapping` - Product-brand relationships

### 3. Monitoring Dead Tables
**Should be removed from monitoring:**
- All summary tables (never refreshed, likely materialized views)
- webhook_* tables (minimal/no activity)
- daily_sqp_data (never refreshed)

### 4. Frequency Misalignment
**Current vs Recommended:**
- Core data tables: 24h → 6-12h (need faster refresh)
- Pipeline monitoring: Missing → 1-6h (critical for alerts)
- Summary tables: 24h → Remove or 48h+ (low priority)

## Impact on Refresh Monitor Accuracy

### Current Monitor Problems
1. **False Negatives**: Shows healthy system while real pipeline issues go undetected
2. **False Positives**: Alerts on irrelevant webhook table "failures"
3. **No Pipeline Visibility**: Can't see BigQuery sync health
4. **Missing Critical Alerts**: Brand mapping failures undetected

### Real World Impact
- Dashboard may show stale data without detection
- BigQuery sync failures not monitored
- Brand intelligence pipeline health unknown
- Data quality issues untracked

## Recommendations

### Immediate Actions (High Priority)
1. **Remove Dead Tables**: webhook_*, summary tables from refresh_config
2. **Add Critical Tables**: sync_log, data_quality_checks, brands
3. **Fix Priorities**: search_query_performance → 95, sync_log → 99
4. **Update Frequencies**: Core tables → 6-12h monitoring

### Architecture Improvements  
1. **Sync-Based Monitoring**: Monitor actual sync_log operations
2. **Data Quality Integration**: Track data_quality_checks results
3. **Pipeline Health Scoring**: Based on real sync success rates
4. **Alert Categorization**: Critical (pipeline) vs Warning (data freshness)

### New Monitor Structure
```
CRITICAL (1-6h monitoring):
- sync_log (pipeline health)
- data_quality_checks (data integrity)

CORE (6-12h monitoring):  
- search_query_performance (dashboard data)
- asin_performance_data (performance metrics)
- brands (business intelligence)
- asin_brand_mapping (product intelligence)

SECONDARY (24h+ monitoring):
- search_performance_summary (if used)
- product_type_mapping (stable data)

REMOVE:
- All webhook tables
- All summary tables (unless actively used)
- daily_sqp_data
```

## Migration Plan

### Phase 1: Cleanup (Low Risk)
1. Disable monitoring for dead tables
2. Update refresh_config priorities
3. Add missing core tables

### Phase 2: Enhanced Monitoring (Medium Risk)
1. Integrate sync_log monitoring
2. Add data quality tracking  
3. Update monitor UI

### Phase 3: Production Deployment (High Risk)
1. Deploy to staging
2. Validate monitoring accuracy
3. Gradual production rollout

## Success Metrics

- **Monitoring Accuracy**: >95% (currently ~20%)
- **False Alert Rate**: <5% (currently high)
- **Pipeline Visibility**: 100% of sync operations tracked
- **Alert Response Time**: <30 minutes for critical issues

---

**Next Steps**: Implement cleanup migration and update refresh monitor UI to focus on actual data pipeline health.