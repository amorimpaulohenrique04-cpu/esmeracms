/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps, Where } from 'payload'

import { openOpportunityStages, opportunityStageLabels } from '../../../businessRules/opportunities/stages'
import { eligibleSaleStatuses } from '../../../collections/Sales'
import {
  AccessDenied,
  EmptyState,
  ensureUser,
  findDocs,
  money,
  PageHeader,
  QueryError,
  shortDate,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'

type Customer = { id: string | number; name?: string }
type User = { id: string | number; name?: string; email?: string }
type Sale = {
  id: string | number
  number?: string
  status?: string
  totalCents?: number
  channel?: string
  customer?: Customer | string | number
  expectedDeliveryAt?: string
}
type Opportunity = {
  id: string | number
  code?: string
  stage?: string
  rank?: number
  customer?: Customer | string | number
  owner?: User | string | number
  source?: string
  estimatedValueCents?: number | null
  nextAction?: string
  nextActionAt?: string
}

type SalesMode = 'list' | 'pipeline'

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  site: 'Site',
  referral: 'Indicação',
  architect: 'Arquiteto',
  other: 'Outro',
}

const sourceLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  site: 'Site',
  referral: 'Indicação',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  other: 'Outro',
}

function customerName(value: Sale['customer'] | Opportunity['customer']) {
  return value && typeof value === 'object' ? value.name || 'Cliente' : 'Cliente ainda não vinculado'
}

function ownerName(value: Opportunity['owner']) {
  return value && typeof value === 'object' ? value.name || value.email || 'Sem responsável' : 'Sem responsável'
}

async function salesMode(props: AdminViewServerProps): Promise<SalesMode> {
  const params = await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
  const value = params?.view
  const normalized = Array.isArray(value) ? value[0] : value
  return normalized === 'pipeline' ? 'pipeline' : 'list'
}

function ViewSwitch({ mode }: { mode: SalesMode }) {
  return (
    <div className="esmera-sales-switch" aria-label="Visualização de vendas">
      <Link className={`esmera-sales-switch__item${mode === 'list' ? ' is-active' : ''}`} href="/admin/sales?view=list" aria-current={mode === 'list' ? 'page' : undefined}>Lista</Link>
      <Link className={`esmera-sales-switch__item${mode === 'pipeline' ? ' is-active' : ''}`} href="/admin/sales?view=pipeline" aria-current={mode === 'pipeline' ? 'page' : undefined}>Pipeline</Link>
    </div>
  )
}

async function SalesListContent(props: AdminViewServerProps) {
  const result = await findDocs<Sale>(props.initPageResult.req, 'sales', {
    sort: '-createdAt',
    limit: 100,
    depth: 1,
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      channel: true,
      customer: true,
      expectedDeliveryAt: true,
    },
  })

  return (
    <section className="esmera-card">
      <div className="esmera-card-header"><h2>Vendas</h2><span className="esmera-pill">{result.totalDocs} registros</span></div>
      {result.docs.length ? (
        <ul className="esmera-list">
          {result.docs.map((sale) => (
            <li className="esmera-list-row" key={String(sale.id)}>
              <div>
                <a className="esmera-row-title" href={`/admin/collections/sales/${sale.id}`}>Venda #{sale.number || '—'} · {customerName(sale.customer)}</a>
                <span className="esmera-row-meta">{channelLabels[sale.channel || ''] || sale.channel || 'canal não informado'} · entrega {shortDate(sale.expectedDeliveryAt)}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span className={`esmera-pill ${eligibleSaleStatuses.includes((sale.status || '') as typeof eligibleSaleStatuses[number]) ? 'esmera-pill--green' : sale.status === 'cancelled' ? 'esmera-pill--red' : 'esmera-pill--sand'}`}>{sale.status || '—'}</span>
                <strong style={{ fontSize: 12 }}>{money(sale.totalCents)}</strong>
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="Nenhuma venda" copy="A consulta foi concluída e ainda não existem vendas." />}
    </section>
  )
}

async function PipelineContent(props: AdminViewServerProps) {
  const result = await findDocs<Opportunity>(props.initPageResult.req, 'opportunities', {
    where: { stage: { in: [...openOpportunityStages] } } as Where,
    sort: 'rank',
    limit: 500,
    depth: 1,
    select: {
      id: true,
      code: true,
      stage: true,
      rank: true,
      customer: true,
      owner: true,
      source: true,
      estimatedValueCents: true,
      nextAction: true,
      nextActionAt: true,
    },
  })

  return (
    <>
      <div className="esmera-pipeline">
        {openOpportunityStages.map((stage) => {
          const opportunities = result.docs.filter((opportunity) => opportunity.stage === stage)
          const potential = opportunities.reduce((sum, opportunity) => sum + (opportunity.estimatedValueCents || 0), 0)
          return (
            <section className="esmera-pipeline-column" key={stage}>
              <div className="esmera-pipeline-head">
                <span>{opportunityStageLabels[stage]}</span>
                <span className="esmera-pill">{opportunities.length} · {money(potential)}</span>
              </div>
              {opportunities.map((opportunity) => (
                <a className="esmera-pipeline-card" href={`/admin/collections/opportunities/${opportunity.id}`} key={String(opportunity.id)} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <small>{opportunity.code || 'Sem código'} · {sourceLabels[opportunity.source || ''] || 'Origem não informada'}</small>
                  <strong>{customerName(opportunity.customer)}</strong>
                  <span>{opportunity.estimatedValueCents == null ? 'Valor potencial não informado' : money(opportunity.estimatedValueCents)}</span>
                  <span>{opportunity.nextAction || 'Sem próxima ação'}{opportunity.nextActionAt ? ` · ${shortDate(opportunity.nextActionAt)}` : ''}</span>
                  <small>{ownerName(opportunity.owner)}</small>
                </a>
              ))}
            </section>
          )
        })}
      </div>
      <div className="esmera-kpi-meta">Fonte comercial: Opportunities. Leads permanecem apenas como entrada e qualificação durante o ciclo de compatibilidade.</div>
    </>
  )
}

export async function SalesWorkspace(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  const mode = await salesMode(props)

  try {
    return (
      <ViewFrame props={props}>
        <PageHeader
          eyebrow="Business"
          title="Vendas"
          subtitle={mode === 'pipeline' ? 'Oportunidades comerciais na mesma superfície de Vendas. Leads representam somente aquisição e qualificação.' : 'Transações ganhas, valores registrados e entrega. Negociação comercial pertence a Opportunities.'}
          actions={mode === 'pipeline' ? <TechnicalLink href="/admin/collections/opportunities/create" primary>Nova oportunidade</TechnicalLink> : <TechnicalLink href="/admin/collections/sales/create" primary>Nova venda</TechnicalLink>}
        />
        <ViewSwitch mode={mode} />
        {mode === 'pipeline' ? <PipelineContent {...props} /> : <SalesListContent {...props} />}
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Vendas" subtitle="Business" /><QueryError title={mode === 'pipeline' ? 'Não foi possível consultar o pipeline' : 'Não foi possível consultar vendas'} error={error} /></ViewFrame>
  }
}

export function PipelineRedirect() {
  redirect('/admin/sales?view=pipeline')
}
