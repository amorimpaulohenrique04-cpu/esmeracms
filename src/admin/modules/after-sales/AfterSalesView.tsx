/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps } from 'payload'

import {
  AccessDenied,
  EmptyState,
  ensureUser,
  findAllDocs,
  PageHeader,
  QueryError,
  shortDate,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'

type Customer = { id: string | number; name?: string }
type FollowUp = { status?: string; dueAt?: string; purpose?: string }
type AfterSale = {
  id: string | number
  status?: string
  priority?: string
  customer?: Customer | string | number
  followUps?: FollowUp[]
  deliveredAt?: string
  incidentType?: string
}

function customerName(value: AfterSale['customer']) {
  return value && typeof value === 'object' ? value.name || 'Cliente' : 'Cliente'
}

export async function AfterSalesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  try {
    const allCases = await findAllDocs<AfterSale>(props.initPageResult.req, 'after-sales', {
      sort: '-updatedAt',
      depth: 1,
      select: {
        id: true,
        status: true,
        priority: true,
        customer: true,
        followUps: true,
        deliveredAt: true,
        incidentType: true,
      },
    })
    const visibleCases = allCases.slice(0, 100)
    const result = { docs: visibleCases, totalDocs: allCases.length }
    const now = new Date()
    const dateKey = (value: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    const today = dateKey(now)
    const followups = allCases.flatMap((item) => item.followUps || [])
    const todayCount = followups.filter((follow) => follow.status === 'pending' && follow.dueAt && dateKey(new Date(follow.dueAt)) === today).length
    const overdue = followups.filter((follow) => follow.status === 'pending' && follow.dueAt && new Date(follow.dueAt) < now).length
    const incidents = allCases.filter((item) => item.incidentType && item.incidentType !== 'none' && !['resolved', 'closed'].includes(item.status || '')).length
    const deliveries = allCases.filter((item) => !item.deliveredAt && !['resolved', 'closed'].includes(item.status || '')).length

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
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Pós-venda" subtitle="Business" /><QueryError title="Não foi possível consultar o pós-venda" error={error} /></ViewFrame>
  }
}
