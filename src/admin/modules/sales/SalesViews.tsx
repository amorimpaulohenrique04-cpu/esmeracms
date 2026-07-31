/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
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

const stageLabels: Record<string, string> = {
  new: 'Novo',
  curation: 'Curadoria',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  won: 'Ganho',
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

export async function SalesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  try {
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

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Vendas" subtitle="Pedidos, valores registrados e entrega. Rascunhos e cancelamentos não entram nas métricas de receita." actions={<TechnicalLink href="/admin/collections/sales/create" primary>Nova venda</TechnicalLink>} />
      <section className="esmera-card"><div className="esmera-card-header"><h2>Vendas</h2><span className="esmera-pill">{result.totalDocs} registros</span></div>{result.docs.length ? <ul className="esmera-list">{result.docs.map((sale) => <li className="esmera-list-row" key={String(sale.id)}><div><a className="esmera-row-title" href={`/admin/collections/sales/${sale.id}`}>Venda #{sale.number || '—'} · {customerName(sale.customer)}</a><span className="esmera-row-meta">{channelLabels[sale.channel || ''] || sale.channel || 'canal não informado'} · entrega {shortDate(sale.expectedDeliveryAt)}</span></div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className={`esmera-pill ${eligibleSaleStatuses.includes((sale.status || '') as typeof eligibleSaleStatuses[number]) ? 'esmera-pill--green' : sale.status === 'cancelled' ? 'esmera-pill--red' : 'esmera-pill--sand'}`}>{sale.status || '—'}</span><strong style={{ fontSize: 12 }}>{money(sale.totalCents)}</strong></div></li>)}</ul> : <EmptyState title="Nenhuma venda" copy="A consulta foi concluída e ainda não existem vendas." />}</section>
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Vendas" subtitle="Business" /><QueryError title="Não foi possível consultar vendas" error={error} /></ViewFrame>
  }
}

export async function PipelineView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  try {
    const result = await findDocs<Lead>(props.initPageResult.req, 'leads', {
      where: { stage: { in: ['new', 'curation', 'proposal', 'negotiation', 'won'] } } as Where,
      sort: 'nextActionAt',
      limit: 200,
      depth: 0,
      select: { id: true, name: true, stage: true, nextAction: true, nextActionAt: true },
    })
    const stages = ['new', 'curation', 'proposal', 'negotiation', 'won']

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Pipeline comercial" subtitle="Etapas reais dos leads. O quadro não contém cards demonstrativos." actions={<TechnicalLink href="/admin/collections/leads/create" primary>Novo lead</TechnicalLink>} />
      <div className="esmera-pipeline">
        {stages.map((stage) => {
          const leads = result.docs.filter((lead) => lead.stage === stage)
          return <section className="esmera-pipeline-column" key={stage}><div className="esmera-pipeline-head"><span>{stageLabels[stage]}</span><span className={`esmera-pill ${stage === 'won' ? 'esmera-pill--green' : ''}`}>{leads.length}</span></div>{leads.map((lead) => <a className="esmera-pipeline-card" href={`/admin/collections/leads/${lead.id}`} key={String(lead.id)} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}><strong>{lead.name || 'Lead sem nome'}</strong><span>{lead.nextAction || 'Sem próxima ação'}{lead.nextActionAt ? ` · ${shortDate(lead.nextActionAt)}` : ''}</span></a>)}</section>
        })}
      </div>
      <div className="esmera-kpi-meta">Fonte: leads.stage · leitura atual. Leads perdidos permanecem no Admin técnico e relatórios, mas não ocupam uma coluna operacional.</div>
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Pipeline" subtitle="Business" /><QueryError title="Não foi possível consultar o pipeline" error={error} /></ViewFrame>
  }
}
