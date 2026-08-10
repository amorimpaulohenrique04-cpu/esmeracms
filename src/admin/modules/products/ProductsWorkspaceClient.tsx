/* eslint-disable react-hooks/incompatible-library -- TanStack Table exposes stateful helpers that React Compiler intentionally does not memoize. */
'use client'

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  type RowSelectionState,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
  BulkActionBar,
  Button,
  ContextInspector,
  DataTable,
  EmptyState,
  FilterPanel,
  InlineFeedback,
  SegmentedControl,
  SegmentedControlLink,
  SplitWorkspace,
} from '../../design-system'
// Contrato real do lote (PR-06). Importado como tipo: nada do runtime do
// servidor entra no bundle do cliente, e o painel não redeclara o contrato.
import type {
  BulkPublicationItemResult,
  BulkPublicationItemStatus,
  BulkPublicationResult,
} from '../../../server/publication/types'
import { ProductCreateDialog } from './ProductCreateDialog'
import {
  availabilityLabels,
  coverItem,
  imageURL,
  type ProductCategory,
  type ProductListItem,
  type ProductWorkspaceFilters,
} from './types'

type WorkspaceProps = {
  products: ProductListItem[]
  categories: ProductCategory[]
  filters: ProductWorkspaceFilters
  totalDocs: number
  totalPages: number
}

// 'publish' saiu daqui: a publicação em lote passa pelo coordenador e usa
// items[] com token de concorrência por produto, não ids[].
type MutationAction = 'unpublish' | 'archive' | 'restore' | 'add-category' | 'set-availability'

type PublishItemRequest = {
  id: string | number
  expectedUpdatedAt: string
  confirmationToken?: string
}

// Ordem de leitura do painel: o que deu certo primeiro, depois o que exige
// ação. As chaves são exatamente os status do contrato — nenhum status novo.
const bulkStatusOrder: BulkPublicationItemStatus[] = [
  'published',
  'warning_requires_confirmation',
  'blocked',
  'revision_conflict',
  'failed',
]

const bulkStatusLabels: Record<BulkPublicationItemStatus, string> = {
  published: 'Publicado',
  blocked: 'Pendências impedem publicar',
  warning_requires_confirmation: 'Avisos aguardando confirmação',
  revision_conflict: 'Alterado em outra sessão',
  failed: 'Não foi possível publicar',
}

/** Único estado de sucesso definitivo do contrato do lote. */
function isBulkSettled(item: BulkPublicationItemResult) {
  return item.status === 'published'
}

/**
 * Única nova tentativa que o contrato autoriza explicitamente.
 *
 * `BulkPublicationItemResult` não expõe `retryable` — essa indicação vive no
 * envelope de erro (`AdminError.retryable`), não por item. Portanto o painel
 * não infere retry: o handshake de confirmação de avisos é a única repetição
 * que o contrato descreve, e ele exige o `confirmationToken` emitido pelo
 * servidor para aquele item. `updatedAt` entra apenas como o token de
 * concorrência que o próprio handshake pede, nunca como sinal de "pode tentar
 * de novo": nenhum outro status recebe ação de reenvio.
 */
function confirmationRequestFor(item: BulkPublicationItemResult): PublishItemRequest | null {
  if (item.status !== 'warning_requires_confirmation') return null
  if (!item.confirmationToken || !item.updatedAt) return null
  return {
    id: item.id,
    expectedUpdatedAt: item.updatedAt,
    confirmationToken: item.confirmationToken,
  }
}

/**
 * Funde o retorno de uma nova tentativa ao resultado já exibido: os itens já
 * concluídos continuam visíveis e os contadores voltam a bater com a lista.
 * A forma devolvida é a do próprio contrato.
 */
function mergeBulkResults(
  previous: BulkPublicationResult | null,
  next: BulkPublicationResult,
): BulkPublicationResult {
  if (!previous) return next
  const byId = new Map(previous.results.map((item) => [String(item.id), item]))
  for (const item of next.results) byId.set(String(item.id), item)
  const results = [...byId.values()]
  const count = (status: BulkPublicationItemStatus) => results.filter((item) => item.status === status).length
  return {
    requested: results.length,
    published: count('published'),
    blocked: count('blocked'),
    conflicts: count('revision_conflict'),
    failed: count('failed'),
    results,
  }
}

function bulkReportPayload(result: BulkPublicationResult) {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      requested: result.requested,
      published: result.published,
      blocked: result.blocked,
      conflicts: result.conflicts,
      failed: result.failed,
    },
    // Só o que não terminou em sucesso definitivo entra no relatório.
    items: result.results.filter((item) => !isBulkSettled(item)).map((item) => ({
      id: item.id,
      title: item.title || `Produto ${item.id}`,
      status: item.status,
      statusLabel: bulkStatusLabels[item.status],
      message: item.message,
      canConfirm: confirmationRequestFor(item) !== null,
      issues: (item.issues || []).map((issue) => ({
        label: issue.label,
        tab: issue.tab,
        message: issue.message,
        suggestion: issue.suggestion ?? null,
      })),
    })),
  }
}

function bulkReportText(result: BulkPublicationResult) {
  const payload = bulkReportPayload(result)
  const lines = [
    'Relatório de publicação em lote',
    `Solicitados: ${payload.summary.requested} · Publicados: ${payload.summary.published} · Bloqueados: ${payload.summary.blocked} · Conflitos: ${payload.summary.conflicts} · Falhas: ${payload.summary.failed}`,
    '',
  ]
  for (const item of payload.items) {
    lines.push(`${item.title} (ID ${item.id})`)
    lines.push(`Status: ${item.statusLabel}`)
    lines.push(`Mensagem: ${item.message}`)
    lines.push(`Nova tentativa: ${item.canConfirm ? 'disponível (confirmação de avisos)' : 'indisponível'}`)
    for (const issue of item.issues) {
      lines.push(`- ${issue.label} (${issue.tab}): ${issue.message}${issue.suggestion ? ` — ${issue.suggestion}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

function money(cents: number | null | undefined) {
  if (typeof cents !== 'number') return 'Sob consulta'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function date(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: 'short', year: 'numeric' })
}

function productHref(filters: ProductWorkspaceFilters, productId: string | number, tab = 'overview') {
  const params = new URLSearchParams()
  params.set('product', String(productId))
  params.set('tab', tab)
  params.set('returnPage', String(filters.page))
  params.set('returnLimit', String(filters.limit))
  params.set('returnView', filters.view)
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
  return (
    <span className={`esmera-product-readiness${product.publicationReady ? ' is-ready' : ' has-issues'}`}>
      <span aria-hidden="true" />
      {product.publicationReady ? 'Pronto' : `${product.publicationIssues?.length || 0} pendência${product.publicationIssues?.length === 1 ? '' : 's'}`}
    </span>
  )
}

function ProductState({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return <span className={`esmera-product-state${active ? ' is-active' : ''}`}><span aria-hidden="true" />{children}</span>
}

function InspectorContent({ product, filters }: { product: ProductListItem; filters: ProductWorkspaceFilters }) {
  const cover = coverItem(product.gallery)
  const coverURL = imageURL(cover)
  const categories = (product.categories || []).filter((item): item is ProductCategory => typeof item === 'object' && item !== null)
  return (
    <div className="esmera-product-inspector">
      <div className="esmera-product-inspector__media">
        {coverURL ? <img className="esmera-product-inspector__image" src={coverURL} alt={cover?.alt || product.title || ''} /> : <div className="esmera-product-inspector__placeholder">Sem imagem</div>}
        <div className="esmera-product-inspector__media-meta">
          <span>{product.gallery?.length || 0} mídia{product.gallery?.length === 1 ? '' : 's'}</span>
          <Readiness product={product} />
        </div>
      </div>
      <dl className="esmera-product-inspector__facts">
        <div><dt>Código</dt><dd>{product.code || '—'}</dd></div>
        <div><dt>Disponibilidade</dt><dd>{availabilityLabels[product.availability || ''] || '—'}</dd></div>
        <div><dt>Preço</dt><dd>{product.priceMode === 'fixed' ? money(product.basePriceCents) : 'Sob consulta'}</dd></div>
        <div><dt>Publicação</dt><dd>{product._status === 'published' ? 'Publicado' : 'Rascunho'}</dd></div>
        <div><dt>Catálogo</dt><dd>{product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</dd></div>
        <div><dt>Atualizado</dt><dd>{date(product.updatedAt)}</dd></div>
      </dl>
      {categories.length ? <div className="esmera-product-inspector__categories">{categories.map((category) => <span key={String(category.id)}>{category.title || category.slug || category.id}</span>)}</div> : null}
      {!product.publicationReady && product.publicationIssues?.length ? (
        <div className="esmera-product-readiness-list">
          <strong>Pendências para publicar</strong>
          <ul>{product.publicationIssues.map((issue, index) => <li key={`${issue.message}-${index}`}>{issue.message}</li>)}</ul>
        </div>
      ) : null}
    </div>
  )
}

export function ProductsWorkspaceClient({ products, categories, filters, totalDocs, totalPages }: WorkspaceProps) {
  const router = useRouter()
  const inspectorTrigger = useRef<HTMLButtonElement | null>(null)
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const bulkPanel = useRef<HTMLElement | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkPublicationResult | null>(null)
  const [bulkAnnouncement, setBulkAnnouncement] = useState('')
  const [bulkFocusToken, setBulkFocusToken] = useState(0)
  const [reportFeedback, setReportFeedback] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [bulkAvailability, setBulkAvailability] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('inspect')
  })

  // O foco só se move quando há algo a resolver; o token evita mover o foco de
  // novo quando o painel apenas rerenderiza.
  useEffect(() => {
    if (!bulkFocusToken) return
    bulkPanel.current?.focus()
  }, [bulkFocusToken])

  const openInspector = (id: string | number, trigger: HTMLButtonElement) => {
    inspectorTrigger.current = trigger
    setSelectedProductId(String(id))
    const url = new URL(window.location.href)
    url.searchParams.set('inspect', String(id))
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }

  const closeInspector = () => {
    setSelectedProductId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('inspect')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    window.requestAnimationFrame(() => inspectorTrigger.current?.focus({ preventScroll: true }))
  }

  const columns = useMemo<ColumnDef<ProductListItem>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <input aria-label="Selecionar página" type="checkbox" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />,
      cell: ({ row }) => <input aria-label={`Selecionar ${row.original.title || 'produto'}`} type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />,
      size: 40,
    },
    {
      id: 'product',
      header: 'Produto',
      cell: ({ row }) => {
        const product = row.original
        const cover = coverItem(product.gallery)
        const coverURL = imageURL(cover)
        return (
          <div className="esmera-product-cell">
            <span className="esmera-product-list-thumb">{coverURL ? <img src={coverURL} alt="" /> : null}</span>
            <div className="esmera-product-cell__copy">
              <Link href={productHref(filters, product.id)}>{product.title || 'Produto sem título'}</Link>
              <small>{product.code || 'Sem código'} · {product.slug || 'sem-slug'}</small>
            </div>
          </div>
        )
      },
    },
    { accessorKey: 'availability', header: 'Disponibilidade', cell: ({ getValue }) => availabilityLabels[String(getValue() || '')] || '—' },
    { id: 'price', header: 'Preço', cell: ({ row }) => row.original.priceMode === 'fixed' ? money(row.original.basePriceCents) : 'Sob consulta' },
    { id: 'catalog', header: 'Catálogo', cell: ({ row }) => <ProductState active={row.original.catalogStatus === 'active'}>{row.original.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'}</ProductState> },
    { id: 'publication', header: 'Publicação', cell: ({ row }) => <ProductState active={row.original._status === 'published'}>{row.original._status === 'published' ? 'Publicado' : 'Rascunho'}</ProductState> },
    { id: 'readiness', header: 'Prontidão', cell: ({ row }) => <Readiness product={row.original} /> },
    { accessorKey: 'updatedAt', header: 'Atualizado', cell: ({ getValue }) => date(String(getValue() || '')) },
    {
      id: 'inspect',
      header: '',
      cell: ({ row }) => <Button className="esmera-product-row-action" type="button" onClick={(event) => openInspector(row.original.id, event.currentTarget)}>Inspecionar</Button>,
    },
  ], [filters])

  const table = useReactTable({
    data: products,
    columns,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
  })

  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id)
  const selectedProduct = products.find((product) => String(product.id) === selectedProductId)

  async function publishSelected(override?: PublishItemRequest[]) {
    if (busy) return
    const items: PublishItemRequest[] = override || table.getSelectedRowModel().rows.map((row) => ({
      id: row.original.id,
      expectedUpdatedAt: row.original.updatedAt || '',
    }))
    if (!items.length) return

    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'publish', items }),
      })
      const body = await response.json() as {
        ok?: boolean
        result?: { meta?: BulkPublicationResult }
        error?: { summary?: string }
      }
      if (!response.ok || !body.result?.meta) {
        throw new Error(body.error?.summary || 'Não foi possível publicar os produtos.')
      }

      // Uma nova tentativa devolve só os itens reenviados: fundir preserva os
      // que já foram concluídos em tentativas anteriores.
      const result = mergeBulkResults(bulkResult, body.result.meta)
      setBulkResult(result)
      setReportFeedback(null)

      if (result.results.some((item) => !isBulkSettled(item))) {
        // O anúncio vem do foco no painel nomeado. Escrever também na região
        // live faria o leitor de tela ler o mesmo resultado duas vezes.
        setBulkAnnouncement('')
        setBulkFocusToken((token) => token + 1)
      } else {
        setBulkAnnouncement(`${result.published} de ${result.requested} produto(s) publicados.`)
      }

      // Só os publicados saem da seleção. Bloqueados, conflitos, falhas e
      // itens aguardando confirmação permanecem selecionados para retry.
      const publishedIds = new Set(
        result.results.filter(isBulkSettled).map((item) => String(item.id)),
      )
      setSelection((current) => Object.fromEntries(
        Object.entries(current).filter(([id, selected]) => selected && !publishedIds.has(id)),
      ))
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível publicar os produtos.')
    } finally {
      setBusy(false)
    }
  }

  const unsettled = (bulkResult?.results || []).filter((item) => !isBulkSettled(item))

  const dismissBulkResult = () => {
    setBulkResult(null)
    setBulkAnnouncement('')
    setReportFeedback(null)
  }

  // O texto vai para a região live e para o painel: só a região live anuncia,
  // então o leitor de tela recebe o retorno uma única vez.
  const announceReport = (message: string) => {
    setReportFeedback(message)
    setBulkAnnouncement(message)
  }

  async function copyReport() {
    if (!bulkResult) return
    try {
      await navigator.clipboard.writeText(bulkReportText(bulkResult))
      announceReport('Relatório copiado para a área de transferência.')
    } catch {
      announceReport('Não foi possível copiar o relatório.')
    }
  }

  function exportReport() {
    if (!bulkResult) return
    try {
      const blob = new Blob([JSON.stringify(bulkReportPayload(bulkResult), null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `publicacao-em-lote-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      announceReport('Relatório exportado.')
    } catch {
      announceReport('Não foi possível exportar o relatório.')
    }
  }

  async function mutate(action: MutationAction) {
    if (!selectedIds.length || busy) return
    if (action === 'add-category' && !categoryId) {
      setFeedback('Escolha uma categoria antes de aplicar.')
      return
    }
    if (action === 'set-availability' && !bulkAvailability) {
      setFeedback('Escolha uma disponibilidade antes de aplicar.')
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action, ids: selectedIds, categoryId: categoryId || undefined, availability: bulkAvailability || undefined }),
      })
      const body = await response.json() as { updated?: number; errors?: Array<{ id: string | number; message: string }>; error?: string }
      if (!response.ok) throw new Error(body.error || 'Não foi possível atualizar os produtos.')
      const errorSuffix = body.errors?.length ? ` ${body.errors.length} item(ns) não foram alterados.` : ''
      setFeedback(`${body.updated || 0} produto(s) atualizados.${errorSuffix}`)
      setSelection({})
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar os produtos.')
    } finally {
      setBusy(false)
    }
  }

  const master = <>
    <form method="get" action="/admin/products">
      <input type="hidden" name="view" value={filters.view} />
      <input type="hidden" name="limit" value={filters.limit} />
      <FilterPanel
        className="esmera-products-filter-panel"
        primary={<>
          <label className="esmera-products-search"><span>Buscar</span><input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Título, código, slug ou material" /></label>
          <label><span>Catálogo</span><select className="esmera-input" name="status" defaultValue={filters.status}><option value="all">Todos</option><option value="active">Ativos</option><option value="archived">Arquivados</option></select></label>
          <label><span>Publicação</span><select className="esmera-input" name="publication" defaultValue={filters.publication}><option value="all">Todos</option><option value="published">Publicados</option><option value="draft">Rascunhos</option><option value="ready">Prontos</option><option value="issues">Com pendências</option></select></label>
        </>}
        advancedLabel="Disponibilidade e categoria"
        advancedActive={filters.availability !== 'all' || filters.category !== 'all'}
        advanced={<div className="esmera-products-advanced-filters">
          <label><span>Disponibilidade</span><select className="esmera-input" name="availability" defaultValue={filters.availability}><option value="all">Todas</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Categoria</span><select className="esmera-input" name="category" defaultValue={filters.category}><option value="all">Todas</option>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.title || category.slug || category.id}</option>)}</select></label>
          <Button type="submit">Aplicar recorte</Button>
        </div>}
        actions={<><Button type="submit" tone="primary">Aplicar</Button><Link className="esmera-button esmera-button--quiet" href="/admin/products">Limpar</Link></>}
      />
    </form>

    <div className="esmera-products-viewbar">
      <div><strong>{totalDocs}</strong> produto{totalDocs === 1 ? '' : 's'}</div>
      <div className="esmera-products-viewbar__controls">
        <SegmentedControl label="Visualização dos produtos">
          <SegmentedControlLink selected={filters.view === 'list'} href={listHref(filters, { view: 'list', page: 1 })}>Lista</SegmentedControlLink>
          <SegmentedControlLink selected={filters.view === 'grid'} href={listHref(filters, { view: 'grid', page: 1 })}>Grid</SegmentedControlLink>
        </SegmentedControl>
        <label className="esmera-products-limit"><span>Por página</span><select className="esmera-input" value={filters.limit} onChange={(event) => router.push(listHref(filters, { limit: Number(event.target.value) as 50 | 100, page: 1 }))}><option value="50">50</option><option value="100">100</option></select></label>
      </div>
    </div>

    {feedback ? <InlineFeedback busy={busy} tone={feedback.includes('não') ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}

    {/* Região live sempre montada: só recebe texto quando o foco NÃO se move. */}
    <p className="esmera-sr-only" role="status" aria-live="polite">{bulkAnnouncement}</p>

    {bulkResult ? (
      <section
        className="esmera-products-bulk-result"
        role="region"
        aria-labelledby="esmera-bulk-result-title"
        tabIndex={-1}
        ref={bulkPanel}
      >
        <div className="esmera-products-bulk-result__header">
          <div>
            <strong id="esmera-bulk-result-title">Resultado da publicação em lote</strong>
            <p className="esmera-products-bulk-result__status">
              {bulkResult.requested} solicitado(s) · {bulkResult.published} publicado(s) · {bulkResult.blocked} bloqueado(s) · {bulkResult.conflicts} conflito(s) · {bulkResult.failed} falha(s)
            </p>
          </div>
          <button className="esmera-icon-button" type="button" onClick={dismissBulkResult} aria-label="Fechar resultado da publicação">×</button>
        </div>

        {bulkStatusOrder.map((status) => {
          const group = bulkResult.results.filter((item) => item.status === status)
          if (!group.length) return null
          return (
            <section key={status} className="esmera-products-bulk-result__group" aria-labelledby={`esmera-bulk-group-${status}`}>
              <strong id={`esmera-bulk-group-${status}`}>{bulkStatusLabels[status]} ({group.length})</strong>
              <ul className="esmera-products-bulk-result__list">
                {group.map((item) => {
                  const confirmation = confirmationRequestFor(item)
                  return (
                    <li key={String(item.id)} data-status={item.status} data-can-confirm={confirmation ? 'true' : 'false'}>
                      <div>
                        <strong>{item.title || `Produto ${item.id}`}</strong>
                        <span className="esmera-products-bulk-result__status">{bulkStatusLabels[item.status]}</span>
                        <p>{item.message}</p>
                        {item.issues?.length ? (
                          <ul className="esmera-product-issues">
                            {item.issues.map((issue, index) => (
                              <li key={`${item.id}-${issue.code}-${index}`}>
                                <strong>{issue.label}</strong>
                                {issue.tab ? <span className="esmera-products-bulk-result__status">{issue.tab}</span> : null}
                                <p>{issue.message}</p>
                                {issue.suggestion ? <small>{issue.suggestion}</small> : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      {/* Cada status recebe só a ação que o contrato e os
                          mecanismos atuais do workspace já sustentam. `failed`
                          não tem nenhuma: o contrato não descreve repetição
                          segura para ele. */}
                      <div className="esmera-actions">
                        {item.status === 'blocked' ? (
                          <Link className="esmera-button" href={productHref(filters, item.id)}>Corrigir produto</Link>
                        ) : null}
                        {item.status === 'published' ? (
                          <Link className="esmera-button" href={productHref(filters, item.id)}>Abrir produto</Link>
                        ) : null}
                        {item.status === 'revision_conflict' ? <Button onClick={() => router.refresh()}>Recarregar</Button> : null}
                        {confirmation ? (
                          <Button disabled={busy} onClick={() => void publishSelected([confirmation])}>
                            Confirmar avisos e publicar
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        <div className="esmera-actions">
          <Button disabled={!unsettled.length} onClick={() => void copyReport()}>Copiar relatório</Button>
          <Button disabled={!unsettled.length} onClick={exportReport}>Exportar relatório</Button>
        </div>
        {reportFeedback ? <p className="esmera-products-bulk-result__status">{reportFeedback}</p> : null}
      </section>
    ) : null}

    {!products.length ? (
      <EmptyState title="Nenhum produto encontrado" copy="Ajuste os filtros ou crie um novo produto para iniciar o catálogo." action={<ProductCreateDialog />} />
    ) : filters.view === 'list' ? (
      <DataTable label="Produtos do catálogo">
        <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
        <tbody>{table.getRowModel().rows.map((row) => {
          const rowClass = [
            String(row.original.id) === selectedProductId ? 'is-selected' : '',
            row.getIsSelected() ? 'is-checked' : '',
          ].filter(Boolean).join(' ')
          return <tr key={row.id} className={rowClass}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
        })}</tbody>
      </DataTable>
    ) : (
      <div className="esmera-products-grid">
        {products.map((product) => {
          const cover = coverItem(product.gallery)
          const coverURL = imageURL(cover)
          const row = table.getRow(String(product.id))
          const checked = row.getIsSelected()
          const tileClass = [
            'esmera-product-tile',
            String(product.id) === selectedProductId ? 'is-selected' : '',
            checked ? 'is-checked' : '',
          ].filter(Boolean).join(' ')
          return <article className={tileClass} key={String(product.id)}>
            <span className="esmera-product-tile__select"><input aria-label={`Selecionar ${product.title || 'produto'}`} type="checkbox" checked={checked} onChange={row.getToggleSelectedHandler()} /></span>
            <Link className="esmera-product-tile__media" href={productHref(filters, product.id)}>{coverURL ? <img src={coverURL} alt={cover?.alt || product.title || ''} /> : <span>Sem imagem</span>}</Link>
            <div className="esmera-product-tile__body"><div><Link href={productHref(filters, product.id)}>{product.title || 'Produto sem título'}</Link><small>{product.code || 'Sem código'}</small></div><Readiness product={product} /></div>
            <div className="esmera-product-tile__meta"><span>{availabilityLabels[product.availability || ''] || '—'}</span><span>{product.priceMode === 'fixed' ? money(product.basePriceCents) : 'Sob consulta'}</span></div>
            <Button className="esmera-product-tile__inspect" type="button" onClick={(event) => openInspector(product.id, event.currentTarget)}>Inspecionar</Button>
          </article>
        })}
      </div>
    )}

    <nav className="esmera-products-pagination" aria-label="Paginação de produtos">
      <Link className={`esmera-button${filters.page <= 1 ? ' is-disabled' : ''}`} aria-disabled={filters.page <= 1} tabIndex={filters.page <= 1 ? -1 : undefined} href={listHref(filters, { page: Math.max(1, filters.page - 1) })}>Anterior</Link>
      <span>Página {filters.page} de {Math.max(1, totalPages)}</span>
      <Link className={`esmera-button${filters.page >= totalPages ? ' is-disabled' : ''}`} aria-disabled={filters.page >= totalPages} tabIndex={filters.page >= totalPages ? -1 : undefined} href={listHref(filters, { page: Math.min(Math.max(1, totalPages), filters.page + 1) })}>Próxima</Link>
    </nav>

    {selectedIds.length ? (
      <BulkActionBar count={selectedIds.length}>
        <Button disabled={busy} onClick={() => void publishSelected()} tone="primary">Publicar</Button>
        <Button disabled={busy} onClick={() => void mutate('unpublish')}>Despublicar</Button>
        <Button disabled={busy} onClick={() => void mutate('archive')}>Arquivar</Button>
        <Button disabled={busy} onClick={() => void mutate('restore')}>Restaurar</Button>
        <label className="esmera-products-bulk-category"><span>Categoria</span><select className="esmera-input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Escolher…</option>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.title || category.slug || category.id}</option>)}</select></label>
        <Button disabled={busy || !categoryId} onClick={() => void mutate('add-category')}>Adicionar categoria</Button>
        <label className="esmera-products-bulk-category"><span>Disponibilidade</span><select className="esmera-input" value={bulkAvailability} onChange={(event) => setBulkAvailability(event.target.value)}><option value="">Escolher…</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <Button disabled={busy || !bulkAvailability} onClick={() => void mutate('set-availability')}>Aplicar disponibilidade</Button>
      </BulkActionBar>
    ) : null}
  </>

  return (
    <SplitWorkspace
      className="esmera-products-workspace"
      master={master}
      hasDetail={Boolean(selectedProduct)}
      detail={selectedProduct ? (
        <ContextInspector
          className="esmera-product-context-inspector"
          label={`Preview de ${selectedProduct.title || 'produto'}`}
          header={<div className="esmera-product-context-inspector__header"><div><span className="esmera-eyebrow">Preview</span><h2>{selectedProduct.title || 'Produto sem título'}</h2><p>{selectedProduct.code || 'Sem código'}</p></div><button className="esmera-icon-button" type="button" onClick={closeInspector} aria-label="Fechar preview">×</button></div>}
          footer={<div className="esmera-actions"><Link className="esmera-button esmera-button--primary" href={productHref(filters, selectedProduct.id)}>Abrir produto</Link><Link className="esmera-button" href={`/admin/collections/products/${selectedProduct.id}`}>Admin técnico</Link></div>}
        >
          <InspectorContent product={selectedProduct} filters={filters} />
        </ContextInspector>
      ) : undefined}
    />
  )
}
