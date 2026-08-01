/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'

import { canManageBusiness, canManageSite } from '../../../access/roles'
import { opportunityStageLabels } from '../../../businessRules/opportunities/stages'
import { getDashboardReporting } from '../../../server/reporting'
import {
  AccessDenied,
  countDocs,
  dateTime,
  EmptyState,
  ensureUser,
  findAllDocs,
  findDocs,
  MetricCard,
  money,
  nextDayThreshold,
  PageHeader,
  QueryError,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'

type Product = { id: string | number; title?: string; code?: string; updatedAt?: string }
type Task = { id: string | number; title?: string; dueAt?: string; priority?: string; status?: string }
type FollowUp = { status?: string; dueAt?: string }
type AfterSale = { followUps?: FollowUp[] }

export default async function DashboardView(props: AdminViewServerProps) {
  const { user } = ensureUser(props)
  const req = props.initPageResult.req
  const siteAllowed = canManageSite(user)
  const businessAllowed = canManageBusiness(user)

  if (!siteAllowed && !businessAllowed) {
    return <AccessDenied props={props} area="operacional" withTemplate={false} />
  }

  try {
    const sitePromise = siteAllowed
      ? Promise.all([
          countDocs(req, 'products', {
            and: [
              { catalogStatus: { equals: 'active' } },
              { _status: { equals: 'published' } },
            ],
          } as Where),
          countDocs(req, 'products', {
            and: [
              { _status: { equals: 'draft' } },
              { publicationReady: { equals: false } },
            ],
          } as Where),
          findDocs<Product>(req, 'products', {
            sort: '-updatedAt',
            limit: 1,
            depth: 0,
            select: { id: true, title: true, code: true, updatedAt: true },
          }),
        ])
      : Promise.resolve(null)

    const businessPromise = businessAllowed
      ? Promise.all([
          getDashboardReporting(req),
          findAllDocs<AfterSale>(req, 'after-sales', {
            depth: 0,
            select: { followUps: true },
          }),
          findDocs<Task>(req, 'tasks', {
            where: { status: { in: ['pending', 'in_progress'] } } as Where,
            sort: 'dueAt',
            limit: 6,
            depth: 0,
            select: { id: true, title: true, dueAt: true, priority: true, status: true },
          }),
        ])
      : Promise.resolve(null)

    const [site, business] = await Promise.all([sitePromise, businessPromise])
    const tomorrow = nextDayThreshold()
    const pendingFollowups = business
      ? business[1]
          .flatMap((item) => item.followUps || [])
          .filter((follow) => follow.status === 'pending' && follow.dueAt && new Date(follow.dueAt) <= tomorrow).length
      : 0
    const reporting = business?.[0] || null
    const tasks = business?.[2] || null

    return (
      <ViewFrame props={props} withTemplate={false}>
        <PageHeader eyebrow="Hoje" title="Olá, Esméra." subtitle="Visão rápida do catálogo e da operação, derivada do Payload." actions={siteAllowed ? <TechnicalLink href="/admin/collections/products/create" primary>Novo produto</TechnicalLink> : businessAllowed ? <TechnicalLink href="/admin/collections/opportunities/create" primary>Nova oportunidade</TechnicalLink> : null} />

        <div className="esmera-metric-grid">
          {site ? <>
            <MetricCard icon="box" label="Produtos ativos" value={site[0]} tone="green" meta="Publicados e ativos no catálogo" />
            <MetricCard icon="draft" label="Pendências editoriais" value={site[1]} meta="Rascunhos com problemas reais de prontidão" />
          </> : null}
          {reporting ? <>
            <MetricCard icon="lead" label="Oportunidades abertas" value={reporting.openOpportunities} tone="blue" meta="Novo, curadoria, proposta e negociação" />
            <MetricCard icon="money" label="Vendas no mês" value={money(reporting.sales.revenueCents)} tone="green" meta={`${reporting.sales.validSales} vendas válidas · contrato ${reporting.semanticVersion}`} />
            <MetricCard icon="alert" label="Follow-ups até amanhã" value={pendingFollowups} tone={pendingFollowups ? 'red' : 'neutral'} meta="Itens pendentes com prazo até amanhã" />
          </> : null}
        </div>

        {reporting && tasks ? <div className="esmera-grid-2">
          <section className="esmera-card">
            <div className="esmera-card-header"><h2>Pipeline comercial</h2><TechnicalLink href="/admin/sales?view=pipeline">Ver pipeline</TechnicalLink></div>
            <div className="esmera-card-body"><div className="esmera-stage-track">{reporting.pipeline.map(({ stage, volume }) => <div className="esmera-stage" key={stage}><strong>{volume}</strong><span>{opportunityStageLabels[stage]}</span></div>)}</div><div className="esmera-kpi-meta">Fonte: Opportunities. Agregação: Reporting Service. Nenhum estágio é estimado ou preenchido com placeholder.</div></div>
          </section>
          <section className="esmera-card">
            <div className="esmera-card-header"><h2>Pendências</h2><TechnicalLink href="/admin/collections/tasks/create">Nova tarefa</TechnicalLink></div>
            {tasks.docs.length ? <ul className="esmera-list">{tasks.docs.map((task) => <li className="esmera-list-row" key={String(task.id)}><div><a className="esmera-row-title" href={`/admin/collections/tasks/${task.id}`}>{task.title || 'Tarefa'}</a><span className="esmera-row-meta">{dateTime(task.dueAt)}</span></div><span className={`esmera-pill ${task.priority === 'urgent' || task.priority === 'high' ? 'esmera-pill--red' : ''}`}>{task.priority || 'normal'}</span></li>)}</ul> : <EmptyState title="Nenhuma pendência" copy="A consulta foi concluída e não existem tarefas abertas." />}
          </section>
        </div> : null}

        {site ? <div className="esmera-grid-equal">
          <section className="esmera-card"><div className="esmera-card-header"><h2>Catálogo Esméra</h2><TechnicalLink href="/admin/products">Ver produtos</TechnicalLink></div><div className="esmera-card-body">{site[2].docs[0] ? <><strong>{site[2].docs[0].title || 'Produto sem título'}</strong><p className="esmera-card-copy">{site[2].docs[0].code || 'Sem código'} · atualizado em {dateTime(site[2].docs[0].updatedAt)}</p></> : <EmptyState title="Catálogo vazio" copy="Crie o primeiro produto no Admin técnico." />}</div></section>
          <section className="esmera-card"><div className="esmera-card-header"><h2>Performance de tráfego</h2><span className="esmera-pill">Não configurado</span></div><div className="esmera-card-body"><p className="esmera-card-copy">Nenhuma porcentagem ou gráfico é exibido sem uma integração de Analytics e uma regra de cálculo verificável.</p></div></section>
        </div> : null}
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props} withTemplate={false}><PageHeader title="Dashboard" subtitle="Visão operacional" /><QueryError title="Não foi possível carregar o dashboard" error={error} /></ViewFrame>
  }
}
