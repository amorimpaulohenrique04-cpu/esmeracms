import config from '@payload-config'
import { getPayload } from 'payload'

import { measureServerOperation } from '../../../../../../server/performance'
import { StorefrontContractV2Error } from '../../../../../../server/storefront-v2/contracts'
import {
  buildEditorialPageV2,
  StorefrontConfigurationError,
  StorefrontInputError,
  StorefrontNotFoundError,
} from '../../../../../../server/storefront-v2/catalog'
import { publicError, publicJSON } from '../../../../../../server/storefront-v2/http'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const payload = await getPayload({ config })
  const { slug } = await context.params

  try {
    const result = await measureServerOperation('navigation', 'storefront.editorial.v2', () =>
      buildEditorialPageV2(payload, slug))
    return publicJSON(request, result.body, {
      revision: result.body.revision,
      lastModified: result.lastModified,
      maxAge: 300,
      staleWhileRevalidate: 900,
    })
  } catch (error) {
    payload.logger.error({
      event: 'storefront.editorial.v2.failed',
      slug,
      error: error instanceof Error ? error.message : 'unknown_error',
      contractFailure: error instanceof StorefrontContractV2Error,
    })
    if (error instanceof StorefrontInputError) return publicError(400, 'invalid_slug', error.message)
    if (error instanceof StorefrontNotFoundError) return publicError(404, 'page_not_found', error.message)
    if (error instanceof StorefrontContractV2Error || error instanceof StorefrontConfigurationError) {
      return publicError(422, 'page_inconsistent', 'A página pública possui uma configuração inconsistente.')
    }
    return publicError(500, 'page_failed', 'Não foi possível carregar esta página agora.')
  }
}
