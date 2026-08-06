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
    'src/admin/modules/sales/SalesWorkspaceClient.tsx',
    "import React, { useMemo, useState } from 'react'",
    "import React, { useEffect, useMemo, useRef, useState } from 'react'",
)
replace_once(
    'src/admin/modules/sales/SalesWorkspaceClient.tsx',
    '''  Button,
  DataSection,''',
    '''  Button,
  ComboboxPrimitive,
  comboboxClasses,
  DataSection,''',
)
replace_once(
    'src/admin/modules/sales/SalesWorkspaceClient.tsx',
    '''  DataTable,
  DrawerPanel,
  EmptyState,
  FilterPanel,
  InlineFeedback,
  Status,''',
    '''  DataTable,
  DialogPanel,
  DrawerPanel,
  EmptyState,
  Field,
  FilterPanel,
  InlineFeedback,
  Status,''',
)
replace_once(
    'src/admin/modules/sales/SalesWorkspaceClient.tsx',
    '''  ActivityRecord,
  OpportunityRecord,''',
    '''  ActivityRecord,
  CustomerRef,
  OpportunityRecord,''',
)

sale_dialog = r'''
type CustomerSearchResponse = {
  docs?: CustomerRef[]
  error?: string
}

function customerSearchLabel(customer: CustomerRef) {
  return [customer.name || 'Cliente', customer.company, customer.phone].filter(Boolean).join(' · ')
}

function effectiveProductPrice(product: ProductRef | undefined, variantSku: string) {
  const variant = product?.variants?.find((candidate) => candidate.sku === variantSku)
  const mode = variant?.priceMode === 'fixed' || variant?.priceMode === 'inquiry'
    ? variant.priceMode
    : product?.priceMode
  const cents = variant?.priceMode === 'fixed' ? variant.priceCents : product?.basePriceCents
  return { mode, cents }
}

export function SaleCreateDialog({ products }: { products: ProductRef[] }) {
  const router = useRouter()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [customer, setCustomer] = useState<CustomerRef | null>(null)
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerRef[]>([])
  const [searching, setSearching] = useState(false)
  const [productID, setProductID] = useState('')
  const [variantSku, setVariantSku] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/admin-customers?q=${encodeURIComponent(term)}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const body = await response.json() as CustomerSearchResponse
        if (!response.ok) throw new Error(body.error || 'Não foi possível buscar clientes.')
        setCustomers(body.docs || [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setCustomers([])
          setFeedback(error instanceof Error ? error.message : 'Não foi possível buscar clientes.')
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 280)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const selectedProduct = products.find((product) => String(product.id) === productID)
  const availableVariants = (selectedProduct?.variants || []).filter((variant) => variant.status !== 'disabled')
  const price = effectiveProductPrice(selectedProduct, variantSku)

  function reset() {
    setCustomer(null)
    setQuery('')
    setCustomers([])
    setProductID('')
    setVariantSku('')
    setQuantity(1)
    setUnitPrice('')
    setFeedback(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!customer || !productID || busy) return

    let negotiatedPrice: number | null = null
    if (price.mode === 'inquiry') {
      negotiatedPrice = Math.round(Number(unitPrice.replace(',', '.')) * 100)
      if (!Number.isSafeInteger(negotiatedPrice) || negotiatedPrice < 0) {
        setFeedback('Informe um preço negociado válido para o produto sob consulta.')
        return
      }
    }

    setBusy(true)
    setFeedback(null)
    try {
      await postSales({
        action: 'create',
        customerID: customer.id,
        items: [{
          product: productID,
          variantSku: variantSku || null,
          unitPriceCents: negotiatedPrice,
          quantity,
        }],
      })
      router.refresh()
      reset()
      closeRef.current?.click()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível criar a venda.')
    } finally {
      setBusy(false)
    }
  }

  return <DialogPanel
    trigger="Nova venda"
    title="Nova venda"
    description="Crie uma venda confirmada sem sair do workspace. Totais e snapshots são calculados pelo servidor."
  >
    <form className="esmera-sales-create-form esmera-sales-close-form" onSubmit={submit}>
      <Field className="esmera-sales-customer-field" label="Cliente">
        <ComboboxPrimitive.Root
          items={customers}
          value={customer}
          filter={null}
          onValueChange={(value) => {
            setCustomer(value)
            setQuery('')
            setCustomers(value ? [value] : [])
            setFeedback(null)
          }}
          onInputValueChange={(value, { reason }) => {
            if (reason === 'item-press') return
            setQuery(value)
            setFeedback(null)
            if (reason === 'input-change' || reason === 'input-clear' || reason === 'clear-press') setCustomer(null)
            if (value.trim().length < 2) {
              setCustomers([])
              setSearching(false)
            }
          }}
          itemToStringLabel={customerSearchLabel}
          isItemEqualToValue={(item, value) => String(item.id) === String(value.id)}
        >
          <ComboboxPrimitive.InputGroup className="esmera-sales-customer-combobox">
            <ComboboxPrimitive.Input
              className={`esmera-input ${comboboxClasses.input}`}
              required
              placeholder="Digite nome, empresa ou telefone"
              aria-label="Buscar cliente"
            />
            <ComboboxPrimitive.Trigger className={comboboxClasses.trigger} aria-label="Abrir resultados">⌄</ComboboxPrimitive.Trigger>
          </ComboboxPrimitive.InputGroup>
          <ComboboxPrimitive.Portal>
            <ComboboxPrimitive.Positioner className={comboboxClasses.positioner} sideOffset={4} align="start">
              <ComboboxPrimitive.Popup className={`${comboboxClasses.popup} esmera-sales-customer-popup`} aria-busy={searching || undefined}>
                <ComboboxPrimitive.Empty className="esmera-sales-customer-empty">
                  {searching ? 'Buscando clientes…' : query.trim().length < 2 ? 'Digite ao menos 2 caracteres.' : 'Nenhum cliente encontrado.'}
                </ComboboxPrimitive.Empty>
                <ComboboxPrimitive.List className="esmera-sales-customer-list">
                  {(item: CustomerRef) => <ComboboxPrimitive.Item key={String(item.id)} className={comboboxClasses.item} value={item}>
                    <span className="esmera-sales-customer-result"><strong>{item.name || 'Cliente'}</strong><small>{[item.company, item.phone].filter(Boolean).join(' · ') || 'Sem identificação complementar'}</small></span>
                  </ComboboxPrimitive.Item>}
                </ComboboxPrimitive.List>
              </ComboboxPrimitive.Popup>
            </ComboboxPrimitive.Positioner>
          </ComboboxPrimitive.Portal>
        </ComboboxPrimitive.Root>
      </Field>

      <div className="esmera-sales-create-grid">
        <Field label="Produto">
          <select className="esmera-input" required value={productID} onChange={(event) => {
            setProductID(event.target.value)
            setVariantSku('')
            setUnitPrice('')
          }}>
            <option value="">Selecione</option>
            {products.map((product) => <option key={String(product.id)} value={String(product.id)}>{product.title || product.code || product.id}</option>)}
          </select>
        </Field>
        {availableVariants.length ? <Field label="Variante">
          <select className="esmera-input" value={variantSku} onChange={(event) => {
            setVariantSku(event.target.value)
            setUnitPrice('')
          }}>
            <option value="">Produto base</option>
            {availableVariants.map((variant) => <option key={variant.sku || ''} value={variant.sku || ''}>{variant.sku || 'Sem SKU'}</option>)}
          </select>
        </Field> : null}
        <Field label="Quantidade">
          <input className="esmera-input" type="number" min={1} step={1} required value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />
        </Field>
        <Field label="Preço unitário">
          {price.mode === 'fixed'
            ? <output className="esmera-sales-fixed-price">{money(price.cents)}</output>
            : <input className="esmera-input" inputMode="decimal" required={Boolean(productID)} value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0,00" />}
        </Field>
      </div>

      {feedback ? <InlineFeedback tone="danger">{feedback}</InlineFeedback> : null}
      <div className="esmera-actions esmera-sales-create-actions">
        <Dialog.Close ref={closeRef} className="esmera-button" type="button">Cancelar</Dialog.Close>
        <Button type="submit" tone="primary" disabled={busy || !customer || !productID}>
          {busy ? 'Criando venda…' : 'Criar venda'}
        </Button>
      </div>
    </form>
  </DialogPanel>
}

'''
replace_once(
    'src/admin/modules/sales/SalesWorkspaceClient.tsx',
    'export function SalesWorkspaceClient(props: Props) {',
    sale_dialog + 'export function SalesWorkspaceClient(props: Props) {',
)

replace_once(
    'src/admin/modules/sales/SalesViews.tsx',
    "import { SalesWorkspaceClient } from './SalesWorkspaceClient'",
    "import { SaleCreateDialog, SalesWorkspaceClient } from './SalesWorkspaceClient'\nimport './sale-create-dialog.scss'",
)
replace_once(
    'src/admin/modules/sales/SalesViews.tsx',
    '''actions={<><TechnicalLink href="/admin/collections/opportunities/create" primary>Nova oportunidade</TechnicalLink><TechnicalLink href="/admin/collections/sales">Vendas confirmadas</TechnicalLink></>}''',
    '''actions={<><TechnicalLink href="/admin/collections/opportunities/create" primary>Nova oportunidade</TechnicalLink><SaleCreateDialog products={productsResult.docs} /><TechnicalLink href="/admin/collections/sales">Vendas confirmadas</TechnicalLink></>}''',
)

write('src/admin/modules/sales/sale-create-dialog.scss', '''@use '../../design-system/tokens';

.esmera-sales-create-form {
  display: grid;
  gap: var(--esmera-space-5);
}

.esmera-sales-create-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--esmera-space-4);
}

.esmera-sales-customer-field,
.esmera-sales-customer-field > * {
  min-width: 0;
}

.esmera-sales-customer-combobox {
  position: relative;
  min-width: 0;
  display: flex;
  align-items: center;
}

.esmera-sales-customer-combobox .esmera-combobox-input {
  width: 100%;
  padding-right: 42px;
}

.esmera-sales-customer-combobox .esmera-combobox-trigger {
  position: absolute;
  right: 1px;
  width: 38px;
  height: calc(100% - 2px);
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--esmera-text-muted);
  cursor: pointer;
}

.esmera-sales-customer-popup {
  width: var(--anchor-width);
  max-height: 260px;
  overflow: hidden;
}

.esmera-sales-customer-list {
  max-height: 248px;
  overflow: auto;
}

.esmera-sales-customer-empty {
  padding: var(--esmera-space-3);
  color: var(--esmera-text-muted);
  font-size: var(--esmera-font-ui-sm);
}

.esmera-sales-customer-result {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.esmera-sales-customer-result strong,
.esmera-sales-customer-result small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.esmera-sales-customer-result small {
  color: var(--esmera-text-muted);
  font-size: var(--esmera-font-meta);
}

.esmera-sales-create-actions {
  justify-content: flex-end;
}

@media (max-width: 560px) {
  .esmera-sales-create-grid {
    grid-template-columns: 1fr;
  }

  .esmera-sales-create-actions .esmera-button {
    width: 100%;
  }
}
''')

write('src/admin/modules/categories/CategoryCreateDialog.tsx', ''''use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button, DialogPanel, Field, InlineFeedback } from '../../design-system'
import type { CategoryParent } from './types'

type CategoryCreateResponse = {
  id?: string | number
  error?: string | { summary?: string; message?: string }
}

function responseError(body: CategoryCreateResponse) {
  if (typeof body.error === 'string') return body.error
  return body.error?.summary || body.error?.message || 'Não foi possível criar a categoria.'
}

export function CategoryCreateDialog({ categories }: { categories: CategoryParent[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', parent: '', status: 'active' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'create',
          data: {
            title: draft.title,
            parent: draft.parent || null,
            status: draft.status,
          },
        }),
      })
      const body = await response.json() as CategoryCreateResponse
      if (!response.ok) throw new Error(responseError(body))
      if (body.id === undefined) throw new Error('A categoria foi criada sem identificador retornado.')
      router.push(`/admin/categories?category=${body.id}&tab=general`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível criar a categoria.')
    } finally {
      setBusy(false)
    }
  }

  return <DialogPanel
    trigger="Nova categoria"
    title="Nova categoria"
    description="Crie a estrutura mínima e complete descrição, mídia, SEO e sinônimos no detalhe."
  >
    <form className="esmera-category-dialog-form" onSubmit={submit}>
      <Field label="Nome">
        <input className="esmera-input" required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </Field>
      <Field label="Categoria principal">
        <select className="esmera-input" value={draft.parent} onChange={(event) => setDraft({ ...draft, parent: event.target.value })}>
          <option value="">Sem categoria principal</option>
          {categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.title || category.slug || category.id}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select className="esmera-input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
          <option value="active">Ativa</option>
          <option value="archive">Arquivada</option>
        </select>
      </Field>
      {feedback ? <InlineFeedback tone="danger">{feedback}</InlineFeedback> : null}
      <div className="esmera-category-dialog-actions">
        <Button type="submit" tone="primary" disabled={busy}>{busy ? 'Criando…' : 'Criar categoria'}</Button>
      </div>
    </form>
  </DialogPanel>
}
''')

write('src/admin/modules/categories/category-create-dialog.scss', '''@use '../../design-system/tokens';

.esmera-category-dialog-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--esmera-space-4);
}

.esmera-category-dialog-form > .esmera-field:first-child,
.esmera-category-dialog-form > .esmera-inline-feedback,
.esmera-category-dialog-actions {
  grid-column: 1 / -1;
}

.esmera-category-dialog-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 560px) {
  .esmera-category-dialog-form {
    grid-template-columns: 1fr;
  }

  .esmera-category-dialog-form > *,
  .esmera-category-dialog-form > .esmera-field:first-child,
  .esmera-category-dialog-form > .esmera-inline-feedback,
  .esmera-category-dialog-actions {
    grid-column: 1;
  }

  .esmera-category-dialog-actions .esmera-button {
    width: 100%;
  }
}
''')

replace_once(
    'src/admin/modules/categories/CategoriesView.tsx',
    '''  QueryError,
  TechnicalLink,
  ViewFrame,''',
    '''  QueryError,
  ViewFrame,''',
)
replace_once(
    'src/admin/modules/categories/CategoriesView.tsx',
    "import { CategoriesMasterList } from './CategoriesMasterList'",
    "import { CategoriesMasterList } from './CategoriesMasterList'\nimport { CategoryCreateDialog } from './CategoryCreateDialog'",
)
replace_once(
    'src/admin/modules/categories/CategoriesView.tsx',
    "import './categories.scss'",
    "import './categories.scss'\nimport './category-create-dialog.scss'",
)
replace_once(
    'src/admin/modules/categories/CategoriesView.tsx',
    '''actions={<TechnicalLink href="/admin/collections/categories/create" primary>Nova categoria</TechnicalLink>}''',
    '''actions={<CategoryCreateDialog categories={allResult.docs} />}''',
)

print('Frontend patch applied.')
