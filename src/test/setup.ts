import { vi } from 'vitest';

// Set up test environment variables
(process.env as any).NODE_ENV = 'test';
process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'test-key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
  client_email: 'test@test-project.iam.gserviceaccount.com',
});

// Set up Supabase test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Set up BigQuery test environment variables
process.env.BIGQUERY_PROJECT_ID = 'test-project';
process.env.BIGQUERY_DATASET = 'test_dataset';
process.env.BIGQUERY_LOCATION = 'US';

// Global test utilities
global.console = {
  ...console,
  error: vi.fn(console.error),
  warn: vi.fn(console.warn),
  log: vi.fn(console.log),
};

// Mock crypto.randomUUID if not available
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  } as any;
}