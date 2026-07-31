/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'

import { eligibleSaleStatuses } from '../../../collections/Sales'
import {
  AccessDenied,
  EmptyState,
  ensureUser,
  findAllDocs,
  money,
  monthStartISO,
  PageHeader,
  QueryError,
  ViewFrame,
} from '../../views/shared'

type Sale = { id: string | number; totalCents?: number; channel?: string }
type Lead = { id: string | number; stage?: string; source?: string }

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram',
  referral: 'Indicação',
  site: 'Site',
  architect: 'Arquiteto',
  organic: 'Orgânico',
  whatsapp: 'WhatsApp',
  other: 'Outro',
}

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  site: 'Site',
  referral: 'Indicação',
  architect: 'Arquiteto',
  other: 'Outro',
}

export async function ReportsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  try {
    const req = props.initPageResult.req
    const from = monthStartISO()
    const [leadDocs, closedLeadDocs, saleDocs] = await Promise.all([
      findAllDocs<Lead>(req, 'leads', {
        where: { createdAt: { greater_than_equal: from } } as Where,
        depth: 0,
        select: { id: true, source: true },
      }),
      findAllDocs<Lead>(req, 'leads', {
        where: {
          and: [
            { closedAt: { greater_than_equal: from } },
            { stage: { in: ['won', 'lost'] } },
          ],
        } as Where,
        depth: 0,
        select: { id: true, stage: true },
      }),
      findAllDocs<Sale>(req, 'sales', {
        where: {
          and: [
            { confirmedAt: { greater_than_equal: from } },
            { status: { in: [...eligibleSaleStatuses] } },
          ],
        } as Where,
        depth: 0,
        select: { id: true, totalCents: true, channel: true },
      }),
    ])

    const leadResult = { docs: leadDocs, totalDocs: leadDocs.length }
    const closedLeadResult = { docs: closedLeadDocs, totalDocs: closedLeadDocs.length }
    const saleResult = { docs: saleDocs, totalDocs: saleDocs.length }
    const revenue = saleResult.docs.reduce((sum, sale) => sum + (sale.totalCents || 0), 0)
    const won = closedLeadResult.docs.filter((lead) => lead.stage === 'won').length
    const lost = closedLeadResult.docs.filter((lead) => lead.stage === 'lost').length
    const ended = won + lost
    const conversion = ended ? `${Math.round((won / ended) * 100)}%` : 'Sem base'
    const sourceCounts = Object.entries(leadResult.docs.reduce<Record<string, number>>((acc, lead) => { const key = lead.source || 'other'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a,b) => b[1] - a[1])
    const channelCounts = Object.entries(saleResult.docs.reduce<Record<string, number>>((acc, sale) => { const key = sale.channel || 'other'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a,b) => b[1] - a[1])
    const maxSource = Math.max(1, ...sourceCounts.map(([,count]) => count))
    const maxChannel = Math.max(1, ...channelCounts.map(([,count]) => count))

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Relatórios" subtitle="Indicadores derivados de consultas documentadas no período atual. Nenhum percentual é fixo." />
      <div className="esmera-metric-grid">
        <article className="esmera-metric esmera-metric--blue"><span>Leads no mês</span><strong>{leadResult.totalDocs}</strong><small>Fonte: leads.createdAt ≥ início do mês.</small></article>
        <article className="esmera-metric esmera-metric--green"><span>Vendas válidas no mês</span><strong>{saleResult.totalDocs}</strong><small>confirmedAt no mês + status confirmed, production, ready ou delivered.</small></article>
        <article className="esmera-metric"><span>Receita registrada</span><strong>{money(revenue)}</strong><small>Soma de sales.totalCents dos mesmos status elegíveis.</small></article>
        <article className="esmera-metric"><span>Conversão de encerrados</span><strong>{conversion}</strong><small>{ended ? `${won} ganhos / ${ended} leads encerrados (ganho + perdido) no mês.` : 'Nenhum lead encerrado no período; percentual não calculado.'}</small></article>
      </div>
      <div className="esmera-grid-equal">
        <section className="esmera-card"><div className="esmera-card-header"><h2>Origem dos leads</h2></div><div className="esmera-card-body">{sourceCounts.length ? sourceCounts.map(([source,count]) => <div className="esmera-report-bar" key={source}><div className="esmera-report-bar-head"><span>{sourceLabels[source] || source}</span><strong>{count}</strong></div><div className="esmera-report-bar-track"><div className="esmera-report-bar-fill" style={{ width: `${Math.max(3, count / maxSource * 100)}%` }} /></div></div>) : <EmptyState title="Sem leads no período" copy="A consulta foi concluída sem registros." />}</div></section>
        <section className="esmera-card"><div className="esmera-card-header"><h2>Canais das vendas válidas</h2></div><div className="esmera-card-body">{channelCounts.length ? channelCounts.map(([channel,count]) => <div className="esmera-report-bar" key={channel}><div className="esmera-report-bar-head"><span>{channelLabels[channel] || channel}</span><strong>{count}</strong></div><div className="esmera-report-bar-track"><div className="esmera-report-bar-fill" style={{ width: `${Math.max(3, count / maxChannel * 100)}%` }} /></div></div>) : <EmptyState title="Sem vendas válidas no período" copy="Rascunhos, propostas, negociações e cancelamentos não são contados." />}</div></section>
      </div>
      <div className="esmera-state"><strong>Fonte e atualização</strong><p>Fonte: Payload/PostgreSQL. Período: do primeiro dia do mês até agora; vendas usam confirmedAt e conversão usa closedAt. Atualização: no carregamento desta página.</p><small>Analytics de tráfego permanece fora deste relatório até existir integração verificável.</small></div>
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Relatórios" subtitle="Business" /><QueryError title="Não foi possível gerar os relatórios" error={error} /></ViewFrame>
  }
}
