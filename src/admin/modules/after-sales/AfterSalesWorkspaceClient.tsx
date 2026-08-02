'use client'

import { Dialog } from '@base-ui/react/dialog'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import {
  afterSalesStatuses,
  afterSalesStatusLabels,
  occurrenceSeverities,
  occurrenceSeverityLabels,
  occurrenceStatusLabels,
  occurrenceTypeLabels,
  occurrenceTypes,
  operationalPriorities,
  operationalPriorityLabels,
  shipmentProgressStatuses,
  shipmentStatuses,
  shipmentStatusLabels,
  taskStatuses,
  taskStatusLabels,
  taskTypeLabels,
  taskTypes,
  type AfterSalesStatus,
  type OccurrenceSeverity,
  type OccurrenceStatus,
  type OccurrenceType,
  type OperationalPriority,
  type ShipmentStatus,
  type TaskStatus,
  type TaskType,
} from '../../../businessRules/afterSales/model'
import {
  Button,
  DataTable,
  EmptyState,
  Inspector,
  Status,
} from '../../design-system'
import type {
  ActivityRecord,
  AfterSalesCase,
  AfterSalesFilters,
  OccurrenceRecord,
  ShipmentRecord,
  TaskRecord,
  UserRef,
} from './types'

type Props = {
  cases: AfterSalesCase[]
  tasks: TaskRecord[]
  shipments: ShipmentRecord[]
  occurrences: OccurrenceRecord[]
  activities: ActivityRecord[]
  users: UserRef[]
  filters: AfterSalesFilters
}

type QueueKind = 'task' | 'occurrence' | 'shipment'

type QueueRow = {
  key: string
  id: string | number
  kind: QueueKind
  caseId: string | number | null
  dueAt: string | null
  priority: string
  ownerId: string | number | null
  ownerLabel: string
  customer: string
  caseNumber: string
  title: string
  subtitle: string
  status: string
  type: string
}

function relationId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (!value || typeof value !== 'object') return null
  const item = value as { id?: unknown; value?: unknown }
  if (typeof item.id === 'string' || typeof item.id === 'number') return item.id
  return relationId(item.value)
}

function relationLabel(value: unknown, fallback = '—') {
  if (!value || typeof value !== 'object') return fallback
  const item = value as { name?: string | null; email?: string | null; number?: string | null; caseNumber?: string | null }
  return item.name || item.number || item.caseNumber || item.email || fallback
}

function polyId(values: TaskRecord['relatedTo'] | ActivityRecord['relatedTo'], relationTo: string) {
  const match = values?.find((item) => item?.relationTo === relationTo)
  return relationId(match?.value)
}

function dateTime(value?: string | null) {
  if (!value) return 'Sem prazo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem prazo'
  return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function shortDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function money(cents?: number | null) {
  if (typeof cents !== 'number') return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dayKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function openTask(task: TaskRecord) {
  return task.status === 'pending' || task.status === 'in_progress'
}

function openOccurrence(occurrence: OccurrenceRecord) {
  return occurrence.status !== 'resolved' && occurrence.status !== 'closed'
}

function activeShipment(shipment: ShipmentRecord) {
  return shipment.status !== 'delivered' && shipment.status !== 'cancelled'
}

function priorityTone(value: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (value === 'urgent' || value === 'critical') return 'danger'
  if (value === 'high') return 'warning'
  if (value === 'medium') return 'info'
  return 'neutral'
}

function statusTone(kind: QueueKind, status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['done', 'delivered', 'resolved', 'closed'].includes(status)) return 'success'
  if (['cancelled', 'exception'].includes(status)) return 'danger'
  if (kind === 'occurrence') return 'warning'
  if (status === 'in_progress' || status === 'in_transit' || status === 'out_for_delivery') return 'info'
  return 'neutral'
}

async function postAfterSales(body: Record<string, unknown>) {
  const response = await fetch('/api/admin-after-sales', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as Record<string, unknown> & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o pós-venda.')
  return result
}

function filterHref(filters: AfterSalesFilters, focus: AfterSalesFilters['focus']) {
  const params = new URLSearchParams()
  params.set('focus', focus)
  if (filters.q) params.set('q', filters.q)
  if (filters.owner) params.set('owner', filters.owner)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.type) params.set('type', filters.type)
  if (filters.status && filters.status !== 'open') params.set('status', filters.status)
  return `/admin/after-sales?${params.toString()}`
}

function FollowUpDialog({ cases, users, selectedCaseId, busy, onCreate }: {
  cases: AfterSalesCase[]
  users: UserRef[]
  selectedCaseId: string | number | null
  busy: boolean
  onCreate: (body: Record<string, unknown>) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [caseId, setCaseId] = useState(String(selectedCaseId || cases[0]?.id || ''))
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('satisfaction')
  const [dueAt, setDueAt] = useState('')
  const [priority, setPriority] = useState<OperationalPriority>('normal')
  const [assignee, setAssignee] = useState('')
  const [notes, setNotes] = useState('')

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger className="esmera-button esmera-button--primary">Novo follow-up</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="esmera-overlay-backdrop" />
      <Dialog.Viewport className="esmera-dialog-viewport">
        <Dialog.Popup className="esmera-dialog esmera-after-sales-dialog">
          <div className="esmera-overlay-header"><div><Dialog.Title>Novo follow-up</Dialog.Title><Dialog.Description>Cria uma Task consultável e vinculada ao caso, à venda e ao cliente.</Dialog.Description></div><Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close></div>
          <form className="esmera-overlay-body esmera-after-sales-form" onSubmit={(event) => {
            event.preventDefault()
            void onCreate({ action: 'create-task', caseId, title, type, dueAt, priority, assignee: assignee || null, notes }).then(() => {
              setOpen(false)
              setTitle('')
              setDueAt('')
              setNotes('')
            })
          }}>
            <label><span>Caso</span><select className="esmera-input" required value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Selecione</option>{cases.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.caseNumber || item.id} · {relationLabel(item.customer, 'Cliente')}</option>)}</select></label>
            <label><span>Objetivo</span><input className="esmera-input" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: confirmar recebimento da peça" /></label>
            <div className="esmera-after-sales-form__grid">
              <label><span>Tipo</span><select className="esmera-input" value={type} onChange={(event) => setType(event.target.value as TaskType)}>{taskTypes.map((value) => <option key={value} value={value}>{taskTypeLabels[value]}</option>)}</select></label>
              <label><span>Prazo</span><input className="esmera-input" required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
              <label><span>Prioridade</span><select className="esmera-input" value={priority} onChange={(event) => setPriority(event.target.value as OperationalPriority)}>{operationalPriorities.map((value) => <option key={value} value={value}>{operationalPriorityLabels[value]}</option>)}</select></label>
              <label><span>Responsável</span><select className="esmera-input" value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Responsável do caso</option>{users.map((user) => <option key={String(user.id)} value={String(user.id)}>{user.name || user.email || user.id}</option>)}</select></label>
            </div>
            <label><span>Observações</span><textarea className="esmera-input" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            <div className="esmera-actions"><Dialog.Close className="esmera-button" type="button">Cancelar</Dialog.Close><Button type="submit" disabled={busy || !cases.length}>{busy ? 'Criando…' : 'Criar follow-up'}</Button></div>
          </form>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}

function ShipmentCreator({ caseId, busy, onCreate }: { caseId: string | number; busy: boolean; onCreate: (body: Record<string, unknown>) => Promise<void> }) {
  const [carrier, setCarrier] = useState('')
  const [trackingCode, setTrackingCode] = useState('')
  const [estimatedDelivery, setEstimatedDelivery] = useState('')
  const [lastEvent, setLastEvent] = useState('')
  return <details className="esmera-after-sales-compose"><summary>Adicionar entrega</summary><form onSubmit={(event) => {
    event.preventDefault()
    void onCreate({ action: 'create-shipment', caseId, carrier, trackingCode, status: 'confirmed', estimatedDelivery: estimatedDelivery || null, lastEvent }).then(() => {
      setCarrier(''); setTrackingCode(''); setEstimatedDelivery(''); setLastEvent('')
    })
  }}>
    <label><span>Transportadora</span><input className="esmera-input" value={carrier} onChange={(event) => setCarrier(event.target.value)} /></label>
    <label><span>Rastreio</span><input className="esmera-input" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} /></label>
    <label><span>Previsão</span><input className="esmera-input" type="datetime-local" value={estimatedDelivery} onChange={(event) => setEstimatedDelivery(event.target.value)} /></label>
    <label><span>Evento real</span><textarea className="esmera-input" rows={2} value={lastEvent} onChange={(event) => setLastEvent(event.target.value)} /></label>
    <Button type="submit" disabled={busy}>{busy ? 'Criando…' : 'Criar entrega'}</Button>
  </form></details>
}

function OccurrenceCreator({ caseId, busy, onCreate }: { caseId: string | number; busy: boolean; onCreate: (body: Record<string, unknown>) => Promise<void> }) {
  const [type, setType] = useState<OccurrenceType>('damage')
  const [severity, setSeverity] = useState<OccurrenceSeverity>('medium')
  const [description, setDescription] = useState('')
  return <details className="esmera-after-sales-compose"><summary>Abrir ocorrência</summary><form onSubmit={(event) => {
    event.preventDefault()
    void onCreate({ action: 'create-occurrence', caseId, type, severity, description }).then(() => setDescription(''))
  }}>
    <label><span>Tipo</span><select className="esmera-input" value={type} onChange={(event) => setType(event.target.value as OccurrenceType)}>{occurrenceTypes.map((value) => <option key={value} value={value}>{occurrenceTypeLabels[value]}</option>)}</select></label>
    <label><span>Severidade</span><select className="esmera-input" value={severity} onChange={(event) => setSeverity(event.target.value as OccurrenceSeverity)}>{occurrenceSeverities.map((value) => <option key={value} value={value}>{occurrenceSeverityLabels[value]}</option>)}</select></label>
    <label><span>Descrição</span><textarea className="esmera-input" required rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <Button type="submit" disabled={busy}>{busy ? 'Abrindo…' : 'Abrir ocorrência'}</Button>
  </form></details>
}

function CaseInspector({ afterSalesCase, tasks, shipments, occurrences, activities, busy, onOperate, onClose }: {
  afterSalesCase: AfterSalesCase
  tasks: TaskRecord[]
  shipments: ShipmentRecord[]
  occurrences: OccurrenceRecord[]
  activities: ActivityRecord[]
  busy: boolean
  onOperate: (body: Record<string, unknown>) => Promise<void>
  onClose: () => void
}) {
  const [caseStatus, setCaseStatus] = useState<AfterSalesStatus>(afterSalesCase.status || 'open')
  const [casePriority, setCasePriority] = useState<OperationalPriority>(afterSalesCase.priority || 'normal')
  const caseTasks = tasks.filter((task) => String(polyId(task.relatedTo, 'after-sales')) === String(afterSalesCase.id)).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
  const caseShipments = shipments.filter((shipment) => String(relationId(shipment.afterSalesCase)) === String(afterSalesCase.id))
  const caseOccurrences = occurrences.filter((occurrence) => String(relationId(occurrence.afterSalesCase)) === String(afterSalesCase.id))
  const caseActivities = activities.filter((activity) => String(polyId(activity.relatedTo, 'after-sales')) === String(afterSalesCase.id)).sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime())
  const sale = afterSalesCase.sale && typeof afterSalesCase.sale === 'object' ? afterSalesCase.sale : null
  const customer = afterSalesCase.customer && typeof afterSalesCase.customer === 'object' ? afterSalesCase.customer : null

  return <Inspector
    className="esmera-after-sales-inspector"
    header={<div className="esmera-after-sales-inspector__header"><div><span className="esmera-eyebrow">Caso</span><h2>{afterSalesCase.caseNumber || afterSalesCase.id}</h2><p>{customer?.name || 'Cliente'} · {sale?.number || 'Venda vinculada'}</p></div><button className="esmera-icon-button esmera-after-sales-inspector__close" type="button" aria-label="Fechar inspector" onClick={onClose}>×</button></div>}
    footer={<div className="esmera-actions"><Link className="esmera-button" href={`/admin/collections/after-sales/${afterSalesCase.id}`}>Editar caso</Link>{sale ? <Link className="esmera-button" href={`/admin/collections/sales/${sale.id}`}>Abrir venda</Link> : null}</div>}
  >
    <section className="esmera-after-sales-case-controls">
      <label><span>Status do caso</span><select className="esmera-input" value={caseStatus} onChange={(event) => setCaseStatus(event.target.value as AfterSalesStatus)}>{afterSalesStatuses.map((value) => <option key={value} value={value}>{afterSalesStatusLabels[value]}</option>)}</select></label>
      <label><span>Prioridade</span><select className="esmera-input" value={casePriority} onChange={(event) => setCasePriority(event.target.value as OperationalPriority)}>{operationalPriorities.map((value) => <option key={value} value={value}>{operationalPriorityLabels[value]}</option>)}</select></label>
      <Button type="button" disabled={busy} onClick={() => void onOperate({ action: 'update-case', id: afterSalesCase.id, status: caseStatus, priority: casePriority })}>Salvar caso</Button>
    </section>

    <dl className="esmera-after-sales-facts">
      <div><dt>Cliente</dt><dd>{customer?.name || '—'}</dd></div>
      <div><dt>Contato</dt><dd>{customer?.phone || customer?.email || '—'}</dd></div>
      <div><dt>Venda</dt><dd>{sale?.number || '—'}</dd></div>
      <div><dt>Total</dt><dd>{money(sale?.totalCents)}</dd></div>
      <div><dt>Aberto em</dt><dd>{shortDate(afterSalesCase.openedAt)}</dd></div>
      <div><dt>Responsável</dt><dd>{relationLabel(afterSalesCase.owner, 'Não definido')}</dd></div>
    </dl>
    {afterSalesCase.summary ? <p className="esmera-after-sales-summary">{afterSalesCase.summary}</p> : null}

    <section className="esmera-after-sales-section">
      <div className="esmera-after-sales-section__heading"><div><span className="esmera-eyebrow">Tarefas</span><h3>Follow-ups</h3></div><span>{caseTasks.filter(openTask).length} abertas</span></div>
      {caseTasks.length ? <ul className="esmera-after-sales-task-list">{caseTasks.map((task) => <li key={String(task.id)}><div><strong>{task.title}</strong><small>{taskTypeLabels[task.type || 'custom']} · {dateTime(task.dueAt)} · {relationLabel(task.assignee, 'Sem responsável')}</small></div><select className="esmera-input" aria-label={`Status de ${task.title}`} value={task.status || 'pending'} disabled={busy} onChange={(event) => void onOperate({ action: 'update-task-status', id: task.id, status: event.target.value as TaskStatus })}>{taskStatuses.map((status) => <option key={status} value={status}>{taskStatusLabels[status]}</option>)}</select></li>)}</ul> : <p>Nenhum follow-up vinculado.</p>}
    </section>

    <section className="esmera-after-sales-section">
      <div className="esmera-after-sales-section__heading"><div><span className="esmera-eyebrow">Logística</span><h3>Entregas</h3></div><span>{caseShipments.length}</span></div>
      {caseShipments.length ? caseShipments.map((shipment) => <article className="esmera-shipment" key={String(shipment.id)}>
        <div className="esmera-shipment__header"><div><strong>{shipment.trackingCode || 'Sem código de rastreio'}</strong><small>{shipment.carrier || 'Responsável não informado'} · previsão {shortDate(shipment.estimatedDelivery)}</small></div><Status tone={statusTone('shipment', shipment.status || '')}>{shipmentStatusLabels[shipment.status || 'confirmed']}</Status></div>
        <ol className="esmera-shipment-timeline">{shipmentProgressStatuses.map((status) => {
          const currentIndex = shipmentProgressStatuses.indexOf(shipment.status as ShipmentStatus)
          const itemIndex = shipmentProgressStatuses.indexOf(status)
          const reached = currentIndex >= itemIndex && currentIndex >= 0
          return <li className={reached ? 'is-reached' : ''} key={status}><span aria-hidden="true" />{shipmentStatusLabels[status]}</li>
        })}</ol>
        {shipment.lastEvent ? <p>{shipment.lastEvent}</p> : null}
        <label><span>Atualizar estado</span><select className="esmera-input" value={shipment.status || 'confirmed'} disabled={busy} onChange={(event) => void onOperate({ action: 'update-shipment', id: shipment.id, status: event.target.value, lastEvent: shipment.lastEvent || null })}>{shipmentStatuses.map((status) => <option key={status} value={status}>{shipmentStatusLabels[status]}</option>)}</select></label>
      </article>) : <p>Nenhuma entrega registrada.</p>}
      <ShipmentCreator caseId={afterSalesCase.id} busy={busy} onCreate={onOperate} />
    </section>

    <section className="esmera-after-sales-section">
      <div className="esmera-after-sales-section__heading"><div><span className="esmera-eyebrow">Atendimento</span><h3>Ocorrências</h3></div><span>{caseOccurrences.filter(openOccurrence).length} abertas</span></div>
      {caseOccurrences.length ? <ul className="esmera-occurrence-list">{caseOccurrences.map((occurrence) => <li key={String(occurrence.id)}><div className="esmera-occurrence-list__header"><div><strong>{occurrenceTypeLabels[occurrence.type || 'other']}</strong><small>{occurrenceSeverityLabels[occurrence.severity || 'medium']} · {shortDate(occurrence.openedAt)}</small></div><Status tone={statusTone('occurrence', occurrence.status || '')}>{occurrenceStatusLabels[occurrence.status || 'open']}</Status></div><p>{occurrence.description}</p>{occurrence.resolution ? <p><strong>Resolução:</strong> {occurrence.resolution}</p> : openOccurrence(occurrence) ? <OccurrenceResolution occurrence={occurrence} busy={busy} onResolve={onOperate} /> : null}</li>)}</ul> : <p>Nenhuma ocorrência registrada.</p>}
      <OccurrenceCreator caseId={afterSalesCase.id} busy={busy} onCreate={onOperate} />
    </section>

    <section className="esmera-after-sales-section">
      <div className="esmera-after-sales-section__heading"><div><span className="esmera-eyebrow">Histórico</span><h3>Timeline consolidada</h3></div></div>
      {caseActivities.length ? <ol className="esmera-after-sales-timeline">{caseActivities.map((activity) => <li key={String(activity.id)}><strong>{activity.summary || activity.eventType || 'Atividade'}</strong>{activity.details ? <p>{activity.details}</p> : null}<small>{dateTime(activity.occurredAt)} · {relationLabel(activity.owner, 'Sistema')}</small></li>)}</ol> : <p>Nenhuma atividade registrada.</p>}
    </section>
  </Inspector>
}

function OccurrenceResolution({ occurrence, busy, onResolve }: { occurrence: OccurrenceRecord; busy: boolean; onResolve: (body: Record<string, unknown>) => Promise<void> }) {
  const [resolution, setResolution] = useState('')
  const [status, setStatus] = useState<OccurrenceStatus>('resolved')
  return <form className="esmera-occurrence-resolution" onSubmit={(event) => { event.preventDefault(); void onResolve({ action: 'resolve-occurrence', id: occurrence.id, status, resolution }) }}><textarea className="esmera-input" required rows={2} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Resolução verificável" /><select className="esmera-input" value={status} onChange={(event) => setStatus(event.target.value as OccurrenceStatus)}><option value="resolved">Resolvida</option><option value="closed">Encerrada</option></select><Button type="submit" disabled={busy}>Concluir</Button></form>
}

function WorkspaceInner(props: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | number | null>(props.cases[0]?.id || null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'dueAt', desc: false }])

  const { data: cases = [] } = useQuery({ queryKey: ['after-sales', 'cases'], queryFn: async () => props.cases, initialData: props.cases, staleTime: Infinity })
  const { data: tasks = [] } = useQuery({ queryKey: ['after-sales', 'tasks'], queryFn: async () => props.tasks, initialData: props.tasks, staleTime: Infinity })
  const { data: shipments = [] } = useQuery({ queryKey: ['after-sales', 'shipments'], queryFn: async () => props.shipments, initialData: props.shipments, staleTime: Infinity })
  const { data: occurrences = [] } = useQuery({ queryKey: ['after-sales', 'occurrences'], queryFn: async () => props.occurrences, initialData: props.occurrences, staleTime: Infinity })
  const { data: activities = [] } = useQuery({ queryKey: ['after-sales', 'activities'], queryFn: async () => props.activities, initialData: props.activities, staleTime: Infinity })

  const operation = useMutation({
    mutationFn: postAfterSales,
    onSuccess: (result) => {
      if (result.task) {
        const task = result.task as TaskRecord
        queryClient.setQueryData<TaskRecord[]>(['after-sales', 'tasks'], (current = []) => current.some((item) => String(item.id) === String(task.id)) ? current.map((item) => String(item.id) === String(task.id) ? { ...item, ...task } : item) : [...current, task])
      }
      if (result.shipment) {
        const shipment = result.shipment as ShipmentRecord
        queryClient.setQueryData<ShipmentRecord[]>(['after-sales', 'shipments'], (current = []) => current.some((item) => String(item.id) === String(shipment.id)) ? current.map((item) => String(item.id) === String(shipment.id) ? { ...item, ...shipment } : item) : [...current, shipment])
      }
      if (result.occurrence) {
        const occurrence = result.occurrence as OccurrenceRecord
        queryClient.setQueryData<OccurrenceRecord[]>(['after-sales', 'occurrences'], (current = []) => current.some((item) => String(item.id) === String(occurrence.id)) ? current.map((item) => String(item.id) === String(occurrence.id) ? { ...item, ...occurrence } : item) : [...current, occurrence])
      }
      if (result.afterSales) {
        const afterSales = result.afterSales as AfterSalesCase
        queryClient.setQueryData<AfterSalesCase[]>(['after-sales', 'cases'], (current = []) => current.map((item) => String(item.id) === String(afterSales.id) ? { ...item, ...afterSales } : item))
      }
      setFeedback('Operação salva.')
      router.refresh()
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : 'A operação não foi salva.'),
  })

  async function operate(body: Record<string, unknown>) {
    setFeedback(null)
    await operation.mutateAsync(body)
  }

  const caseMap = useMemo(() => new Map(cases.map((item) => [String(item.id), item])), [cases])
  const now = new Date()
  const today = dayKey(now)
  const openTasks = tasks.filter(openTask)
  const metrics = {
    today: openTasks.filter((task) => task.dueAt && dayKey(new Date(task.dueAt)) === today).length,
    overdue: openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now.getTime() && dayKey(new Date(task.dueAt)) !== today).length,
    occurrences: occurrences.filter(openOccurrence).length,
    deliveries: shipments.filter(activeShipment).length,
  }

  const rows = useMemo<QueueRow[]>(() => {
    const taskRows: QueueRow[] = tasks.map((task) => {
      const caseId = polyId(task.relatedTo, 'after-sales')
      const item = caseId !== null ? caseMap.get(String(caseId)) : undefined
      return {
        key: `task:${task.id}`,
        id: task.id,
        kind: 'task',
        caseId,
        dueAt: task.dueAt || null,
        priority: task.priority || item?.priority || 'normal',
        ownerId: relationId(task.assignee),
        ownerLabel: relationLabel(task.assignee, 'Sem responsável'),
        customer: relationLabel(item?.customer, 'Cliente'),
        caseNumber: item?.caseNumber || String(caseId || 'Sem caso'),
        title: task.title || 'Follow-up sem título',
        subtitle: taskTypeLabels[task.type || 'custom'],
        status: task.status || 'pending',
        type: task.type || 'custom',
      }
    })
    const occurrenceRows: QueueRow[] = occurrences.map((occurrence) => {
      const caseId = relationId(occurrence.afterSalesCase)
      const item = caseId !== null ? caseMap.get(String(caseId)) : undefined
      return {
        key: `occurrence:${occurrence.id}`,
        id: occurrence.id,
        kind: 'occurrence',
        caseId,
        dueAt: occurrence.openedAt || null,
        priority: occurrence.severity || item?.priority || 'normal',
        ownerId: relationId(occurrence.owner),
        ownerLabel: relationLabel(occurrence.owner, 'Sem responsável'),
        customer: relationLabel(item?.customer, 'Cliente'),
        caseNumber: item?.caseNumber || String(caseId || 'Sem caso'),
        title: occurrenceTypeLabels[occurrence.type || 'other'],
        subtitle: occurrence.description || 'Ocorrência sem descrição',
        status: occurrence.status || 'open',
        type: 'occurrence',
      }
    })
    const shipmentRows: QueueRow[] = shipments.map((shipment) => {
      const caseId = relationId(shipment.afterSalesCase)
      const item = caseId !== null ? caseMap.get(String(caseId)) : undefined
      return {
        key: `shipment:${shipment.id}`,
        id: shipment.id,
        kind: 'shipment',
        caseId,
        dueAt: shipment.estimatedDelivery || shipment.updatedAt || null,
        priority: item?.priority || 'normal',
        ownerId: relationId(item?.owner),
        ownerLabel: relationLabel(item?.owner, 'Sem responsável'),
        customer: relationLabel(item?.customer, 'Cliente'),
        caseNumber: item?.caseNumber || String(caseId || 'Sem caso'),
        title: shipment.trackingCode || shipment.carrier || 'Entrega',
        subtitle: shipment.lastEvent || shipmentStatusLabels[shipment.status || 'confirmed'],
        status: shipment.status || 'confirmed',
        type: 'shipment',
      }
    })

    let combined = [...taskRows, ...occurrenceRows, ...shipmentRows]
    if (props.filters.focus === 'today') combined = taskRows.filter((row) => row.dueAt && openTask(tasks.find((task) => String(task.id) === String(row.id)) as TaskRecord) && dayKey(new Date(row.dueAt)) === today)
    else if (props.filters.focus === 'overdue') combined = taskRows.filter((row) => row.dueAt && openTask(tasks.find((task) => String(task.id) === String(row.id)) as TaskRecord) && new Date(row.dueAt).getTime() < now.getTime() && dayKey(new Date(row.dueAt)) !== today)
    else if (props.filters.focus === 'occurrences') combined = occurrenceRows.filter((row) => !['resolved', 'closed'].includes(row.status))
    else if (props.filters.focus === 'deliveries') combined = shipmentRows.filter((row) => !['delivered', 'cancelled'].includes(row.status))

    if (props.filters.status === 'open') combined = combined.filter((row) => row.kind === 'task' ? ['pending', 'in_progress'].includes(row.status) : row.kind === 'occurrence' ? !['resolved', 'closed'].includes(row.status) : !['delivered', 'cancelled'].includes(row.status))
    else if (props.filters.status === 'done') combined = combined.filter((row) => row.kind === 'task' ? ['done', 'cancelled'].includes(row.status) : row.kind === 'occurrence' ? ['resolved', 'closed'].includes(row.status) : ['delivered', 'cancelled'].includes(row.status))
    if (props.filters.owner) combined = combined.filter((row) => String(row.ownerId) === props.filters.owner)
    if (props.filters.priority) combined = combined.filter((row) => row.priority === props.filters.priority)
    if (props.filters.type) combined = combined.filter((row) => row.type === props.filters.type)
    if (props.filters.q) {
      const q = props.filters.q.toLocaleLowerCase('pt-BR')
      combined = combined.filter((row) => [row.title, row.subtitle, row.customer, row.caseNumber].some((value) => value.toLocaleLowerCase('pt-BR').includes(q)))
    }
    return combined
  }, [caseMap, occurrences, props.filters, shipments, tasks, today, now])

  const columns = useMemo<ColumnDef<QueueRow>[]>(() => [
    { accessorKey: 'dueAt', header: 'Prazo', cell: ({ row }) => <div><strong>{dateTime(row.original.dueAt)}</strong><small>{row.original.caseNumber}</small></div> },
    { accessorKey: 'title', header: 'Ação', cell: ({ row }) => <div><strong>{row.original.title}</strong><small>{row.original.subtitle}</small></div> },
    { accessorKey: 'customer', header: 'Cliente' },
    { accessorKey: 'priority', header: 'Prioridade', cell: ({ row }) => <Status tone={priorityTone(row.original.priority)}>{operationalPriorityLabels[row.original.priority as OperationalPriority] || occurrenceSeverityLabels[row.original.priority as OccurrenceSeverity] || row.original.priority}</Status> },
    { accessorKey: 'ownerLabel', header: 'Responsável' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Status tone={statusTone(row.original.kind, row.original.status)}>{row.original.kind === 'task' ? taskStatusLabels[row.original.status as TaskStatus] : row.original.kind === 'occurrence' ? occurrenceStatusLabels[row.original.status as OccurrenceStatus] : shipmentStatusLabels[row.original.status as ShipmentStatus]}</Status> },
    { id: 'inspect', header: '', enableSorting: false, cell: ({ row }) => <Button type="button" onClick={() => row.original.caseId !== null && setSelectedCaseId(row.original.caseId)}>Inspecionar</Button> },
  ], [])

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() })
  const selectedCase = selectedCaseId !== null ? caseMap.get(String(selectedCaseId)) : undefined

  return <>
    <nav className="esmera-after-sales-metrics" aria-label="Filtros rápidos do pós-venda">
      <Link className={props.filters.focus === 'today' ? 'is-active' : ''} href={filterHref(props.filters, 'today')}><span>Follow-ups hoje</span><strong>{metrics.today}</strong><small>Tasks abertas com prazo hoje</small></Link>
      <Link className={props.filters.focus === 'overdue' ? 'is-active is-danger' : 'is-danger'} href={filterHref(props.filters, 'overdue')}><span>Atrasados</span><strong>{metrics.overdue}</strong><small>Tasks abertas com prazo vencido</small></Link>
      <Link className={props.filters.focus === 'occurrences' ? 'is-active' : ''} href={filterHref(props.filters, 'occurrences')}><span>Ocorrências abertas</span><strong>{metrics.occurrences}</strong><small>Casos ainda não resolvidos</small></Link>
      <Link className={props.filters.focus === 'deliveries' ? 'is-active' : ''} href={filterHref(props.filters, 'deliveries')}><span>Entregas ativas</span><strong>{metrics.deliveries}</strong><small>Estados discretos ainda em andamento</small></Link>
    </nav>

    <div className="esmera-after-sales-toolbar">
      <form className="esmera-after-sales-filters" method="get" action="/admin/after-sales">
        <input type="hidden" name="focus" value={props.filters.focus} />
        <label className="esmera-after-sales-search"><span>Buscar</span><input className="esmera-input" type="search" name="q" defaultValue={props.filters.q} placeholder="Caso, cliente ou ação" /></label>
        <label><span>Responsável</span><select className="esmera-input" name="owner" defaultValue={props.filters.owner}><option value="">Todos</option>{props.users.map((user) => <option key={String(user.id)} value={String(user.id)}>{user.name || user.email || user.id}</option>)}</select></label>
        <label><span>Prioridade</span><select className="esmera-input" name="priority" defaultValue={props.filters.priority}><option value="">Todas</option>{operationalPriorities.map((value) => <option key={value} value={value}>{operationalPriorityLabels[value]}</option>)}</select></label>
        <label><span>Tipo</span><select className="esmera-input" name="type" defaultValue={props.filters.type}><option value="">Todos</option>{taskTypes.map((value) => <option key={value} value={value}>{taskTypeLabels[value]}</option>)}<option value="shipment">Entrega</option><option value="occurrence">Ocorrência</option></select></label>
        <label><span>Status</span><select className="esmera-input" name="status" defaultValue={props.filters.status}><option value="open">Abertos</option><option value="done">Concluídos</option><option value="all">Todos</option></select></label>
        <Button type="submit">Aplicar</Button><Link className="esmera-button esmera-button--quiet" href="/admin/after-sales">Limpar</Link>
      </form>
      <FollowUpDialog key={String(selectedCaseId || 'none')} cases={cases} users={props.users} selectedCaseId={selectedCaseId} busy={operation.isPending} onCreate={operate} />
    </div>

    {feedback ? <p className="esmera-after-sales-feedback" role="status">{feedback}</p> : null}

    <div className={`esmera-after-sales-workspace${selectedCase ? ' has-inspector' : ''}`}>
      <section className="esmera-after-sales-queue">
        <div className="esmera-after-sales-queue__heading"><div><span className="esmera-eyebrow">Fila operacional</span><h2>{rows.length} item{rows.length === 1 ? '' : 's'}</h2></div><Link href={filterHref(props.filters, 'all')}>Ver tudo</Link></div>
        {rows.length ? <DataTable label="Fila operacional de pós-venda"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : <button className="esmera-table-sort" type="button" disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}</button>}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className={String(row.original.caseId) === String(selectedCaseId) ? 'is-selected' : ''}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></DataTable> : <EmptyState title="Fila vazia" copy="A consulta foi concluída. Nenhuma tarefa, entrega ou ocorrência corresponde aos filtros." />}
      </section>
      {selectedCase ? <CaseInspector key={String(selectedCase.id)} afterSalesCase={selectedCase} tasks={tasks} shipments={shipments} occurrences={occurrences} activities={activities} busy={operation.isPending} onOperate={operate} onClose={() => setSelectedCaseId(null)} /> : <aside className="esmera-after-sales-placeholder"><span className="esmera-eyebrow">Inspector</span><h2>Selecione um item da fila</h2><p>O contexto do caso, tarefas, logística, ocorrências e timeline será exibido sem abandonar os filtros.</p></aside>}
    </div>
  </>
}

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })

export function AfterSalesWorkspaceClient(props: Props) {
  return <QueryClientProvider client={queryClient}><WorkspaceInner {...props} /></QueryClientProvider>
}
