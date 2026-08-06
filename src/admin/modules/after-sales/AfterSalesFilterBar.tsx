'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import React, { useState } from 'react'

import {
  operationalPriorities,
  operationalPriorityLabels,
  taskTypeLabels,
  taskTypes,
  type OperationalPriority,
  type TaskType,
} from '../../../businessRules/afterSales/model'
import { Button } from '../../design-system'
import { FilterPanelAdvanced } from '../../design-system/FilterPanelAdvanced'
import type { AfterSalesCase, AfterSalesFilters, UserRef } from './types'
import { relationLabel } from './workspace'

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

export function AfterSalesFilterBar({ cases, users, filters, selectedCaseId, busy, onCreate }: {
  cases: AfterSalesCase[]
  users: UserRef[]
  filters: AfterSalesFilters
  selectedCaseId: string | number | null
  busy: boolean
  onCreate: (body: Record<string, unknown>) => Promise<void>
}) {
  const hasAdvancedFilters = Boolean(filters.priority || filters.type)

  return (
    <div className="esmera-after-sales-toolbar">
      <form className="esmera-after-sales-filters" method="get" action="/admin/after-sales">
        <input type="hidden" name="focus" value={filters.focus} />
        <div className="esmera-after-sales-filters__primary">
          <label className="esmera-after-sales-search"><span>Buscar</span><input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Caso, cliente ou ação" /></label>
          <label><span>Status</span><select className="esmera-input" name="status" defaultValue={filters.status}><option value="open">Abertos</option><option value="done">Concluídos</option><option value="all">Todos</option></select></label>
          <label><span>Responsável</span><select className="esmera-input" name="owner" defaultValue={filters.owner}><option value="">Todos</option>{users.map((user) => <option key={String(user.id)} value={String(user.id)}>{user.name || user.email || user.id}</option>)}</select></label>
          <Button type="submit">Aplicar</Button>
          <FollowUpDialog key={String(selectedCaseId || 'none')} cases={cases} users={users} selectedCaseId={selectedCaseId} busy={busy} onCreate={onCreate} />
        </div>
        <FilterPanelAdvanced label="Mais filtros" active={hasAdvancedFilters}>
          <label><span>Prioridade</span><select className="esmera-input" name="priority" defaultValue={filters.priority}><option value="">Todas</option>{operationalPriorities.map((value) => <option key={value} value={value}>{operationalPriorityLabels[value]}</option>)}</select></label>
          <label><span>Tipo</span><select className="esmera-input" name="type" defaultValue={filters.type}><option value="">Todos</option>{taskTypes.map((value) => <option key={value} value={value}>{taskTypeLabels[value]}</option>)}<option value="shipment">Entrega</option><option value="occurrence">Ocorrência</option></select></label>
          <Button type="submit">Aplicar recorte</Button>
          <Link className="esmera-button esmera-button--quiet" href="/admin/after-sales">Limpar</Link>
        </FilterPanelAdvanced>
      </form>
    </div>
  )
}
