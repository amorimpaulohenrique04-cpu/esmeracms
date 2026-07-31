import type { AdminViewServerProps, Where } from 'payload'
import { eligibleSaleStatuses } from '../../collections/Sales'
import {
  AccessDenied,
  EmptyState,
  ensureUser,
  findDocs,
  money,
  monthStartISO,
  PageHeader,
  QueryError,
  shortDate,
  TechnicalLink,
  ViewFrame,
} from './shared'

type Customer = { id: string | number; name?: string; phone?: string; email?: string; city?: string; state?: string; updatedAt?: string }
type Sale = { id: string | number; number?: string; status?: string; totalCents?: number; channel?: string; customer?: Customer | string | number; expectedDeliveryAt?: string; createdAt?: string; confirmedAt?: string }
type Lead = { id: string | number; name?: string; stage?: string; source?: string; owner?: string; nextAction?: string; nextActionAt?: string; createdAt?: string; closedAt?: string }
type FollowUp = { status?: string; dueAt?: string; purpose?: string; moment?: string }
type AfterSale = { id: string | number; status?: string; priority?: string; customer?: Customer | string | number; sale?: Sale | string | number; followUps?: FollowUp[]; expectedDeliveryAt?: string; deliveredAt?: string; incidentType?: string }

const stageLabels: Record<string, string> = {
  new: 'Novo',
  curation: 'Curadoria',
  proposal: 'Proposta',
  negotiation: 'Negociação',
  won: 'Ganho',
}

const sourceLabels: Record<string, string> = {
  instagram: 'Instagram', referral: 'Indicação', site: 'Site', architect: 'Arquiteto', organic: 'Orgânico', whatsapp: 'WhatsApp', other: 'Outro',
}

const channelLabels: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', site: 'Site', referral: 'Indicação', architect: 'Arquiteto', other: 'Outro',
}

function customerName(value: Sale['customer'] | AfterSale['customer']) {
  return value && typeof value === 'object' ? value.name || 'Cliente' : 'Cliente'
}

export async function CustomersView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const result = await findDocs<Customer>(props.initPageResult.req, 'customers', { sort: '-updatedAt', limit: 200, depth: 0 })
    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Clientes" subtitle="Relacionamento, preferências e histórico comercial em uma fonte autenticada." actions={<TechnicalLink href="/admin/collections/customers/create" primary>Novo cliente</TechnicalLink>} />
      <section className="esmera-card"><div className="esmera-card-header"><h2>Base de clientes</h2><span className="esmera-pill esmera-pill--green">{result.totalDocs} clientes</span></div>{result.docs.length ? <ul className="esmera-list">{result.docs.map((customer) => <li className="esmera-list-row" key={String(customer.id)}><div><a className="esmera-row-title" href={`/admin/collections/customers/${customer.id}`}>{customer.name || 'Cliente sem nome'}</a><span className="esmera-row-meta">{customer.phone || customer.email || 'Sem contato'} · {[customer.city, customer.state].filter(Boolean).join(' / ') || 'Local não informado'}</span></div><span className="esmera-pill">{shortDate(customer.updatedAt)}</span></li>)}</ul> : <EmptyState title="Nenhum cliente" copy="A consulta foi concluída e a base ainda está vazia." />}</section>
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Clientes" subtitle="Business" /><QueryError title="Não foi possível consultar clientes" error={error} /></ViewFrame> }
}

export async function SalesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const result = await findDocs<Sale>(props.initPageResult.req, 'sales', { sort: '-createdAt', limit: 200, depth: 1 })
    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Vendas" subtitle="Pedidos, valores registrados e entrega. Rascunhos e cancelamentos não entram nas métricas de receita." actions={<TechnicalLink href="/admin/collections/sales/create" primary>Nova venda</TechnicalLink>} />
      <section className="esmera-card"><div className="esmera-card-header"><h2>Vendas</h2><span className="esmera-pill">{result.totalDocs} registros</span></div>{result.docs.length ? <ul className="esmera-list">{result.docs.map((sale) => <li className="esmera-list-row" key={String(sale.id)}><div><a className="esmera-row-title" href={`/admin/collections/sales/${sale.id}`}>Venda #{sale.number || '—'} · {customerName(sale.customer)}</a><span className="esmera-row-meta">{channelLabels[sale.channel || ''] || sale.channel || 'canal não informado'} · entrega {shortDate(sale.expectedDeliveryAt)}</span></div><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span className={`esmera-pill ${eligibleSaleStatuses.includes((sale.status || '') as typeof eligibleSaleStatuses[number]) ? 'esmera-pill--green' : sale.status === 'cancelled' ? 'esmera-pill--red' : 'esmera-pill--sand'}`}>{sale.status || '—'}</span><strong style={{ fontSize: 12 }}>{money(sale.totalCents)}</strong></div></li>)}</ul> : <EmptyState title="Nenhuma venda" copy="A consulta foi concluída e ainda não existem vendas." />}</section>
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Vendas" subtitle="Business" /><QueryError title="Não foi possível consultar vendas" error={error} /></ViewFrame> }
}

export async function PipelineView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const result = await findDocs<Lead>(props.initPageResult.req, 'leads', { where: { stage: { in: ['new', 'curation', 'proposal', 'negotiation', 'won'] } } as Where, sort: 'nextActionAt', limit: 500, depth: 0 })
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
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Pipeline" subtitle="Business" /><QueryError title="Não foi possível consultar o pipeline" error={error} /></ViewFrame> }
}

export async function AfterSalesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const result = await findDocs<AfterSale>(props.initPageResult.req, 'after-sales', { sort: '-updatedAt', limit: 300, depth: 1 })
    const now = new Date()
    const dateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    const today = dateKey(now)
    const followups = result.docs.flatMap((item) => item.followUps || [])
    const todayCount = followups.filter((follow) => follow.status === 'pending' && follow.dueAt && dateKey(new Date(follow.dueAt)) === today).length
    const overdue = followups.filter((follow) => follow.status === 'pending' && follow.dueAt && new Date(follow.dueAt) < now).length
    const incidents = result.docs.filter((item) => item.incidentType && item.incidentType !== 'none' && !['resolved', 'closed'].includes(item.status || '')).length
    const deliveries = result.docs.filter((item) => !item.deliveredAt && !['resolved', 'closed'].includes(item.status || '')).length
    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Pós-venda" subtitle="Entregas, follow-ups e ocorrências com contagens semânticas explícitas." actions={<TechnicalLink href="/admin/collections/after-sales/create" primary>Novo acompanhamento</TechnicalLink>} />
      <div className="esmera-metric-grid">
        <article className="esmera-metric esmera-metric--green"><span>Follow-ups hoje</span><strong>{todayCount}</strong><small>Itens de followUps pendentes com prazo na data de hoje.</small></article>
        <article className="esmera-metric esmera-metric--red"><span>Follow-ups atrasados</span><strong>{overdue}</strong><small>Itens pendentes cujo prazo já passou.</small></article>
        <article className="esmera-metric esmera-metric--red"><span>Ocorrências abertas</span><strong>{incidents}</strong><small>Casos com incidentType e status ainda não resolvido/encerrado.</small></article>
        <article className="esmera-metric esmera-metric--blue"><span>Entregas acompanhadas</span><strong>{deliveries}</strong><small>Casos abertos ainda sem entrega realizada.</small></article>
      </div>
      <section className="esmera-card"><div className="esmera-card-header"><h2>Fila operacional</h2><span className="esmera-pill">{result.totalDocs} casos</span></div>{result.docs.length ? <ul className="esmera-list">{result.docs.map((item) => { const pending = (item.followUps || []).filter((follow) => follow.status === 'pending').sort((a,b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0]; return <li className="esmera-list-row" key={String(item.id)}><div><a className="esmera-row-title" href={`/admin/collections/after-sales/${item.id}`}>{customerName(item.customer)}</a><span className="esmera-row-meta">Próximo follow-up: {pending?.purpose || 'não definido'} · {shortDate(pending?.dueAt)}</span></div><span className={`esmera-pill ${item.priority === 'urgent' || item.priority === 'high' ? 'esmera-pill--red' : ''}`}>{item.priority || 'normal'}</span></li> })}</ul> : <EmptyState title="Nenhum acompanhamento" copy="A consulta foi concluída e a fila está vazia." />}</section>
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Pós-venda" subtitle="Business" /><QueryError title="Não foi possível consultar o pós-venda" error={error} /></ViewFrame> }
}

export async function ReportsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const req = props.initPageResult.req
    const from = monthStartISO()
    const [leadResult, closedLeadResult, saleResult] = await Promise.all([
      findDocs<Lead>(req, 'leads', { where: { createdAt: { greater_than_equal: from } } as Where, limit: 1000, depth: 0 }),
      findDocs<Lead>(req, 'leads', { where: { and: [{ closedAt: { greater_than_equal: from } }, { stage: { in: ['won', 'lost'] } }] } as Where, limit: 1000, depth: 0 }),
      findDocs<Sale>(req, 'sales', { where: { and: [{ confirmedAt: { greater_than_equal: from } }, { status: { in: [...eligibleSaleStatuses] } }] } as Where, limit: 1000, depth: 0 }),
    ])
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
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Relatórios" subtitle="Business" /><QueryError title="Não foi possível gerar os relatórios" error={error} /></ViewFrame> }
}
