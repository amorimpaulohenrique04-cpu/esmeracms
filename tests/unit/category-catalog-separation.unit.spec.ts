import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { moveWithinSiblings, siblingsOf } from '../../src/admin/modules/categories/hierarchy'
import { categoryStatePills, matchesCategoryView } from '../../src/admin/modules/categories/types'
import { nextAvailableSlug } from '../../src/businessRules/categories/slug'
import { buildCatalogCategoriesV2, buildNavigationV2 } from '../../src/server/storefront-v2/catalog'
import { publicCacheHeaders } from '../../src/server/storefront-v2/http'

type RecordValue = Record<string, unknown>

function category(id: number, slug: string, overrides: RecordValue = {}) {
  return {
    id,
    title: slug,
    slug,
    status: 'active',
    _status: 'published',
    order: id * 100,
    parent: null,
    nodeType: 'collection',
    taxonomyAxis: 'navigation',
    listingMode: 'assigned',
    menu: { showInMenu: true, visibility: 'all' },
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  }
}

function payloadWith(categories: RecordValue[], navigation: RecordValue = {}) {
  return {
    find: vi.fn(async () => ({ docs: categories })),
    findGlobal: vi.fn(async (args: RecordValue) => args.slug === 'navigation' ? navigation : {}),
  } as unknown as Payload
}

const colecoes = category(3, 'colecoes', { order: 3900 })
const presenteaveis = category(94, 'presenteaveis', { order: 100 })
const escultura = category(92, 'escultura', { order: 100, parent: null })
const oculta = category(93, 'caixa-quadro-acrilico', { parent: 3, menu: { showInMenu: false } })

describe('categorias, menu e catálogo', () => {
  it('Exibir no menu controla só a navegação', async () => {
    const payload = payloadWith([colecoes, presenteaveis, oculta])
    const navigation = await buildNavigationV2(payload)
    const catalog = await buildCatalogCategoriesV2(payload)

    const labels = JSON.stringify(navigation.body.roots)
    expect(labels).toContain('presenteaveis')
    expect(labels).not.toContain('caixa-quadro-acrilico')
    expect(catalog.map((item) => item.slug)).toContain('caixa-quadro-acrilico')
  })

  it('Escultura sem categoria principal é raiz do menu, e não filha de COLEÇÕES', async () => {
    const navigation = await buildNavigationV2(payloadWith([colecoes, escultura]))
    expect(navigation.body.roots.map((root) => root.slug)).toEqual(['escultura', 'colecoes'])
    expect(navigation.body.roots.find((root) => root.slug === 'colecoes')?.children).toEqual([])
  })

  it('catálogo só traz coleções de verdade, com a hierarquia preservada', async () => {
    const catalog = await buildCatalogCategoriesV2(payloadWith([
      colecoes,
      oculta,
      category(5, 'grupo', { nodeType: 'group' }),
      category(6, 'pagina', { nodeType: 'editorial' }),
    ]))
    expect(catalog.map((item) => item.slug)).toEqual(['colecoes', 'caixa-quadro-acrilico'])
    expect(catalog[1]).toMatchObject({ id: '93', parentId: '3' })
  })

  it('rascunhos e arquivadas não entram: a consulta exige ativa e publicada', async () => {
    const payload = payloadWith([colecoes])
    await buildCatalogCategoriesV2(payload)
    const args = vi.mocked(payload.find).mock.calls[0][0] as RecordValue
    expect(args.draft).toBe(false)
    expect(JSON.stringify(args.where)).toContain('"status":{"equals":"active"}')
    expect(JSON.stringify(args.where)).toContain('"_status":{"equals":"published"}')
  })
})

describe('cache público', () => {
  it('etiqueta a resposta para poder limpar o CDN', () => {
    const headers = publicCacheHeaders({ maxAge: 60, staleWhileRevalidate: 300, cacheTags: ['storefront-navigation', 'storefront-bootstrap'] })
    expect(headers.get('Vercel-Cache-Tag')).toBe('storefront-navigation,storefront-bootstrap')
    expect(headers.get('Vercel-CDN-Cache-Control')).toContain('s-maxage=60')
    expect(headers.get('Vercel-CDN-Cache-Control')).toContain('stale-if-error=86400')
  })

  it('bootstrap e navegação não voltam a TTLs longos', () => {
    for (const route of ['bootstrap', 'navigation']) {
      const source = readFileSync(path.resolve(`src/app/(payload)/api/storefront/${route}/route.ts`), 'utf8')
      expect(source).toMatch(/maxAge: 60,\s+staleWhileRevalidate: 300,/)
      expect(source).toContain('cacheTags')
    }
  })

  it('categorias e produtos estão ligados à invalidação', () => {
    for (const file of ['src/collections/Categories.ts', 'src/collections/Products.ts']) {
      const source = readFileSync(path.resolve(file), 'utf8')
      expect(source).toContain('invalidateStorefrontAfterChange')
      expect(source).toContain('invalidateStorefrontAfterDelete')
    }
    for (const file of ['Navigation', 'Home', 'SiteSettings', 'CollectionPage']) {
      expect(readFileSync(path.resolve(`src/globals/${file}.ts`), 'utf8')).toContain('invalidateStorefrontAfterGlobalChange')
    }
  })
})

describe('estados da categoria', () => {
  const labels = (input: Parameters<typeof categoryStatePills>[0]) => categoryStatePills(input).map((pill) => pill.label)

  it('usa linguagem da cliente', () => {
    expect(labels({ status: 'active', _status: 'draft', published: false, menu: { showInMenu: true } })).toEqual(['Rascunho'])
    expect(labels({ status: 'active', _status: 'published', published: true, menu: { showInMenu: true } })).toEqual(['Publicado no site'])
    expect(labels({ status: 'active', _status: 'draft', published: true, menu: { showInMenu: true } })).toEqual(['Publicado, com alterações não publicadas'])
    expect(labels({ status: 'active', _status: 'published', published: true, menu: { showInMenu: false } })).toEqual(['Publicado no site', 'Oculto do menu'])
    expect(labels({ status: 'archive', _status: 'published', published: true })).toEqual(['Arquivada'])
  })

  it('filtra pela situação real no site', () => {
    const rascunho = { _status: 'draft', published: false, menu: { showInMenu: true } }
    const pendente = { _status: 'draft', published: true, menu: { showInMenu: false } }
    expect(matchesCategoryView(rascunho, 'draft')).toBe(true)
    expect(matchesCategoryView(pendente, 'published')).toBe(true)
    expect(matchesCategoryView(pendente, 'hidden')).toBe(true)
    expect(matchesCategoryView(rascunho, 'hidden')).toBe(false)
  })
})

describe('reorganização entre irmãs', () => {
  const tree = [
    { id: 1, parent: null },
    { id: 11, parent: 1 },
    { id: 12, parent: 1 },
    { id: 2, parent: null },
    { id: 21, parent: 2 },
    { id: 3, parent: null },
  ]
  const ids = (nodes: Array<{ id: number }> | null) => nodes?.map((node) => node.id)

  it('lista só o mesmo nível', () => {
    expect(ids(siblingsOf(tree, 12))).toEqual([11, 12])
    expect(ids(siblingsOf(tree, 2))).toEqual([1, 2, 3])
  })

  it('leva as filhas junto', () => {
    expect(ids(moveWithinSiblings(tree, 2, 0))).toEqual([2, 21, 1, 11, 12, 3])
    expect(ids(moveWithinSiblings(tree, 1, 2))).toEqual([2, 21, 3, 1, 11, 12])
  })

  it('não mistura níveis', () => {
    expect(ids(moveWithinSiblings(tree, 12, 0))).toEqual([1, 12, 11, 2, 21, 3])
  })

  it('recusa movimentos sem efeito', () => {
    expect(moveWithinSiblings(tree, 1, 0)).toBeNull()
    expect(moveWithinSiblings(tree, 1, 9)).toBeNull()
    expect(moveWithinSiblings(tree, 99, 0)).toBeNull()
  })
})

describe('slug automático', () => {
  it('usa o nome e resolve colisões', () => {
    expect(nextAvailableSlug('vasos', new Set())).toBe('vasos')
    expect(nextAvailableSlug('vasos', new Set(['vasos']))).toBe('vasos-2')
    expect(nextAvailableSlug('vasos', new Set(['vasos', 'vasos-2']))).toBe('vasos-3')
  })
})

describe('migrações de importação', () => {
  it('todo campo retomável do produto tem coluna criada de forma idempotente', () => {
    const migration = readFileSync(path.resolve('src/migrations/20261108_170000_resumable_product_imports.ts'), 'utf8')
    const collection = readFileSync(path.resolve('src/collections/ProductImports.ts'), 'utf8')
    for (const [field, column] of [['resumable', 'resumable'], ['mediaCache', 'media_cache'], ['leaseToken', 'lease_token'], ['leaseUntil', 'lease_until']]) {
      expect(collection).toContain(`name: '${field}'`)
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`)
    }
  })

  it('a ordenação editorial nunca roda de novo por um migrate genérico', () => {
    // Ela reescreve a ordem dos produtos: só pode constar como já aplicada.
    const index = readFileSync(path.resolve('src/migrations/index.ts'), 'utf8')
    expect(index).toContain('20260905_101500_product_editorial_order')
  })
})
