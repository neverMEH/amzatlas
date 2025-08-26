import { vi } from 'vitest';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'test-key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
  client_email: 'test@test-project.iam.gserviceaccount.com',
});

// Global test utilities
global.console = {
  ...console,
  error: vi.fn(console.error),
  warn: vi.fn(console.warn),
  log: vi.fn(console.log),
};