import { vi } from 'vitest';

// Set up test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.BIGQUERY_PROJECT_ID = 'test-project';
process.env.BIGQUERY_DATASET = 'test_dataset';
process.env.BIGQUERY_LOCATION = 'US';

// Mock crypto.randomUUID if not available
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  } as any;
}