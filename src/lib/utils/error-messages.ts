/**
 * User-friendly error messages for brand-related errors
 */

export const brandErrorMessages: Record<string, string> = {
  'Failed to fetch brands': 'Unable to load brand list. Please check your connection and try again.',
  'Network error': 'Connection error. Please check your internet connection.',
  'Timeout': 'Request timed out. The server may be busy, please try again.',
  'Unauthorized': 'You don\'t have permission to view brands. Please contact support.',
  'Server error': 'Something went wrong on our end. Please try again later.',
  'Invalid response': 'Received invalid data from server. Please refresh the page.',
}

/**
 * Get user-friendly error message
 */
export function getBrandErrorMessage(error: Error | string): string {
  const errorMessage = typeof error === 'string' ? error : error.message
  
  // Check for known error messages
  for (const [key, value] of Object.entries(brandErrorMessages)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }
  
  // Check for HTTP status codes in message
  if (errorMessage.includes('404')) {
    return 'Brand service not found. Please contact support.'
  }
  if (errorMessage.includes('500')) {
    return 'Server error occurred. Please try again later.'
  }
  if (errorMessage.includes('503')) {
    return 'Service temporarily unavailable. Please try again in a few minutes.'
  }
  
  // Default fallback
  return 'Unable to load brands. Please try again.'
}