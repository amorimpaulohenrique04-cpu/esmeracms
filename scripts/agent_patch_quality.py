from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{relative}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


def write(relative: str, content: str) -> None:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


replace_once(
    'src/admin/modules/products/ProductsWorkspaceClient.tsx',
    '''<input className="esmera-input" name="q" defaultValue={filters.q} placeholder="Título, código, slug ou material" />''',
    '''<input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Título, código, slug ou material" />''',
)
replace_once(
    'src/admin/design-system/tokens.scss',
    '''  --esmera-z-sticky: 20;
  --esmera-z-popover: 50;''',
    '''  --esmera-z-sticky: 20;
  --esmera-z-nav-peek: 40;
  --esmera-z-popover: 50;''',
)
replace_once(
    'src/admin/components/nav.scss',
    '''    z-index: var(--esmera-z-popover);
    width: var(--esmera-rail-width);''',
    '''    z-index: var(--esmera-z-nav-peek);
    width: var(--esmera-rail-width);''',
)
replace_once(
    'src/admin/design-system/ui-ux-fixes.scss',
    '''@media (max-width: 700px) {
  .esmera-error-summary,''',
    '''@container esmera-workspace (max-width: 560px) {
  .esmera-products-search {
    min-width: 0;
  }
}

@media (max-width: 700px) {
  .esmera-error-summary,''',
)

replace_once(
    'tests/unit/motion-policy.unit.spec.ts',
    '''const shell = source('src/admin/shell/shell.scss')
const adminStateProvider''',
    '''const shell = source('src/admin/shell/shell.scss')
const nav = source('src/admin/components/nav.scss')
const adminStateProvider''',
)
replace_once(
    'tests/unit/motion-policy.unit.spec.ts',
    '''  it('não reintroduz os aliases de transição legados --esmera-transition-fast/--esmera-transition-panel', () => {''',
    '''  it('documenta a exceção de width do rail por hit-testing sem liberar outras propriedades de layout', () => {
    expect(nav).toContain('getBoundingClientRect() ignora clip-path')
    expect(nav).toContain('transition: width var(--esmera-motion-fast) var(--esmera-ease-exit)')
    expect(nav).toContain('transition: width var(--esmera-motion-fast) var(--esmera-ease-enter)')
    const withoutApprovedRailWidth = nav
      .replaceAll('transition: width var(--esmera-motion-fast) var(--esmera-ease-exit);', '')
      .replaceAll('transition: width var(--esmera-motion-fast) var(--esmera-ease-enter);', '')
    expect(withoutApprovedRailWidth).not.toMatch(/transition:[^;]*(?:width|height|grid-template-columns)/)
  })

  it('não reintroduz os aliases de transição legados --esmera-transition-fast/--esmera-transition-panel', () => {''',
)

write('tests/unit/create-dialogs.unit.spec.ts', '''import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('Popups de criação e responsividade', () => {
  it('cria venda direta no workflow transacional e registra atividade', () => {
    const workflow = source('src/server/domain/sales/opportunityWorkflow.ts')
    expect(workflow).toContain('export async function createSale')
    expect(workflow).toContain("channel: 'whatsapp'")
    expect(workflow).toContain("status: 'confirmed'")
    expect(workflow).toContain("eventType: 'sale.created'")
  })

  it('expõe create em Vendas e busca leve de clientes', () => {
    const salesRoute = source('src/app/(payload)/api/admin-sales/route.ts')
    const customerHandler = source('src/app/(payload)/api/admin-customers/handler.ts')
    const customerRoute = source('src/app/(payload)/api/admin-customers/route.ts')
    expect(salesRoute).toContain("'create'")
    expect(salesRoute).toContain('customerID')
    expect(customerHandler).toContain('export async function GET')
    expect(customerHandler).toContain('limit: 8')
    expect(customerRoute).toContain('GET, POST')
  })

  it('substitui os links técnicos pelos dialogs de criação', () => {
    const salesView = source('src/admin/modules/sales/SalesViews.tsx')
    const categoriesView = source('src/admin/modules/categories/CategoriesView.tsx')
    expect(salesView).toContain('<SaleCreateDialog products={productsResult.docs} />')
    expect(categoriesView).toContain('<CategoryCreateDialog categories={allResult.docs} />')
    expect(categoriesView).not.toContain('/admin/collections/categories/create')
  })

  it('cria categorias como rascunho e abre o detalhe customizado', () => {
    const route = source('src/app/(payload)/api/admin-categories/route.ts')
    const dialog = source('src/admin/modules/categories/CategoryCreateDialog.tsx')
    expect(route).toContain("body.action === 'create'")
    expect(route).toContain("_status: 'draft'")
    expect(dialog).toContain('router.push(`/admin/categories?category=${body.id}&tab=general`)')
  })

  it('mantém busca responsiva e separa o z-index do rail peek', () => {
    const products = source('src/admin/modules/products/ProductsWorkspaceClient.tsx')
    const fixes = source('src/admin/design-system/ui-ux-fixes.scss')
    const tokens = source('src/admin/design-system/tokens.scss')
    const nav = source('src/admin/components/nav.scss')
    expect(products).toContain('type="search" name="q"')
    expect(fixes).toMatch(/@container esmera-workspace \(max-width: 560px\)[\s\S]*\.esmera-products-search[\s\S]*min-width: 0/)
    expect(tokens).toContain('--esmera-z-nav-peek: 40')
    expect(nav).toContain('z-index: var(--esmera-z-nav-peek)')
  })
})
''')

print('Quality patch applied.')
