'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SortingState } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  occurrenceTypeLabels,
  shipmentStatusLabels,
  taskTypeLabels,
} from '../../../businessRules/afterSales/model'
import { AfterSalesFilterBar } from './AfterSalesFilterBar'
import { AfterSalesInspector } from './AfterSalesInspector'
import { AfterSalesMetricStrip } from './AfterSalesMetricStrip'
import { AfterSalesQueue } from './AfterSalesQueue'
import type {
  ActivityRecord,
  AfterSalesCase,
  AfterSalesFilters,
  OccurrenceRecord,
  SaleOption,
  ShipmentRecord,
  TaskRecord,
  UserRef,
} from './types'
import {
  activeShipment,
  dayKey,
  openOccurrence,
  openTask,
  polyId,
  postAfterSales,
  relationId,
  relationLabel,
  type QueueRow,
} from './workspace'

type Props = {
  cases: AfterSalesCase[]
  tasks: TaskRecord[]
  shipments: ShipmentRecord[]
  occurrences: OccurrenceRecord[]
  activities: ActivityRecord[]
  users: UserRef[]
  sales: SaleOption[]
  filters: AfterSalesFilters
}

function WorkspaceInner(props: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | number | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('case')
  })
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false)
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
        queryClient.setQueryData<AfterSalesCase[]>(['after-sales', 'cases'], (current = []) => current.some((item) => String(item.id) === String(afterSales.id)) ? current.map((item) => String(item.id) === String(afterSales.id) ? { ...item, ...afterSales } : item) : [...current, afterSales])
      }
      setFeedback('Operação salva.')
      router.refresh()
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : 'A operação não foi salva.'),
  })

  async function operate(body: Record<string, unknown>) {
    setFeedback(null)
    return await operation.mutateAsync(body)
  }

  const caseMap = useMemo(() => new Map(cases.map((item) => [String(item.id), item])), [cases])

  const openInspector = useCallback((caseId: string | number, trigger?: HTMLButtonElement) => {
    triggerRef.current = trigger || null
    setSelectedCaseId(caseId)
    setMobileInspectorOpen(true)
    const url = new URL(window.location.href)
    url.searchParams.set('case', String(caseId))
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
  }, [])

  const closeInspector = useCallback(() => {
    setSelectedCaseId(null)
    setMobileInspectorOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.delete('case')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
  }, [])

  useEffect(() => {
    if (!mobileInspectorOpen || !window.matchMedia('(max-width: 900px)').matches) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeInspector()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeInspector, mobileInspectorOpen])

  const now = useMemo(() => new Date(), [])
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
  }, [caseMap, now, occurrences, props.filters, shipments, tasks, today])

  const selectedCase = selectedCaseId !== null ? caseMap.get(String(selectedCaseId)) : undefined

  return <>
    <AfterSalesMetricStrip filters={props.filters} metrics={metrics} />
    <AfterSalesFilterBar
      cases={cases}
      sales={props.sales}
      users={props.users}
      filters={props.filters}
      selectedCaseId={selectedCaseId}
      busy={operation.isPending}
      onCreate={operate}
      onCaseCreated={(caseId) => openInspector(caseId)}
    />
    {feedback ? <p className="esmera-after-sales-feedback" role="status" aria-live="polite">{feedback}</p> : null}
    <div className={`esmera-after-sales-workspace${selectedCase ? ' has-inspector' : ''}${mobileInspectorOpen ? ' is-mobile-inspector-open' : ''}`}>
      <AfterSalesQueue rows={rows} filters={props.filters} selectedCaseId={selectedCaseId} sorting={sorting} onSortingChange={setSorting} onInspect={openInspector} />
      {selectedCase ? <AfterSalesInspector key={String(selectedCase.id)} afterSalesCase={selectedCase} tasks={tasks} shipments={shipments} occurrences={occurrences} activities={activities} busy={operation.isPending} onOperate={operate} onClose={closeInspector} /> : null}
    </div>
  </>
}

export function AfterSalesWorkspaceClient(props: Props) {
  return <WorkspaceInner {...props} />
}
