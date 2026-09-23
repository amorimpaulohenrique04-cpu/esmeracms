import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./certs/supabase-prod-ca-2021.crt'],
  },
  images: {
    // Payload media is immutable in practice (new uploads receive new
    // filenames). Keep optimized derivatives hot for a week so hero/product
    // images do not repeatedly invoke the CMS function.
    minimumCacheTTL: 604800,
    qualities: [75],
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
