import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { measureServerOperation } from '../../../../../../server/performance'
import { canonicalStorefrontQuery } from '../../../../../../server/storefront-v2/cacheKey'
import { StorefrontContractV2Error } from '../../../../../../server/storefront-v2/contracts'
import {
  buildCollectionV2,
  StorefrontConfigurationError,
  StorefrontInputError,
  StorefrontNotFoundError,
} from '../../../../../../server/storefront-v2/catalog'
import { publicError, publicJSON } from '../../../../../../server/storefront-v2/http'
import {
  readCanonicalMaterialFilters,
  withCanonicalMaterialFilters,
} from '../../../../../../server/storefront-v2/materialFilters'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ slug: string }>
}

const loadCollection = unstable_cache(
  async (slug: string, query: string) => {
    const payload = await getPayload({ config })
    const searchParams = new URLSearchParams(query)
    const materialFilters = readCanonicalMaterialFilters(searchParams)
    const catalogPayload = withCanonicalMaterialFilters(payload, materialFilters)
    return await buildCollectionV2(catalogPayload, slug, searchParams)
  },
  ['storefront-collection-v2'],
  {
    revalidate: 45,
    tags: ['storefront-collections'],
  },
)

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const url = new URL(request.url)
  const query = canonicalStorefrontQuery(url.searchParams)
  const page = url.searchParams.get('page') || '1'
  const limit = url.searchParams.get('limit') || 'default'
  const filterCount = Array.from(url.searchParams.keys()).filter((key) => !['page', 'limit', 'sort'].includes(key)).length

  try {
    const result = await measureServerOperation(
      'operational',
      'storefront.collection.v2',
      () => loadCollection(slug, query),
    )
    return publicJSON(request, result.body, {
      revision: result.body.revision,
      lastModified: result.lastModified,
      maxAge: 45,
      staleWhileRevalidate: 180,
    })
  } catch (error) {
    console.error({
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
