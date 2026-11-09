import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { RevisionConflictError } from '../../src/server/publication/types'
import { assertStudioGallery, STUDIO_DRAFT_VERSION, studioDraftData, StudioInputError } from '../../src/server/studio/productDraft'

const media = (count: number) => ({ find: vi.fn(async () => ({ docs: Array.from({ length: count }, (_, id) => ({ id })) })) }) as never
const gallery = [{ image: 1, mediaKey: 'capa', role: 'detail', alt: 'Vaso' }, { image: 2, mediaKey: 'lado_2', role: 'cover', alt: 'Lado' }]

describe('studioDraftData', () => {
  it('mantém o que a ficha não enviou', () => {
    const data = studioDraftData({ title: 'Vaso' })
    expect(data).toEqual({ title: 'Vaso', _status: 'draft' })
    expect(data).not.toHaveProperty('description')
    expect(data).not.toHaveProperty('categories')
    expect(data).not.toHaveProperty('gallery')
  })

  it('converte a descrição em parágrafos e define capa pela ordem', () => {
    const data = studioDraftData({ descriptionText: 'Linha 1\n\nLinha 3', gallery })
    const root = (data.description as { root: { children: Array<{ children: unknown[] }> } }).root
    expect(root.children).toHaveLength(3)
    expect(root.children[1].children).toEqual([])
    expect(data.gallery?.map((item) => item.role)).toEqual(['cover', 'detail'])
  })

  it('limpa a descrição com texto vazio', () => {
    expect(studioDraftData({ descriptionText: '' }).description).toBeNull()
  })

  it.each([
    [{ categories: [1, 1] }],
    [{ categories: ['a b'] }],
    [{ catalogStatus: 'other' }],
    [{ attributes: [{ label: ' ', value: 'x' }] }],
    [{ gallery: [{ ...gallery[0], alt: ' ' }] }],
    [{ gallery: [gallery[0], gallery[0]] }],
    [{ gallery: [], catalogStatus: 'active' }],
  ])('recusa entrada inválida %j', (input) => {
    expect(() => studioDraftData(input)).toThrow(StudioInputError)
  })
})

describe('assertStudioGallery', () => {
  const data = { gallery: [{ image: 1, mediaKey: 'capa', role: 'cover', alt: 'Vaso' }] }

  it('não consulta mídia sem alteração de galeria', async () => {
    const payload = media(0)
    await assertStudioGallery(payload, null, null, {})
    expect((payload as unknown as { find: ReturnType<typeof vi.fn> }).find).not.toHaveBeenCalled()
  })

  it('protege imagens usadas por variantes', async () => {
    const current = { variants: [{ mediaKeys: [{ key: 'removida' }] }] }
    await expect(assertStudioGallery(media(1), null, current, data)).rejects.toThrow(RevisionConflictError)
  })

  it('exige mídia publicada', async () => {
    await expect(assertStudioGallery(media(0), null, null, data)).rejects.toThrow(RevisionConflictError)
    await expect(assertStudioGallery(media(1), null, null, data)).resolves.toBeUndefined()
  })
})

describe('rotas usadas pelo Studio', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  it('anuncia o contrato atual', () => {
    expect(STUDIO_DRAFT_VERSION).toBe(2)
    expect(source('src/app/(payload)/api/admin-products/route.ts')).toContain('studioDraftVersion: STUDIO_DRAFT_VERSION')
  })

  it('a lixeira respeita o acesso e restaura como rascunho', () => {
    const route = source('src/app/(payload)/api/admin-products/route.ts')
    expect(route).toMatch(/action === 'trash' \|\| action === 'untrash'/)
    expect(route).toContain("{ deletedAt: null, _status: 'draft' }")
    expect(route).toMatch(/trash: true,\s+depth: 0,\s+overrideAccess: false/)
  })

  it('categoria em uso não vai para a lixeira', () => {
    const route = source('src/app/(payload)/api/admin-categories/route.ts')
    expect(route).toContain("body.action === 'trash'")
    expect(route).toContain('children.totalDocs || products.totalDocs || editorial')
  })
})
