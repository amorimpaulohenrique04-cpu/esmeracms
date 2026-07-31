/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'

import { eligibleSaleStatuses } from '../../collections/Sales'
import { PipelineBoard, type PipelineLead } from '../components/PipelineBoard'
import {
  AccessDenied,
  countDocs,
  EmptyState,
  ensureUser,
  findAllDocs,
  findDocs,
  hrefWithParams,
  MasterDetailLayout,
  money,
  PageHeader,
  Pagination,
  paramValue,
  positiveInt,
  QueryError,
  resolveSearchParams,
  shortDate,
  StatusBadge,
  TechnicalLink,
  ViewFrame,
} from './shared'

type User = { id?: string | number; name?: string | null; email?: string | null }
type Customer = {
  id: string | number
  name?: string | null
  phone?: string | null
  email?: string | null
  city?: string | null
  state?: string | null
  relationshipNotes?: string | null
  preferences?: Array<{ value?: string | null }> | null
  tags?: Array<{ value?: string | null }> | null
  updatedAt?: string | null
}
type SaleItem = { snapshotTitle?: string | null; snapshotSelection?: string | null; quantity?: number | null; unitPriceCents?: number | null; priceMode?: string | null }
type Sale = {
  id: string | number
  number?: string | null
  status?: string | null
  totalCents?: number | null
  subtotalCents?: number | null
  discountCents?: number | null
  shippingCents?: number | null
  channel?: string | null
  customer?: Customer | string | number | null
  ownerUser?: User | string | number | null
  expectedDeliveryAt?: string | null
  deliveredAt?: string | null
  nextAction?: string | null
  nextActionAt?: string | null
  confirmedAt?: string | null
  items?: SaleItem[] | null
  createdAt?: string | null
}
type Lead = {
  id: string | number
  name?: string | null
  stage?: string | null
  source?: string | null
  ownerUser?: User | string | number | null
  nextAction?: string | null
  nextActionAt?: string | null
  createdAt?: string | null
  closedAt?: string | null
}
type FollowUp = { status?: string | null; dueAt?: string | null; purpose?: string | null; moment?: string | null; completedAt?: string | null }
type AfterSale = {
  id: string | number
  status?: string | null
  priority?: string | null
  customer?: Customer | string | number | null
  sale?: Sale | string | number | null
  ownerUser?: User | string | number | null
  followUps?: FollowUp[] | null
  incidentType?: string | null
  incidentDetails?: string | null
  resolution?: string | null
  deliveryNotes?: string | null
  updatedAt?: string | null
}

const stageLabels: Record<string, string> = { new: 'Novo', curation: 'Curadoria', proposal: 'Proposta', negotiation: 'Negociação', won: 'Ganho', lost: 'Perdido' }
const sourceLabels: Record<string, string> = { instagram: 'Instagram', referral: 'Indicação', site: 'Site', architect: 'Arquiteto', organic: 'Orgânico', whatsapp: 'WhatsApp', other: 'Outro' }
const channelLabels: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', site: 'Site', referral: 'Indicação', architect: 'Arquiteto', other: 'Outro' }
const saleStatusLabels: Record<string, string> = { draft: 'Rascunho', proposal: 'Proposta', negotiation: 'Negociação', confirmed: 'Confirmada', production: 'Em produção', ready: 'Pronta', delivered: 'Entregue', cancelled: 'Cancelada' }
const priorityLabels: Record<string, string> = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }

function relationName(value: User | Customer | string | number | null | undefined, fallback = '—') {
  return value && typeof value === 'object' ? value.name || ('email' in value ? value.email : null) || fallback : fallback
}

function customerName(value: Sale['customer'] | AfterSale['customer']) {
  return value && typeof value === 'object' ? value.name || 'Cliente' : 'Cliente'
}

function saleStatusTone(status?: string | null): 'neutral' | 'green' | 'blue' | 'red' | 'sand' {
  if (status === 'delivered' || status === 'ready') return 'green'
  if (status === 'confirmed' || status === 'production') return 'blue'
  if (status === 'cancelled') return 'red'
  if (status === 'proposal' || status === 'negotiation') return 'sand'
  return 'neutral'
}

function periodStart(period: string) {
  const now = new Date()
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000).toISOString()
  if (period === '90d') return new Date(now.getTime() - 90 * 86400000).toISOString()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export async function CustomersView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const req = props.initPageResult.req
    const params = await resolveSearchParams(props)
    const q = paramValue(params, 'q').trim()
    const page = positiveInt(paramValue(params, 'page'), 1)
    const where = q ? ({ or: [{ name: { contains: q } }, { phone: { contains: q } }, { email: { contains: q } }, { city: { contains: q } }] } as Where) : undefined
    const result = await findDocs<Customer>(req, 'customers', { where, sort: '-updatedAt', limit: 25, page, depth: 0, select: { id: true, name: true, phone: true, email: true, city: true, state: true, updatedAt: true } })
    const selectedId = paramValue(params, 'selected') || (result.docs[0] ? String(result.docs[0].id) : '')
    const tab = paramValue(params, 'tab', 'overview')
    const selected = selectedId ? (await req.payload.findByID({ collection: 'customers', id: selectedId, depth: 1, overrideAccess: false, req })) as Customer : null
    const [sales, afterSales] = selected ? await Promise.all([
      findDocs<Sale>(req, 'sales', { where: { customer: { equals: selected.id } } as Where, sort: '-createdAt', limit: 8, depth: 1, select: { id: true, number: true, status: true, totalCents: true, createdAt: true } }),
      findDocs<AfterSale>(req, 'after-sales', { where: { customer: { equals: selected.id } } as Where, sort: '-updatedAt', limit: 8, depth: 1, select: { id: true, status: true, priority: true, updatedAt: true } }),
    ]) : [null, null]
    const whatsapp = selected?.phone ? `https://wa.me/${selected.phone.replace(/\D/g, '')}` : null

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Clientes" subtitle="Workspace de relacionamento com histórico derivado das Collections relacionadas, sem duplicar vendas ou pós-venda no cliente." actions={<TechnicalLink href="/admin/collections/customers/create" primary>Novo cliente</TechnicalLink>} />
      <div className="esmera-toolbar"><form action="/admin/customers" method="get"><input className="esmera-input" name="q" defaultValue={q} placeholder="Buscar nome, telefone, e-mail ou cidade" aria-label="Buscar clientes" /><button className="esmera-button" type="submit">Buscar</button></form><a className="esmera-toolbar-reset" href="/admin/customers">Limpar</a></div>
      <MasterDetailLayout
        master={<><div className="esmera-master-head"><span>{result.totalDocs} cliente{result.totalDocs === 1 ? '' : 's'}</span><span>Atualização</span></div>{result.docs.length ? <ul className="esmera-master-list">{result.docs.map((customer) => <li key={String(customer.id)}><a className={`esmera-master-row${String(customer.id) === selectedId ? ' is-selected' : ''}`} href={hrefWithParams('/admin/customers', params, { selected: customer.id, page: result.page })}><div><strong>{customer.name || 'Cliente sem nome'}</strong><small>{customer.phone || customer.email || 'Sem contato'} · {[customer.city, customer.state].filter(Boolean).join(' / ') || 'Local não informado'}</small></div><span className="esmera-row-meta">{shortDate(customer.updatedAt)}</span></a></li>)}</ul> : <EmptyState title="Nenhum cliente encontrado" copy={q ? 'Nenhum cliente corresponde à busca.' : 'A base ainda está vazia.'} />}<Pagination path="/admin/customers" params={params} page={result.page} totalPages={result.totalPages} totalDocs={result.totalDocs} /></>}
        detail={selected ? <div className="esmera-detail-inner"><span className="esmera-detail-kicker">Relacionamento</span><h2 className="esmera-detail-title">{selected.name || 'Cliente sem nome'}</h2><p className="esmera-detail-subtitle">{selected.phone || selected.email || 'Sem contato'} · {[selected.city, selected.state].filter(Boolean).join(' / ') || 'Local não informado'}</p><div className="esmera-detail-actions"><TechnicalLink href={`/admin/collections/customers/${selected.id}`} primary>Editar cliente</TechnicalLink>{whatsapp ? <a className="esmera-button" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a> : null}</div><nav className="esmera-detail-tabs" aria-label="Detalhes do cliente">{[['overview','Visão geral'],['sales','Vendas'],['after-sales','Pós-venda'],['notes','Notas']].map(([value,label]) => <a key={value} className={tab === value ? 'is-active' : ''} href={hrefWithParams('/admin/customers', params, { selected: selected.id, tab: value })}>{label}</a>)}</nav>
          {tab === 'overview' ? <div className="esmera-detail-grid"><div className="esmera-detail-field"><span>Telefone</span><strong>{selected.phone || '—'}</strong></div><div className="esmera-detail-field"><span>E-mail</span><strong>{selected.email || '—'}</strong></div><div className="esmera-detail-field"><span>Vendas registradas</span><strong>{sales?.totalDocs || 0}</strong></div><div className="esmera-detail-field"><span>Casos de pós-venda</span><strong>{afterSales?.totalDocs || 0}</strong></div><div className="esmera-detail-field"><span>Tags</span><strong>{selected.tags?.map((item) => item.value).filter(Boolean).join(', ') || '—'}</strong></div><div className="esmera-detail-field"><span>Preferências</span><strong>{selected.preferences?.map((item) => item.value).filter(Boolean).join(', ') || '—'}</strong></div></div> : null}
          {tab === 'sales' ? <div className="esmera-detail-section"><h3>Vendas recentes</h3>{sales?.docs.length ? <ul className="esmera-list">{sales.docs.map((sale) => <li className="esmera-list-row" key={String(sale.id)}><div><a className="esmera-row-title" href={`/admin/sales?selected=${sale.id}`}>Venda #{sale.number || '—'}</a><span className="esmera-row-meta">{shortDate(sale.createdAt)}</span></div><strong>{money(sale.totalCents)}</strong></li>)}</ul> : <EmptyState title="Sem vendas" copy="Nenhuma venda está relacionada a este cliente." />}</div> : null}
          {tab === 'after-sales' ? <div className="esmera-detail-section"><h3>Pós-venda</h3>{afterSales?.docs.length ? <ul className="esmera-list">{afterSales.docs.map((item) => <li className="esmera-list-row" key={String(item.id)}><div><a className="esmera-row-title" href={`/admin/after-sales?selected=${item.id}`}>Acompanhamento #{item.id}</a><span className="esmera-row-meta">Atualizado {shortDate(item.updatedAt)}</span></div><StatusBadge tone={item.priority === 'high' || item.priority === 'urgent' ? 'red' : 'neutral'}>{priorityLabels[item.priority || ''] || item.priority || 'Normal'}</StatusBadge></li>)}</ul> : <EmptyState title="Sem pós-venda" copy="Nenhum caso está relacionado a este cliente." />}</div> : null}
          {tab === 'notes' ? <div className="esmera-detail-section"><h3>Notas do relacionamento</h3><p className="esmera-card-copy">{selected.relationshipNotes || 'Nenhuma nota registrada.'}</p></div> : null}
        </div> : <EmptyState title="Selecione um cliente" copy="O histórico e as ações aparecem aqui." />}
      />
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Clientes" subtitle="Business" /><QueryError title="Não foi possível consultar clientes" error={error} /></ViewFrame> }
}

export async function SalesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const req = props.initPageResult.req
    const params = await resolveSearchParams(props)
    const q = paramValue(params, 'q').trim()
    const status = paramValue(params, 'status')
    const channel = paramValue(params, 'channel')
    const page = positiveInt(paramValue(params, 'page'), 1)
    const conditions: Where[] = []
    if (q) conditions.push({ number: { contains: q } } as Where)
    if (status) conditions.push({ status: { equals: status } } as Where)
    if (channel) conditions.push({ channel: { equals: channel } } as Where)
    const where = conditions.length ? ({ and: conditions } as Where) : undefined
    const result = await findDocs<Sale>(req, 'sales', { where, sort: '-createdAt', limit: 25, page, depth: 1, select: { id: true, number: true, status: true, totalCents: true, channel: true, customer: true, expectedDeliveryAt: true, createdAt: true } })
    const selectedId = paramValue(params, 'selected') || (result.docs[0] ? String(result.docs[0].id) : '')
    const selected = selectedId ? (await req.payload.findByID({ collection: 'sales', id: selectedId, depth: 2, overrideAccess: false, req })) as Sale : null
    const progress = ['confirmed','production','ready','delivered']
    const progressIndex = selected ? progress.indexOf(selected.status || '') : -1

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Vendas" subtitle="Pedidos, valores íntegros e entrega em um workspace operacional. Snapshots e totais são calculados no servidor." actions={<TechnicalLink href="/admin/collections/sales/create" primary>Nova venda</TechnicalLink>} />
      <div className="esmera-toolbar"><form action="/admin/sales" method="get"><input className="esmera-input" name="q" defaultValue={q} placeholder="Buscar número da venda" aria-label="Buscar vendas" /><select className="esmera-select" name="status" defaultValue={status}><option value="">Todos os status</option>{Object.entries(saleStatusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select className="esmera-select" name="channel" defaultValue={channel}><option value="">Todos os canais</option>{Object.entries(channelLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button className="esmera-button" type="submit">Aplicar</button></form><a className="esmera-toolbar-reset" href="/admin/sales">Limpar</a></div>
      <MasterDetailLayout
        master={<><div className="esmera-master-head"><span>{result.totalDocs} venda{result.totalDocs === 1 ? '' : 's'}</span><span>Mais recentes</span></div>{result.docs.length ? <ul className="esmera-master-list">{result.docs.map((sale) => <li key={String(sale.id)}><a className={`esmera-master-row${String(sale.id) === selectedId ? ' is-selected' : ''}`} href={hrefWithParams('/admin/sales', params, { selected: sale.id, page: result.page })}><div><strong>Venda #{sale.number || '—'} · {customerName(sale.customer)}</strong><small>{channelLabels[sale.channel || ''] || 'Canal não informado'} · {shortDate(sale.createdAt)}</small></div><div className="esmera-master-row-meta"><StatusBadge tone={saleStatusTone(sale.status)}>{saleStatusLabels[sale.status || ''] || sale.status || '—'}</StatusBadge><strong>{money(sale.totalCents)}</strong></div></a></li>)}</ul> : <EmptyState title="Nenhuma venda encontrada" copy={q || status || channel ? 'Nenhuma venda corresponde aos filtros.' : 'Ainda não existem vendas.'} />}<Pagination path="/admin/sales" params={params} page={result.page} totalPages={result.totalPages} totalDocs={result.totalDocs} /></>}
        detail={selected ? <div className="esmera-detail-inner"><span className="esmera-detail-kicker">Venda #{selected.number || '—'}</span><h2 className="esmera-detail-title">{customerName(selected.customer)}</h2><p className="esmera-detail-subtitle">{channelLabels[selected.channel || ''] || 'Canal não informado'} · responsável {relationName(selected.ownerUser)}</p><div className="esmera-detail-actions"><TechnicalLink href={`/admin/collections/sales/${selected.id}`} primary>Editar venda</TechnicalLink><StatusBadge tone={saleStatusTone(selected.status)}>{saleStatusLabels[selected.status || ''] || selected.status || '—'}</StatusBadge></div>
          <div className="esmera-sale-progress">{progress.map((stage,index) => <div className={`esmera-sale-step${index <= progressIndex ? ' is-complete' : ''}`} key={stage}><span>{index + 1}</span><strong>{saleStatusLabels[stage]}</strong></div>)}</div>
          <div className="esmera-detail-grid"><div className="esmera-detail-field"><span>Subtotal</span><strong>{money(selected.subtotalCents)}</strong></div><div className="esmera-detail-field"><span>Total</span><strong>{money(selected.totalCents)}</strong></div><div className="esmera-detail-field"><span>Desconto</span><strong>{money(selected.discountCents)}</strong></div><div className="esmera-detail-field"><span>Frete</span><strong>{money(selected.shippingCents)}</strong></div><div className="esmera-detail-field"><span>Entrega prevista</span><strong>{shortDate(selected.expectedDeliveryAt)}</strong></div><div className="esmera-detail-field"><span>Entrega realizada</span><strong>{shortDate(selected.deliveredAt)}</strong></div></div>
          <div className="esmera-detail-section"><h3>Itens</h3>{selected.items?.length ? <ul className="esmera-list">{selected.items.map((item,index) => <li className="esmera-list-row" key={`${item.snapshotTitle}-${index}`}><div><strong className="esmera-row-title">{item.snapshotTitle || 'Item'}</strong><span className="esmera-row-meta">{item.snapshotSelection || 'Sem variante'} · qtd. {item.quantity || 1}</span></div><strong>{item.priceMode === 'fixed' ? money(item.unitPriceCents) : 'Sob consulta'}</strong></li>)}</ul> : <EmptyState title="Sem itens" copy="A venda não possui itens carregados." />}</div>
          {selected.nextAction ? <div className="esmera-detail-section"><h3>Próxima ação</h3><p className="esmera-card-copy">{selected.nextAction} · {shortDate(selected.nextActionAt)}</p></div> : null}
        </div> : <EmptyState title="Selecione uma venda" copy="Itens, valores, progresso e entrega aparecem aqui." />}
      />
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Vendas" subtitle="Business" /><QueryError title="Não foi possível consultar vendas" error={error} /></ViewFrame> }
}

export async function PipelineView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const req = props.initPageResult.req
    const stages = ['new', 'curation', 'proposal', 'negotiation', 'won']
    const stageResults = await Promise.all(stages.map((stage) => findDocs<Lead>(req, 'leads', { where: { stage: { equals: stage } } as Where, sort: 'nextActionAt', limit: 25, depth: 1, select: { id: true, name: true, stage: true, source: true, ownerUser: true, nextAction: true, nextActionAt: true } })))
    const totals = Object.fromEntries(stages.map((stage,index) => [stage, stageResults[index].totalDocs]))
    const leads: PipelineLead[] = stageResults.flatMap((result) => result.docs).map((lead) => ({ id: lead.id, name: lead.name || 'Lead sem nome', stage: lead.stage || 'new', source: lead.source, nextAction: lead.nextAction, nextActionAt: lead.nextActionAt, owner: relationName(lead.ownerUser, '') }))
    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Pipeline comercial" subtitle="Kanban operacional com atualização no próprio Lead. Drag é opcional: cada card também possui controle de movimento por teclado." actions={<TechnicalLink href="/admin/collections/leads/create" primary>Novo lead</TechnicalLink>} />
      <PipelineBoard initialLeads={leads} totals={totals} />
      <div className="esmera-kpi-meta">Fonte: leads.stage. Perdidos permanecem fora das colunas principais e continuam disponíveis no Admin técnico/relatórios.</div>
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Pipeline" subtitle="Business" /><QueryError title="Não foi possível consultar o pipeline" error={error} /></ViewFrame> }
}

export async function AfterSalesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const req = props.initPageResult.req
    const params = await resolveSearchParams(props)
    const status = paramValue(params, 'status')
    const priority = paramValue(params, 'priority')
    const page = positiveInt(paramValue(params, 'page'), 1)
    const conditions: Where[] = []
    if (status) conditions.push({ status: { equals: status } } as Where)
    if (priority) conditions.push({ priority: { equals: priority } } as Where)
    const where = conditions.length ? ({ and: conditions } as Where) : undefined

    const now = new Date().toISOString()
    const [result, overdue, incidents, openCases] = await Promise.all([
      findDocs<AfterSale>(req, 'after-sales', { where, sort: '-updatedAt', limit: 25, page, depth: 1, select: { id: true, status: true, priority: true, customer: true, sale: true, followUps: true, incidentType: true, updatedAt: true } }),
      countDocs(req, 'after-sales', { and: [{ 'followUps.status': { equals: 'pending' } }, { 'followUps.dueAt': { less_than: now } }] } as Where),
      countDocs(req, 'after-sales', { and: [{ incidentType: { not_equals: 'none' } }, { status: { in: ['open','following'] } }] } as Where),
      countDocs(req, 'after-sales', { status: { in: ['open','following'] } } as Where),
    ])
    const selectedId = paramValue(params, 'selected') || (result.docs[0] ? String(result.docs[0].id) : '')
    const selected = selectedId ? (await req.payload.findByID({ collection: 'after-sales', id: selectedId, depth: 2, overrideAccess: false, req })) as AfterSale : null
    const relatedSale = selected?.sale && typeof selected.sale === 'object' ? selected.sale : null
    const pending = (selected?.followUps || []).filter((followUp) => followUp.status === 'pending').sort((a,b) => String(a.dueAt).localeCompare(String(b.dueAt)))

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Pós-venda" subtitle="Fila de acompanhamento com entrega derivada da venda, follow-ups e ocorrências sem duplicar a fonte de verdade." actions={<TechnicalLink href="/admin/collections/after-sales/create" primary>Novo acompanhamento</TechnicalLink>} />
      <div className="esmera-metric-grid"><article className="esmera-metric esmera-metric--blue"><span>Casos abertos</span><strong>{openCases}</strong><small>Status aberto ou acompanhando.</small></article><article className="esmera-metric esmera-metric--red"><span>Follow-ups atrasados</span><strong>{overdue}</strong><small>Casos com follow-up pendente cujo prazo passou.</small></article><article className="esmera-metric esmera-metric--red"><span>Ocorrências abertas</span><strong>{incidents}</strong><small>Ocorrência registrada em caso ainda ativo.</small></article></div>
      <div className="esmera-toolbar"><form action="/admin/after-sales" method="get"><select className="esmera-select" name="status" defaultValue={status}><option value="">Todos os status</option><option value="open">Aberto</option><option value="following">Acompanhando</option><option value="resolved">Resolvido</option><option value="closed">Encerrado</option></select><select className="esmera-select" name="priority" defaultValue={priority}><option value="">Todas as prioridades</option>{Object.entries(priorityLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><button className="esmera-button" type="submit">Aplicar</button></form><a className="esmera-toolbar-reset" href="/admin/after-sales">Limpar</a></div>
      <MasterDetailLayout
        master={<><div className="esmera-master-head"><span>{result.totalDocs} caso{result.totalDocs === 1 ? '' : 's'}</span><span>Fila operacional</span></div>{result.docs.length ? <ul className="esmera-master-list">{result.docs.map((item) => { const next = (item.followUps || []).filter((follow) => follow.status === 'pending').sort((a,b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0]; return <li key={String(item.id)}><a className={`esmera-master-row${String(item.id) === selectedId ? ' is-selected' : ''}`} href={hrefWithParams('/admin/after-sales', params, { selected: item.id, page: result.page })}><div><strong>{customerName(item.customer)}</strong><small>{next?.purpose || 'Sem próxima ação'} · {shortDate(next?.dueAt)}</small></div><StatusBadge tone={item.priority === 'urgent' || item.priority === 'high' ? 'red' : 'neutral'}>{priorityLabels[item.priority || ''] || 'Normal'}</StatusBadge></a></li> })}</ul> : <EmptyState title="Nenhum acompanhamento" copy="A fila está vazia para os filtros escolhidos." />}<Pagination path="/admin/after-sales" params={params} page={result.page} totalPages={result.totalPages} totalDocs={result.totalDocs} /></>}
        detail={selected ? <div className="esmera-detail-inner"><span className="esmera-detail-kicker">Pós-venda #{selected.id}</span><h2 className="esmera-detail-title">{customerName(selected.customer)}</h2><p className="esmera-detail-subtitle">Venda #{relatedSale?.number || '—'} · responsável {relationName(selected.ownerUser)}</p><div className="esmera-detail-actions"><TechnicalLink href={`/admin/collections/after-sales/${selected.id}`} primary>Editar acompanhamento</TechnicalLink><StatusBadge tone={selected.priority === 'urgent' || selected.priority === 'high' ? 'red' : 'neutral'}>{priorityLabels[selected.priority || ''] || 'Normal'}</StatusBadge></div><div className="esmera-detail-grid"><div className="esmera-detail-field"><span>Entrega prevista</span><strong>{shortDate(relatedSale?.expectedDeliveryAt)}</strong></div><div className="esmera-detail-field"><span>Entrega realizada</span><strong>{shortDate(relatedSale?.deliveredAt)}</strong></div><div className="esmera-detail-field"><span>Próximo follow-up</span><strong>{pending[0]?.purpose || '—'} · {shortDate(pending[0]?.dueAt)}</strong></div><div className="esmera-detail-field"><span>Ocorrência</span><strong>{selected.incidentType && selected.incidentType !== 'none' ? selected.incidentType : 'Sem ocorrência'}</strong></div></div><div className="esmera-detail-section"><h3>Follow-ups</h3>{selected.followUps?.length ? <ul className="esmera-list">{selected.followUps.map((follow,index) => <li className="esmera-list-row" key={`${follow.dueAt}-${index}`}><div><strong className="esmera-row-title">{follow.purpose || 'Follow-up'}</strong><span className="esmera-row-meta">{follow.moment || 'Personalizado'} · {shortDate(follow.dueAt)}</span></div><StatusBadge tone={follow.status === 'done' ? 'green' : follow.status === 'pending' && follow.dueAt && new Date(follow.dueAt) < new Date() ? 'red' : 'neutral'}>{follow.status || '—'}</StatusBadge></li>)}</ul> : <EmptyState title="Sem follow-ups" copy="Nenhum follow-up foi cadastrado." />}</div>{selected.deliveryNotes ? <div className="esmera-detail-section"><h3>Observações</h3><p className="esmera-card-copy">{selected.deliveryNotes}</p></div> : null}</div> : <EmptyState title="Selecione um caso" copy="Entrega, follow-ups e ocorrência aparecem aqui." />}
      />
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Pós-venda" subtitle="Business" /><QueryError title="Não foi possível consultar o pós-venda" error={error} /></ViewFrame> }
}

export async function ReportsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />
  try {
    const req = props.initPageResult.req
    const params = await resolveSearchParams(props)
    const requestedPeriod = paramValue(params, 'period', 'month')
    const period = ['month','30d','90d'].includes(requestedPeriod) ? requestedPeriod : 'month'
    const from = periodStart(period)
    const [leadDocs, closedLeadDocs, saleDocs, stageCounts] = await Promise.all([
      findAllDocs<Lead>(req, 'leads', { where: { createdAt: { greater_than_equal: from } } as Where, depth: 0, select: { id: true, source: true } }),
      findAllDocs<Lead>(req, 'leads', { where: { and: [{ closedAt: { greater_than_equal: from } }, { stage: { in: ['won','lost'] } }] } as Where, depth: 0, select: { id: true, stage: true } }),
      findAllDocs<Sale>(req, 'sales', { where: { and: [{ confirmedAt: { greater_than_equal: from } }, { status: { in: [...eligibleSaleStatuses] } }] } as Where, depth: 0, select: { id: true, totalCents: true, channel: true } }),
      Promise.all(['new','curation','proposal','negotiation','won','lost'].map((stage) => countDocs(req, 'leads', { stage: { equals: stage } } as Where))),
    ])
    const revenue = saleDocs.reduce((sum,sale) => sum + (sale.totalCents || 0), 0)
    const won = closedLeadDocs.filter((lead) => lead.stage === 'won').length
    const lost = closedLeadDocs.filter((lead) => lead.stage === 'lost').length
    const ended = won + lost
    const conversion = ended ? `${Math.round((won / ended) * 100)}%` : 'Sem base'
    const sourceCounts = Object.entries(leadDocs.reduce<Record<string, number>>((acc, lead) => { const key = lead.source || 'other'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a,b) => b[1] - a[1])
    const channelCounts = Object.entries(saleDocs.reduce<Record<string, number>>((acc, sale) => { const key = sale.channel || 'other'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a,b) => b[1] - a[1])
    const maxSource = Math.max(1, ...sourceCounts.map(([,count]) => count))
    const maxChannel = Math.max(1, ...channelCounts.map(([,count]) => count))

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Business" title="Relatórios" subtitle="Métricas derivadas de fonte, período, população e fórmula explícitos — sem Analytics demonstrativo." />
      <div className="esmera-toolbar"><form action="/admin/reports" method="get"><select className="esmera-select" name="period" defaultValue={period}><option value="month">Mês atual</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option></select><button className="esmera-button" type="submit">Aplicar período</button></form></div>
      <div className="esmera-metric-grid"><article className="esmera-metric esmera-metric--blue"><span>Leads criados</span><strong>{leadDocs.length}</strong><small>createdAt ≥ início do período</small></article><article className="esmera-metric esmera-metric--green"><span>Vendas válidas</span><strong>{saleDocs.length}</strong><small>Status confirmado, produção, pronta ou entregue.</small></article><article className="esmera-metric esmera-metric--green"><span>Receita registrada</span><strong>{money(revenue)}</strong><small>Soma de totalCents validado nas vendas válidas.</small></article><article className="esmera-metric"><span>Conversão</span><strong>{conversion}</strong><small>won / (won + lost) encerrados no período.</small></article></div>
      <div className="esmera-grid-equal"><section className="esmera-card"><div className="esmera-card-header"><h2>Origem dos leads</h2><span className="esmera-pill">{leadDocs.length} leads</span></div><div className="esmera-card-body">{sourceCounts.length ? sourceCounts.map(([source,count]) => <div className="esmera-report-bar" key={source}><div className="esmera-report-bar-head"><span>{sourceLabels[source] || source}</span><strong>{count}</strong></div><div className="esmera-report-bar-track"><div className="esmera-report-bar-fill" style={{ width: `${Math.max(3, (count / maxSource) * 100)}%` }} /></div></div>) : <EmptyState title="Sem base" copy="Não há leads no período selecionado." />}</div></section><section className="esmera-card"><div className="esmera-card-header"><h2>Canal das vendas</h2><span className="esmera-pill">{saleDocs.length} vendas</span></div><div className="esmera-card-body">{channelCounts.length ? channelCounts.map(([channel,count]) => <div className="esmera-report-bar" key={channel}><div className="esmera-report-bar-head"><span>{channelLabels[channel] || channel}</span><strong>{count}</strong></div><div className="esmera-report-bar-track"><div className="esmera-report-bar-fill" style={{ width: `${Math.max(3, (count / maxChannel) * 100)}%` }} /></div></div>) : <EmptyState title="Sem base" copy="Não há vendas válidas no período selecionado." />}</div></section></div>
      <section className="esmera-card"><div className="esmera-card-header"><h2>Distribuição atual do pipeline</h2><span className="esmera-pill">Leitura atual</span></div><div className="esmera-card-body"><div className="esmera-report-stage-grid">{['new','curation','proposal','negotiation','won','lost'].map((stage,index) => <div key={stage}><span>{stageLabels[stage]}</span><strong>{stageCounts[index]}</strong></div>)}</div><div className="esmera-kpi-meta">Esta distribuição é uma fotografia atual. Os demais KPIs respeitam o período selecionado a partir de {shortDate(from)}.</div></div></section>
    </ViewFrame>
  } catch (error) { return <ViewFrame props={props}><PageHeader title="Relatórios" subtitle="Business" /><QueryError title="Não foi possível calcular os relatórios" error={error} /></ViewFrame> }
}
