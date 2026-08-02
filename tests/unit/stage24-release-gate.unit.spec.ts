import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

async function source(relativePath: string) {
  return await fs.readFile(path.join(root, relativePath), 'utf8')
}

describe('Etapa 24 — release gate de Categorias e Pós-venda', () => {
  it('mantém Categorias em master-detail com ordenação acessível e sem coluna excedente', async () => {
    const [view, master, release] = await Promise.all([
      source('src/admin/modules/categories/CategoriesView.tsx'),
      source('src/admin/modules/categories/CategoriesMasterList.tsx'),
      source('src/admin/modules/categories/categories.release.scss'),
    ])

    expect(view).toContain("import './categories.release.scss'")
    expect(view).toContain('esmera-categories-workspace')
    expect(master).toContain('DragDropProvider')
    expect(master).toContain('Mover ${category.title || \'categoria\'} para posição')
    expect(release).toContain('grid-template-columns: 30px minmax(0, 1fr) 64px 72px')
    expect(release).toContain('.esmera-category-row > .esmera-status')
    expect(release).toContain('.esmera-category-position .esmera-input')
  })

  it('mantém o Pós-venda orientado por Tasks e com inspector contido', async () => {
    const [view, workspace, release] = await Promise.all([
      source('src/admin/modules/after-sales/AfterSalesView.tsx'),
      source('src/admin/modules/after-sales/AfterSalesWorkspaceClient.tsx'),
      source('src/admin/modules/after-sales/after-sales.release.scss'),
    ])

    expect(view).toContain("findDocs<TaskRecord>(req, 'tasks'")
    expect(view).toContain("import './after-sales.release.scss'")
    expect(workspace).toContain("type QueueKind = 'task' | 'occurrence' | 'shipment'")
    expect(workspace).toContain("queryKey: ['after-sales', 'tasks']")
    expect(workspace).toContain('Fila operacional de pós-venda')
    expect(release).toContain('height: calc(100vh - var(--esmera-shell-header-height, 64px) - 32px)')
    expect(release).toContain('.esmera-after-sales-inspector:focus-within')
  })

  it('preserva a experiência mobile sem comprimir a tabela desktop', async () => {
    const [categories, afterSales] = await Promise.all([
      source('src/admin/modules/categories/categories.release.scss'),
      source('src/admin/modules/after-sales/after-sales.release.scss'),
    ])

    expect(categories).toContain('@container esmera-workspace (max-width: 560px)')
    expect(categories).toContain('grid-template-columns: 1fr')
    expect(afterSales).toContain('@container esmera-workspace (max-width: 620px)')
    expect(afterSales).toContain('.esmera-after-sales-queue .esmera-data-table tr')
    expect(afterSales).toContain('height: 100dvh')
  })
})
