import config from '@payload-config'
import { getPayload } from 'payload'

import { measureServerOperation } from '../../../../../server/performance'
import { StorefrontContractV2Error } from '../../../../../server/storefront-v2/contracts'
import { buildNavigationV2, StorefrontConfigurationError } from '../../../../../server/storefront-v2/catalog'
import { publicError, publicJSON } from '../../../../../server/storefront-v2/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  try {
    const result = await measureServerOperation('navigation', 'storefront.navigation.v2', () => buildNavigationV2(payload))
    return publicJSON(request, result.body, {
      revision: result.body.revision,
      lastModified: result.lastModified,
      maxAge: 300,
      staleWhileRevalidate: 900,
    })
  } catch (error) {
    payload.logger.error({
      event: 'storefront.navigation.v2.failed',
      error: error instanceof Error ? error.message : 'unknown_error',
      contractFailure: error instanceof StorefrontContractV2Error,
    })
    if (error instanceof StorefrontContractV2Error || error instanceof StorefrontConfigurationError) {
      return publicError(422, 'navigation_inconsistent', 'A navegação pública está temporariamente indisponível.')
    }
    return publicError(500, 'navigation_failed', 'Não foi possível carregar a navegação agora.')
  }
}
