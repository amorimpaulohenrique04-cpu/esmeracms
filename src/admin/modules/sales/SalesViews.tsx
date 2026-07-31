/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import { redirect } from 'next/navigation'
import type { AdminViewServerProps, Where } from 'payload'

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
type Sale = {
  id: string | number
  number?: string
  status?: string
  totalCents?: number
  channel?: string
  customer?: Customer | string | number
  expectedDeliveryAt?: string
}
type Lead = {
  id: string | number
  name?: string
  stage?: string
  nextAction?: string
  nextActionAt?: string
}

type SalesMode = 'list' | 'pipeline'

const pipelineStages = ['new', 'curation', 'proposal', 'negotiation'] as const

const stageLabels: Record<string, string> = {
  new: 'Novo',
  curation: 'Curadoria',
  proposal: 'Proposta',
  negotiation: 'Negociação',
}

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  site: 'Site',
  referral: 'Indicação',
  architect: 'Arquiteto',
  other: 'Outro',
}

function customerName(value: Sale['customer']) {
  return value && typeof value === 'object' ? value.name || 'Cliente' : 'Cliente'
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
      <a className={`esmera-sales-switch__item${mode === 'list' ? ' is-active' : ''}`} href="/admin/sales?view=list" aria-current={mode === 'list' ? 'page' : undefined}>Lista</a>
      <a className={`esmera-sales-switch__item${mode === 'pipeline' ? ' is-active' : ''}`} href="/admin/sales?view=pipeline" aria-current={mode === 'pipeline' ? 'page' : undefined}>Pipeline</a>
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
  const result = await findDocs<Lead>(props.initPageResult.req, 'leads', {
    where: { stage: { in: [...pipelineStages] } } as Where,
    sort: 'nextActionAt',
    limit: 200,
    depth: 0,
    select: { id: true, name: true, stage: true, nextAction: true, nextActionAt: true },
  })

  return (
    <>
      <div className="esmera-pipeline">
        {pipelineStages.map((stage) => {
          const leads = result.docs.filter((lead) => lead.stage === stage)
          return (
            <section className="esmera-pipeline-column" key={stage}>
              <div className="esmera-pipeline-head"><span>{stageLabels[stage]}</span><span className="esmera-pill">{leads.length}</span></div>
              {leads.map((lead) => (
                <a className="esmera-pipeline-card" href={`/admin/collections/leads/${lead.id}`} key={String(lead.id)} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <strong>{lead.name || 'Lead sem nome'}</strong>
                  <span>{lead.nextAction || 'Sem próxima ação'}{lead.nextActionAt ? ` · ${shortDate(lead.nextActionAt)}` : ''}</span>
                </a>
              ))}
            </section>
          )
        })}
      </div>
      <div className="esmera-kpi-meta">Fonte transitória: leads.stage. Ganhos e perdidos não ocupam coluna operacional; a coleção Opportunities será introduzida na etapa de domínio comercial.</div>
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
          subtitle={mode === 'pipeline' ? 'Pipeline comercial dentro da mesma superfície de Vendas, sem rota operacional paralela.' : 'Pedidos, valores registrados e entrega. Rascunhos e cancelamentos não entram nas métricas de receita.'}
          actions={mode === 'pipeline' ? <TechnicalLink href="/admin/collections/leads/create" primary>Novo lead</TechnicalLink> : <TechnicalLink href="/admin/collections/sales/create" primary>Nova venda</TechnicalLink>}
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
