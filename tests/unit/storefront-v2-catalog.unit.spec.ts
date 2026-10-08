import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { buildCollectionV2, buildNavigationV2, buildProductDetailV2, buildProductsV2 } from '../../src/server/storefront-v2/catalog'

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

  it('lists the catalog root with enriched card fields and payment terms', async () => {
    const product = {
      id: 11,
      slug: 'pulseira-esmera',
      title: 'Aurora',
      material: 'Esmeralda',
      availability: 'unique',
      priceMode: 'fixed',
      basePriceCents: 49000,
      physicalSpecs: { widthMm: 180, weightGrams: 1200 },
      gallery: [{ role: 'cover', image: { id: 52, url: '/media/aurora.jpg', alt: 'Aurora' } }],
      categories: [{ ...child, title: 'Pulseira' }],
      updatedAt: '2026-08-05T12:00:00.000Z',
    }
    const { payload, find } = payloadStub({
      categories: [root, child],
      products: [product],
      siteSettings: { paymentTerms: { enabled: true, maxInstallments: 12, minimumInstallmentCents: 1000, interestFree: true } },
    })

    const result = await buildProductsV2(payload, new URLSearchParams('page=1&limit=24&piece_type=vasos'))

    expect(result.body.items[0]).toMatchObject({
      identity: { name: 'Aurora', pieceType: 'Pulseira', material: 'Esmeralda' },
      specs: { widthMm: 180, weightGrams: 1200 },
      pricing: { mode: 'fixed', installment: { count: 12, amountCents: 4083, interestFree: true } },
    })
    expect(result.body).not.toHaveProperty('category')
    expect(result.body.catalog).toMatchObject({ title: 'Coleções', visibleFilters: expect.arrayContaining(['material', 'price']) })
    expect(find.mock.calls.find(([args]) => args.collection === 'products')?.[0].where).toMatchObject({
      and: expect.arrayContaining([{ categories: { contains: '2' } }]),
    })
  })

  it('preserves the original aspect ratio derivative in product detail galleries', async () => {
    const product = {
      id: 12,
      slug: 'vaso-horizontal',
      code: 'OBJ-012',
      title: 'Horizonte',
      material: 'Esmeralda',
      availability: 'available',
      priceMode: 'fixed',
      basePriceCents: 79000,
      gallery: [{
        role: 'cover',
        alt: 'Horizonte em composição horizontal',
        image: {
          id: 53,
          url: '/media/horizonte-original.jpg',
          alt: 'Horizonte',
          width: 2400,
          height: 1600,
          sizes: {
            productCard: { url: '/media/horizonte-900x1200.jpg', width: 900, height: 1200 },
            gallery: { url: '/media/horizonte-1800x1200.jpg', width: 1800, height: 1200 },
          },
        },
      }],
      categories: [{ ...child }],
      updatedAt: '2026-08-06T12:00:00.000Z',
    }
    const { payload } = payloadStub({
      categories: [root, child],
      products: [product],
    })

    const result = await buildProductDetailV2(payload, 'vaso-horizontal')

    expect(result.body.product.image).toMatchObject({
      url: '/media/horizonte-1800x1200.jpg',
      width: 1800,
      height: 1200,
    })
    expect(result.body.product.gallery[0]).toMatchObject({
      url: '/media/horizonte-1800x1200.jpg',
      width: 1800,
      height: 1200,
    })
  })

  it('uses uncropped media in listings and details, regardless of productCard crop', async () => {
    const product = {
      id: 13,
      slug: 'gelato-regression',
      title: 'Gelato',
      material: 'Rocha de esmeralda natural',
      availability: 'available',
      priceMode: 'fixed',
      basePriceCents: 49000,
      gallery: [{
        role: 'cover',
        alt: 'Gelato',
        image: {
          id: 54,
          url: '/media/gelato-original.jpg',
          width: 1200,
          height: 800,
          sizes: {
            productCard: { url: '/media/gelato-900x1200.jpg', width: 900, height: 1200 },
            gallery: { url: '/media/gelato-1800.jpg', width: 1200, height: 800 },
          },
        },
      }],
      categories: [{ ...child }],
      updatedAt: '2026-10-07T22:00:00.000Z',
    }
    const { payload } = payloadStub({
      categories: [root, child],
      products: [product],
    })

    const listing = await buildProductsV2(payload, new URLSearchParams('page=1&limit=24'))
    expect(listing.body.items[0].image).toMatchObject({
      url: '/media/gelato-1800.jpg',
      width: 1200,
      height: 800,
    })

    const detail = await buildProductDetailV2(payload, 'gelato-regression')
    expect(detail.body.product.image).toMatchObject({
      url: '/media/gelato-1800.jpg',
      width: 1200,
      height: 800,
    })
    expect(detail.body.product.gallery[0].url).toBe('/media/gelato-1800.jpg')
  })

  it('applies the same landscape selection on page 2, page 3 and category listings', async () => {
    const product = {
      id: 71,
      slug: 'gelato-page-two',
      title: 'Gelato',
      availability: 'available',
      priceMode: 'fixed',
      basePriceCents: 49000,
      gallery: [
        { role: 'cover', image: { id: 1047, url: '/gelato-horizontal.jpg', width: 1200, height: 800 } },
        { role: 'detail', image: { id: 1046, url: '/gelato-portrait.jpg', width: 1200, height: 1798 } },
        { role: 'detail', image: { id: 1048, url: '/gelato-horizontal-detail.jpg', width: 1200, height: 800 } },
      ],
      categories: [{ ...child }],
      updatedAt: '2026-10-07T22:00:00.000Z',
    }
    const { payload } = payloadStub({ categories: [root, child], products: [product] })

    for (const page of [2, 3]) {
      const listing = await buildProductsV2(payload, new URLSearchParams(`page=${page}&limit=24`))
      expect(listing.body.pagination.page).toBe(page)
      expect(listing.body.items[0].image?.url).toBe('/gelato-horizontal.jpg')
      expect(listing.body.items[0].hoverImage?.url).toBe('/gelato-horizontal-detail.jpg')
    }

    const collection = await buildCollectionV2(payload, 'pecas', new URLSearchParams('page=2&limit=24'))
    expect(collection.body.items[0].image?.url).toBe('/gelato-horizontal.jpg')
    expect(collection.body.items[0].hoverImage?.url).toBe('/gelato-horizontal-detail.jpg')

    const detail = await buildProductDetailV2(payload, 'gelato-page-two')
    expect(detail.body.product.gallery.map((media) => media.url)).toEqual([
      '/gelato-horizontal.jpg',
      '/gelato-portrait.jpg',
      '/gelato-horizontal-detail.jpg',
    ])
  })

  it('uses original for both cover and hover when only cropped variants exist', async () => {
    const product = {
      id: 14,
      slug: 'difusor-regression',
      title: 'Difusor em Bege Bahia',
      availability: 'available',
      priceMode: 'fixed',
      basePriceCents: 49000,
      gallery: [
        {
          role: 'cover',
          alt: 'Difusor frente',
          image: {
            id: 968,
            url: '/media/difusor-original.jpg',
            width: 1200,
            height: 801,
            sizes: { productCard: { url: '/media/difusor-900x1200.jpg', width: 900, height: 1200 } },
          },
        },
        {
          role: 'detail',
          alt: 'Difusor detalhe',
          image: {
            id: 969,
            url: '/media/difusor-detail-original.jpg',
            width: 1200,
            height: 886,
            sizes: { card: { url: '/media/difusor-detail-900x1125.jpg', width: 900, height: 1125 } },
          },
        },
      ],
      categories: [{ ...child }],
      updatedAt: '2026-10-07T22:00:00.000Z',
    }
    const { payload } = payloadStub({
      categories: [root, child],
      products: [product],
    })

    const listing = await buildProductsV2(payload, new URLSearchParams('page=1&limit=24'))
    expect(listing.body.items[0].image?.url).toBe('/media/difusor-original.jpg')
    expect(listing.body.items[0].hoverImage?.url).toBe('/media/difusor-detail-original.jpg')
  })
})
