import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { editorialPreviewURL } from '../../src/admin/editorial/previewURL'
import {
  parseInvestigation,
  popInvestigation,
  pushInvestigation,
  reportSearchParams,
  serializeInvestigation,
} from '../../src/admin/modules/reports/investigation'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Rodada 3 — interatividade avançada', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_EDITORIAL_PREVIEW_URL
  })

  it('mantém View Transition API como progressive enhancement com reduced motion', () => {
    const css = source('src/admin/design-system/advanced-interactions.scss')
    expect(css).toContain('@view-transition')
    expect(css).toContain('navigation: auto')
    expect(css).toContain('120ms')
    expect(css).toContain('220ms')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('navigation: none')
  })

  it('mantém a investigação de Relatórios serializável e reversível pela URL', () => {
    const first = { kind: 'source' as const, value: 'instagram', label: 'Instagram' }
    const second = { kind: 'product' as const, value: '42', label: 'Cartografia Verde' }
    const stack = pushInvestigation(pushInvestigation([], first), second)
    const serialized = serializeInvestigation(stack)

    expect(parseInvestigation(serialized)).toEqual(stack)
    expect(popInvestigation(stack)).toEqual([first])

    const params = reportSearchParams({
      period: { from: '2026-08-01T03:00:00.000Z', to: '2026-08-03T02:59:59.999Z' },
      compareWith: null,
      ownerId: null,
      source: 'instagram',
      categoryId: null,
      productId: 42,
    }, stack)
    expect(params.get('source')).toBe('instagram')
    expect(params.get('product')).toBe('42')
    expect(params.get('investigation')).toBe(serialized)
  })

  it('só cria preview quando uma rota draft real está configurada', () => {
    expect(editorialPreviewURL({ collection: 'products', id: 12, slug: 'nodulo-i' })).toBeNull()

    process.env.NEXT_PUBLIC_EDITORIAL_PREVIEW_URL = 'https://preview.esmera.test/{collection}/{slug}?document={id}'
    expect(editorialPreviewURL({ collection: 'products', id: 12, slug: 'nodulo-i' })).toBe('https://preview.esmera.test/products/nodulo-i?document=12&draft=true&source=esmera-cms')
  })

  it('expõe somente ações contextuais com rotas reais na command palette', () => {
    const route = source('src/app/(payload)/api/admin-search/route.ts')
    expect(route).toContain('contextualActions')
    expect(route).toContain('Nova categoria')
    expect(route).toContain('Novo follow-up')
    expect(route).toContain('/admin/collections/tasks/create?type=follow_up')
    expect(route).toContain('Copiar recorte atual')
    expect(route).not.toContain('mutation: undefined')
  })

  it('não adiciona biblioteca de motion à Rodada 3', () => {
    const packageJSON = source('package.json')
    expect(packageJSON).not.toContain('"motion"')
    expect(packageJSON).not.toContain('"framer-motion"')
  })
})
