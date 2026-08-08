import config from '@payload-config'
import { getPayload } from 'payload'

import { measureServerOperation } from '../../../../../server/performance'
import { StorefrontContractV2Error } from '../../../../../server/storefront-v2/contracts'
import {
  buildProductsV2,
  StorefrontConfigurationError,
  StorefrontInputError,
  StorefrontNotFoundError,
} from '../../../../../server/storefront-v2/catalog'
import { publicError, publicJSON } from '../../../../../server/storefront-v2/http'

export const dynamic = 'force-dynamic'

/** GET /api/storefront/products — catálogo público enriquecido e paginado. */
export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const url = new URL(request.url)
  try {
    const result = await measureServerOperation('operational', 'storefront.products.v2', () =>
      buildProductsV2(payload, url.searchParams))
    return publicJSON(request, result.body, {
      revision: result.body.revision,
      lastModified: result.lastModified,
      maxAge: 45,
      staleWhileRevalidate: 180,
    })
  } catch (error) {
    payload.logger.error({
      event: 'storefront.products.v2.failed',
      error: error instanceof Error ? error.message : 'unknown_error',
      contractFailure: error instanceof StorefrontContractV2Error,
    })
    if (error instanceof StorefrontInputError) return publicError(400, 'invalid_query', error.message)
    if (error instanceof StorefrontNotFoundError) return publicError(404, 'catalog_page_not_found', error.message)
    if (error instanceof StorefrontContractV2Error || error instanceof StorefrontConfigurationError) {
      return publicError(422, 'catalog_inconsistent', 'O catálogo público possui uma configuração inconsistente.')
    }
    return publicError(500, 'catalog_failed', 'Não foi possível carregar o catálogo agora.')
  }
}
