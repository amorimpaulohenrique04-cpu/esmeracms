/**
 * PR-12B — Produtos, refinamento visual.
 *
 * Contrato visual lido direto da folha e dos componentes: prova que o
 * refinamento é puramente estético — sem novo status, sem retry novo, sem
 * troca na ordem de save/publish e sem `transition: all`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

const scss = source('src/admin/modules/products/products.scss')
const workspace = source('src/admin/modules/products/ProductsWorkspaceClient.tsx')
const draftForm = source('src/admin/modules/products/ProductDraftForm.tsx')
const view = source('src/admin/modules/products/ProductsView.tsx')

describe('PR-12B — Produtos visual', () => {
  it('não usa transition: all em nenhuma regra', () => {
    expect(scss).not.toMatch(/transition:\s*all/)
  })

  it('lista continua como modo padrão', () => {
    expect(view).toMatch(/view:\s*viewValue === 'grid' \? 'grid' : 'list'/)
  })

  it('thumbnail estável entre 48 e 56px, sem variar por breakpoint', () => {
    const rule = scss.match(/\.esmera-product-list-thumb\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const width = Number((rule?.[1].match(/width:\s*(\d+)px/) || [])[1])
    expect(width).toBeGreaterThanOrEqual(48)
    expect(width).toBeLessThanOrEqual(56)
    expect(scss.match(/\.esmera-product-list-thumb\s*\{/g)?.length).toBe(1)
  })

  it('zoom interno máximo 1.015, sem alterar frame ou crop', () => {
    expect(scss).toMatch(/scale\(1\.015\)/)
    expect(scss).not.toMatch(/scale\(1\.0[2-9]/)
    expect(scss).not.toMatch(/scale\(1\.[1-9]/)
    expect(scss).toContain('object-fit: cover')
  })

  it('ações secundárias revelam por hover e focus-within, mas ficam visíveis fora de hover fino (touch)', () => {
    const hoverBlock = scss.match(/@media \(hover: hover\) and \(pointer: fine\) \{([\s\S]*?)\n\}/)
    expect(hoverBlock).not.toBeNull()
    const body = hoverBlock?.[1] ?? ''
    expect(body).toMatch(/\.esmera-product-tile:focus-within \.esmera-product-tile__select/)
    expect(body).toMatch(/\.esmera-product-tile:focus-within \.esmera-product-tile__inspect/)
    expect(body).toMatch(/tbody tr:focus-within \.esmera-product-row-action/)
    // Fora do gate de hover fino, os seletores não têm opacity:0 aplicado — ou seja, em touch (sem match do media query) permanecem visíveis.
    const outsideHoverGate = scss.replace(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n\}/, '')
    expect(outsideHoverGate).not.toMatch(/\.esmera-product-tile__select\s*\{[^}]*opacity:\s*0/)
    expect(outsideHoverGate).not.toMatch(/\.esmera-product-row-action\s*\{[^}]*opacity:\s*0/)
  })

  it('bulk bar não interrompe a ordem de paginação: paginação some antes da barra de lote no fluxo', () => {
    const paginationIndex = workspace.indexOf('esmera-products-pagination')
    const bulkBarIndex = workspace.indexOf('<BulkActionBar')
    expect(paginationIndex).toBeGreaterThan(-1)
    expect(bulkBarIndex).toBeGreaterThan(-1)
    expect(paginationIndex).toBeLessThan(bulkBarIndex)
  })

  it('selected state usa checkbox real + primary-soft + sinal adicional, sem novo status', () => {
    expect(workspace).toMatch(/row\.getToggleSelectedHandler\(\)/)
    expect(scss).toMatch(/\.is-checked[^{]*\{[^}]*var\(--esmera-primary-soft\)/)
    expect(scss).toMatch(/\.is-checked[^{]*\{[^}]*box-shadow/)
  })

  it('preserva a ordem save-then-publish e o contrato de items[] do lote (nada de ids[] em publish)', () => {
    expect(draftForm).toContain("action: 'save-and-publish'")
    expect(draftForm.indexOf('enqueueSave')).toBeLessThan(draftForm.indexOf("action: 'save-and-publish'"))
    expect(workspace).toContain("action: 'publish', items")
  })

  it('publicação, catálogo e prontidão continuam como estados separados (sem status novo)', () => {
    expect(workspace).toMatch(/id: 'catalog'/)
    expect(workspace).toMatch(/id: 'publication'/)
    expect(workspace).toMatch(/id: 'readiness'/)
  })

  it('reduced motion preserva todas as funções: seletor e ação continuam visíveis, só a transição some', () => {
    const reduced = scss.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/)
    expect(reduced).not.toBeNull()
    const body = reduced?.[1] ?? ''
    expect(body).toMatch(/\.esmera-product-tile__select[\s\S]*?opacity:\s*1/)
    expect(body).toMatch(/esmera-product-row-action[\s\S]*?opacity:\s*1/)
  })
})
