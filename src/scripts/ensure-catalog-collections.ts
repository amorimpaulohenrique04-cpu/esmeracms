import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

const COLLECTIONS_ROOT_SLUG = 'colecoes'

const DESIRED_COLLECTIONS = [
  { title: 'Coleção Fuchsita', slug: 'colecao-fuchsita' },
  { title: 'Coleção Esmeralda', slug: 'colecao-esmeralda' },
  { title: 'Coleção Bege Bahia', slug: 'colecao-bege-bahia' },
  { title: 'Coleção Essência', slug: 'colecao-essencia' },
  { title: 'Coleção Fé', slug: 'colecao-fe' },
  { title: 'Coleção Alento', slug: 'colecao-alento' },
  { title: 'Coleção Serpentinita', slug: 'colecao-serpentinita' },
  { title: 'Coleção Ônix Calcário', slug: 'colecao-onix-calcario' },
] as const

type CategoryRow = {
  id: string | number
  slug?: string | null
  order?: number | null
}

async function main() {
  const payload = await getPayload({ config: await config })

  const rootResult = await payload.find({
    collection: 'categories',
    depth: 0,
    draft: true,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: { slug: { equals: COLLECTIONS_ROOT_SLUG } },
    select: { id: true, slug: true },
  })

  const root = rootResult.docs[0] as CategoryRow | undefined
  if (!root) {
    throw new Error(`Categoria raiz não encontrada: ${COLLECTIONS_ROOT_SLUG}`)
  }

  const desiredSlugs = DESIRED_COLLECTIONS.map((collection) => collection.slug)
  const existingResult = await payload.find({
    collection: 'categories',
    depth: 0,
    draft: true,
    limit: 100,
    pagination: false,
    overrideAccess: true,
    where: { slug: { in: desiredSlugs as unknown as string[] } },
    select: { id: true, slug: true },
  })

  const existingSlugs = new Set(
    (existingResult.docs as unknown as CategoryRow[])
      .map((category) => category.slug)
      .filter((slug): slug is string => Boolean(slug)),
  )

  const childrenResult = await payload.find({
    collection: 'categories',
    depth: 0,
    draft: true,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    where: { parent: { equals: root.id } },
    select: { id: true, order: true },
  })

  let nextOrder = Math.max(
    0,
    ...(childrenResult.docs as unknown as CategoryRow[]).map((category) => Number(category.order) || 0),
  )

  const created: string[] = []
  const reused: string[] = []

  for (const desired of DESIRED_COLLECTIONS) {
    if (existingSlugs.has(desired.slug)) {
      reused.push(desired.slug)
      continue
    }

    nextOrder += 1
    const category = await payload.create({
      collection: 'categories',
      depth: 0,
      draft: true,
      overrideAccess: true,
      data: {
        title: desired.title,
        slug: desired.slug,
        status: 'active',
        nodeType: 'collection',
        taxonomyAxis: 'collection',
        parent: root.id,
        order: nextOrder,
        menu: { showInMenu: true, label: desired.title, visibility: 'all' },
        listingMode: 'assigned',
        collectionPage: {
          visibleFilters: ['category', 'collection', 'environment', 'piece_type', 'material', 'availability', 'price'],
          defaultSort: 'editorial',
          productsPerPage: 24,
          showProductCount: true,
          layout: 'grid',
        },
        _status: 'draft',
      } as never,
    })

    await payload.update({
      collection: 'categories',
      id: category.id,
      depth: 0,
      draft: false,
      overrideAccess: true,
      data: { _status: 'published' } as never,
    })
    created.push(desired.slug)
  }

  payload.logger.info({
    event: 'catalog-collections.ensure.completed',
    root: COLLECTIONS_ROOT_SLUG,
    desired: DESIRED_COLLECTIONS.length,
    created,
    reused,
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
