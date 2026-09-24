import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const STOREFRONT_IMAGE_WIDTHS = [
  384,
  414,
  512,
  640,
  750,
  828,
  1080,
  1200,
  1920,
  2048,
  3840,
]

const IMMUTABLE_MEDIA_CACHE =
  'public, max-age=31536000, s-maxage=31536000, immutable'

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./certs/supabase-prod-ca-2021.crt'],
  },
  async headers() {
    return [
      {
        source: '/api/media/file/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: IMMUTABLE_MEDIA_CACHE,
          },
        ],
      },
    ]
  },
  images: {
    // Payload media filenames are immutable in practice. Keep the original
    // upload and its optimized derivatives hot; a replacement upload receives
    // a new filename and therefore a new cache key.
    minimumCacheTTL: 2678400,
    deviceSizes: STOREFRONT_IMAGE_WIDTHS,
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
