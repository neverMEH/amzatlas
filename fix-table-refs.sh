#!/bin/bash

# Fix table references in edge functions
# Remove 'sqp.' prefix and use table names directly

echo "Fixing table references in edge functions..."

# Fix orchestrator
sed -i "s/'sqp\.refresh_config'/'refresh_config'/g" supabase/functions/daily-refresh-orchestrator/index.ts
sed -i "s/'sqp\.refresh_audit_log'/'refresh_audit_log'/g" supabase/functions/daily-refresh-orchestrator/index.ts

# Fix all worker functions
for func in refresh-asin-performance refresh-search-queries refresh-summary-tables refresh-daily-sqp refresh-generic-table; do
  echo "Fixing $func..."
  sed -i "s/'sqp\.refresh_checkpoints'/'refresh_checkpoints'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.refresh_audit_log'/'refresh_audit_log'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.asin_performance_data'/'asin_performance_data'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.search_query_performance'/'search_query_performance'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.daily_sqp_data'/'daily_sqp_data'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.weekly_summary'/'weekly_summary'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.monthly_summary'/'monthly_summary'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.quarterly_summary'/'quarterly_summary'/g" supabase/functions/$func/index.ts
  sed -i "s/'sqp\.yearly_summary'/'yearly_summary'/g" supabase/functions/$func/index.ts
done

# Fix shared utils
sed -i "s/'sqp\.refresh_audit_log'/'refresh_audit_log'/g" supabase/functions/_shared/utils.ts

echo "✅ Table references fixed!"