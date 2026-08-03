import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { editorialPreviewURL } from '../../src/admin/editorial/previewURL'

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

  it('mantém filtros e drilldown de Relatórios representados na URL ativa', () => {
    const reports = source('src/admin/modules/reports/ReportsWorkspaceClient.tsx')
    expect(reports).toContain("params.set('from'")
    expect(reports).toContain("params.set('to'")
    expect(reports).toContain("params.set('source'")
    expect(reports).toContain("params.set('product'")
    expect(reports).toContain("params.set('mode', 'drilldown')")
    expect(reports).toContain("params.set('kind', request.kind)")
    expect(reports).toContain('window.history.replaceState')
  })

  it('usa preview interno autenticado como fallback e preserva override externo', () => {
    expect(editorialPreviewURL({ collection: 'products', id: 12, slug: 'nodulo-i' })).toBe('/preview/editorial/product/12')
    expect(editorialPreviewURL({ collection: 'categories', id: 'green', slug: 'esculturas' })).toBe('/preview/editorial/category/green')

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
