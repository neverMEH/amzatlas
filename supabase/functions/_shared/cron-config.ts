// Cron schedule configurations for Supabase Edge Functions
export const CRON_SCHEDULES = {
  'daily-refresh-orchestrator': '0 2 * * *',  // 2 AM UTC daily
  'cleanup-expired-checkpoints': '0 * * * *', // Every hour
  'refresh-materialized-views': '0 3 * * *'   // 3 AM UTC daily
}

// Function timeout configurations (in milliseconds)
export const FUNCTION_TIMEOUTS = {
  orchestrator: 300000,     // 5 minutes
  tableRefresh: 240000,     // 4 minutes (to leave buffer)
  checkpointCleanup: 60000  // 1 minute
}

// Batch size configurations
export const BATCH_SIZES = {
  default: 5000,
  largeTable: 10000,
  smallTable: 1000,
  checkpointSave: 500  // Save checkpoint every N rows
}

// Refresh priorities
export const REFRESH_PRIORITIES = {
  critical: 100,     // Real-time data tables
  high: 90,         // Core performance data
  medium: 80,       // Summary tables
  low: 70,          // Historical aggregates
  background: 60    // Non-essential tables
}