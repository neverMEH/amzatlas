import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

// Environment configuration
export const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL environment variable is required');
  }

  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required');
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
};

// Create singleton Supabase client
let supabaseClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

/**
 * Get Supabase client for regular operations (uses anon key)
 */
export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
      db: {
        schema: 'public', // Use public schema by default
      },
    });
  }
  return supabaseClient;
};

/**
 * Get Supabase admin client for administrative operations (uses service role key)
 */
export const getSupabaseAdminClient = (): SupabaseClient => {
  if (!supabaseAdminClient) {
    const config = getSupabaseConfig();
    if (!config.serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
    }
    
    supabaseAdminClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public', // Use public schema by default
      },
    });
  }
  return supabaseAdminClient;
};

/**
 * Test Supabase connection
 */
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const client = getSupabaseClient();
    
    // Try to query the database (this will fail if connection is bad)
    const { error } = await client
      .from('sqp_weekly_summary')
      .select('count')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (which is OK)
      console.error('Supabase connection test failed:', error);
      return false;
    }

    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return false;
  }
};

// Export config for testing
export const config = {
  getSupabaseConfig,
};