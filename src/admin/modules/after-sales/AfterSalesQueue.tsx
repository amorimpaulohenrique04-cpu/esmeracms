/* eslint-disable react-hooks/incompatible-library -- TanStack Table exposes stateful helpers that React Compiler intentionally does not memoize. */
'use client'

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import Link from 'next/link'
import React, { useMemo } from 'react'

import { Button, DataTable, EmptyState, Status } from '../../design-system'
import type { AfterSalesFilters } from './types'
import {
  dateTime,
  filterHref,
  priorityTone,
  queuePriorityLabel,
  queueStatusLabel,
  statusTone,
  type QueueRow,
} from './workspace'

export function AfterSalesQueue({
  rows,
  filters,
  selectedCaseId,
  sorting,
  onSortingChange,
  onInspect,
}: {
  rows: QueueRow[]
  filters: AfterSalesFilters
  selectedCaseId: string | number | null
  sorting: SortingState
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>
  onInspect: (caseId: string | number, trigger: HTMLButtonElement) => void
}) {
  const columns = useMemo<ColumnDef<QueueRow>[]>(() => [
    { accessorKey: 'dueAt', header: 'Prazo', cell: ({ row }) => <div><strong>{dateTime(row.original.dueAt)}</strong><small>{row.original.caseNumber}</small></div> },
    { accessorKey: 'title', header: 'Ação', cell: ({ row }) => <div><strong>{row.original.title}</strong><small>{row.original.subtitle}</small></div> },
    { accessorKey: 'customer', header: 'Cliente' },
    { accessorKey: 'priority', header: 'Prioridade', cell: ({ row }) => <Status tone={priorityTone(row.original.priority)}>{queuePriorityLabel(row.original.priority)}</Status> },
    { accessorKey: 'ownerLabel', header: 'Responsável' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Status tone={statusTone(row.original.kind, row.original.status)}>{queueStatusLabel(row.original)}</Status> },
    {
      id: 'inspect',
      header: '',
      enableSorting: false,
      cell: ({ row }) => row.original.caseId === null ? null : (
        <Button
          type="button"
          data-esmera-context-key={`after-sales-${row.original.key}`}
          onClick={(event) => onInspect(row.original.caseId as string | number, event.currentTarget)}
        >Inspecionar</Button>
      ),
    },
  ], [onInspect])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <section className="esmera-after-sales-queue">
      <div className="esmera-after-sales-queue__heading">
        <div><span className="esmera-eyebrow">Fila operacional</span><h2>{rows.length} item{rows.length === 1 ? '' : 's'}</h2></div>
        <div className="esmera-after-sales-queue__context"><span>O detalhe abre sem perder filtros.</span><Link href={filterHref(filters, 'all')}>Ver tudo</Link></div>
      </div>
      {rows.length ? (
        <DataTable label="Fila operacional de pós-venda">
          <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : <button className="esmera-table-sort" type="button" disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}{header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}</button>}</th>)}</tr>)}</thead>
          <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className={String(row.original.caseId) === String(selectedCaseId) ? 'is-selected' : ''}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </DataTable>
      ) : <EmptyState title="Fila vazia" copy="A consulta foi concluída. Nenhuma tarefa, entrega ou ocorrência corresponde aos filtros." />}
    </section>
  )
}
