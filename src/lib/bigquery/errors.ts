export class BigQueryError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'BigQueryError';
  }
}

export class BigQueryAuthError extends BigQueryError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'BigQueryAuthError';
  }
}

export class BigQueryConnectionError extends BigQueryError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'BigQueryConnectionError';
  }
}

export class BigQueryQueryError extends BigQueryError {
  constructor(message: string, details?: any) {
    super(message, 'QUERY_ERROR', details);
    this.name = 'BigQueryQueryError';
  }
}

export class BigQueryPermissionError extends BigQueryError {
  constructor(message: string, details?: any) {
    super(message, 'PERMISSION_ERROR', details);
    this.name = 'BigQueryPermissionError';
  }
}

export class BigQueryQuotaError extends BigQueryError {
  constructor(message: string, details?: any) {
    super(message, 'QUOTA_ERROR', details);
    this.name = 'BigQueryQuotaError';
  }
}

export const isRetryableError = (error: Error): boolean => {
  const retryableMessages = [
    'service temporarily unavailable',
    'timeout',
    'deadline exceeded',
    'internal error',
    'connection reset',
    'network error',
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some(msg => errorMessage.includes(msg));
};