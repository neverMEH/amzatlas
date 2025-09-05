# Migration Plan: Manual to Automated Refresh

This document outlines the migration strategy from the current manual sync process to the automated daily refresh system described in @.agent-os/specs/2025-09-05-daily-bigquery-refresh/spec.md

## Current State Analysis

### Existing Manual Process
- **Scripts**: Manual sync scripts in `/src/scripts/`
  - `sync-nested-bigquery.ts` - Single week sync
  - `sync-all-data.ts` - Full historical sync
- **Execution**: Developer runs scripts via npm commands
- **Frequency**: Ad-hoc, typically when new data is noticed missing
- **Monitoring**: Console logs only, no persistent audit trail

### Pain Points
1. Requires manual intervention to keep data current
2. No visibility into sync status without checking logs
3. Risk of data staleness if syncs are forgotten
4. No automatic error recovery
5. Inefficient full table scans for incremental updates

## Migration Strategy

### Phase 1: Parallel Running (Week 1-2)

**Objective**: Deploy automated system alongside manual process

1. **Deploy Infrastructure**
   ```sql
   -- Run migration 031_add_refresh_infrastructure.sql
   -- This creates all necessary tables without affecting existing data
   ```

2. **Deploy Edge Functions**
   - Deploy all functions in "dry-run" mode
   - Functions log actions but don't modify data
   - Validate BigQuery queries and data transformations

3. **Testing Checklist**
   - [ ] Edge functions can connect to BigQuery
   - [ ] Correct tables identified for refresh
   - [ ] Audit logs properly created
   - [ ] No interference with manual syncs

### Phase 2: Shadow Mode (Week 3-4)

**Objective**: Automated system runs but manual remains primary

1. **Enable Automated Refresh**
   ```sql
   -- Enable for non-critical tables first
   UPDATE sqp.refresh_config 
   SET is_enabled = true 
   WHERE table_name IN ('yearly_summary', 'quarterly_summary');
   ```

2. **Monitoring**
   - Compare automated vs manual sync results
   - Track execution times and resource usage
   - Validate data consistency

3. **Success Metrics**
   - 100% data consistency with manual syncs
   - Execution time < 5 minutes per table
   - Zero failed refreshes due to code issues

### Phase 3: Gradual Cutover (Week 5-6)

**Objective**: Transition primary tables to automated refresh

1. **Enable Core Tables**
   ```sql
   -- Enable high-priority tables
   UPDATE sqp.refresh_config 
   SET is_enabled = true 
   WHERE table_name IN (
     'asin_performance_data',
     'search_query_performance',
     'search_performance_summary'
   );
   ```

2. **Manual Sync Reduction**
   - Continue manual syncs weekly as backup
   - Document any discrepancies
   - Adjust batch sizes based on performance

3. **Validation Points**
   - Dashboard data matches expected values
   - New weekly data appears automatically
   - Summary tables update correctly

### Phase 4: Full Automation (Week 7-8)

**Objective**: Complete transition to automated system

1. **Enable All Tables**
   ```sql
   UPDATE sqp.refresh_config SET is_enabled = true;
   ```

2. **Deprecate Manual Scripts**
   - Add deprecation notices to manual scripts
   - Update documentation
   - Keep scripts available for emergency use

3. **Final Validation**
   - 7 days of successful automated refreshes
   - All dashboards showing current data
   - Zero manual interventions required

## Data Validation Process

### Consistency Checks

Create validation queries to run during migration:

```sql
-- Record count comparison
WITH manual_counts AS (
  SELECT 
    'asin_performance_data' as table_name,
    COUNT(*) as row_count,
    MAX(end_date) as latest_date
  FROM sqp.asin_performance_data_manual
),
automated_counts AS (
  SELECT 
    'asin_performance_data' as table_name,
    COUNT(*) as row_count,
    MAX(end_date) as latest_date
  FROM sqp.asin_performance_data
)
SELECT 
  m.table_name,
  m.row_count as manual_count,
  a.row_count as automated_count,
  ABS(m.row_count - a.row_count) as difference,
  m.latest_date as manual_latest,
  a.latest_date as automated_latest
FROM manual_counts m
JOIN automated_counts a ON m.table_name = a.table_name;

-- Data quality comparison
SELECT 
  metric_name,
  AVG(CASE WHEN source = 'manual' THEN metric_value END) as manual_avg,
  AVG(CASE WHEN source = 'automated' THEN metric_value END) as automated_avg,
  ABS(
    AVG(CASE WHEN source = 'manual' THEN metric_value END) - 
    AVG(CASE WHEN source = 'automated' THEN metric_value END)
  ) as difference
FROM sqp.validation_metrics
GROUP BY metric_name
HAVING difference > 0.01;  -- 1% tolerance
```

## Risk Mitigation

### Rollback Plan

1. **Immediate Rollback** (< 5 minutes)
   ```sql
   -- Disable all automated refreshes
   UPDATE sqp.refresh_config SET is_enabled = false;
   
   -- Clear active checkpoints
   UPDATE sqp.refresh_checkpoints 
   SET status = 'expired' 
   WHERE status = 'active';
   ```

2. **Data Recovery** (if needed)
   - Manual sync scripts remain functional
   - BigQuery source data unchanged
   - Point-in-time recovery available in Supabase

### Risk Matrix

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Edge function timeouts | Medium | Medium | Checkpoint system, batch size tuning |
| Data inconsistency | High | Low | Validation queries, shadow mode testing |
| BigQuery API limits | Medium | Low | Rate limiting, connection pooling |
| Schema drift | Medium | Medium | Schema validation, alerts |

## Communication Plan

### Stakeholder Notifications

1. **Pre-Migration** (Week 0)
   - Email: Migration schedule and expected impact
   - Documentation: Updated refresh process guide
   - Training: How to monitor automated refreshes

2. **During Migration** (Weeks 1-8)
   - Weekly status updates
   - Immediate alerts for any issues
   - Dashboard showing migration progress

3. **Post-Migration** (Week 9+)
   - Final report with metrics
   - Updated SOP documentation
   - Lessons learned session

### Team Responsibilities

- **Data Engineering**: Deploy and monitor edge functions
- **Analytics Team**: Validate data consistency
- **DevOps**: Monitor system performance
- **Product Owner**: Sign-off on each phase

## Success Metrics

### Phase Completion Criteria

Each phase is complete when:

1. **Phase 1**: All functions deployed, dry-run successful
2. **Phase 2**: 14 days of shadow mode with 100% consistency
3. **Phase 3**: Core tables automated with zero failures
4. **Phase 4**: Full automation with 7-day stability

### Overall Success Metrics

- **Automation Rate**: 100% of tables on automated refresh
- **Reliability**: 99.9% successful refresh rate
- **Timeliness**: New data available within 24 hours
- **Manual Effort**: 0 hours per week (down from ~2 hours)

## Post-Migration Optimization

### Performance Tuning

1. Analyze execution patterns
2. Optimize batch sizes per table
3. Adjust refresh priorities
4. Implement caching where beneficial

### Enhancement Opportunities

- Real-time refresh triggers for critical data
- Incremental materialized view updates
- Advanced data quality rules
- Self-healing error recovery

## Appendix: Script Modifications

### Deprecation Notice for Manual Scripts

Add to existing sync scripts:

```typescript
console.warn(`
╔════════════════════════════════════════════════════════╗
║                    DEPRECATION NOTICE                   ║
║                                                         ║
║  This manual sync script has been replaced by          ║
║  automated Supabase Edge Functions.                    ║
║                                                         ║
║  Automated refresh runs daily at 2 AM UTC.             ║
║  Monitor status at: /api/refresh/status                ║
║                                                         ║
║  This script will be removed on: 2025-10-31           ║
╚════════════════════════════════════════════════════════╝
`)

// Add 5-second delay to ensure notice is seen
await new Promise(resolve => setTimeout(resolve, 5000))
```