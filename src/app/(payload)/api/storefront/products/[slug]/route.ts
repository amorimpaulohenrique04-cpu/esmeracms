import config from '@payload-config'
import { getPayload } from 'payload'

import { measureServerOperation } from '../../../../../../server/performance'
import { StorefrontContractV2Error } from '../../../../../../server/storefront-v2/contracts'
import {
  buildProductDetailV2,
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
    const result = await measureServerOperation('operational', 'storefront.product.v2', () =>
      buildProductDetailV2(payload, slug))
    payload.logger.info({
      event: 'storefront.product.v2.served',
      slug,
    })
    return publicJSON(request, result.body, {
      revision: result.body.revision,
      lastModified: result.lastModified,
      maxAge: 45,
      staleWhileRevalidate: 180,
    })
  } catch (error) {
    payload.logger.error({
      event: 'storefront.product.v2.failed',
      slug,
      error: error instanceof Error ? error.message : 'unknown_error',
      contractFailure: error instanceof StorefrontContractV2Error,
    })
    if (error instanceof StorefrontInputError) return publicError(400, 'invalid_query', error.message)
    if (error instanceof StorefrontNotFoundError) return publicError(404, 'product_not_found', error.message)
    if (error instanceof StorefrontContractV2Error) {
      return publicError(422, 'product_inconsistent', 'O produto público possui uma configuração inconsistente.')
    }
    return publicError(500, 'product_failed', 'Não foi possível carregar este produto agora.')
  }
}
