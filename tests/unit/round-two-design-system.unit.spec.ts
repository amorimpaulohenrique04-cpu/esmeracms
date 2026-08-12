import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

const primitives = [
  'PageCommandBar',
  'SegmentedControl',
  'MetricStrip',
  'FilterPanel',
  'SplitWorkspace',
  'ContextInspector',
  'DataSection',
  'EmptyVisualization',
  'InlineFeedback',
  'SectionNav',
  'QuickActionMenu',
]

describe('Rodada 2 — Design System Esméra v2', () => {
  it('define e exporta os primitives oficiais', () => {
    const implementation = source('src/admin/design-system/Primitives.tsx')
    const index = source('src/admin/design-system/index.ts')
    for (const primitive of primitives) expect(implementation).toContain(`export function ${primitive}`)
    expect(index).toContain("export * from './Primitives'")
  })

  it('mantém tipografia, superfícies, densidade, motion, gráficos e workspaces em tokens', () => {
    const tokens = source('src/admin/design-system/tokens.scss')
    expect(tokens).toContain('--esmera-font-body: 14px')
    expect(tokens).toContain('--esmera-surface-canvas')
    expect(tokens).toContain('--esmera-control-compact')
    expect(tokens).toContain('--esmera-motion-standard')
    expect(tokens).toContain('--esmera-chart-1')
    expect(tokens).toContain('--esmera-workspace-wide')
    expect(tokens).toContain('--esmera-selection-bar')
  })

  it('formaliza estados operacionais sem converter falhas em zero', () => {
    const feedback = source('src/admin/design-system/Feedback.tsx')
    for (const state of ['loading', 'empty-result', 'empty-system', 'integration-unconfigured', 'partial-data', 'permission-denied', 'recoverable-error', 'destructive-error', 'saving', 'saved', 'rollback']) {
      expect(feedback).toContain(`'${state}'`)
    }
    expect(feedback).toContain('SavingState')
    expect(feedback).toContain('PermissionState')
    expect(feedback).toContain('PartialDataState')
  })

  it('migra os módulos prioritários para primitives v2', () => {
    const modules: Array<[string, string[]]> = [
      ['src/admin/modules/dashboard/DashboardView.tsx', ['MetricStrip', 'DataSection']],
      ['src/admin/modules/products/ProductsWorkspaceClient.tsx', ['FilterPanel', 'SplitWorkspace', 'ContextInspector']],
      ['src/admin/modules/customers/CustomersWorkspaceView.tsx', ['MetricStrip', 'CustomerDetailTabs', 'SplitWorkspace']],
      ['src/admin/modules/customers/CustomerDetailTabs.tsx', ['SectionNav', 'LoadingState']],
      ['src/admin/modules/customers/CustomerDetailTabPanel.tsx', ['DataSection']],
      ['src/admin/modules/sales/SalesWorkspaceClient.tsx', ['FilterPanel', 'InlineFeedback', 'DataTable']],
      ['src/admin/modules/privacy/PrivacyView.tsx', ['FilterPanel', 'DataSection']],
      ['src/admin/modules/settings/SettingsView.tsx', ['DataSection', 'IntegrationState']],
      ['src/admin/modules/technical/TechnicalView.tsx', ['DataSection', 'PartialDataState']],
    ]
    for (const [path, contracts] of modules) {
      const content = source(path)
      for (const contract of contracts) expect(content).toContain(contract)
    }
  })

  it('usa um único QueryClient global nos workspaces', () => {
    for (const path of [
      'src/admin/modules/reports/ReportsWorkspaceClient.tsx',
      'src/admin/modules/after-sales/AfterSalesWorkspaceClient.tsx',
      'src/admin/modules/sales/SalesWorkspaceClient.tsx',
    ]) {
      const content = source(path)
      expect(content).not.toContain('QueryClientProvider')
      expect(content).not.toContain('new QueryClient(')
    }
  })

  it('não reintroduz folhas de polish ou release nos módulos migrados', () => {
    expect(existsSync(resolve(root, 'src/admin/modules/customers/customers-polish.scss'))).toBe(false)
    expect(existsSync(resolve(root, 'src/admin/modules/categories/categories.release.scss'))).toBe(false)
    expect(existsSync(resolve(root, 'src/admin/modules/after-sales/after-sales.release.scss'))).toBe(false)
  })

  it('mantém o shell contextual e com estados explícitos de busca', () => {
    const create = source('src/admin/shell/GlobalCreateMenu.tsx')
    const search = source('src/admin/shell/CommandPalette.tsx')
    const nav = source('src/admin/components/nav.scss')
    expect(create).toContain('matchesContext')
    expect(create).toContain('is-contextual')
    expect(search).toContain("type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error'")
    expect(search).toContain('data-search-state')
    expect(nav).toContain('var(--esmera-surface-selected)')
    expect(nav).not.toContain('background: var(--esmera-primary); color: #fff')
  })

  it('documenta API, teclado, reduced motion e exemplos incorretos', () => {
    const documentation = source('docs/design-system-v2.md')
    expect(documentation).toContain('## Primitives oficiais')
    expect(documentation).toContain('## Teclado e foco')
    expect(documentation).toContain('prefers-reduced-motion')
    expect(documentation).toContain('## Exemplos incorretos')
  })
})