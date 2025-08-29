import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getEnvConfig, validateEnvConfig } from '@/config/env.config'

let clientCache: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  // Return cached client if available
  if (clientCache) {
    return clientCache
  }

  try {
    const config = getEnvConfig()
    const validation = validateEnvConfig(config)

    if (!validation.valid && !config.isPlaceholder) {
      console.error('Environment configuration errors:', validation.errors)
      throw new Error(`Environment configuration errors: ${validation.errors.join(', ')}`)
    }

    // During build time with placeholders, return a minimal client
    if (config.isPlaceholder) {
      console.log('Using placeholder Supabase client for build')
      // Return a mock client that won't be used during build
      return {
        from: () => ({
          select: () => ({ data: null, error: new Error('Build time placeholder') }),
          insert: () => ({ data: null, error: new Error('Build time placeholder') }),
          update: () => ({ data: null, error: new Error('Build time placeholder') }),
          delete: () => ({ data: null, error: new Error('Build time placeholder') })
        }),
        rpc: () => ({ data: null, error: new Error('Build time placeholder') })
      } as any
    }

    const supabaseUrl = config.supabase.url!
    const supabaseKey = config.supabase.serviceRoleKey!

    clientCache = createSupabaseClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    return clientCache
  } catch (error) {
    console.error('Failed to create Supabase client:', error)
    throw error
  }
}