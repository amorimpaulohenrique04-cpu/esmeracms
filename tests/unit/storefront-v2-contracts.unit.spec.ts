import { describe, expect, it } from 'vitest'

import {
  assertCollectionV2,
  assertNavigationV2,
  validateCollectionV2,
  validateEditorialPageV2,
  validateNavigationV2,
} from '../../src/server/storefront-v2/contracts'

function node(id: string, children: unknown[] = []) {
  return {
    id,
    title: id,
    label: id,
    slug: id,
    nodeType: 'collection',
    taxonomyAxis: 'navigation',
    href: `/colecao/${id}`,
    visibility: 'all',
    children,
  }
}

describe('storefront V2 runtime contracts', () => {
  it('accepts a stable navigation tree and rejects duplicate roots', () => {
    const navigation = { version: 2, revision: 'rev-1', roots: [node('pecas', [node('vasos')])] }
    expect(validateNavigationV2(navigation)).toEqual([])
    expect(() => assertNavigationV2(navigation)).not.toThrow()

    const duplicated = { ...navigation, roots: [node('pecas'), node('pecas')] }
    expect(validateNavigationV2(duplicated)).toContain('navigation.roots.1 está duplicada.')
  })

  it('rejects cycles in the navigation tree', () => {
    const navigation = {
      version: 2,
      revision: 'rev-cycle',
      roots: [node('pecas', [node('pecas')])],
    }
    expect(validateNavigationV2(navigation).some((issue) => issue.includes('ciclo ou duplicata'))).toBe(true)
  })

  it('accepts collection pagination and rejects duplicate public products', () => {
    const collection = {
      version: 2,
      revision: 'rev-2',
      category: {
        id: '1',
        slug: 'pronta-entrega',
        title: 'Pronta entrega',
        visibleFilters: ['availability'],
      },
      items: [
        { id: 'p1', slug: 'vaso-1', title: 'Vaso 1', priceUnit: 'cent' },
      ],
      pagination: {
        page: 1,
        limit: 24,
        totalDocs: 1,
        totalPages: 1,
        hasNextPage: false,
        nextPage: null,
        hasPrevPage: false,
        prevPage: null,
      },
      facets: {},
      applied: {},
    }
    expect(validateCollectionV2(collection)).toEqual([])
    expect(() => assertCollectionV2(collection)).not.toThrow()

    const duplicated = { ...collection, items: [collection.items[0], collection.items[0]] }
    expect(validateCollectionV2(duplicated)).toContain('collection.items.1 está duplicado.')
  })

  it('rejects unsafe limits and incomplete editorial pages', () => {
    const badCollection = {
      version: 2,
      revision: 'rev-3',
      category: { id: '1', slug: 'pecas', title: 'Peças', visibleFilters: [] },
      items: [],
      pagination: { page: 0, limit: 49, totalDocs: 0, totalPages: 0 },
      facets: {},
      applied: {},
    }
    const collectionIssues = validateCollectionV2(badCollection)
    expect(collectionIssues).toContain('collection.pagination.page começa em 1.')
    expect(collectionIssues).toContain('collection.pagination.limit precisa estar entre 1 e 48.')

    expect(validateEditorialPageV2({ version: 2, revision: 'rev', page: { id: '1' } })).toEqual(expect.arrayContaining([
      'editorial.page.slug é obrigatório.',
      'editorial.page.title é obrigatório.',
      'editorial.page.content precisa ser uma lista.',
      'editorial.page.breadcrumb precisa ser uma lista.',
    ]))
  })
})
