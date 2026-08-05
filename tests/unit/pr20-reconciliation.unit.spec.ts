import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Reconciliação da PR #20', () => {
  it('preserva continuidade, seleção e navegação progressiva', () => {
    const provider = source('src/admin/state/AdminStateProvider.tsx')
    const continuity = source('src/admin/state/continuity.ts')
    const styles = source('src/admin/design-system/reconciled-interactions.scss')

    expect(provider).not.toContain('startAdminViewTransition')
    expect(provider).toContain('ADMIN_SELECTION_EVENT')
    expect(provider).toContain('rememberRecentAnchor')
    expect(provider).toContain("event.key !== 'Escape'")
    expect(provider).toContain('isSoftNavigable')
    expect(continuity).toContain('localStorage')
    expect(styles).toContain('.esmera-spatial-selection')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('restaura a Command Palette contextual sem substituir a busca segura', () => {
    const palette = source('src/admin/shell/CommandPalette.tsx')
    const header = source('src/admin/shell/AppHeader.tsx')
    const endpoint = source('src/app/(payload)/api/admin-search/route.ts')

    expect(palette).toContain("group: 'Seleção atual'")
    expect(palette).toContain("group: 'Recentes'")
    expect(palette).toContain("group: 'Filtros salvos'")
    expect(palette).toContain('savedAdminViews')
    expect(header).toContain('inferSelection')
    expect(endpoint).toContain('requestContext')
    expect(endpoint).toContain('canManageSite')
    expect(endpoint).toContain('canManageBusiness')
  })

  it('mantém eventos reais de ECharts e rollback operacional', () => {
    const chart = source('src/admin/modules/reports/EChart.tsx')
    const categories = source('src/admin/modules/categories/CategoriesMasterList.tsx')
    const gallery = source('src/admin/modules/products/ProductMediaManager.tsx')

    expect(chart).toContain("chart.on('click'")
    expect(chart).toContain("chart.on('mouseover'")
    expect(chart).toContain("type: 'highlight'")
    expect(categories).toContain('setItems(previousItems)')
    expect(categories).toContain('posição anterior foi restaurada')
    expect(gallery).toContain('lastSaved.current')
    expect(gallery).toContain('setGallery(lastSaved.current)')
  })

  it('não regride os contratos da fundação operacional', () => {
    const productDraft = source('src/admin/modules/products/ProductDraftForm.tsx')
    const formSystem = source('src/admin/design-system/FormSystem.tsx')
    const publication = source('src/server/publication/coordinator.ts')

    expect(productDraft).toContain('expectedRevision')
    expect(productDraft).toContain("action: 'save-and-publish'")
    expect(formSystem).toContain('ErrorSummary')
    expect(publication).toContain('saveDraft')
    expect(publication).toContain('publish')
  })

  it('registra explicitamente as implementações substituídas', () => {
    const reconciliation = source('docs/pr20-reconciliation.md')

    expect(reconciliation).toContain('Preview editorial')
    expect(reconciliation).toContain('Relatórios investigativos')
    expect(reconciliation).toContain('Busca administrativa')
    expect(reconciliation).toContain('não mesclada diretamente')
  })
})
