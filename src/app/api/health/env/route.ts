import { NextResponse } from 'next/server'
import { getEnvConfig, validateEnvConfig } from '@/config/env.config'

export async function GET() {
  try {
    const config = getEnvConfig()
    const validation = validateEnvConfig(config)
    
    // Mask sensitive values
    const maskedConfig = {
      supabase: {
        url: config.supabase.url ? `${config.supabase.url.substring(0, 20)}...` : 'NOT_SET',
        anonKey: config.supabase.anonKey ? `${config.supabase.anonKey.substring(0, 10)}...` : 'NOT_SET',
        serviceRoleKey: config.supabase.serviceRoleKey ? 'SET' : 'NOT_SET'
      },
      isPlaceholder: config.isPlaceholder
    }

    // Check various environment variable sources
    const envSources = {
      standard: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      nextPublic: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      },
      railway: {
        RAILWAY_PUBLIC_SUPABASE_URL: !!process.env.RAILWAY_PUBLIC_SUPABASE_URL,
        RAILWAY_PUBLIC_SUPABASE_ANON_KEY: !!process.env.RAILWAY_PUBLIC_SUPABASE_ANON_KEY,
        RAILWAY_SUPABASE_SERVICE_ROLE_KEY: !!process.env.RAILWAY_SUPABASE_SERVICE_ROLE_KEY
      }
    }

    return NextResponse.json({
      status: validation.valid ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL,
        isRailway: !!process.env.RAILWAY_ENVIRONMENT
      },
      config: maskedConfig,
      validation,
      envSources,
      recommendation: !validation.valid ? 
        'Please ensure the following environment variables are set: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)' : 
        null
    }, { 
      status: validation.valid ? 200 : 503 
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}