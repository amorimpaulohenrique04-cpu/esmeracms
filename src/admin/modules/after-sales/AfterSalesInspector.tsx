'use client'

import Link from 'next/link'
import React, { useState } from 'react'

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
  type AfterSalesStatus,
  type OccurrenceSeverity,
  type OccurrenceStatus,
  type OccurrenceType,
  type OperationalPriority,
  type ShipmentStatus,
  type TaskStatus,
} from '../../../businessRules/afterSales/model'
import { Button, Inspector, Status } from '../../design-system'
import type {
  ActivityRecord,
  AfterSalesCase,
  OccurrenceRecord,
  ShipmentRecord,
  TaskRecord,
} from './types'
import {
  dateTime,
  money,
  openOccurrence,
  openTask,
  polyId,
  relationId,
  relationLabel,
  shortDate,
  statusTone,
} from './workspace'

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

function OccurrenceResolution({ occurrence, busy, onResolve }: { occurrence: OccurrenceRecord; busy: boolean; onResolve: (body: Record<string, unknown>) => Promise<void> }) {
  const [resolution, setResolution] = useState('')
  const [status, setStatus] = useState<OccurrenceStatus>('resolved')

  return <form className="esmera-occurrence-resolution" onSubmit={(event) => {
    event.preventDefault()
    void onResolve({ action: 'resolve-occurrence', id: occurrence.id, status, resolution })
  }}>
    <textarea className="esmera-input" required rows={2} value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Resolução verificável" />
    <select className="esmera-input" value={status} onChange={(event) => setStatus(event.target.value as OccurrenceStatus)}><option value="resolved">Resolvida</option><option value="closed">Encerrada</option></select>
    <Button type="submit" disabled={busy}>Concluir</Button>
  </form>
}

export function AfterSalesInspector({ afterSalesCase, tasks, shipments, occurrences, activities, busy, onOperate, onClose }: {
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
