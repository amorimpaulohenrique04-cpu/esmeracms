import config from '@payload-config'
import { getPayload } from 'payload'

import { measureServerOperation } from '../../../../../../server/performance'
import { StorefrontContractV2Error } from '../../../../../../server/storefront-v2/contracts'
import {
  buildCollectionV2,
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
  const url = new URL(request.url)
  const page = url.searchParams.get('page') || '1'
  const limit = url.searchParams.get('limit') || 'default'
  const filterCount = Array.from(url.searchParams.keys()).filter((key) => !['page', 'limit', 'sort'].includes(key)).length

  try {
    const result = await measureServerOperation('navigation', 'storefront.collection.v2', () =>
      buildCollectionV2(payload, slug, url.searchParams))
    payload.logger.info({
      event: 'storefront.collection.v2.served',
      slug,
      page,
      limit,
      filterCount,
      returned: result.body.items.length,
      listingMode: result.body.category.nodeType,
    })
    return publicJSON(request, result.body, {
      revision: result.body.revision,
      lastModified: result.lastModified,
      maxAge: 45,
      staleWhileRevalidate: 180,
    })
  } catch (error) {
    payload.logger.error({
      event: 'storefront.collection.v2.failed',
      slug,
      page,
      limit,
      filterCount,
      error: error instanceof Error ? error.message : 'unknown_error',
      contractFailure: error instanceof StorefrontContractV2Error,
    })
    if (error instanceof StorefrontInputError) return publicError(400, 'invalid_query', error.message)
    if (error instanceof StorefrontNotFoundError) return publicError(404, 'collection_not_found', error.message)
    if (error instanceof StorefrontContractV2Error || error instanceof StorefrontConfigurationError) {
      return publicError(422, 'collection_inconsistent', 'A coleção pública possui uma configuração inconsistente.')
    }
    return publicError(500, 'collection_failed', 'Não foi possível carregar esta coleção agora.')
  }
}
