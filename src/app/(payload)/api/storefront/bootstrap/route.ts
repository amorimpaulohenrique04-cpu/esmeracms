import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { measureServerOperation } from '../../../../../server/performance'
import { buildNavigationV2 } from '../../../../../server/storefront-v2/catalog'
import { deterministicRevision, publicError, publicJSON } from '../../../../../server/storefront-v2/http'

export const dynamic = 'force-dynamic'

const loadBootstrap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const [home, siteSettings, navigation] = await Promise.all([
      payload.findGlobal({
        slug: 'home',
        depth: 2,
        draft: false,
        overrideAccess: true,
      }),
      payload.findGlobal({
        slug: 'site-settings',
        depth: 0,
        draft: false,
        overrideAccess: true,
      }),
      buildNavigationV2(payload),
    ])

    const revision = deterministicRevision({
      homeUpdatedAt: typeof home === 'object' && home && 'updatedAt' in home ? home.updatedAt : null,
      settingsUpdatedAt:
        typeof siteSettings === 'object' && siteSettings && 'updatedAt' in siteSettings
          ? siteSettings.updatedAt
          : null,
      navigationRevision: navigation.body.revision,
    })

    const timestamps = [
      typeof home === 'object' && home && 'updatedAt' in home ? String(home.updatedAt || '') : '',
      typeof siteSettings === 'object' && siteSettings && 'updatedAt' in siteSettings
        ? String(siteSettings.updatedAt || '')
        : '',
      navigation.lastModified || '',
    ]
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())

    return {
      body: {
        version: 1,
        home,
        siteSettings,
        navigation: navigation.body,
        revision,
      },
      lastModified: timestamps[0]?.toISOString() || null,
    }
  },
  ['storefront-bootstrap-v1'],
  {
    revalidate: 300,
    tags: ['storefront-bootstrap'],
  },
)

/**
 * GET /api/storefront/bootstrap
 *
 * Single public bootstrap for the storefront shell + Home. The runtime cache
 * keeps Payload/Postgres out of the hot path even when the CDN misses.
 */
export async function GET(request: Request) {
  try {
    const result = await measureServerOperation(
      'navigation',
      'storefront.bootstrap.v1',
      loadBootstrap,
    )

    return publicJSON(request, result.body, {
      revision: result.body.revision,
      lastModified: result.lastModified,
      maxAge: 300,
      staleWhileRevalidate: 3600,
    })
  } catch (error) {
    console.error({
      event: 'storefront.bootstrap.v1.failed',
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return publicError(500, 'bootstrap_failed', 'Não foi possível carregar a vitrine agora.')
  }
}
