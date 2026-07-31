/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps } from 'payload'

import { canManageBusiness, canManageSite } from '../../access/roles'
import {
  getAfterSalesSummary,
  getCatalogHealth,
  getDueTaskSummary,
  getMonthlySalesSummary,
  getOpenLeadSummary,
} from '../../services/dashboard'
import {
  AccessDenied,
  dateTime,
  EmptyState,
  ensureUser,
  MetricCard,
  money,
  monthStartISO,
  nextDayThreshold,
  PageHeader,
  QueryError,
  TechnicalLink,
  ViewFrame,
} from './shared'

const stageLabels: Record<string, string> = {
  new: 'Novo',
  curation: 'Curadoria',
  proposal: 'Proposta',
  negotiation: 'Negociação',
}

export default async function Dashboard(props: AdminViewServerProps) {
  const { user } = ensureUser(props)
  const req = props.initPageResult.req
  const siteAllowed = canManageSite(user)
  const businessAllowed = canManageBusiness(user)

  if (!siteAllowed && !businessAllowed) {
    return <AccessDenied props={props} area="operacional" withTemplate={false} />
  }

  try {
    const sitePromise = siteAllowed ? getCatalogHealth(req) : Promise.resolve(null)
    const businessPromise = businessAllowed
      ? Promise.all([
          getOpenLeadSummary(req),
          getMonthlySalesSummary(req, monthStartISO()),
          getAfterSalesSummary(req, nextDayThreshold().toISOString()),
          getDueTaskSummary(req),
        ])
      : Promise.resolve(null)

    const [site, business] = await Promise.all([sitePromise, businessPromise])
    const leadSummary = business?.[0] ?? null
    const salesSummary = business?.[1] ?? null
    const afterSalesSummary = business?.[2] ?? null
    const tasks = business?.[3] ?? []

    return (
      <ViewFrame props={props} withTemplate={false}>
        <PageHeader
          eyebrow="Hoje"
          title="Olá, Esméra."
          subtitle="Visão rápida do catálogo e da operação, derivada do Payload."
          actions={
            siteAllowed ? (
              <TechnicalLink href="/admin/collections/products/create" primary>
                Novo produto
              </TechnicalLink>
            ) : businessAllowed ? (
              <TechnicalLink href="/admin/collections/leads/create" primary>
                Novo lead
              </TechnicalLink>
            ) : null
          }
        />

        <div className="esmera-metric-grid">
          {site ? (
            <>
              <MetricCard
                icon="box"
                label="Produtos ativos"
                value={site.publishedActive}
                tone="green"
                meta="Publicados e ativos no catálogo"
              />
              <MetricCard
                icon="draft"
                label="Aguardando publicação"
                value={site.drafts}
                meta="Documentos com status de rascunho"
              />
            </>
          ) : null}
          {leadSummary && salesSummary && afterSalesSummary ? (
            <>
              <MetricCard
                icon="lead"
                label="Leads abertos"
                value={leadSummary.open}
                tone="blue"
                meta="Novo, curadoria, proposta e negociação"
              />
              <MetricCard
                icon="money"
                label="Vendas no mês"
                value={money(salesSummary.revenueCents)}
                tone="green"
                meta={`${salesSummary.count} vendas confirmadas ou em andamento`}
              />
              <MetricCard
                icon="alert"
                label="Follow-ups até amanhã"
                value={afterSalesSummary.dueFollowUps}
                tone={afterSalesSummary.dueFollowUps ? 'red' : 'neutral'}
                meta="Itens pendentes com prazo até amanhã"
              />
            </>
          ) : null}
        </div>

        {leadSummary ? (
          <div className="esmera-grid-2">
            <section className="esmera-card">
              <div className="esmera-card-header">
                <h2>Pipeline comercial</h2>
                <TechnicalLink href="/admin/pipeline">Ver pipeline</TechnicalLink>
              </div>
              <div className="esmera-card-body">
                <div className="esmera-stage-track">
                  {leadSummary.stages.map(({ stage, count }) => (
                    <div className="esmera-stage" key={stage}>
                      <strong>{count}</strong>
                      <span>{stageLabels[stage]}</span>
                    </div>
                  ))}
                </div>
                <div className="esmera-kpi-meta">
                  Fonte: leads · leitura atual. Nenhum estágio é estimado ou preenchido com placeholder.
                </div>
              </div>
            </section>

            <section className="esmera-card">
              <div className="esmera-card-header">
                <h2>Pendências</h2>
                <TechnicalLink href="/admin/collections/tasks/create">Nova tarefa</TechnicalLink>
              </div>
              {tasks.length ? (
                <ul className="esmera-list">
                  {tasks.map((task) => (
                    <li className="esmera-list-row" key={String(task.id)}>
                      <div>
                        <a className="esmera-row-title" href={`/admin/collections/tasks/${task.id}`}>
                          {task.title || 'Tarefa'}
                        </a>
                        <span className="esmera-row-meta">{dateTime(task.dueAt)}</span>
                      </div>
                      <span
                        className={`esmera-pill ${
                          task.priority === 'urgent' || task.priority === 'high'
                            ? 'esmera-pill--red'
                            : ''
                        }`}
                      >
                        {task.priority || 'normal'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Nenhuma pendência" copy="A consulta foi concluída e não existem tarefas abertas." />
              )}
            </section>
          </div>
        ) : null}

        {site ? (
          <div className="esmera-grid-equal">
            <section className="esmera-card">
              <div className="esmera-card-header">
                <h2>Catálogo Esméra</h2>
                <TechnicalLink href="/admin/products">Ver produtos</TechnicalLink>
              </div>
              <div className="esmera-card-body">
                {site.latest ? (
                  <>
                    <strong>{site.latest.title || 'Produto sem título'}</strong>
                    <p className="esmera-card-copy">
                      {site.latest.code || 'Sem código'} · atualizado em {dateTime(site.latest.updatedAt)}
                    </p>
                  </>
                ) : (
                  <EmptyState title="Catálogo vazio" copy="Crie o primeiro produto no Admin técnico." />
                )}
              </div>
            </section>
            <section className="esmera-card">
              <div className="esmera-card-header">
                <h2>Performance de tráfego</h2>
                <span className="esmera-pill">Não configurado</span>
              </div>
              <div className="esmera-card-body">
                <p className="esmera-card-copy">
                  Nenhuma porcentagem ou gráfico é exibido sem uma integração de Analytics e uma regra de cálculo verificável.
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </ViewFrame>
    )
  } catch (error) {
    return (
      <ViewFrame props={props} withTemplate={false}>
        <PageHeader title="Dashboard" subtitle="Visão operacional" />
        <QueryError title="Não foi possível carregar o dashboard" error={error} />
      </ViewFrame>
    )
  }
}
