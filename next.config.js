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
}

module.exports = nextConfig