import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Rodada 3 — interações de assinatura', () => {
  it('usa View Transition API com fallback e reduced motion', () => {
    const provider = source('src/admin/state/AdminStateProvider.tsx')
    const styles = source('src/admin/design-system/interactions.scss')
    expect(provider).toContain('startAdminViewTransition')
    expect(provider).toContain('startViewTransition')
    expect(provider).toContain("prefers-reduced-motion: reduce")
    expect(provider).toContain('scrollRestoration')
    expect(provider).toContain('restoreContext')
    expect(styles).toContain('::view-transition-old(root)')
    expect(styles).toContain('::view-transition-new(root)')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('mantém a Command Palette contextual, recente e autorizada', () => {
    const palette = source('src/admin/shell/CommandPalette.tsx')
    const endpoint = source('src/app/(payload)/api/admin-search/route.ts')
    const continuity = source('src/admin/state/continuity.ts')
    expect(palette).toContain("group: 'Seleção atual'")
    expect(palette).toContain("group: 'Recentes'")
    expect(palette).toContain("group: 'Filtros salvos'")
    expect(palette).toContain('savedAdminViews')
    expect(continuity).toContain('localStorage')
    expect(endpoint).toContain('contextualActions')
    expect(endpoint).toContain('canManageSite')
    expect(endpoint).toContain('canManageBusiness')
    expect(endpoint).toContain('Confirmar venda pelo Pipeline')
    expect(endpoint).not.toContain('/admin/collections/sales/create')
  })

  it('implementa cross-filter por URL, histórico e gráficos reais', () => {
    const reports = source('src/admin/modules/reports/ReportsWorkspaceClient.tsx')
    const chart = source('src/admin/modules/reports/EChart.tsx')
    expect(reports).toContain('window.history.pushState')
    expect(reports).toContain("window.addEventListener('popstate'")
    expect(reports).toContain('Voltar um nível')
    expect(reports).toContain('saveAdminView')
    expect(reports).toContain('patchFilters')
    expect(reports).toContain('focusEvolutionDay')
    expect(chart).toContain("chart.on('click'")
    expect(chart).toContain("chart.on('mouseover'")
    expect(chart).toContain("type: 'highlight'")
  })

  it('expõe preview editorial apenas por rota autenticada de draft', () => {
    const route = source('src/app/(frontend)/preview/editorial/[kind]/[id]/page.tsx')
    const preview = source('src/admin/editorial/EditorialPreviewPanel.tsx')
    const document = source('src/app/(frontend)/preview/editorial/[kind]/[id]/EditorialPreviewDocument.tsx')
    expect(route).toContain('payload.auth')
    expect(route).toContain('canManageSite')
    expect(route).toContain('draft: true')
    expect(route).toContain('index: false')
    expect(preview).toContain("type PreviewKind = 'product' | 'category'")
    expect(preview).toContain("type DeviceMode = 'desktop' | 'tablet' | 'mobile'")
    expect(preview).toContain('ADMIN_DRAFT_CHANGED_EVENT')
    expect(preview).toContain('esmera-editorial-preview-field')
    expect(document).toContain('window.parent.postMessage')
  })

  it('não oferece preview editorial em Vendas ou Pós-venda', () => {
    const sales = source('src/admin/modules/sales/SalesWorkspaceClient.tsx')
    const afterSales = source('src/admin/modules/after-sales/AfterSalesWorkspaceClient.tsx')
    expect(sales).not.toContain('EditorialPreviewPanel')
    expect(afterSales).not.toContain('EditorialPreviewPanel')
  })

  it('faz rollback seguro de autosave e reorder', () => {
    const draft = source('src/admin/modules/products/ProductDraftForm.tsx')
    const media = source('src/admin/modules/products/ProductMediaManager.tsx')
    const categories = source('src/admin/modules/categories/CategoriesMasterList.tsx')
    expect(draft).toContain('lastSaved')
    expect(draft).toContain('setDraft(lastSaved.current)')
    expect(media).toContain('lastSaved.current')
    expect(media).toContain('setGallery(lastSaved.current)')
    expect(categories).toContain('setItems(previousItems)')
    expect(categories).toContain('posição anterior foi restaurada')
  })
})
