/* eslint-disable react-hooks/incompatible-library -- TanStack Table exposes stateful helpers that React Compiler intentionally does not memoize. */
'use client'

import { Dialog } from '@base-ui/react/dialog'
import { DragDropProvider, useDroppable } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
  openOpportunityStages,
  opportunityLossReasonLabels,
  opportunityLossReasons,
  opportunityStageLabels,
  opportunityStages,
  type OpportunityLossReason,
  type OpportunityStage,
} from '../../../businessRules/opportunities/stages'
import {
  Button,
  ComboboxPrimitive,
  comboboxClasses,
  DataSection,
  DataTable,
  DialogPanel,
  DrawerPanel,
  EmptyState,
  Field,
  FilterPanel,
  InlineFeedback,
  Status,
} from '../../design-system'
import type {
  ActivityRecord,
  CustomerRef,
  OpportunityRecord,
  ProductRef,
  SalesTransaction,
  SalesWorkspaceFilters,
  UserRef,
} from './types'
import {
  priorityLabels,
  relationId,
  relationLabel,
  saleStatusLabels,
  sourceLabels,
} from './types'

type Props = {
  opportunities: OpportunityRecord[]
  activities: ActivityRecord[]
  products: ProductRef[]
  users: UserRef[]
  transactions: SalesTransaction[]
  filters: SalesWorkspaceFilters
  totalDocs: number
  totalPages: number
}

type StageMove = {
  id: string | number
  fromStage: OpportunityStage
  toStage: OpportunityStage
  fromIndex: number
  toIndex: number
  sourceOrderedIds: Array<string | number>
  targetOrderedIds: Array<string | number>
  next: OpportunityRecord[]
}

type CloseInput =
  | { action: 'lose'; id: string | number; lossReason: OpportunityLossReason; lossNotes?: string }
  | {
      action: 'win'
      id: string | number
      channel: string
      items: Array<{ product: string | number; variantSku?: string | null; unitPriceCents?: number | null; quantity: number }>
      discountCents: number
      shippingCents: number
      expectedDeliveryAt?: string | null
      deliveryMode?: string | null
      deliveryNotes?: string | null
    }

const openStageSet = new Set<string>(openOpportunityStages)

function money(cents: number | null | undefined) {
  if (typeof cents !== 'number') return 'Não informado'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function shortDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: 'short', year: 'numeric' })
}

function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function stageTone(stage?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (stage === 'won') return 'success'
  if (stage === 'lost') return 'danger'
  if (stage === 'proposal' || stage === 'negotiation') return 'warning'
  if (stage === 'curation') return 'info'
  return 'neutral'
}

function customerName(opportunity: OpportunityRecord) {
  return relationLabel(opportunity.customer, 'Cliente ainda não vinculado')
}

function productObject(value: OpportunityRecord['interestedProducts'][number] | undefined, products: ProductRef[]) {
  const id = relationId(value)
  if (value && typeof value === 'object') return value
  return products.find((product) => String(product.id) === String(id))
}

function grouped(records: OpportunityRecord[]) {
  return openOpportunityStages.reduce<Record<OpportunityStage, OpportunityRecord[]>>((acc, stage) => {
    acc[stage] = records
      .filter((record) => record.stage === stage)
      .sort((left, right) => (left.rank || 0) - (right.rank || 0))
    return acc
  }, { new: [], curation: [], proposal: [], negotiation: [], won: [], lost: [] })
}

function applyMove(records: OpportunityRecord[], move: Omit<StageMove, 'next' | 'sourceOrderedIds' | 'targetOrderedIds'>) {
  const byStage = grouped(records)
  const source = [...byStage[move.fromStage]]
  const [record] = source.splice(move.fromIndex, 1)
  if (!record) return { next: records, sourceOrderedIds: [], targetOrderedIds: [] }

  if (move.fromStage === move.toStage) {
    source.splice(move.toIndex, 0, record)
    const rankById = new Map(source.map((item, index) => [String(item.id), (index + 1) * 10_000]))
    return {
      next: records.map((item) => item.stage === move.fromStage ? { ...item, rank: rankById.get(String(item.id)) || item.rank } : item),
      sourceOrderedIds: source.map((item) => item.id),
      targetOrderedIds: source.map((item) => item.id),
    }
  }

  const target = [...byStage[move.toStage]]
  target.splice(Math.max(0, Math.min(move.toIndex, target.length)), 0, { ...record, stage: move.toStage })
  const sourceRanks = new Map(source.map((item, index) => [String(item.id), (index + 1) * 10_000]))
  const targetRanks = new Map(target.map((item, index) => [String(item.id), (index + 1) * 10_000]))
  return {
    next: records.map((item) => {
      if (String(item.id) === String(record.id)) return { ...item, stage: move.toStage, rank: targetRanks.get(String(item.id)) }
      if (item.stage === move.fromStage) return { ...item, rank: sourceRanks.get(String(item.id)) || item.rank }
      if (item.stage === move.toStage) return { ...item, rank: targetRanks.get(String(item.id)) || item.rank }
      return item
    }),
    sourceOrderedIds: source.map((item) => item.id),
    targetOrderedIds: target.map((item) => item.id),
  }
}

async function postSales(body: Record<string, unknown>) {
  const response = await fetch('/api/admin-sales', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as Record<string, unknown> & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a operação comercial.')
  return result
}

function filterHref(filters: SalesWorkspaceFilters, patch: Partial<SalesWorkspaceFilters>) {
  const next = { ...filters, ...patch }
  const params = new URLSearchParams()
  params.set('view', next.view)
  if (next.q) params.set('q', next.q)
  if (next.owner) params.set('owner', next.owner)
  if (next.source) params.set('source', next.source)
  if (next.stage) params.set('stage', next.stage)
  if (next.period !== 'all') params.set('period', next.period)
  if (next.page > 1) params.set('page', String(next.page))
  if (next.limit !== 50) params.set('limit', String(next.limit))
  if (next.sort) params.set('sort', next.sort)
  return `/admin/sales?${params.toString()}`
}

function InspectorContent({ opportunity, activities }: { opportunity: OpportunityRecord; activities: ActivityRecord[] }) {
  const timeline = activities
    .filter((activity) => String(relationId(activity.opportunity)) === String(opportunity.id))
    .sort((left, right) => new Date(right.occurredAt || 0).getTime() - new Date(left.occurredAt || 0).getTime())
  const sale = opportunity.wonSale && typeof opportunity.wonSale === 'object' ? opportunity.wonSale : null

  return <div className="esmera-sales-inspector">
    <dl className="esmera-sales-inspector__facts">
      <div><dt>Cliente</dt><dd>{customerName(opportunity)}</dd></div>
      <div><dt>Etapa</dt><dd>{opportunityStageLabels[(opportunity.stage || 'new') as OpportunityStage] || opportunity.stage}</dd></div>
      <div><dt>Valor potencial</dt><dd>{money(opportunity.estimatedValueCents)}</dd></div>
      <div><dt>Responsável</dt><dd>{relationLabel(opportunity.owner, 'Não definido')}</dd></div>
      <div><dt>Origem</dt><dd>{sourceLabels[opportunity.source || ''] || 'Não informada'}</dd></div>
      <div><dt>Previsão</dt><dd>{shortDate(opportunity.expectedCloseAt)}</dd></div>
    </dl>

    <section>
      <span className="esmera-eyebrow">Próxima ação</span>
      <h3>{opportunity.nextAction || 'Nenhuma próxima ação registrada'}</h3>
      <p>{opportunity.nextActionAt ? dateTime(opportunity.nextActionAt) : 'Sem prazo definido.'}</p>
    </section>

    <section>
      <span className="esmera-eyebrow">Produtos de interesse</span>
      {!opportunity.interestedProducts?.length ? <p>Nenhum produto relacionado.</p> : <ul className="esmera-sales-product-list">{opportunity.interestedProducts.map((product) => {
        const item = product && typeof product === 'object' ? product : null
        return <li key={String(relationId(product))}><strong>{item?.title || item?.code || relationId(product)}</strong><small>{item?.priceMode === 'fixed' ? money(item.basePriceCents) : 'Sob consulta'}</small></li>
      })}</ul>}
    </section>

    {sale ? <section className="esmera-sales-generated-sale"><span className="esmera-eyebrow">Venda gerada</span><h3>{sale.number || sale.id}</h3><p>{money(sale.totalCents)} · {saleStatusLabels[sale.status || ''] || sale.status}</p><Link className="esmera-button" href={`/admin/collections/sales/${sale.id}`}>Abrir venda</Link></section> : null}

    <section>
      <span className="esmera-eyebrow">Timeline operacional</span>
      {!timeline.length ? <p>Nenhuma atividade registrada.</p> : <ol className="esmera-sales-timeline">{timeline.map((activity) => <li key={String(activity.id)}><strong>{activity.summary || activity.eventType || 'Atividade'}</strong>{activity.details ? <p>{activity.details}</p> : null}<small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'Sistema')}</small></li>)}</ol>}
    </section>

    <div className="esmera-actions"><Link className="esmera-button esmera-button--primary" href={`/admin/collections/opportunities/${opportunity.id}`}>Editar oportunidade</Link></div>
  </div>
}

function DialogFrame({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <Dialog.Portal>
    <Dialog.Backdrop className="esmera-overlay-backdrop" />
    <Dialog.Viewport className="esmera-dialog-viewport">
      <Dialog.Popup className="esmera-dialog esmera-sales-close-dialog">
        <div className="esmera-overlay-header"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close className="esmera-icon-button" aria-label="Fechar" onClick={onClose}>×</Dialog.Close></div>
        <div className="esmera-overlay-body">{children}</div>
      </Dialog.Popup>
    </Dialog.Viewport>
  </Dialog.Portal>
}

function LossDialog({ opportunity, open, busy, onOpenChange, onSubmit }: {
  opportunity: OpportunityRecord
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CloseInput) => Promise<void>
}) {
  const [reason, setReason] = useState<OpportunityLossReason>('price')
  const [notes, setNotes] = useState('')
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <DialogFrame title="Marcar como perdido" description={`${opportunity.code || opportunity.id} · ${customerName(opportunity)}`} onClose={() => onOpenChange(false)}>
      <form className="esmera-sales-close-form" onSubmit={(event) => { event.preventDefault(); void onSubmit({ action: 'lose', id: opportunity.id, lossReason: reason, lossNotes: notes }) }}>
        <label><span>Motivo da perda</span><select className="esmera-input" value={reason} onChange={(event) => setReason(event.target.value as OpportunityLossReason)}>{opportunityLossReasons.map((value) => <option key={value} value={value}>{opportunityLossReasonLabels[value]}</option>)}</select></label>
        <label><span>Contexto</span><textarea className="esmera-input" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Registre somente o contexto comercial verificável." /></label>
        <div className="esmera-actions"><Dialog.Close className="esmera-button" type="button">Cancelar</Dialog.Close><Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Confirmar perda'}</Button></div>
      </form>
    </DialogFrame>
  </Dialog.Root>
}

type SaleItemDraft = { key: string; product: string; variantSku: string; unitPrice: string; quantity: number }

function defaultSaleItems(opportunity: OpportunityRecord, products: ProductRef[]): SaleItemDraft[] {
  const related = (opportunity.interestedProducts || [])
    .map((value) => productObject(value, products))
    .filter((value): value is ProductRef => Boolean(value))
  const source = related.length ? related : products.slice(0, 1)
  return source.map((product) => ({ key: `${product.id}-${crypto.randomUUID()}`, product: String(product.id), variantSku: '', unitPrice: '', quantity: 1 }))
}

function WinDialog({ opportunity, products, open, busy, onOpenChange, onSubmit }: {
  opportunity: OpportunityRecord
  products: ProductRef[]
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CloseInput) => Promise<void>
}) {
  const [channel, setChannel] = useState(opportunity.source === 'instagram' ? 'instagram' : 'whatsapp')
  const [items, setItems] = useState<SaleItemDraft[]>(() => defaultSaleItems(opportunity, products))
  const [discount, setDiscount] = useState('0')
  const [shipping, setShipping] = useState('0')
  const [deliveryAt, setDeliveryAt] = useState('')
  const [deliveryMode, setDeliveryMode] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  function updateItem(key: string, patch: Partial<SaleItemDraft>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item))
  }

  const estimatedSubtotal = items.reduce((sum, item) => {
    const product = products.find((candidate) => String(candidate.id) === item.product)
    const variant = product?.variants?.find((candidate) => candidate.sku === item.variantSku)
    const fixed = variant?.priceMode === 'fixed' ? variant.priceCents : product?.priceMode === 'fixed' ? product.basePriceCents : null
    const value = fixed ?? (Number(item.unitPrice) || 0) * 100
    return sum + (value || 0) * item.quantity
  }, 0)

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <DialogFrame title="Confirmar venda ganha" description="A confirmação cria uma Sale transacional com snapshots dos produtos e remove a oportunidade do pipeline aberto." onClose={() => onOpenChange(false)}>
      <form className="esmera-sales-close-form" onSubmit={(event) => {
        event.preventDefault()
        void onSubmit({
          action: 'win',
          id: opportunity.id,
          channel,
          items: items.map((item) => ({ product: item.product, variantSku: item.variantSku || null, unitPriceCents: item.unitPrice ? Math.round(Number(item.unitPrice.replace(',', '.')) * 100) : null, quantity: item.quantity })),
          discountCents: Math.max(0, Math.round(Number(discount.replace(',', '.')) * 100) || 0),
          shippingCents: Math.max(0, Math.round(Number(shipping.replace(',', '.')) * 100) || 0),
          expectedDeliveryAt: deliveryAt ? new Date(deliveryAt).toISOString() : null,
          deliveryMode: deliveryMode || null,
          deliveryNotes,
        })
      }}>
        <div className="esmera-sales-close-grid">
          <label><span>Canal</span><select className="esmera-input" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="site">Site</option><option value="referral">Indicação</option><option value="architect">Arquiteto</option><option value="other">Outro</option></select></label>
          <label><span>Entrega prevista</span><input className="esmera-input" type="datetime-local" value={deliveryAt} onChange={(event) => setDeliveryAt(event.target.value)} /></label>
          <label><span>Forma de entrega</span><select className="esmera-input" value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value)}><option value="">Não definida</option><option value="carrier">Transportadora</option><option value="pickup">Retirada</option><option value="own_delivery">Entrega própria</option></select></label>
        </div>

        <section className="esmera-sales-items-editor">
          <div className="esmera-sales-section-heading"><div><span className="esmera-eyebrow">Itens</span><h3>Produtos, variantes e valores</h3></div><Button type="button" onClick={() => setItems((current) => [...current, { key: crypto.randomUUID(), product: String(products[0]?.id || ''), variantSku: '', unitPrice: '', quantity: 1 }])}>Adicionar item</Button></div>
          {items.map((item, index) => {
            const product = products.find((candidate) => String(candidate.id) === item.product)
            const variant = product?.variants?.find((candidate) => candidate.sku === item.variantSku)
            const priceMode = variant?.priceMode === 'fixed' || variant?.priceMode === 'inquiry' ? variant.priceMode : product?.priceMode
            const fixedPrice = variant?.priceMode === 'fixed' ? variant.priceCents : product?.basePriceCents
            return <div className="esmera-sales-item-row" key={item.key}>
              <span>{index + 1}</span>
              <label><span>Produto</span><select className="esmera-input" required value={item.product} onChange={(event) => updateItem(item.key, { product: event.target.value, variantSku: '', unitPrice: '' })}><option value="">Selecione</option>{products.map((candidate) => <option key={String(candidate.id)} value={String(candidate.id)}>{candidate.title || candidate.code || candidate.id}</option>)}</select></label>
              <label><span>Variante</span><select className="esmera-input" value={item.variantSku} onChange={(event) => updateItem(item.key, { variantSku: event.target.value })}><option value="">Produto base</option>{(product?.variants || []).filter((candidate) => candidate.status !== 'disabled').map((candidate) => <option key={candidate.sku || ''} value={candidate.sku || ''}>{candidate.sku || 'Sem SKU'}</option>)}</select></label>
              <label><span>Valor unitário</span>{priceMode === 'fixed' ? <strong className="esmera-sales-fixed-price">{money(fixedPrice)}</strong> : <input className="esmera-input" inputMode="decimal" required value={item.unitPrice} onChange={(event) => updateItem(item.key, { unitPrice: event.target.value })} placeholder="0,00" />}</label>
              <label><span>Qtd.</span><input className="esmera-input" type="number" min={1} step={1} value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></label>
              <button className="esmera-icon-button" type="button" aria-label={`Remover item ${index + 1}`} disabled={items.length === 1} onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))}>×</button>
            </div>
          })}
        </section>

        <div className="esmera-sales-close-grid">
          <label><span>Desconto (R$)</span><input className="esmera-input" inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
          <label><span>Frete (R$)</span><input className="esmera-input" inputMode="decimal" value={shipping} onChange={(event) => setShipping(event.target.value)} /></label>
          <div className="esmera-sales-total-preview"><span>Prévia</span><strong>{money(Math.max(0, estimatedSubtotal - (Number(discount.replace(',', '.')) || 0) * 100 + (Number(shipping.replace(',', '.')) || 0) * 100))}</strong><small>O servidor recalcula e valida o total.</small></div>
        </div>
        <label><span>Observações da entrega</span><textarea className="esmera-input" rows={3} value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} /></label>
        <div className="esmera-actions"><Dialog.Close className="esmera-button" type="button">Cancelar</Dialog.Close><Button type="submit" disabled={busy || !items.length}>{busy ? 'Criando venda…' : 'Confirmar e criar venda'}</Button></div>
      </form>
    </DialogFrame>
  </Dialog.Root>
}

function OpportunityControls({ opportunity, index, total, onMove, onClose }: {
  opportunity: OpportunityRecord
  index: number
  total: number
  onMove: (toStage: OpportunityStage, toIndex?: number) => void
  onClose: (stage: 'won' | 'lost') => void
}) {
  const current = (opportunity.stage || 'new') as OpportunityStage
  return <div className="esmera-opportunity-controls">
    <label><span className="esmera-sr-only">Mover {opportunity.code} para etapa</span><select className="esmera-input" aria-label={`Mover ${opportunity.code || opportunity.id} para etapa`} value={current} onChange={(event) => { const stage = event.target.value as OpportunityStage; if (stage === 'won' || stage === 'lost') onClose(stage); else onMove(stage) }}>{opportunityStages.map((stage) => <option key={stage} value={stage}>{opportunityStageLabels[stage]}</option>)}</select></label>
    {openStageSet.has(current) ? <label><span className="esmera-sr-only">Mover {opportunity.code} para posição</span><select className="esmera-input" aria-label={`Mover ${opportunity.code || opportunity.id} para posição`} value={index + 1} onChange={(event) => onMove(current, Number(event.target.value) - 1)}>{Array.from({ length: total }, (_, target) => <option key={target + 1} value={target + 1}>{target + 1}</option>)}</select></label> : null}
  </div>
}

function PipelineCard({ opportunity, index, total, activities, products, onMove, onClose, closing }: {
  opportunity: OpportunityRecord
  index: number
  total: number
  activities: ActivityRecord[]
  products: ProductRef[]
  onMove: (opportunity: OpportunityRecord, toStage: OpportunityStage, toIndex?: number) => void
  onClose: (input: CloseInput) => Promise<void>
  closing: boolean
}) {
  const stage = (opportunity.stage || 'new') as OpportunityStage
  const sortable = useSortable({ id: String(opportunity.id), index, group: stage, type: 'opportunity', accept: 'opportunity' })
  const [dialog, setDialog] = useState<'won' | 'lost' | null>(null)

  async function close(input: CloseInput) {
    await onClose(input)
    setDialog(null)
  }

  return <article ref={sortable.ref} className={`esmera-opportunity-card${sortable.isDragging ? ' is-dragging' : ''}`}>
    <div className="esmera-opportunity-card__top">
      <button ref={sortable.handleRef} type="button" className="esmera-opportunity-drag" aria-label={`Arrastar ${opportunity.code || opportunity.id}`}>⋮⋮</button>
      <span>{opportunity.code || 'Sem código'}</span>
      <Status tone={opportunity.priority === 'urgent' ? 'danger' : opportunity.priority === 'high' ? 'warning' : 'neutral'}>{priorityLabels[opportunity.priority || 'normal'] || 'Normal'}</Status>
    </div>
    <a className="esmera-opportunity-card__title" href={`/admin/collections/opportunities/${opportunity.id}`}>{customerName(opportunity)}</a>
    <small>{sourceLabels[opportunity.source || ''] || 'Origem não informada'}</small>
    <strong>{money(opportunity.estimatedValueCents)}</strong>
    <p>{opportunity.nextAction || 'Sem próxima ação'}{opportunity.nextActionAt ? <small> · {dateTime(opportunity.nextActionAt)}</small> : null}</p>
    <div className="esmera-opportunity-card__footer"><span>{relationLabel(opportunity.owner, 'Sem responsável')}</span><DrawerPanel trigger="Inspecionar" title={opportunity.code || 'Oportunidade'} description={customerName(opportunity)}><InspectorContent opportunity={opportunity} activities={activities} /></DrawerPanel></div>
    <OpportunityControls opportunity={opportunity} index={index} total={total} onMove={(toStage, toIndex) => onMove(opportunity, toStage, toIndex)} onClose={setDialog} />
    <WinDialog opportunity={opportunity} products={products} open={dialog === 'won'} busy={closing} onOpenChange={(open) => setDialog(open ? 'won' : null)} onSubmit={close} />
    <LossDialog opportunity={opportunity} open={dialog === 'lost'} busy={closing} onOpenChange={(open) => setDialog(open ? 'lost' : null)} onSubmit={close} />
  </article>
}

function PipelineColumn({ stage, records, activities, products, onMove, onClose, closing }: {
  stage: OpportunityStage
  records: OpportunityRecord[]
  activities: ActivityRecord[]
  products: ProductRef[]
  onMove: (opportunity: OpportunityRecord, toStage: OpportunityStage, toIndex?: number) => void
  onClose: (input: CloseInput) => Promise<void>
  closing: boolean
}) {
  const drop = useDroppable({ id: `stage:${stage}`, type: 'stage', accept: 'opportunity' })
  const potential = records.reduce((sum, record) => sum + (record.estimatedValueCents || 0), 0)
  return <section ref={drop.ref} className={`esmera-pipeline-column${drop.isDropTarget ? ' is-drop-target' : ''}`}>
    <div className="esmera-pipeline-head"><div><span>{opportunityStageLabels[stage]}</span><small>{records.length} oportunidade{records.length === 1 ? '' : 's'}</small></div><strong>{money(potential)}</strong></div>
    <div className="esmera-pipeline-stack">{records.length ? records.map((opportunity, index) => <PipelineCard key={String(opportunity.id)} opportunity={opportunity} index={index} total={records.length} activities={activities} products={products} onMove={onMove} onClose={onClose} closing={closing} />) : <div className="esmera-pipeline-empty">Arraste uma oportunidade ou use o seletor de etapa.</div>}</div>
  </section>
}

function Filters({ filters, users }: { filters: SalesWorkspaceFilters; users: UserRef[] }) {
  return <form method="get" action="/admin/sales">
    <input type="hidden" name="view" value={filters.view} />
    <input type="hidden" name="limit" value={filters.limit} />
    <FilterPanel
      className="esmera-sales-filters"
      primary={<>
        <label className="esmera-sales-search"><span>Buscar</span><input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Código, cliente ou próxima ação" /></label>
        <label><span>Responsável</span><select className="esmera-input" name="owner" defaultValue={filters.owner}><option value="">Todos</option>{users.map((user) => <option key={String(user.id)} value={String(user.id)}>{user.name || user.email || user.id}</option>)}</select></label>
        <label><span>Próxima ação</span><select className="esmera-input" name="period" defaultValue={filters.period}><option value="all">Qualquer data</option><option value="overdue">Atrasadas</option><option value="today">Hoje</option><option value="7d">Próximos 7 dias</option><option value="30d">Próximos 30 dias</option></select></label>
      </>}
      advancedLabel="Origem e etapa"
      advancedActive={Boolean(filters.source || filters.stage)}
      advanced={<div className="esmera-sales-advanced-filters">
        <label><span>Origem</span><select className="esmera-input" name="source" defaultValue={filters.source}><option value="">Todas</option>{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Etapa</span><select className="esmera-input" name="stage" defaultValue={filters.stage}><option value="">Todas</option>{opportunityStages.map((stage) => <option key={stage} value={stage}>{opportunityStageLabels[stage]}</option>)}</select></label>
        <Button type="submit">Aplicar recorte</Button>
      </div>}
      actions={<><Button type="submit" tone="primary">Aplicar</Button><Link className="esmera-button esmera-button--quiet" href={`/admin/sales?view=${filters.view}`}>Limpar</Link></>}
    />
  </form>
}

function Transactions({ transactions }: { transactions: SalesTransaction[] }) {
  return <DataSection className="esmera-sales-transactions" eyebrow="Fulfillment" title="Vendas confirmadas recentes" description="Sales transacionais criadas a partir de oportunidades ganhas." action={<Link href="/admin/collections/sales">Ver Admin técnico</Link>}>{transactions.length ? <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Venda</th><th>Cliente</th><th>Status</th><th>Total</th><th>Confirmada</th><th /></tr></thead><tbody>{transactions.map((sale) => <tr key={String(sale.id)}><td><strong>{sale.number || sale.id}</strong></td><td>{relationLabel(sale.customer, '—')}</td><td><Status tone={sale.status === 'delivered' ? 'success' : 'info'}>{saleStatusLabels[sale.status || ''] || sale.status}</Status></td><td><span className="esmera-nums">{money(sale.totalCents)}</span></td><td>{shortDate(sale.confirmedAt || sale.updatedAt)}</td><td><Link href={`/admin/collections/sales/${sale.id}`}>Abrir</Link></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhuma venda confirmada" copy="Quando uma oportunidade for ganha, a Sale criada aparecerá aqui." />}</DataSection>
}

function WorkspaceInner(props: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const queryKey = ['sales', { view: props.filters.view, owner: props.filters.owner, stage: props.filters.stage, source: props.filters.source, q: props.filters.q, page: props.filters.page }]
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selection, setSelection] = useState<RowSelectionState>({})
  const [visibility, setVisibility] = useState<VisibilityState>({})
  const initialSort = props.filters.sort ? props.filters.sort.split(':') : ['updatedAt', 'desc']
  const [sorting, setSorting] = useState<SortingState>([{ id: initialSort[0], desc: initialSort[1] !== 'asc' }])

  const { data: opportunities = [] } = useQuery({ queryKey, queryFn: async () => props.opportunities, initialData: props.opportunities, staleTime: Infinity })

  const moveMutation = useMutation({
    mutationFn: async (move: StageMove) => await postSales({ action: 'move-stage', id: move.id, stage: move.toStage, sourceStage: move.fromStage, sourceOrderedIds: move.sourceOrderedIds, targetOrderedIds: move.targetOrderedIds }),
    onMutate: async (move) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<OpportunityRecord[]>(queryKey) || []
      queryClient.setQueryData(queryKey, move.next)
      setFeedback('Salvando etapa e ordem…')
      return { previous }
    },
    onError: (error, _move, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      setFeedback(error instanceof Error ? error.message : 'A alteração foi revertida.')
    },
    onSuccess: () => { setFeedback('Etapa e ordem salvas.'); router.refresh() },
  })

  const closeMutation = useMutation({
    mutationFn: async (input: CloseInput) => await postSales(input as unknown as Record<string, unknown>),
    onSuccess: (result, input) => {
      const returned = result.opportunity as OpportunityRecord | undefined
      queryClient.setQueryData<OpportunityRecord[]>(queryKey, (current = []) => props.filters.view === 'pipeline'
        ? current.filter((record) => String(record.id) !== String(input.id))
        : current.map((record) => String(record.id) === String(input.id) ? { ...record, ...(returned || {}), stage: input.action === 'win' ? 'won' : 'lost' } : record))
      const sale = result.sale as { number?: string } | undefined
      setFeedback(input.action === 'win' ? `Venda ${sale?.number || ''} criada e oportunidade encerrada.` : 'Oportunidade marcada como perdida.')
      router.refresh()
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : 'O fechamento não foi confirmado.'),
  })

  function moveRecord(opportunity: OpportunityRecord, toStage: OpportunityStage, toIndex?: number) {
    const fromStage = opportunity.stage as OpportunityStage
    if (!openStageSet.has(fromStage) || !openStageSet.has(toStage)) return
    const groups = grouped(opportunities)
    const fromIndex = groups[fromStage].findIndex((record) => String(record.id) === String(opportunity.id))
    const targetIndex = toIndex ?? groups[toStage].length
    const moved = applyMove(opportunities, { id: opportunity.id, fromStage, toStage, fromIndex, toIndex: targetIndex })
    moveMutation.mutate({ id: opportunity.id, fromStage, toStage, fromIndex, toIndex: targetIndex, ...moved })
  }

  async function closeRecord(input: CloseInput) {
    setFeedback(null)
    await closeMutation.mutateAsync(input)
  }

  const columns = useMemo<ColumnDef<OpportunityRecord>[]>(() => [
    { id: 'select', header: ({ table }) => <input aria-label="Selecionar página" type="checkbox" checked={table.getIsAllPageRowsSelected()} onChange={table.getToggleAllPageRowsSelectedHandler()} />, cell: ({ row }) => <input aria-label={`Selecionar ${row.original.code || row.original.id}`} type="checkbox" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} /> },
    { accessorKey: 'code', header: 'Oportunidade', cell: ({ row }) => <div className="esmera-sales-table-title"><strong>{row.original.code || row.original.id}</strong><small>{sourceLabels[row.original.source || ''] || 'Origem não informada'}</small></div> },
    { id: 'customer', header: 'Cliente', cell: ({ row }) => customerName(row.original) },
    { accessorKey: 'stage', header: 'Etapa', cell: ({ row }) => <Status tone={stageTone(row.original.stage)}>{opportunityStageLabels[(row.original.stage || 'new') as OpportunityStage] || row.original.stage}</Status> },
    { accessorKey: 'estimatedValueCents', header: 'Valor', cell: ({ row }) => <span className="esmera-nums">{money(row.original.estimatedValueCents)}</span> },
    { id: 'owner', header: 'Responsável', cell: ({ row }) => relationLabel(row.original.owner, 'Não definido') },
    { accessorKey: 'nextActionAt', header: 'Próxima ação', cell: ({ row }) => <div className="esmera-sales-table-title"><strong>{row.original.nextAction || 'Sem ação'}</strong><small>{dateTime(row.original.nextActionAt)}</small></div> },
    { accessorKey: 'updatedAt', header: 'Atualizado', cell: ({ row }) => shortDate(row.original.updatedAt) },
    { id: 'actions', header: '', enableHiding: false, cell: ({ row }) => <div className="esmera-sales-row-actions"><DrawerPanel trigger="Inspecionar" title={row.original.code || 'Oportunidade'} description={customerName(row.original)}><InspectorContent opportunity={row.original} activities={props.activities} /></DrawerPanel><Link className="esmera-button esmera-button--quiet" href={`/admin/collections/opportunities/${row.original.id}`}>Editar</Link></div> },
  ], [props.activities])

  const table = useReactTable({ data: opportunities, columns, state: { sorting, rowSelection: selection, columnVisibility: visibility }, onSortingChange: setSorting, onRowSelectionChange: setSelection, onColumnVisibilityChange: setVisibility, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getRowId: (row) => String(row.id), enableRowSelection: true })
  const selected = table.getSelectedRowModel().rows.map((row) => row.original.id)

  async function bulkMove(stage: OpportunityStage) {
    if (!selected.length) return
    try {
      setFeedback('Atualizando seleção…')
      await postSales({ action: 'bulk-stage', ids: selected, stage })
      setSelection({})
      setFeedback(`${selected.length} oportunidade(s) movidas para ${opportunityStageLabels[stage]}.`)
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível mover a seleção.')
    }
  }

  const groups = grouped(opportunities)

  return <>
    <Filters filters={props.filters} users={props.users} />
    {feedback ? <InlineFeedback className="esmera-sales-feedback" busy={moveMutation.isPending || closeMutation.isPending} tone={feedback.includes('não') || feedback.includes('revertida') ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}

    {props.filters.view === 'pipeline' ? <>
      <DragDropProvider onDragEnd={(event) => {
        if (event.canceled) return
        const { source, target } = event.operation
        if (!isSortable(source)) return
        const fromStage = source.initialGroup as OpportunityStage
        let toStage = source.group as OpportunityStage
        if (target?.id && String(target.id).startsWith('stage:')) toStage = String(target.id).slice(6) as OpportunityStage
        if (!openStageSet.has(fromStage) || !openStageSet.has(toStage)) return
        const opportunity = opportunities.find((record) => String(record.id) === String(source.id))
        if (!opportunity) return
        const targetIndex = target?.id && String(target.id).startsWith('stage:') ? groups[toStage].length : source.index
        moveRecord(opportunity, toStage, targetIndex)
      }}>
        <div className="esmera-pipeline" aria-label="Pipeline de oportunidades">{openOpportunityStages.map((stage) => <PipelineColumn key={stage} stage={stage} records={groups[stage]} activities={props.activities} products={props.products} onMove={moveRecord} onClose={closeRecord} closing={closeMutation.isPending} />)}</div>
      </DragDropProvider>
      <div className="esmera-kpi-meta">Fonte comercial: Opportunities. Arraste entre etapas abertas; Ganho e Perdido exigem confirmação no servidor. Todos os cards possuem alternativa por teclado.</div>
    </> : <>
      <div className="esmera-sales-list-toolbar"><div><strong>{props.totalDocs}</strong> oportunidade{props.totalDocs === 1 ? '' : 's'}</div><div className="esmera-actions"><details className="esmera-sales-columns"><summary className="esmera-button">Colunas</summary><div>{table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => <label key={column.id}><input type="checkbox" checked={column.getIsVisible()} onChange={column.getToggleVisibilityHandler()} /> {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}</label>)}</div></details><label><span className="esmera-sr-only">Itens por página</span><select className="esmera-input" value={props.filters.limit} onChange={(event) => router.push(filterHref(props.filters, { limit: Number(event.target.value) as 25 | 50 | 100, page: 1 }))}><option value="25">25 por página</option><option value="50">50 por página</option><option value="100">100 por página</option></select></label></div></div>
      <div className="esmera-sales-list-body">
        {selected.length ? <div className="esmera-bulk-bar"><strong>{selected.length} selecionada{selected.length === 1 ? '' : 's'}</strong><div className="esmera-actions"><span>Mover para:</span>{openOpportunityStages.map((stage) => <Button type="button" key={stage} onClick={() => void bulkMove(stage)}>{opportunityStageLabels[stage]}</Button>)}</div></div> : null}
        {!opportunities.length ? <EmptyState title="Nenhuma oportunidade encontrada" copy="Ajuste os filtros ou crie uma nova oportunidade comercial." /> : <DataTable label="Oportunidades comerciais"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : <button className="esmera-table-sort" type="button" disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}</button>}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></DataTable>}
      </div>
      {props.totalPages > 1 ? <nav className="esmera-pagination" aria-label="Paginação de oportunidades"><Link className="esmera-button" aria-disabled={props.filters.page <= 1} href={filterHref(props.filters, { page: Math.max(1, props.filters.page - 1) })}>Anterior</Link><span>Página {props.filters.page} de {props.totalPages}</span><Link className="esmera-button" aria-disabled={props.filters.page >= props.totalPages} href={filterHref(props.filters, { page: Math.min(props.totalPages, props.filters.page + 1) })}>Próxima</Link></nav> : null}
      <Transactions transactions={props.transactions} />
    </>}
  </>
}


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

export function SalesWorkspaceClient(props: Props) {
  return <WorkspaceInner {...props} />
}
