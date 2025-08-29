// Environment configuration with runtime validation
export const getEnvConfig = () => {
  // Check if we're in a build environment
  const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME

  // During build time, return dummy values
  if (isBuildTime) {
    console.log('Build time detected, using placeholder values')
    return {
      supabase: {
        url: 'https://placeholder.supabase.co',
        anonKey: 'placeholder-anon-key',
        serviceRoleKey: 'placeholder-service-key'
      },
      isPlaceholder: true
    }
  }

  // Runtime configuration - check all possible environment variable names
  // Railway may prefix variables differently
  const possibleUrlVars = [
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL', 
    'RAILWAY_PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_URL',
    'REACT_APP_SUPABASE_URL'
  ]

  const possibleAnonKeyVars = [
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'RAILWAY_PUBLIC_SUPABASE_ANON_KEY',
    'PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_KEY',
    'REACT_APP_SUPABASE_ANON_KEY'
  ]

  const possibleServiceKeyVars = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'RAILWAY_SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'SERVICE_ROLE_KEY'
  ]

  // Find the first available variable
  const supabaseUrl = possibleUrlVars.find(varName => process.env[varName]) ? 
                     process.env[possibleUrlVars.find(varName => process.env[varName])!] : 
                     undefined

  const supabaseAnonKey = possibleAnonKeyVars.find(varName => process.env[varName]) ? 
                          process.env[possibleAnonKeyVars.find(varName => process.env[varName])!] : 
                          undefined

  const supabaseServiceKey = possibleServiceKeyVars.find(varName => process.env[varName]) ? 
                             process.env[possibleServiceKeyVars.find(varName => process.env[varName])!] : 
                             undefined

  return {
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceKey || supabaseAnonKey // Fallback to anon key if service key not available
    },
    isPlaceholder: false
  }
}

// Validate environment configuration
export const validateEnvConfig = (config: ReturnType<typeof getEnvConfig>) => {
  if (config.isPlaceholder) {
    return { valid: true, errors: [] }
  }

  const errors: string[] = []

  if (!config.supabase.url) {
    errors.push('Missing Supabase URL')
  }

  if (!config.supabase.anonKey) {
    errors.push('Missing Supabase anonymous key')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}