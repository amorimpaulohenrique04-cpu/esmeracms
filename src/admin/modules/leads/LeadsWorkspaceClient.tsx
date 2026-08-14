'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { Button, DataTable, EmptyState, Inspector, Status } from '../../design-system'
import { ContextInspector, SplitWorkspace } from '../../design-system/Primitives'
import type { LeadFilters, LeadRecord } from './types'

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  referral: 'Indicação',
  site: 'Site',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  whatsapp: 'WhatsApp',
  other: 'Outro',
}

function opportunityId(value: LeadRecord['opportunity']) {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  return value.id
}

function shortDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function postLeads(body: Record<string, unknown>) {
  const response = await fetch('/api/admin-leads', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as Record<string, unknown> & { error?: string }
  if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o lead.')
  return result
}

export function LeadsWorkspaceClient({ leads, filters }: { leads: LeadRecord[]; filters: LeadFilters }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  // Exclusão é destrutiva: exige um segundo clique (armada) para confirmar,
  // mesmo padrão usado na exclusão de produtos.
  const [deleteArmed, setDeleteArmed] = useState(false)

  const { data } = useQuery({ queryKey: ['leads', 'list'], queryFn: async () => leads, initialData: leads, staleTime: Infinity })

  const operation = useMutation({
    mutationFn: postLeads,
    onSuccess: (result) => {
      if (result.opportunity) {
        const opportunityRef = result.opportunity as { id: string | number; code?: string | null }
        queryClient.setQueryData<LeadRecord[]>(['leads', 'list'], (current = []) => current.map((item) => String(item.id) === String(selectedId) ? { ...item, opportunity: opportunityRef } : item))
        setFeedback(`Lead convertido em ${opportunityRef.code || opportunityRef.id}.`)
        router.push(`/admin/collections/opportunities/${opportunityRef.id}`)
      }
      router.refresh()
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : 'Não foi possível qualificar o lead.'),
  })

  const deleteOperation = useMutation({
    mutationFn: postLeads,
    onSuccess: () => {
      queryClient.setQueryData<LeadRecord[]>(['leads', 'list'], (current = []) => current.filter((item) => String(item.id) !== String(selectedId)))
      setFeedback('Lead excluído.')
      setSelectedId(null)
      setDeleteArmed(false)
      router.refresh()
    },
    onError: (error) => setFeedback(error instanceof Error ? error.message : 'Não foi possível excluir o lead.'),
  })

  const selected = useMemo(() => data.find((item) => String(item.id) === String(selectedId)) || null, [data, selectedId])

  // Trocar a seleção desarma a exclusão: a confirmação vale só para o lead que estava aberto.
  function selectLead(id: string | number | null) {
    setSelectedId(id)
    setDeleteArmed(false)
  }

  function requestDelete() {
    if (!selected) return
    if (!deleteArmed) {
      setDeleteArmed(true)
      setFeedback('Excluir este lead move o registro para a lixeira. Clique em “Confirmar exclusão” para continuar.')
      return
    }
    setDeleteArmed(false)
    setFeedback(null)
    void deleteOperation.mutate({ action: 'delete-lead', id: selected.id })
  }

  return (
    <>
    <form className="esmera-leads-filters" method="get" action="/admin/leads">
      <label className="esmera-leads-search"><span>Buscar</span><input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Nome, telefone, e-mail ou nota" /></label>
      <div className="esmera-leads-filters__actions">
        <Button type="submit">Aplicar</Button>
        <Link className="esmera-button esmera-button--quiet" href="/admin/leads">Limpar</Link>
      </div>
    </form>
    <SplitWorkspace
      className="esmera-leads-split"
      detailWidth="minmax(0, 1.15fr)"
      master={
        data.length ? (
          <DataTable label="Leads" className="esmera-leads-table">
            <thead><tr><th>Nome</th><th>Contato</th><th className="esmera-leads-table__origin">Origem</th><th>Status</th><th className="esmera-leads-table__date">Recebido</th></tr></thead>
            <tbody>
              {data.map((lead) => (
                <tr
                  key={String(lead.id)}
                  className={String(lead.id) === String(selectedId) ? 'is-selected' : ''}
                  onClick={() => selectLead(lead.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td><strong>{lead.name || 'Sem nome'}</strong></td>
                  <td>{lead.phone || lead.email || '—'}</td>
                  <td className="esmera-leads-table__origin">{sourceLabels[lead.source || ''] || lead.source || '—'}</td>
                  <td><Status tone={opportunityId(lead.opportunity) ? 'success' : 'neutral'}>{opportunityId(lead.opportunity) ? 'Convertido' : 'Novo'}</Status></td>
                  <td className="esmera-leads-table__date">{shortDate(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : <EmptyState title="Nenhum lead" copy={filters.q ? 'Nenhum lead corresponde à busca.' : 'Use “+ Novo → Novo lead” para registrar a primeira entrada.'} />
      }
      detail={selected ? (
        <ContextInspector
          label="Detalhes do lead"
          header={<div><span className="esmera-eyebrow">Lead</span><h2>{selected.name || 'Sem nome'}</h2></div>}
        >
          <Inspector
            footer={<div className="esmera-actions">
              <button className="esmera-button" type="button" onClick={() => selectLead(null)}>Fechar</button>
              {opportunityId(selected.opportunity) ? (
                <Link className="esmera-button esmera-button--primary" href={`/admin/opportunities?view=list&q=${encodeURIComponent(String(opportunityId(selected.opportunity)))}`}>Ver oportunidade</Link>
              ) : (
                <Button
                  type="button"
                  disabled={operation.isPending}
                  onClick={() => { setFeedback(null); void operation.mutate({ action: 'qualify', id: selected.id }) }}
                >{operation.isPending ? 'Convertendo…' : 'Converter em Oportunidade'}</Button>
              )}
              <Button
                type="button"
                tone="danger"
                busy={deleteOperation.isPending}
                busyLabel="Excluindo…"
                onClick={requestDelete}
                aria-label={deleteArmed ? 'Confirmar exclusão do lead' : 'Excluir lead'}
              >{deleteArmed ? 'Confirmar exclusão' : 'Excluir lead'}</Button>
            </div>}
          >
            <dl className="esmera-leads-facts">
              <div><dt>Contato</dt><dd>{selected.phone || '—'}{selected.phone && selected.email ? ' · ' : ''}{selected.email || ''}</dd></div>
              <div><dt>Origem</dt><dd>{sourceLabels[selected.source || ''] || selected.source || '—'}</dd></div>
              <div><dt>Recebido em</dt><dd>{shortDate(selected.createdAt)}</dd></div>
            </dl>
            {selected.notes ? <p>{selected.notes}</p> : null}
            {feedback ? <p className="esmera-quick-create-feedback" role="status" aria-live="polite">{feedback}</p> : null}
          </Inspector>
        </ContextInspector>
      ) : undefined}
    />
    </>
  )
}
