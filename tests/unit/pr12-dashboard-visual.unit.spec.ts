/**
 * PR-12A — Dashboard Premium Tech Quiet.
 *
 * Contrato visual lido direto da folha e da view: prova que o refinamento é
 * puramente estético — tokens existentes, sem contagem animada, sem dado
 * inventado e sem `transition: all`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

const scss = source('src/admin/modules/dashboard/dashboard.scss')
const view = source('src/admin/modules/dashboard/DashboardView.tsx')

describe('PR-12A — Dashboard visual', () => {
  it('não usa transition: all em nenhuma regra', () => {
    expect(scss).not.toMatch(/transition:\s*all/)
  })

  it('reutiliza os tokens existentes de motion e espaçamento, sem valores repetidos', () => {
    expect(scss).toContain('var(--esmera-motion-data)')
    expect(scss).toContain('var(--esmera-ease-enter)')
    expect(scss).toMatch(/esmera-dashboard-metrics\.esmera-metric-strip\s*\{[^}]*gap:\s*var\(--esmera-space-3\)/)
  })

  it('marca valores numéricos com tabular-nums', () => {
    expect(scss).toMatch(/esmera-metric-strip__item > strong[^}]*font-variant-numeric:\s*tabular-nums/)
    expect(scss).toMatch(/esmera-dashboard-pipeline__stage > strong[^}]*font-variant-numeric:\s*tabular-nums/)
  })

  it('anima o pipeline uma única vez, sem cascata por item', () => {
    expect(scss).toMatch(/esmera-dashboard-pipeline__list\s*{[^}]*animation:\s*esmera-dashboard-pipeline-enter/)
    expect(scss).not.toMatch(/animation-delay/)
  })

  it('reduced motion remove apenas o movimento decorativo, sem apagar a regra inteira', () => {
    const reduced = scss.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/)
    expect(reduced).not.toBeNull()
    const body = reduced?.[1] ?? ''
    expect(body).toContain('esmera-dashboard-pipeline__list')
    expect(body).toMatch(/animation:\s*none/)
    expect(body).toContain('esmera-dashboard-task__actions')
  })

  it('expõe as ações de Tasks em hover, focus-within e em dispositivos sem hover', () => {
    expect(scss).toMatch(/esmera-dashboard-task:hover \.esmera-dashboard-task__actions/)
    expect(scss).toMatch(/esmera-dashboard-task:focus-within \.esmera-dashboard-task__actions/)
    expect(scss).toMatch(/@media \(hover: none\)\s*\{\s*\.esmera-dashboard-task__actions/)
  })

  it('não aplica lift/shadow-interactive a métricas sem link (via classe já condicional do design system)', () => {
    expect(scss).not.toMatch(/esmera-dashboard-metrics[^{]*:hover[^{]*\{[^}]*(transform|box-shadow)/)
  })

  it('preserva as rotas reais do Dashboard (nenhum link foi trocado por placeholder)', () => {
    expect(view).toContain('getDashboardSnapshot')
    expect(view).toContain('/admin/products?status=active&publication=published')
    expect(view).toContain('/admin/opportunities?view=pipeline')
    expect(view).toContain('/admin/sales')
    expect(view).toContain('/admin/after-sales?focus=all&status=open')
  })

  it('mantém o estado de tráfego honesto: sem valor, gráfico ou contagem inventados', () => {
    expect(view).toContain('snapshot.traffic.reason')
    expect(view).not.toMatch(/CountUp|count-up|setInterval|Math\.random/i)
    expect(scss).not.toMatch(/CountUp|count-up/i)
  })
})
