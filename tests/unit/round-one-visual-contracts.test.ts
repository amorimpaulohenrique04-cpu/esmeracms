import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Rodada 1 — contratos estruturais do Admin', () => {
  it('mantém uma única fonte visual em Categorias e Pós-venda', () => {
    expect(existsSync(resolve(root, 'src/admin/modules/categories/categories.release.scss'))).toBe(false)
    expect(existsSync(resolve(root, 'src/admin/modules/after-sales/after-sales.release.scss'))).toBe(false)
    expect(source('src/admin/modules/categories/CategoriesView.tsx')).not.toContain('categories.release.scss')
    expect(source('src/admin/modules/after-sales/AfterSalesView.tsx')).not.toContain('after-sales.release.scss')
  })

  it('não renderiza colunas de categoria para escondê-las por CSS', () => {
    const list = source('src/admin/modules/categories/CategoriesMasterList.tsx')
    expect(list).not.toContain('categoryStatusLabels')
    expect(list).not.toContain('esmera-category-order')
    expect(list).not.toContain('<Status')
    expect(list).toContain('<span>Categoria</span><span>Produtos</span><span>Posição</span>')
  })

  it('controla o inspector mobile de Pós-venda por estado explícito', () => {
    const client = source('src/admin/modules/after-sales/AfterSalesWorkspaceClient.tsx')
    const styles = source('src/admin/modules/after-sales/after-sales.scss')
    expect(client).toContain('mobileInspectorOpen')
    expect(client).toContain('is-mobile-inspector-open')
    expect(client).not.toContain('QueryClientProvider')
    expect(styles).not.toContain(':has(')
    expect(styles).not.toContain(':focus-within')
  })

  it('usa o QueryClient global e compacta estados vazios em Relatórios', () => {
    const client = source('src/admin/modules/reports/ReportsWorkspaceClient.tsx')
    const styles = source('src/admin/modules/reports/reports.scss')
    const view = source('src/admin/modules/reports/ReportsView.tsx')
    expect(client).not.toContain('QueryClientProvider')
    expect(client).toContain('hasEvolutionData')
    expect(client).toContain('esmera-report-empty-visualization')
    expect(styles).not.toContain('repeat(7')
    expect(view).toContain('actions={<ReportExportControl />}')
  })
})
