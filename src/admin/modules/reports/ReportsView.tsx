/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps } from 'payload'

import { getReportingOverview } from '../../../server/reporting'
import {
  AccessDenied,
  EmptyState,
  ensureUser,
  money,
  PageHeader,
  QueryError,
  shortDate,
  ViewFrame,
} from '../../views/shared'

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
    const report = await getReportingOverview(props.initPageResult.req)
    const metrics = report.metrics.current
    const ended = metrics.wonOpportunities + metrics.lostOpportunities
    const conversion = metrics.conversionRate === null ? 'Sem base' : `${Math.round(metrics.conversionRate * 100)}%`
    const sourceCounts = report.leadAcquisition.sources
    const channelCounts = report.channels
    const maxSource = Math.max(1, ...sourceCounts.map((source) => source.leads))
    const maxChannel = Math.max(1, ...channelCounts.map((channel) => channel.sales))

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Relatórios" subtitle="Aquisição deriva de Leads; funil comercial deriva de Opportunities; receita deriva de Sales. As métricas são centralizadas no Reporting Service." />
      <div className="esmera-metric-grid">
        <article className="esmera-metric esmera-metric--blue"><span>Leads no mês</span><strong>{report.leadAcquisition.total}</strong><small>Fonte: leads.createdAt na janela normalizada.</small></article>
        <article className="esmera-metric esmera-metric--green"><span>Vendas válidas no mês</span><strong>{metrics.validSales}</strong><small>confirmedAt no período + status comercial elegível.</small></article>
        <article className="esmera-metric"><span>Receita registrada</span><strong>{money(metrics.revenueCents)}</strong><small>Soma de sales.totalCents das mesmas vendas válidas.</small></article>
        <article className="esmera-metric"><span>Conversão de encerradas</span><strong>{conversion}</strong><small>{ended ? `${metrics.wonOpportunities} ganhos / ${ended} oportunidades encerradas no período.` : 'Nenhuma Opportunity com closedAt na janela efetiva; percentual não calculado.'}</small></article>
      </div>
      <div className="esmera-grid-equal">
        <section className="esmera-card"><div className="esmera-card-header"><h2>Origem dos leads</h2></div><div className="esmera-card-body">{sourceCounts.length ? sourceCounts.map((source) => <div className="esmera-report-bar" key={source.source}><div className="esmera-report-bar-head"><span>{sourceLabels[source.source] || source.source}</span><strong>{source.leads}</strong></div><div className="esmera-report-bar-track"><div className="esmera-report-bar-fill" style={{ width: `${Math.max(3, source.leads / maxSource * 100)}%` }} /></div></div>) : <EmptyState title="Sem leads no período" copy="A consulta foi concluída sem registros." />}</div></section>
        <section className="esmera-card"><div className="esmera-card-header"><h2>Canais das vendas válidas</h2></div><div className="esmera-card-body">{channelCounts.length ? channelCounts.map((channel) => <div className="esmera-report-bar" key={channel.channel}><div className="esmera-report-bar-head"><span>{channelLabels[channel.channel] || channel.channel}</span><strong>{channel.sales}</strong></div><div className="esmera-report-bar-track"><div className="esmera-report-bar-fill" style={{ width: `${Math.max(3, channel.sales / maxChannel * 100)}%` }} /></div></div>) : <EmptyState title="Sem vendas válidas no período" copy="Rascunhos, propostas, negociações e cancelamentos não são contados." />}</div></section>
      </div>
      <div className="esmera-state"><strong>Fonte, janela e atualização</strong><p>Fonte: Payload/PostgreSQL, agregada no servidor por Drizzle. Período: {shortDate(report.filters.period.from)} a {shortDate(report.filters.period.to)}. Corte do funil: {shortDate(report.opportunityCutoverAt)}. Contrato: {report.semanticVersion}.</p><small>Nenhum percentual é fixo. Oportunidades migradas sem início verificável não são tratadas como novas nem entram artificialmente no ciclo médio. Analytics de tráfego permanece fora deste relatório até existir integração real.</small></div>
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Relatórios" subtitle="Business" /><QueryError title="Não foi possível gerar os relatórios" error={error} /></ViewFrame>
  }
}
