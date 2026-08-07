import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { buildCollectionV2, buildNavigationV2 } from '../../src/server/storefront-v2/catalog'

type RecordValue = Record<string, unknown>

function payloadStub(options: {
  categories: RecordValue[]
  navigation?: RecordValue
  siteSettings?: RecordValue
  collectionPage?: RecordValue
  products?: RecordValue[]
}) {
  const products = options.products || []
  const find = vi.fn(async (args: RecordValue) => {
    if (args.collection === 'categories') return { docs: options.categories }
    if (args.collection === 'products') {
      const page = typeof args.page === 'number' ? args.page : 1
      const limit = typeof args.limit === 'number' ? args.limit : 24
      return {
        docs: products,
        page,
        limit,
        totalDocs: products.length,
        totalPages: products.length ? 1 : 0,
        hasNextPage: false,
        nextPage: null,
        hasPrevPage: false,
        prevPage: null,
      }
    }
    throw new Error(`collection inesperada: ${String(args.collection)}`)
  })
  const findGlobal = vi.fn(async (args: RecordValue) => {
    if (args.slug === 'navigation') return options.navigation || {}
    if (args.slug === 'site-settings') return options.siteSettings || {}
    if (args.slug === 'collection-page') return options.collectionPage || {}
    throw new Error(`global inesperada: ${String(args.slug)}`)
  })
  return {
    payload: { find, findGlobal } as unknown as Payload,
    find,
    findGlobal,
  }
}

const root = {
  id: 1,
  title: 'PEÇAS',
  slug: 'pecas',
  status: 'active',
  _status: 'published',
  order: 100,
  parent: null,
  nodeType: 'collection',
  taxonomyAxis: 'navigation',
  listingMode: 'descendants',
  menu: { showInMenu: true, label: 'PEÇAS', visibility: 'all' },
  collectionPage: { visibleFilters: ['category', 'material', 'price'], defaultSort: 'editorial', productsPerPage: 24, showProductCount: true, layout: 'grid' },
  updatedAt: '2026-08-01T12:00:00.000Z',
}

const child = {
  id: 2,
  title: 'Vasos',
  slug: 'vasos',
  status: 'active',
  _status: 'published',
  order: 100,
  parent: 1,
  nodeType: 'collection',
  taxonomyAxis: 'piece_type',
  listingMode: 'assigned',
  menu: { showInMenu: true, visibility: 'all' },
  updatedAt: '2026-08-02T12:00:00.000Z',
}

describe('storefront V2 catalog builders', () => {
  it('derives desktop and mobile navigation from the same category tree', async () => {
    const { payload } = payloadStub({
      categories: [root, child],
      navigation: { roots: [{ category: 1, order: 100, highlightLimit: 2 }], updatedAt: '2026-08-03T12:00:00.000Z' },
      siteSettings: {
        officialChannels: [
          { kind: 'whatsapp', value: '+55 11 99999-9999', active: true },
          { kind: 'instagram', value: '@esmera', active: true },
        ],
      },
    })

    const result = await buildNavigationV2(payload)
    expect(result.body.version).toBe(2)
    expect(result.body.roots).toHaveLength(1)
    expect(result.body.roots[0]).toMatchObject({ id: '1', href: '/colecao/pecas' })
    expect(result.body.roots[0].children[0]).toMatchObject({ id: '2', href: '/colecao/vasos', taxonomyAxis: 'piece_type' })
    expect(result.body.channels).toEqual({
      whatsapp: 'https://wa.me/5511999999999',
      instagram: 'https://instagram.com/esmera',
    })
  })

  it('returns a minimal public product contract with deterministic pagination', async () => {
    const product = {
      id: 10,
      slug: 'vaso-nodulo',
      code: 'OBJ-010',
      title: 'Nódulo',
      subtitle: 'Escultura em pedra',
      material: 'Esmeralda',
      availability: 'available',
      basePriceCents: 129900,
      gallery: [
        { role: 'cover', image: { id: 50, url: '/media/capa.jpg', alt: 'Nódulo frontal' }, alt: 'Nódulo frontal' },
        { role: 'detail', image: { id: 51, url: '/media/detalhe.jpg', alt: 'Detalhe' }, alt: 'Detalhe' },
      ],
      categories: [{ ...child }],
      updatedAt: '2026-08-04T12:00:00.000Z',
    }
    const { payload, find } = payloadStub({
      categories: [root, child],
      collectionPage: { visibleFilters: ['category', 'material', 'price'] },
      products: [product],
    })

    const result = await buildCollectionV2(payload, 'pecas', new URLSearchParams('page=1&limit=24&sort=editorial'))
    expect(result.body.items).toEqual([
      expect.objectContaining({
        id: '10',
        slug: 'vaso-nodulo',
        title: 'Nódulo',
        price: 129900,
        priceUnit: 'cent',
      }),
    ])
    expect(result.body.items[0].image).toMatchObject({ url: '/media/capa.jpg', alt: 'Nódulo frontal' })
    expect(result.body.pagination).toMatchObject({ page: 1, limit: 24, totalDocs: 1, totalPages: 1, hasNextPage: false })
    expect(result.body.facets.materials).toEqual([{ value: 'Esmeralda', label: 'Esmeralda', count: 1 }])

    const productQueries = find.mock.calls.map(([args]) => args).filter((args) => args.collection === 'products')
    expect(productQueries).toHaveLength(2)
    expect(productQueries[0].where).toMatchObject({
      and: expect.arrayContaining([
        { catalogStatus: { equals: 'active' } },
        { _status: { equals: 'published' } },
      ]),
    })
  })
})
