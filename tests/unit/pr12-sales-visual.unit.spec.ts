/**
 * PR-12C — Vendas, refinamento visual.
 *
 * Contrato visual lido direto da folha e dos componentes: prova que o
 * refinamento é puramente estético — sem nova stage, sem novo payload/mutation
 * e sem `transition: all`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

const scss = source('src/admin/modules/sales/sales.scss')
const workspace = source('src/admin/modules/sales/SalesWorkspaceClient.tsx')
const views = source('src/admin/modules/sales/SalesViews.tsx')

describe('PR-12C — Vendas visual', () => {
  it('não usa transition: all em nenhuma regra', () => {
    expect(scss).not.toMatch(/transition:\s*all/)
  })

  it('não usa animações de bounce ou shake', () => {
    expect(scss).not.toMatch(/bounce|shake/i)
    expect(scss).not.toMatch(/@keyframes/)
  })

  it('Lista e Pipeline continuam modos da mesma aba, com filtros e modo preservados na URL', () => {
    expect(views).toMatch(/list\.set\('view', 'list'\)/)
    expect(views).toMatch(/pipeline\.set\('view', 'pipeline'\)/)
    expect(workspace).toMatch(/params\.set\('view', next\.view\)/)
    expect(workspace).toMatch(/if \(next\.q\) params\.set\('q', next\.q\)/)
    expect(workspace).toMatch(/if \(next\.stage\) params\.set\('stage', next\.stage\)/)
    expect(workspace).toMatch(/if \(next\.page > 1\) params\.set\('page', String\(next\.page\)\)/)
  })

  it('valores financeiros usam tabular-nums', () => {
    expect(scss).toMatch(/\.esmera-nums\s*\{[^}]*font-variant-numeric:\s*tabular-nums/)
    expect(workspace).toMatch(/<span className="esmera-nums">\{money\(row\.original\.estimatedValueCents\)\}<\/span>/)
    expect(workspace).toMatch(/<span className="esmera-nums">\{money\(sale\.totalCents\)\}<\/span>/)
  })

  it('ações secundárias da lista revelam por hover e focus-within apenas em ponteiro fino', () => {
    const hoverBlock = scss.match(/@media \(hover: hover\) and \(pointer: fine\) \{([\s\S]*?)\n\}/)
    expect(hoverBlock).not.toBeNull()
    const body = hoverBlock?.[1] ?? ''
    expect(body).toMatch(/\.esmera-sales-row-actions \.esmera-button--quiet\s*\{[^}]*opacity:\s*0/)
    expect(body).toMatch(/tr:hover \.esmera-sales-row-actions \.esmera-button--quiet/)
    expect(body).toMatch(/tr:focus-within \.esmera-sales-row-actions \.esmera-button--quiet/)
  })

  it('em touch (fora do gate de ponteiro fino) as ações essenciais e secundárias ficam visíveis, sem depender de hover', () => {
    const outsideHoverGate = scss.replace(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n\}/, '')
    expect(outsideHoverGate).not.toMatch(/\.esmera-sales-row-actions \.esmera-button--quiet\s*\{[^}]*opacity:\s*0/)
    // Inspecionar (essencial) nunca recebe opacity:0 em nenhum ponto da folha.
    expect(scss).not.toMatch(/\.esmera-sales-row-actions \.esmera-button\s*\{[^}]*opacity:\s*0/)
  })

  it('cards do pipeline em drag usam shadow-interactive e scale 1.01, sem exagero de escala', () => {
    const rule = scss.match(/\.esmera-opportunity-card\.is-dragging\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const body = rule?.[1] ?? ''
    expect(body).toMatch(/transform:\s*scale\(1\.01\)/)
    expect(body).toMatch(/box-shadow:\s*var\(--esmera-shadow-interactive\)/)
    expect(scss).not.toMatch(/scale\(1\.0[2-9]/)
    expect(scss).not.toMatch(/scale\(1\.[1-9]/)
  })

  it('coluna droppable-over usa primary-soft e ring, sem mover cards na própria regra visual', () => {
    const rule = scss.match(/\.esmera-pipeline-column\.is-drop-target\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    const body = rule?.[1] ?? ''
    expect(body).toMatch(/background:\s*var\(--esmera-primary-soft\)/)
    expect(body).toMatch(/box-shadow:\s*var\(--esmera-focus-ring\)/)
  })

  it('cards do pipeline respondem por borda no hover, sem cardização extra (sem box-shadow no :hover)', () => {
    const rule = scss.match(/\.esmera-opportunity-card:hover\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule?.[1]).not.toMatch(/box-shadow/)
  })

  it('origem permanece com estado selecionado enquanto o inspector está aberto (via data-popup-open)', () => {
    expect(scss).toMatch(/\.esmera-opportunity-card:has\(\[data-popup-open\]\)/)
    expect(scss).toMatch(/tr:has\(\[data-popup-open\]\)/)
  })

  it('inspector usa o token de panel motion sem alterar o componente compartilhado', () => {
    expect(scss).toMatch(/\.esmera-drawer:has\(\.esmera-sales-inspector\)\s*\{[^}]*transition-duration:\s*var\(--esmera-motion-panel\)/)
  })

  it('bulk bar não cobre a paginação: paginação fica fora do container que contém a barra de lote', () => {
    const bodyBlockMatch = workspace.match(/<div className="esmera-sales-list-body">([\s\S]*?)\n\s*<\/div>/)
    expect(bodyBlockMatch).not.toBeNull()
    const body = bodyBlockMatch?.[1] ?? ''
    expect(body).toMatch(/esmera-bulk-bar/)
    expect(body).not.toMatch(/esmera-pagination/)
    expect(workspace.indexOf('esmera-sales-list-body')).toBeLessThan(workspace.indexOf('esmera-pagination'))
  })

  it('confirmação crítica (ganho/perda) continua aguardando o servidor antes de fechar o diálogo', () => {
    expect(workspace).toMatch(/async function close\(input: CloseInput\) \{\s*await onClose\(input\)\s*setDialog\(null\)/)
  })

  it('mobile usa stage/lista compacta em coluna única, sem kanban desktop comprimido', () => {
    const mobileBlock = scss.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/)
    expect(mobileBlock).not.toBeNull()
    const body = mobileBlock?.[1] ?? ''
    expect(body).toMatch(/\.esmera-pipeline\s*\{[^}]*grid-template-columns:\s*1fr/)
  })

  it('reduced motion preserva o estado das ações da lista, apenas removendo a transição', () => {
    const reduced = scss.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/)
    expect(reduced).not.toBeNull()
    const body = reduced?.[1] ?? ''
    expect(body).toMatch(/\.esmera-sales-row-actions \.esmera-button--quiet[\s\S]*?opacity:\s*1/)
  })
})
