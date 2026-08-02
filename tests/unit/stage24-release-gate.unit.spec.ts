import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

async function source(relativePath: string) {
  return await fs.readFile(path.join(root, relativePath), 'utf8')
}

async function missing(relativePath: string) {
  try {
    await fs.access(path.join(root, relativePath))
    return false
  } catch {
    return true
  }
}

describe('Etapa 24 — release gate de Categorias e Pós-venda', () => {
  it('mantém Categorias em master-detail com ordenação acessível e sem coluna excedente', async () => {
    const [view, master, styles] = await Promise.all([
      source('src/admin/modules/categories/CategoriesView.tsx'),
      source('src/admin/modules/categories/CategoriesMasterList.tsx'),
      source('src/admin/modules/categories/categories.scss'),
    ])

    expect(await missing('src/admin/modules/categories/categories.release.scss')).toBe(true)
    expect(view).not.toContain('categories.release.scss')
    expect(view).toContain('esmera-categories-workspace')
    expect(master).toContain('DragDropProvider')
    expect(master).toContain('Mover ${title} para posição')
    expect(master).not.toContain('categoryStatusLabels')
    expect(master).toContain('<span>Categoria</span><span>Produtos</span><span>Posição</span>')
    expect(styles).toContain('grid-template-columns: 30px minmax(0, 1fr) 64px 72px')
    expect(styles).toContain('.esmera-category-position .esmera-input')
  })

  it('mantém o Pós-venda orientado por Tasks e com inspector contido', async () => {
    const [view, workspace, queue, styles] = await Promise.all([
      source('src/admin/modules/after-sales/AfterSalesView.tsx'),
      source('src/admin/modules/after-sales/AfterSalesWorkspaceClient.tsx'),
      source('src/admin/modules/after-sales/AfterSalesQueue.tsx'),
      source('src/admin/modules/after-sales/after-sales.scss'),
    ])

    expect(await missing('src/admin/modules/after-sales/after-sales.release.scss')).toBe(true)
    expect(view).toContain("findDocs<TaskRecord>(req, 'tasks'")
    expect(view).not.toContain('after-sales.release.scss')
    expect(workspace).toContain("queryKey: ['after-sales', 'tasks']")
    expect(workspace).toContain('mobileInspectorOpen')
    expect(workspace).not.toContain('QueryClientProvider')
    expect(queue).toContain('Fila operacional de pós-venda')
    expect(styles).toContain('height: calc(100vh - var(--esmera-shell-header-height, 64px) - 32px)')
    expect(styles).toContain('.esmera-after-sales-workspace.is-mobile-inspector-open .esmera-after-sales-inspector')
    expect(styles).not.toContain(':focus-within')
    expect(styles).not.toContain(':has(')
  })

  it('preserva a experiência mobile sem comprimir a tabela desktop', async () => {
    const [categories, afterSales] = await Promise.all([
      source('src/admin/modules/categories/categories.scss'),
      source('src/admin/modules/after-sales/after-sales.scss'),
    ])

    expect(categories).toContain('@container esmera-workspace (max-width: 560px)')
    expect(categories).toContain('.esmera-category-form { grid-template-columns: 1fr; }')
    expect(afterSales).toContain('@container esmera-workspace (max-width: 620px)')
    expect(afterSales).toContain('.esmera-after-sales-queue .esmera-data-table tr')
    expect(afterSales).toContain('height: 100dvh')
  })
})
