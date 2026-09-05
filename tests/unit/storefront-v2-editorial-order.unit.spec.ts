import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { buildProductsV2 } from '../../src/server/storefront-v2/catalog'

type RecordValue = Record<string, unknown>

function payloadStub() {
  const find = vi.fn(async (args: RecordValue) => {
    if (args.collection === 'categories') return { docs: [] }
    if (args.collection === 'products') {
      return {
        docs: [],
        page: typeof args.page === 'number' ? args.page : 1,
        limit: typeof args.limit === 'number' ? args.limit : 24,
        totalDocs: 0,
        totalPages: 0,
        hasNextPage: false,
        nextPage: null,
        hasPrevPage: false,
        prevPage: null,
      }
    }
    throw new Error(`collection inesperada: ${String(args.collection)}`)
  })
  const findGlobal = vi.fn(async () => ({}))

  return {
    payload: { find, findGlobal } as unknown as Payload,
    find,
  }
}

function listingSort(find: ReturnType<typeof vi.fn>) {
  const productQueries = find.mock.calls
    .map(([args]) => args as RecordValue)
    .filter((args) => args.collection === 'products')

  return productQueries[0]?.sort
}

describe('storefront product editorial order', () => {
  it('uses the CMS editorial order before pagination when no sort is selected', async () => {
    const { payload, find } = payloadStub()

    await buildProductsV2(payload, new URLSearchParams('page=1&limit=24'))

    expect(listingSort(find)).toEqual(['order', 'id'])
  })

  it('uses the user-selected sort instead of editorial order', async () => {
    const { payload, find } = payloadStub()

    await buildProductsV2(payload, new URLSearchParams('page=1&limit=24&sort=price_desc'))

    expect(listingSort(find)).toEqual(['-basePriceCents', 'id'])
  })
})
