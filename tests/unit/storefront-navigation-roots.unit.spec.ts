import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { buildNavigationV2 } from '../../src/server/storefront-v2/catalog'

type CategoryFixture = {
  id: string
  title: string
  slug: string
  parent: string | null
  order: number
  status: 'active' | 'archive'
  _status: 'published' | 'draft'
  nodeType: 'collection'
  taxonomyAxis: 'navigation'
  menu: { showInMenu: boolean; visibility: 'all' }
}

function category(
  slug: string,
  options: Partial<CategoryFixture> = {},
): CategoryFixture {
  return {
    id: slug,
    title: slug,
    slug,
    parent: null,
    order: 100,
    status: 'active',
    _status: 'published',
    nodeType: 'collection',
    taxonomyAxis: 'navigation',
    menu: { showInMenu: true, visibility: 'all' },
    ...options,
  }
}

function payloadWithNavigation(
  categories: CategoryFixture[],
  roots: Array<{ category: string; order: number }> = [],
  categoryLinks: string[] = [],
): Payload {
  return {
    find: async () => ({
      docs: categories.filter(
        (item) => item.status === 'active' && item._status === 'published',
      ),
    }),
    findGlobal: async ({ slug }: { slug: string }) =>
      slug === 'navigation' ? { roots, categoryLinks } : { officialChannels: [] },
  } as unknown as Payload
}

describe('storefront navigation: automatic CMS menu roots', () => {
  it('includes a newly published category without changing existing configured roots', async () => {
    const payload = payloadWithNavigation(
      [
        category('pecas', { order: 100 }),
        category('presenteaveis', { order: 10 }),
        category('oculta', { menu: { showInMenu: false, visibility: 'all' } }),
      ],
      [{ category: 'pecas', order: 20 }],
    )

    const { body } = await buildNavigationV2(payload)

    expect(body.roots.map((node) => node.slug)).toEqual(['pecas', 'presenteaveis'])
    expect(body.roots[1].href).toBe('/colecao/presenteaveis')
  })

  it('does not duplicate explicitly configured roots', async () => {
    const payload = payloadWithNavigation(
      [category('pecas'), category('presenteaveis')],
      [{ category: 'pecas', order: 1 }, { category: 'presenteaveis', order: 2 }],
    )

    const { body } = await buildNavigationV2(payload)

    expect(body.roots.map((node) => node.slug)).toEqual(['pecas', 'presenteaveis'])
  })

  it('keeps visible children nested under their visible parent', async () => {
    const payload = payloadWithNavigation([
      category('pecas'),
      category('esculturas', { parent: 'pecas' }),
    ])

    const { body } = await buildNavigationV2(payload)

    expect(body.roots.map((node) => node.slug)).toEqual(['pecas'])
    expect(body.roots[0].children.map((node) => node.slug)).toEqual(['esculturas'])
  })

  it('promotes visible children when a parent is not shown in the menu', async () => {
    const payload = payloadWithNavigation([
      category('colecao-oculta', {
        menu: { showInMenu: false, visibility: 'all' },
      }),
      category('presenteaveis', { parent: 'colecao-oculta' }),
    ])

    const { body } = await buildNavigationV2(payload)

    expect(body.roots.map((node) => node.slug)).toEqual(['presenteaveis'])
  })

  it('keeps the category ordering when no roots are configured', async () => {
    const payload = payloadWithNavigation([
      category('pecas', { order: 200 }),
      category('presenteaveis', { order: 20 }),
      category('rascunho', { _status: 'draft' }),
      category('arquivada', { status: 'archive' }),
    ])

    const { body } = await buildNavigationV2(payload)

    expect(body.roots.map((node) => node.slug)).toEqual(['presenteaveis', 'pecas'])
  })

  it('keeps legacy selected roots and appends categories registered afterwards', async () => {
    const payload = payloadWithNavigation(
      [category('pecas'), category('presenteaveis')],
      [],
      ['pecas'],
    )

    const { body } = await buildNavigationV2(payload)

    expect(body.roots.map((node) => node.slug)).toEqual(['pecas', 'presenteaveis'])
  })
})
