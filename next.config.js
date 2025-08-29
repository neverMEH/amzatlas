/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure TypeScript
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Configure ESLint
  eslint: {
    ignoreDuringBuilds: false,
  },
  
  // Configure source directory and file extensions
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  
  // Ensure proper path resolution
  trailingSlash: false,
  
  // Ensure proper build optimization
  poweredByHeader: false,

  // Public runtime configuration
  publicRuntimeConfig: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  },

  // Server runtime configuration
  serverRuntimeConfig: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
}

module.exports = nextConfig