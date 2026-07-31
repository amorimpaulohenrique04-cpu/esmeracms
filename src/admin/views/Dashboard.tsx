import type { AdminViewServerProps, Where } from 'payload'
import { canManageBusiness, canManageSite } from '../../access/roles'
import { eligibleSaleStatuses } from '../../collections/Sales'
import {
  AccessDenied,
  countDocs,
  dateTime,
  EmptyState,
  ensureUser,
  findDocs,
  MetricCard,
  money,
  monthStartISO,
  PageHeader,
  QueryError,
  TechnicalLink,
  ViewFrame,
} from './shared'

type Product = { id: string | number; title?: string; code?: string; updatedAt?: string }
type Task = { id: string | number; title?: string; dueAt?: string; priority?: string; status?: string; assignee?: string }
type Sale = { totalCents?: number | null; status?: string }
type Lead = { stage?: string }
type FollowUp = { status?: string; dueAt?: string }
type AfterSale = { followUps?: FollowUp[] }

const activeLeadStages = ['new', 'curation', 'proposal', 'negotiation']

export default async function Dashboard(props: AdminViewServerProps) {
  const { user } = ensureUser(props)
  const req = props.initPageResult.req
  const siteAllowed = canManageSite(user)
  const businessAllowed = canManageBusiness(user)

  if (!siteAllowed && !businessAllowed) return <AccessDenied props={props} area="operacional" />

  try {
    const sitePromise = siteAllowed
      ? Promise.all([
          countDocs(req, 'products', { and: [{ catalogStatus: { equals: 'active' } }, { _status: { equals: 'published' } }] } as Where),
          countDocs(req, 'products', { _status: { equals: 'draft' } } as Where),
          findDocs<Product>(req, 'products', { sort: '-updatedAt', limit: 1, depth: 0 }),
        ])
      : Promise.resolve(null)

    const businessPromise = businessAllowed
      ? Promise.all([
          countDocs(req, 'leads', { stage: { in: activeLeadStages } } as Where),
          findDocs<Sale>(req, 'sales', {
            where: {
              and: [
                { status: { in: [...eligibleSaleStatuses] } },
                { confirmedAt: { greater_than_equal: monthStartISO() } },
              ],
            } as Where,
            limit: 500,
            depth: 0,
          }),
          findDocs<AfterSale>(req, 'after-sales', { limit: 500, depth: 0 }),
          findDocs<Task>(req, 'tasks', {
            where: { status: { in: ['pending', 'in_progress'] } } as Where,
            sort: 'dueAt',
            limit: 6,
            depth: 0,
          }),
          findDocs<Lead>(req, 'leads', { limit: 1000, depth: 0 }),
        ])
      : Promise.resolve(null)

    const [site, business] = await Promise.all([sitePromise, businessPromise])

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const pendingFollowups = business
      ? business[2].docs.flatMap((item) => item.followUps || []).filter((follow) =>
          follow.status === 'pending' && follow.dueAt && new Date(follow.dueAt) <= tomorrow,
        ).length
      : 0
    const salesCount = business?.[1].docs.length || 0
    const revenue = business?.[1].docs.reduce((sum, sale) => sum + (sale.totalCents || 0), 0) || 0
    const pipeline = business
      ? activeLeadStages.map((stage) => ({ stage, count: business[4].docs.filter((lead) => lead.stage === stage).length }))
      : []
    const stageLabels: Record<string, string> = {
      new: 'Novo',
      curation: 'Curadoria',
      proposal: 'Proposta',
      negotiation: 'Negociação',
    }

    return (
      <ViewFrame props={props}>
        <PageHeader
          eyebrow="Hoje"
          title="Olá, Esméra."
          subtitle="Visão rápida do catálogo e da operação, derivada do Payload."
          actions={siteAllowed
            ? <TechnicalLink href="/admin/collections/products/create" primary>Novo produto</TechnicalLink>
            : businessAllowed
              ? <TechnicalLink href="/admin/collections/leads/create" primary>Novo lead</TechnicalLink>
              : null}
        />

        <div className="esmera-metric-grid">
          {site ? (
            <>
              <MetricCard label="Produtos ativos" value={site[0]} tone="green" meta="Fonte: products · publicados + catalogStatus ativo" />
              <MetricCard label="Produtos ainda não publicados" value={site[1]} meta="Fonte: products · documento principal com _status draft" />
            </>
          ) : null}
          {business ? (
            <>
              <MetricCard label="Leads abertos" value={business[0]} tone="blue" meta="Fonte: leads · novo, curadoria, proposta e negociação" />
              <MetricCard label="Vendas válidas no mês" value={salesCount} tone="green" meta="Fonte: sales · confirmadas, produção, prontas e entregues" />
              <MetricCard label="Receita registrada" value={money(revenue)} meta="Fonte: sales.totalCents · mês atual · mesmos status elegíveis" />
              <MetricCard label="Follow-ups até amanhã" value={pendingFollowups} tone={pendingFollowups ? 'red' : 'neutral'} meta="Fonte: after-sales.followUps · itens pendentes com prazo até amanhã" />
            </>
          ) : null}
        </div>

        {business ? (
          <div className="esmera-grid-2">
            <section className="esmera-card">
              <div className="esmera-card-header"><h2>Pipeline comercial</h2><TechnicalLink href="/admin/pipeline">Ver pipeline</TechnicalLink></div>
              <div className="esmera-card-body">
                <div className="esmera-pipeline" style={{ gridTemplateColumns: 'repeat(4,minmax(130px,1fr))' }}>
                  {pipeline.map(({ stage, count }) => (
                    <div className="esmera-pipeline-column" style={{ minHeight: 140 }} key={stage}>
                      <div className="esmera-pipeline-head"><span>{stageLabels[stage]}</span><span className="esmera-pill esmera-pill--green">{count}</span></div>
                    </div>
                  ))}
                </div>
                <div className="esmera-kpi-meta">Fonte: leads · leitura atual. Nenhum estágio é estimado ou preenchido com placeholder.</div>
              </div>
            </section>

            <section className="esmera-card">
              <div className="esmera-card-header"><h2>Pendências</h2><TechnicalLink href="/admin/collections/tasks/create">Nova tarefa</TechnicalLink></div>
              {business[3].docs.length ? (
                <ul className="esmera-list">
                  {business[3].docs.map((task) => (
                    <li className="esmera-list-row" key={String(task.id)}>
                      <div><a className="esmera-row-title" href={`/admin/collections/tasks/${task.id}`}>{task.title || 'Tarefa'}</a><span className="esmera-row-meta">{dateTime(task.dueAt)}</span></div>
                      <span className={`esmera-pill ${task.priority === 'urgent' || task.priority === 'high' ? 'esmera-pill--red' : ''}`}>{task.priority || 'normal'}</span>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="Nenhuma pendência" copy="A consulta foi concluída e não existem tarefas abertas." />}
            </section>
          </div>
        ) : null}

        {site ? (
          <div className="esmera-grid-equal">
            <section className="esmera-card">
              <div className="esmera-card-header"><h2>Catálogo Esméra</h2><TechnicalLink href="/admin/products">Ver produtos</TechnicalLink></div>
              <div className="esmera-card-body">
                {site[2].docs[0] ? (
                  <><strong>{site[2].docs[0].title || 'Produto sem título'}</strong><p className="esmera-card-copy">{site[2].docs[0].code || 'Sem código'} · atualizado em {dateTime(site[2].docs[0].updatedAt)}</p></>
                ) : <EmptyState title="Catálogo vazio" copy="Crie o primeiro produto no Admin técnico." />}
              </div>
            </section>
            <section className="esmera-card">
              <div className="esmera-card-header"><h2>Performance de tráfego</h2><span className="esmera-pill">Não configurado</span></div>
              <div className="esmera-card-body"><p className="esmera-card-copy">Nenhuma porcentagem ou gráfico é exibido sem uma integração de Analytics e uma regra de cálculo verificável.</p></div>
            </section>
          </div>
        ) : null}
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Dashboard" subtitle="Visão operacional" /><QueryError title="Não foi possível carregar o dashboard" error={error} /></ViewFrame>
  }
}
