/* eslint-disable react-hooks/incompatible-library -- The workspace intentionally keeps server-backed row selection outside React Compiler memoization. */
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import {
  BulkActionBar,
  Button,
  DataTable,
  EmptyState,
  FilterPanel,
  InlineFeedback,
  SegmentedControl,
  SegmentedControlLink,
} from '../../design-system'
import {
  availabilityLabels,
  coverItem,
  imageURL,
  type ProductCategory,
  type ProductListItem,
  type ProductWorkspaceFilters,
} from './types'

type Props = {
  products: ProductListItem[]
  categories: ProductCategory[]
  filters: ProductWorkspaceFilters
  totalDocs: number
  totalPages: number
}

type BulkStatus =
  | 'published'
  | 'published_but_unverified'
  | 'published_but_incompatible'
  | 'publish_reverted'
  | 'blocked'
  | 'warning_requires_confirmation'
  | 'revision_conflict'
  | 'failed'

type BulkItem = {
  id: string | number
  title?: string
  status: BulkStatus
  message: string
  publicationRevision?: string
  traceId?: string
  retryable?: boolean
  updatedAt?: string
  confirmationToken?: string
  issues?: Array<{ message: string; suggestion?: string | null }>
}

type BulkResult = {
  requested: number
  published: number
  unverified: number
  incompatible: number
  reverted: number
  blocked: number
  conflicts: number
  failed: number
  results: BulkItem[]
}

type PublishRequestItem = {
  id: string | number
  expectedUpdatedAt: string
  confirmationToken?: string
}

const bulkLabels: Record<BulkStatus, string> = {
  published: 'Visível no site',
  published_but_unverified: 'Publicado; confirmação do site pendente',
  published_but_incompatible: 'Publicado com problema de compatibilidade',
  publish_reverted: 'Publicação desfeita; versão anterior preservada',
  blocked: 'Pendências impedem publicar',
  warning_requires_confirmation: 'Avisos aguardando confirmação',
  revision_conflict: 'Alterado em outra sessão',
  failed: 'Não foi possível publicar',
}

const operationalLabels: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Pronto',
  publishing: 'Publicando',
  pending_verification: 'Aguardando confirmação',
  published: 'Visível no site',
  published_but_unverified: 'Confirmação pendente',
  published_but_incompatible: 'Problema de compatibilidade',
  publish_reverted: 'Publicação desfeita',
  blocked: 'Bloqueado',
  conflict: 'Conflito',
  failed: 'Falhou',
}

function publicationLabel(product: ProductListItem) {
  return operationalLabels[product.publicationOperationalStatus || ''] ||
    (product._status === 'published' ? 'Publicado no Payload' : 'Rascunho')
}

function productHref(filters: ProductWorkspaceFilters, id: string | number) {
  const params = new URLSearchParams({
    product: String(id),
    tab: 'overview',
    returnPage: String(filters.page),
    returnLimit: String(filters.limit),
    returnView: filters.view,
  })
  if (filters.q) params.set('returnQ', filters.q)
  if (filters.status !== 'all') params.set('returnStatus', filters.status)
  if (filters.availability !== 'all') params.set('returnAvailability', filters.availability)
  if (filters.publication !== 'all') params.set('returnPublication', filters.publication)
  if (filters.category !== 'all') params.set('returnCategory', filters.category)
  return `/admin/products?${params.toString()}`
}

function listHref(filters: ProductWorkspaceFilters, patch: Partial<ProductWorkspaceFilters>) {
  const next = { ...filters, ...patch }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.status !== 'all') params.set('status', next.status)
  if (next.availability !== 'all') params.set('availability', next.availability)
  if (next.publication !== 'all') params.set('publication', next.publication)
  if (next.category !== 'all') params.set('category', next.category)
  if (next.page > 1) params.set('page', String(next.page))
  if (next.limit !== 50) params.set('limit', String(next.limit))
  if (next.view !== 'list') params.set('view', next.view)
  const query = params.toString()
  return query ? `/admin/products?${query}` : '/admin/products'
}

function Readiness({ product }: { product: ProductListItem }) {
  const count = product.publicationIssues?.length || 0
  return (
    <span className={`esmera-product-readiness${product.publicationReady ? ' is-ready' : ' has-issues'}`}>
      <span aria-hidden="true" />
      {product.publicationReady ? 'Pronto' : `${count} pendência${count === 1 ? '' : 's'}`}
    </span>
  )
}

function publicTone(status: string | null | undefined) {
  if (status === 'published' || status === 'publish_reverted') return 'success' as const
  if (status === 'published_but_incompatible' || status === 'failed') return 'danger' as const
  return 'warning' as const
}

export function ProductsWorkspaceClient({ products, categories, filters, totalDocs, totalPages }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [availability, setAvailability] = useState('')

  const selectedProducts = useMemo(
    () => products.filter((product) => selected[String(product.id)]),
    [products, selected],
  )

  function toggle(id: string | number, checked: boolean) {
    setSelected((current) => ({ ...current, [String(id)]: checked }))
  }

  async function publish(items?: PublishRequestItem[]) {
    const requests = items || selectedProducts.map((product) => ({
      id: product.id,
      expectedUpdatedAt: product.updatedAt || '',
    }))
    if (!requests.length || busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'publish', items: requests }),
      })
      const body = await response.json() as {
        result?: { meta?: BulkResult }
        error?: { summary?: string } | string
      }
      if (!response.ok || !body.result?.meta) {
        const message = typeof body.error === 'string' ? body.error : body.error?.summary
        throw new Error(message || 'Não foi possível publicar os produtos.')
      }
      const result = body.result.meta
      setBulkResult(result)
      const terminal = new Set(
        result.results
          .filter((item) => item.status === 'published' || item.status === 'publish_reverted')
          .map((item) => String(item.id)),
      )
      setSelected((current) => Object.fromEntries(
        Object.entries(current).filter(([id, value]) => value && !terminal.has(id)),
      ))
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível publicar os produtos.')
    } finally {
      setBusy(false)
    }
  }

  async function recheck(item: BulkItem) {
    if (!item.publicationRevision || busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-publication-recheck', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          entity: 'product',
          id: item.id,
          expectedPublicationRevision: item.publicationRevision,
          contractVersion: '1',
          parentTraceId: item.traceId,
        }),
      })
      const body = await response.json() as {
        result?: { message?: string }
        error?: { summary?: string } | string
      }
      if (!response.ok) {
        const message = typeof body.error === 'string' ? body.error : body.error?.summary
        throw new Error(message || 'Não foi possível verificar novamente.')
      }
      setFeedback(body.result?.message || 'A verificação foi processada.')
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível verificar novamente.')
    } finally {
      setBusy(false)
    }
  }

  async function mutate(action: 'unpublish' | 'archive' | 'restore' | 'add-category' | 'set-availability') {
    if (!selectedProducts.length || busy) return
    if (action === 'add-category' && !categoryId) return setFeedback('Escolha uma categoria antes de aplicar.')
    if (action === 'set-availability' && !availability) return setFeedback('Escolha uma disponibilidade antes de aplicar.')
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action,
          ids: selectedProducts.map((product) => product.id),
          categoryId: categoryId || undefined,
          availability: availability || undefined,
        }),
      })
      const body = await response.json() as {
        updated?: number
        errors?: Array<{ message: string }>
        error?: string
      }
      if (!response.ok) throw new Error(body.error || 'Não foi possível atualizar os produtos.')
      setFeedback(`${body.updated || 0} produto(s) atualizados.${body.errors?.length ? ` ${body.errors.length} item(ns) falharam.` : ''}`)
      setSelected({})
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar os produtos.')
    } finally {
      setBusy(false)
    }
  }

  const pendingWarnings = (bulkResult?.results || []).filter(
    (item) => item.status === 'warning_requires_confirmation' && item.updatedAt && item.confirmationToken,
  )

  return (
    <div className="esmera-products-workspace">
      <form method="get" action="/admin/products">
        <input type="hidden" name="view" value={filters.view} />
        <input type="hidden" name="limit" value={filters.limit} />
        <FilterPanel
          className="esmera-products-filter-panel"
          primary={(
            <>
              <label className="esmera-products-search"><span>Buscar</span><input className="esmera-input" name="q" defaultValue={filters.q} /></label>
              <label><span>Catálogo</span><select className="esmera-input" name="status" defaultValue={filters.status}><option value="all">Todos</option><option value="active">Ativos</option><option value="archived">Arquivados</option></select></label>
              <label><span>Publicação</span><select className="esmera-input" name="publication" defaultValue={filters.publication}><option value="all">Todas</option><option value="published">Publicados no Payload</option><option value="draft">Rascunhos</option><option value="ready">Prontos</option><option value="issues">Com pendências</option></select></label>
            </>
          )}
          advancedLabel="Disponibilidade e categoria"
          advancedActive={filters.availability !== 'all' || filters.category !== 'all'}
          advanced={(
            <div className="esmera-products-advanced-filters">
              <label><span>Disponibilidade</span><select className="esmera-input" name="availability" defaultValue={filters.availability}><option value="all">Todas</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Categoria</span><select className="esmera-input" name="category" defaultValue={filters.category}><option value="all">Todas</option>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.title || category.slug || category.id}</option>)}</select></label>
            </div>
          )}
          actions={<><Button type="submit" tone="primary">Aplicar</Button><Link className="esmera-button esmera-button--quiet" href="/admin/products">Limpar</Link></>}
        />
      </form>

      <div className="esmera-products-viewbar">
        <div><strong>{totalDocs}</strong> produto{totalDocs === 1 ? '' : 's'}</div>
        <SegmentedControl label="Visualização dos produtos">
          <SegmentedControlLink selected={filters.view === 'list'} href={listHref(filters, { view: 'list', page: 1 })}>Lista</SegmentedControlLink>
          <SegmentedControlLink selected={filters.view === 'grid'} href={listHref(filters, { view: 'grid', page: 1 })}>Grid</SegmentedControlLink>
        </SegmentedControl>
      </div>

      {feedback ? <InlineFeedback busy={busy} tone={feedback.includes('não') || feedback.includes('falharam') ? 'danger' : feedback.includes('pendente') ? 'warning' : 'success'}>{feedback}</InlineFeedback> : null}

      {bulkResult ? (
        <section className="esmera-products-bulk-result" aria-label="Resultado da publicação em lote">
          <div className="esmera-products-bulk-result__header">
            <InlineFeedback tone={bulkResult.unverified || bulkResult.incompatible || bulkResult.blocked || bulkResult.conflicts || bulkResult.failed ? 'warning' : 'success'}>
              {bulkResult.published} visível(is), {bulkResult.unverified} pendente(s), {bulkResult.incompatible} incompatível(is) e {bulkResult.reverted} revertido(s).
            </InlineFeedback>
            <button className="esmera-icon-button" type="button" onClick={() => setBulkResult(null)} aria-label="Fechar resultado">×</button>
          </div>
          <ul className="esmera-products-bulk-result__list">
            {bulkResult.results.filter((item) => item.status !== 'published').map((item) => (
              <li key={String(item.id)}>
                <div>
                  <strong>{item.title || `Produto ${item.id}`}</strong>
                  <span className="esmera-products-bulk-result__status">{bulkLabels[item.status]}</span>
                  <p>{item.message}</p>
                  {item.issues?.length ? <ul className="esmera-product-issues">{item.issues.map((issue, index) => <li key={`${item.id}-${index}`}>{issue.message}{issue.suggestion ? <small>{issue.suggestion}</small> : null}</li>)}</ul> : null}
                </div>
                <div className="esmera-actions">
                  <Link className="esmera-button" href={productHref(filters, item.id)}>Abrir produto</Link>
                  {item.status === 'revision_conflict' ? <Button onClick={() => router.refresh()}>Recarregar lista</Button> : null}
                  {item.status === 'published_but_unverified' && item.publicationRevision ? <Button disabled={busy} onClick={() => void recheck(item)}>Tentar verificar novamente</Button> : null}
                </div>
              </li>
            ))}
          </ul>
          {pendingWarnings.length ? <Button tone="primary" disabled={busy} onClick={() => void publish(pendingWarnings.map((item) => ({ id: item.id, expectedUpdatedAt: item.updatedAt as string, confirmationToken: item.confirmationToken })))}>Confirmar avisos e publicar ({pendingWarnings.length})</Button> : null}
        </section>
      ) : null}

      {!products.length ? (
        <EmptyState title="Nenhum produto encontrado" copy="Ajuste os filtros ou crie um novo produto." action={<Link className="esmera-button esmera-button--primary" href="/admin/collections/products/create">Novo produto</Link>} />
      ) : filters.view === 'grid' ? (
        <div className="esmera-products-grid">
          {products.map((product) => {
            const cover = coverItem(product.gallery)
            const src = imageURL(cover)
            return <article className="esmera-product-tile" key={String(product.id)}><Link className="esmera-product-tile__media" href={productHref(filters, product.id)}>{src ? <img src={src} alt={cover?.alt || product.title || ''} /> : <span>Sem imagem</span>}</Link><div className="esmera-product-tile__body"><div><Link href={productHref(filters, product.id)}>{product.title || 'Produto sem título'}</Link><small>{product.code || 'Sem código'}</small></div><Readiness product={product} /></div><div className="esmera-product-tile__meta"><span>{availabilityLabels[product.availability || ''] || '—'}</span><span>{publicationLabel(product)}</span></div><label><input type="checkbox" checked={Boolean(selected[String(product.id)])} onChange={(event) => toggle(product.id, event.target.checked)} /> Selecionar</label></article>
          })}
        </div>
      ) : (
        <DataTable label="Produtos do catálogo">
          <thead><tr><th><span className="sr-only">Selecionar</span></th><th>Produto</th><th>Disponibilidade</th><th>Catálogo</th><th>Publicação</th><th>Prontidão</th><th>Ação</th></tr></thead>
          <tbody>{products.map((product) => <tr key={String(product.id)}><td><input aria-label={`Selecionar ${product.title || 'produto'}`} type="checkbox" checked={Boolean(selected[String(product.id)])} onChange={(event) => toggle(product.id, event.target.checked)} /></td><td><Link className="esmera-row-title" href={productHref(filters, product.id)}>{product.title || 'Produto sem título'}</Link><small>{product.code || 'Sem código'}</small></td><td>{availabilityLabels[product.availability || ''] || '—'}</td><td>{product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</td><td><InlineFeedback tone={publicTone(product.publicationOperationalStatus)}>{publicationLabel(product)}</InlineFeedback></td><td><Readiness product={product} /></td><td><Link className="esmera-button" href={productHref(filters, product.id)}>Abrir</Link></td></tr>)}</tbody>
        </DataTable>
      )}

      <nav className="esmera-products-pagination" aria-label="Paginação de produtos">
        <Link className={`esmera-button${filters.page <= 1 ? ' is-disabled' : ''}`} aria-disabled={filters.page <= 1} href={listHref(filters, { page: Math.max(1, filters.page - 1) })}>Anterior</Link>
        <span>Página {filters.page} de {Math.max(1, totalPages)}</span>
        <Link className={`esmera-button${filters.page >= totalPages ? ' is-disabled' : ''}`} aria-disabled={filters.page >= totalPages} href={listHref(filters, { page: Math.min(Math.max(1, totalPages), filters.page + 1) })}>Próxima</Link>
      </nav>

      {selectedProducts.length ? (
        <BulkActionBar count={selectedProducts.length}>
          <Button disabled={busy} tone="primary" onClick={() => void publish()}>Publicar</Button>
          <Button disabled={busy} onClick={() => void mutate('unpublish')}>Despublicar</Button>
          <Button disabled={busy} onClick={() => void mutate('archive')}>Arquivar</Button>
          <Button disabled={busy} onClick={() => void mutate('restore')}>Restaurar</Button>
          <label className="esmera-products-bulk-category"><span>Categoria</span><select className="esmera-input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Escolher…</option>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.title || category.slug || category.id}</option>)}</select></label>
          <Button disabled={busy || !categoryId} onClick={() => void mutate('add-category')}>Adicionar categoria</Button>
          <label className="esmera-products-bulk-category"><span>Disponibilidade</span><select className="esmera-input" value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="">Escolher…</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <Button disabled={busy || !availability} onClick={() => void mutate('set-availability')}>Aplicar disponibilidade</Button>
        </BulkActionBar>
      ) : null}
    </div>
  )
}
