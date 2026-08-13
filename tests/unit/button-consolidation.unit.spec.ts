import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Consolidação das regras de botão (Design System)', () => {
  const designSystem = source('src/admin/design-system/design-system.scss')
  const fixes = source('src/admin/design-system/ui-ux-fixes.scss')
  const tokens = source('src/admin/design-system/tokens.scss')

  it('mantém o primitive de botão na folha canônica com box-sizing consistente', () => {
    expect(designSystem).toMatch(/\.esmera-button\s*\{[^}]*box-sizing:\s*border-box/s)
    expect(designSystem).toMatch(/\.esmera-button\s*\{[^}]*min-height:\s*var\(--esmera-control-standard\)/s)
    // Tons e estado busy/spinner continuam numa única fonte.
    expect(designSystem).toContain('.esmera-button--primary')
    expect(designSystem).toContain('.esmera-button--quiet')
    expect(designSystem).toContain('.esmera-button--danger')
    expect(designSystem).toContain('.esmera-button__spinner')
    expect(designSystem).toContain('@keyframes esmera-button-spin')
  })

  it('absorve as correções de altura de filtro/toolbar usando o token, sem literais', () => {
    expect(designSystem).toMatch(/\.esmera-after-sales-filters__primary\s*>\s*\.esmera-button/)
    expect(designSystem).toMatch(/\.esmera-report-filter-primary\s*>\s*\.esmera-button/)
    expect(designSystem).toMatch(/\.esmera-products-filter-panel\s+\.esmera-filter-panel__actions\s+\.esmera-button/)
  })

  it('não deixa mais uma camada de correção de altura de botão em ui-ux-fixes.scss', () => {
    // O literal 38px divergente do pós-venda foi eliminado.
    expect(fixes).not.toContain('38px')
    expect(fixes).not.toMatch(/\.esmera-after-sales-filters__primary\s*>\s*\.esmera-button\s*,/)
    expect(fixes).not.toMatch(/\.esmera-report-filter-primary\s*>\s*\.esmera-button/)
    // A normalização de geometria de input (fora do escopo de botão) permanece.
    expect(fixes).toMatch(/\.esmera-products-filter-panel\s+\.esmera-input/)
  })

  it('mantém tokens.scss sem aparência de botão (só a política de reduced-motion)', () => {
    expect(tokens).not.toMatch(/\.esmera-button\s*\{/)
    expect(tokens).toContain('prefers-reduced-motion')
  })
})
