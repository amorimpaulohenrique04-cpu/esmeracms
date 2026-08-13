import { readFileSync } from 'node:fs'
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
    const productsView = source('src/admin/modules/products/ProductsView.tsx')
    const productsWorkspace = source('src/admin/modules/products/ProductsWorkspaceClient.tsx')
    expect(salesView).toContain('<SaleCreateDialog products={productsResult.docs} />')
    expect(categoriesView).toContain('<CategoryCreateDialog categories={allResult.docs} />')
    expect(categoriesView).not.toContain('/admin/collections/categories/create')
    expect(productsView).toContain('<ProductCreateDialog categories={eligibleCategoryResult.docs} />')
    expect(productsView).not.toContain('/admin/collections/products/create')
    expect(productsWorkspace).toContain('action={<ProductCreateDialog />}')
  })

  it('preserva a ação primária de categoria e evita compressão do cabeçalho de vendas', () => {
    const overlays = source('src/admin/design-system/Overlays.tsx')
    const categoryDialog = source('src/admin/modules/categories/CategoryCreateDialog.tsx')
    const salesView = source('src/admin/modules/sales/SalesViews.tsx')
    const salesStyles = source('src/admin/modules/sales/sale-create-dialog.scss')
    expect(overlays).toContain("triggerClassName = ''")
    expect(categoryDialog).toContain('triggerClassName="esmera-button--primary"')
    expect(salesView).toContain('className="esmera-sales-command-bar"')
    expect(salesStyles).toMatch(/@container esmera-workspace \(min-width: 701px\) and \(max-width: 1220px\)[\s\S]*flex-wrap: wrap[\s\S]*flex: 1 1 520px/)
  })

  it('mantém o portal de clientes ancorado dentro da árvore modal clicável', () => {
    const salesDialog = source('src/admin/modules/sales/SalesWorkspaceClient.tsx')
    const salesStyles = source('src/admin/modules/sales/sale-create-dialog.scss')
    expect(salesDialog).toContain('const portalContainerRef = useRef<HTMLFormElement>(null)')
    expect(salesDialog).toContain('<form ref={portalContainerRef}')
    expect(salesDialog).toContain('<ComboboxPrimitive.Portal container={portalContainerRef}')
    expect(salesDialog).toContain('<ComboboxPrimitive.Positioner className={comboboxClasses.positioner}')
    expect(salesStyles).toMatch(/\.esmera-sales-customer-portal\s*\{[\s\S]*display: contents/)
  })

  it('cria categorias como rascunho e abre o detalhe customizado', () => {
    const route = source('src/app/(payload)/api/admin-categories/route.ts')
    const dialog = source('src/admin/modules/categories/CategoryCreateDialog.tsx')
    expect(route).toContain("body.action === 'create'")
    expect(route).toContain("_status: 'draft'")
    expect(dialog).toContain('router.push(`/admin/categories?category=${body.id}&tab=general`)')
  })

  it('cria produtos como rascunho num popup de 2 estágios com categorias e galeria', () => {
    const route = source('src/app/(payload)/api/admin-products/route.ts')
    const media = source('src/app/(payload)/api/admin-product-media/route.ts')
    const dialog = source('src/admin/modules/products/ProductCreateDialog.tsx')
    const picker = source('src/admin/modules/products/ProductCategoryPicker.tsx')
    const uploader = source('src/admin/modules/products/ProductGalleryUploader.tsx')
    // Estágio 1 cria o rascunho (action create de main), estágio 2 organiza e publica.
    expect(route).toContain("action === 'create'")
    expect(route).toContain("data: { title, priceMode, basePriceCents, _status: 'draft' }")
    expect(route).toContain("action === 'set-categories'")
    expect(dialog).toContain("'essential'")
    expect(dialog).toContain("'details'")
    expect(dialog).toContain("action: 'create'")
    expect(dialog).toContain("action: 'save-and-publish'")
    expect(dialog).toContain('requires_confirmation')
    expect(dialog).toContain('<ProductCategoryPicker')
    expect(dialog).toContain('<ProductGalleryUploader')
    expect(dialog).toContain('size="wide"')
    // Seletor hierárquico grava a união (diretas ∪ ancestrais elegíveis) via
    // set-categories, com otimista-com-rollback.
    expect(picker).toContain("action: 'set-categories'")
    expect(picker).toContain('onSelectedChange(previousUnion)')
    expect(picker).toContain('getAncestorChain')
    expect(picker).toContain('orderCategoriesHierarchically')
    // Uploader reaproveita add-gallery-image (mediaKey/capa/alt gerados no servidor)
    // e estiliza o disparo do upload sem o controle nativo cru; vazio via EmptyState.
    expect(media).toContain("collection: 'media'")
    expect(media).toContain('canManageSite')
    expect(uploader).toContain('/api/admin-product-media')
    expect(uploader).toContain("action: 'add-gallery-image'")
    expect(uploader).toContain('esmera-file-upload')
    expect(uploader).toContain('EmptyState')
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
