'use client'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

export type PipelineLead = {
  id: string | number
  name: string
  stage: string
  source?: string | null
  nextAction?: string | null
  nextActionAt?: string | null
  owner?: string | null
}

const stages = [
  { value: 'new', label: 'Novo' },
  { value: 'curation', label: 'Curadoria' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociação' },
  { value: 'won', label: 'Ganho' },
] as const

function dateLabel(value?: string | null) {
  if (!value) return 'Sem prazo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sem prazo'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function PipelineBoard({ initialLeads, totals }: { initialLeads: PipelineLead[]; totals: Record<string, number> }) {
  const router = useRouter()
  const [leads, setLeads] = useState(initialLeads)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | number | null>(null)

  const grouped = useMemo(() => {
    const result = Object.fromEntries(stages.map((stage) => [stage.value, [] as PipelineLead[]])) as Record<string, PipelineLead[]>
    for (const lead of leads) if (result[lead.stage]) result[lead.stage].push(lead)
    return result
  }, [leads])

  const moveLead = async (id: string | number, target: string) => {
    const current = leads.find((lead) => String(lead.id) === String(id))
    if (!current || current.stage === target || moving !== null) return
    const previous = leads
    setError(null)
    setMoving(id)
    setLeads((items) => items.map((lead) => String(lead.id) === String(id) ? { ...lead, stage: target } : lead))

    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ stage: target }),
      })
      if (!response.ok) throw new Error('Não foi possível atualizar a etapa.')
      router.refresh()
    } catch (cause) {
      setLeads(previous)
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a etapa.')
    } finally {
      setMoving(null)
    }
  }

  return <>
    {error ? <div className="esmera-state esmera-state--error" role="alert"><strong>Movimento não salvo</strong><p>{error}</p></div> : null}
    <div className="esmera-pipeline" aria-label="Pipeline comercial">
      {stages.map((stage) => <section
        className="esmera-pipeline-column"
        key={stage.value}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const id = event.dataTransfer.getData('text/esmera-lead-id')
          if (id) void moveLead(id, stage.value)
        }}
      >
        <div className="esmera-pipeline-head"><span>{stage.label}</span><span className={`esmera-pill ${stage.value === 'won' ? 'esmera-pill--green' : ''}`}>{totals[stage.value] || 0}</span></div>
        {(grouped[stage.value] || []).map((lead) => <article
          className="esmera-pipeline-card"
          draggable
          key={String(lead.id)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/esmera-lead-id', String(lead.id))
          }}
        >
          <a href={`/admin/collections/leads/${lead.id}`}><strong>{lead.name || 'Lead sem nome'}</strong></a>
          <span>{lead.nextAction || 'Sem próxima ação'} · {dateLabel(lead.nextActionAt)}</span>
          <div className="esmera-pipeline-move">
            <label htmlFor={`stage-${lead.id}`}>Mover para</label>
            <select
              id={`stage-${lead.id}`}
              value={lead.stage}
              disabled={moving !== null}
              onChange={(event) => void moveLead(lead.id, event.target.value)}
            >
              {stages.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              <option value="lost">Perdido</option>
            </select>
          </div>
        </article>)}
        {(grouped[stage.value] || []).length === 0 ? <div className="esmera-pipeline-empty">Sem cards nesta amostra.</div> : null}
        {(totals[stage.value] || 0) > (grouped[stage.value] || []).length ? <small className="esmera-pipeline-more">Mostrando {(grouped[stage.value] || []).length} de {totals[stage.value]}</small> : null}
      </section>)}
    </div>
  </>
}
