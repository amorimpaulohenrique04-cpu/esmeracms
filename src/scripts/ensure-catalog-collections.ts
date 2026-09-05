import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

const COLLECTIONS_ROOT_SLUG = 'colecoes'

const DESIRED_COLLECTIONS = [
  {
    title: 'Dolomita amarela',
    slug: 'colecao-dolomita-amarela',
    aliases: [],
  },
  {
    title: 'Dolomita laranja',
    slug: 'colecao-dolomita-laranja',
    aliases: [],
  },
  {
    title: 'Jadeíta',
    slug: 'colecao-jadeita',
    aliases: [],
  },
  {
    title: 'Rocha de esmeralda',
    slug: 'colecao-rocha-de-esmeralda',
    aliases: ['colecao-esmeralda'],
  },
  {
    title: 'Bege Bahia',
    slug: 'colecao-bege-bahia',
    aliases: [],
  },
  {
    title: 'Fuschita',
    slug: 'colecao-fuschita',
    aliases: ['colecao-fuchsita', 'colecao-fucshita'],
  },
  {
    title: 'Serpentinita',
    slug: 'colecao-serpentinita',
    aliases: [],
  },
  {
    title: 'Ônix',
    slug: 'colecao-onix',
    aliases: ['colecao-onix-calcario'],
  },
  {
    title: 'Outras',
    slug: 'colecao-outras',
    aliases: [],
  },
] as const

type CategoryRow = {
  id: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  taxonomyAxis?: string | null
  parent?: unknown
  order?: number | null
  _status?: string | null
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

  const lookupSlugs = DESIRED_COLLECTIONS.flatMap((collection) => [collection.slug, ...collection.aliases])
  const existingResult = await payload.find({
    collection: 'categories',
    depth: 0,
    draft: true,
    limit: 200,
    pagination: false,
    overrideAccess: true,
    where: { slug: { in: lookupSlugs as unknown as string[] } },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      taxonomyAxis: true,
      parent: true,
      order: true,
      _status: true,
    },
  })

  const existingBySlug = new Map(
    (existingResult.docs as unknown as CategoryRow[])
      .filter((category) => category.slug)
      .map((category) => [category.slug as string, category]),
  )

  const childrenResult = await payload.find({
    collection: 'categories',
    depth: 0,
    draft: true,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    where: { parent: { equals: root.id } },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      taxonomyAxis: true,
      order: true,
      _status: true,
    },
  })

  let nextOrder = Math.max(
    0,
    ...(childrenResult.docs as unknown as CategoryRow[]).map((category) => Number(category.order) || 0),
  )

  const created: string[] = []
  const renamed: string[] = []
  const reused: string[] = []
  const canonicalIDs = new Set<string | number>()

  for (const desired of DESIRED_COLLECTIONS) {
    const canonical = existingBySlug.get(desired.slug)
    const alias = desired.aliases
      .map((slug) => existingBySlug.get(slug))
      .find((category): category is CategoryRow => Boolean(category))
    const found = canonical || alias

    if (found) {
      await payload.update({
        collection: 'categories',
        id: found.id,
        depth: 0,
        draft: false,
        overrideAccess: true,
        data: {
          title: desired.title,
          slug: desired.slug,
          status: 'active',
          nodeType: 'collection',
          taxonomyAxis: 'collection',
          parent: root.id,
          menu: { showInMenu: true, label: desired.title, visibility: 'all' },
          listingMode: 'assigned',
          _status: 'published',
        } as never,
      })
      canonicalIDs.add(found.id)
      if (found.slug === desired.slug && found.title === desired.title) reused.push(desired.slug)
      else renamed.push(`${found.slug || found.id} -> ${desired.slug}`)
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
    canonicalIDs.add(category.id)
    created.push(desired.slug)
  }

  const refreshedChildren = await payload.find({
    collection: 'categories',
    depth: 0,
    draft: true,
    limit: 500,
    pagination: false,
    overrideAccess: true,
    where: { parent: { equals: root.id } },
    select: { id: true, title: true, slug: true, status: true, taxonomyAxis: true, _status: true },
  })

  const archived: string[] = []
  for (const category of refreshedChildren.docs as unknown as CategoryRow[]) {
    if (category.taxonomyAxis !== 'collection') continue
    if (canonicalIDs.has(category.id)) continue
    if (category.status === 'archive') continue

    await payload.update({
      collection: 'categories',
      id: category.id,
      depth: 0,
      draft: false,
      overrideAccess: true,
      data: { status: 'archive', _status: 'published' } as never,
    })
    archived.push(category.slug || String(category.id))
  }

  payload.logger.info({
    event: 'catalog-collections.ensure.completed',
    root: COLLECTIONS_ROOT_SLUG,
    desired: DESIRED_COLLECTIONS.length,
    created,
    renamed,
    reused,
    archived,
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
