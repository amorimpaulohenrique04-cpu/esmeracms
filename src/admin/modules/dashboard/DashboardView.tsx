/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import type { AdminViewServerProps } from 'payload'

import {
  operationalPriorityLabels,
  taskStatusLabels,
  taskTypeLabels,
} from '../../../businessRules/afterSales/model'
import { opportunityStageLabels } from '../../../businessRules/opportunities/stages'
import {
  dashboardDayBounds,
  getDashboardSnapshot,
  type DashboardProduct,
  type DashboardRelationValue,
  type DashboardTask,
  type DashboardTaskRelation,
} from '../../../server/dashboard'
import {
  AccessDenied,
  dateTime,
  EmptyState,
  ensureUser,
  money,
  PageHeader,
  QueryError,
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'
import './dashboard.scss'

type DashboardUser = {
  name?: string | null
  email?: string | null
}

type MetricProps = {
  label: string
  value: ReactNode
  meta: string
  href: string
  tone?: 'neutral' | 'success' | 'attention'
}

function firstName(user: DashboardUser) {
  const source = user.name?.trim() || user.email?.split('@')[0] || 'Esméra'
  return source.split(/\s+/)[0]
}

function operationalDate(value: string, timeZone: string) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function relationValue(relation: DashboardTaskRelation | undefined) {
  const value = relation?.value
  if (typeof value === 'string' || typeof value === 'number') return { id: value } satisfies DashboardRelationValue
  return value && typeof value === 'object' ? value : null
}

function related(task: DashboardTask, relationTo: string) {
  return relationValue(task.relatedTo?.find((item) => item.relationTo === relationTo))
}

function taskContext(task: DashboardTask) {
  const afterSales = related(task, 'after-sales')
  if (afterSales?.id) {
    const query = afterSales.caseNumber || String(afterSales.id)
    return { href: `/admin/after-sales?q=${encodeURIComponent(query)}`, label: 'Abrir caso' }
  }

  const opportunity = related(task, 'opportunities')
  if (opportunity?.id) {
    const query = opportunity.code || String(opportunity.id)
    return { href: `/admin/sales?view=list&q=${encodeURIComponent(query)}`, label: 'Abrir oportunidade' }
  }

  const occurrence = related(task, 'occurrences')
  if (occurrence?.id) {
    return { href: `/admin/after-sales?focus=occurrences&q=${encodeURIComponent(String(occurrence.id))}`, label: 'Abrir ocorrência' }
  }

  const shipment = related(task, 'shipments')
  if (shipment?.id) {
    const query = shipment.trackingCode || String(shipment.id)
    return { href: `/admin/after-sales?focus=deliveries&q=${encodeURIComponent(query)}`, label: 'Abrir entrega' }
  }

  const customer = related(task, 'customers')
  if (customer?.id) return { href: `/admin/customers?customer=${customer.id}&tab=overview`, label: 'Abrir cliente' }

  const sale = related(task, 'sales')
  if (sale?.id) return { href: `/admin/collections/sales/${sale.id}`, label: 'Abrir venda' }

  const lead = related(task, 'leads')
  if (lead?.id) return { href: `/admin/collections/leads/${lead.id}`, label: 'Abrir lead' }

  return { href: `/admin/collections/tasks/${task.id}`, label: 'Abrir tarefa' }
}

function taskTimeState(task: DashboardTask, generatedAt: string) {
  if (!task.dueAt) return 'future'
  const due = new Date(task.dueAt).getTime()
  const now = new Date(generatedAt).getTime()
  const day = dashboardDayBounds(new Date(generatedAt))
  if (due < now) return 'overdue'
  if (due < new Date(day.end).getTime()) return 'today'
  return 'future'
}

function labelFor(map: Record<string, string>, value: string | null | undefined, fallback: string) {
  return value ? map[value] || fallback : fallback
}

function DashboardMetric({ label, value, meta, href, tone = 'neutral' }: MetricProps) {
  return (
    <Link className={`esmera-dashboard-metric is-${tone}`} href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
      <span className="esmera-dashboard-metric__action" aria-hidden="true">Abrir →</span>
    </Link>
  )
}

function PanelHeader({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return (
    <header className="esmera-dashboard-panel__header">
      <div>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  )
}

function ProductRow({ product }: { product: DashboardProduct }) {
  const publication = product._status === 'published' ? 'Publicado' : 'Rascunho'
  const state = product.catalogStatus === 'active' ? 'Ativo' : 'Arquivado'
  return (
    <li>
      <Link className="esmera-dashboard-product" href={`/admin/products?product=${product.id}&tab=overview`}>
        <span className="esmera-dashboard-product__mark" aria-hidden="true">◇</span>
        <span className="esmera-dashboard-product__copy">
          <strong>{product.title || 'Produto sem título'}</strong>
          <small>{product.code || 'Sem código'} · {publication} · {state}</small>
        </span>
        <time dateTime={product.updatedAt || undefined}>{dateTime(product.updatedAt)}</time>
      </Link>
    </li>
  )
}

export default async function DashboardView(props: AdminViewServerProps) {
  const { user } = ensureUser(props)
  const req = props.initPageResult.req

  try {
    const snapshot = await getDashboardSnapshot(req)
    if (!snapshot.permissions.site && !snapshot.permissions.business) {
      return <AccessDenied props={props} area="operacional" withTemplate={false} />
    }

    const reporting = snapshot.business?.reporting || null
    const tasks = snapshot.business?.tasks || null
    const pipelineMax = reporting ? Math.max(0, ...reporting.pipeline.map((item) => item.volume)) : 0
    const dashboardUser = user as DashboardUser
    const actions = snapshot.permissions.business
      ? <><TechnicalLink href="/admin/collections/opportunities/create" primary>+ Nova oportunidade</TechnicalLink>{snapshot.permissions.site ? <TechnicalLink href="/admin/collections/products/create">Novo produto</TechnicalLink> : null}</>
      : <TechnicalLink href="/admin/collections/products/create" primary>+ Novo produto</TechnicalLink>

    return (
      <ViewFrame props={props} withTemplate={false}>
        <PageHeader
          eyebrow={operationalDate(snapshot.generatedAt, snapshot.timeZone)}
          title={`Olá, ${firstName(dashboardUser)}.`}
          subtitle="O que aconteceu, o que exige atenção e os caminhos diretos para agir — sem duplicar a análise detalhada de Relatórios."
          actions={actions}
        />

        <section className="esmera-dashboard-metrics" aria-label="Indicadores do Dashboard">
          <DashboardMetric
            label="Produtos ativos"
            value={snapshot.catalog.activeProducts}
            meta="Publicados e ativos no catálogo"
            href="/admin/products?status=active&publication=published"
          />
          {reporting && tasks ? <>
            <DashboardMetric
              label="Oportunidades abertas"
              value={reporting.openOpportunities}
              meta="Novo, curadoria, proposta e negociação"
              href="/admin/sales?view=pipeline"
            />
            <DashboardMetric
              label="Vendas no mês"
              value={reporting.sales.validSales}
              meta={`${money(reporting.sales.revenueCents)} em receita válida`}
              href="/admin/collections/sales"
              tone="success"
            />
            <DashboardMetric
              label="Pendências"
              value={tasks.open}
              meta={`${tasks.overdue} atrasadas · ${tasks.dueToday} vencem hoje`}
              href="/admin/after-sales?focus=all&status=open"
              tone={tasks.overdue ? 'attention' : 'neutral'}
            />
          </> : snapshot.permissions.site ? (
            <DashboardMetric
              label="Pendências editoriais"
              value={snapshot.catalog.editorialPending}
              meta="Rascunhos com problemas reais de prontidão"
              href="/admin/products?publication=issues"
              tone={snapshot.catalog.editorialPending ? 'attention' : 'neutral'}
            />
          ) : null}
        </section>

        {reporting && tasks ? (
          <div className="esmera-dashboard-primary-grid">
            <section className="esmera-dashboard-panel esmera-dashboard-pipeline" aria-labelledby="dashboard-pipeline-title">
              <PanelHeader
                title="Pipeline compacto"
                copy="Estado atual das Opportunities abertas. Cada etapa leva aos registros correspondentes em Vendas."
                action={<Link className="esmera-dashboard-text-link" href="/admin/sales?view=pipeline">Ver pipeline completo</Link>}
              />
              <div className="esmera-dashboard-panel__body">
                <ol className="esmera-dashboard-pipeline__list">
                  {reporting.pipeline.map(({ stage, volume }) => {
                    const share = pipelineMax ? Math.round((volume / pipelineMax) * 100) : 0
                    return (
                      <li key={stage}>
                        <Link
                          href={`/admin/sales?view=list&stage=${stage}`}
                          className="esmera-dashboard-pipeline__stage"
                          aria-label={`${opportunityStageLabels[stage]}: ${volume} oportunidades. Abrir Vendas filtradas.`}
                        >
                          <span className="esmera-dashboard-pipeline__label">{opportunityStageLabels[stage]}</span>
                          <span className="esmera-dashboard-pipeline__track" aria-hidden="true">
                            <span style={{ '--dashboard-pipeline-share': `${share}%` } as CSSProperties} />
                          </span>
                          <strong>{volume}</strong>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
                <p className="esmera-dashboard-source">Fonte: Opportunities · contrato {reporting.semanticVersion}. O Dashboard não recalcula métricas.</p>
              </div>
            </section>

            <section className="esmera-dashboard-panel esmera-dashboard-tasks" aria-labelledby="dashboard-tasks-title">
              <PanelHeader
                title="Pendências do dia"
                copy="Tasks reais ordenadas pelo prazo; atrasadas aparecem primeiro."
                action={<Link className="esmera-dashboard-text-link" href="/admin/after-sales?focus=all&status=open">Abrir fila</Link>}
              />
              {tasks.items.length ? (
                <ul className="esmera-dashboard-task-list">
                  {tasks.items.map((task) => {
                    const timeState = taskTimeState(task, snapshot.generatedAt)
                    const context = taskContext(task)
                    return (
                      <li className={`esmera-dashboard-task is-${timeState}`} key={String(task.id)}>
                        <div className="esmera-dashboard-task__time">
                          <span>{timeState === 'overdue' ? 'Atrasada' : timeState === 'today' ? 'Hoje' : 'Próxima'}</span>
                          <time dateTime={task.dueAt || undefined}>{dateTime(task.dueAt)}</time>
                        </div>
                        <div className="esmera-dashboard-task__copy">
                          <strong>{task.title || 'Tarefa sem título'}</strong>
                          <small>
                            {labelFor(taskTypeLabels as Record<string, string>, task.type, 'Tarefa')} · {labelFor(taskStatusLabels as Record<string, string>, task.status, 'Pendente')} · {labelFor(operationalPriorityLabels as Record<string, string>, task.priority, 'Normal')}
                          </small>
                        </div>
                        <div className="esmera-dashboard-task__actions">
                          <Link href={context.href}>{context.label}</Link>
                          {context.href !== `/admin/collections/tasks/${task.id}` ? <Link href={`/admin/collections/tasks/${task.id}`}>Ver tarefa</Link> : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : <EmptyState title="Nenhuma pendência aberta" copy="A consulta foi concluída e não existem Tasks pendentes ou em andamento." />}
            </section>
          </div>
        ) : null}

        <div className={`esmera-dashboard-secondary-grid${snapshot.permissions.site ? '' : ' is-single'}`}>
          {snapshot.permissions.site ? (
            <section className="esmera-dashboard-panel" aria-labelledby="dashboard-catalog-title">
              <PanelHeader
                title="Catálogo recente"
                copy="Últimos produtos atualizados no Payload, com acesso direto ao documento operacional."
                action={<Link className="esmera-dashboard-text-link" href="/admin/products">Ver catálogo</Link>}
              />
              {snapshot.catalog.recentProducts.length ? (
                <ul className="esmera-dashboard-product-list">
                  {snapshot.catalog.recentProducts.map((product) => <ProductRow key={String(product.id)} product={product} />)}
                </ul>
              ) : <EmptyState title="Catálogo vazio" copy="Crie o primeiro produto para iniciar a operação editorial." />}
            </section>
          ) : null}

          <section className="esmera-dashboard-panel esmera-dashboard-traffic" aria-labelledby="dashboard-traffic-title">
            <PanelHeader title="Tráfego" copy="Métricas de audiência só entram depois de uma integração verificável." />
            <div className="esmera-dashboard-panel__body">
              <div className="esmera-dashboard-traffic__status">
                <span aria-hidden="true" />
                <strong>Não configurado</strong>
              </div>
              <p>{snapshot.traffic.reason}</p>
              <small>Nenhum percentual, visitante, sessão ou gráfico é estimado ou preenchido com placeholder.</small>
            </div>
          </section>
        </div>
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props} withTemplate={false}><PageHeader title="Dashboard" subtitle="Visão operacional" /><QueryError title="Não foi possível carregar o dashboard" error={error} /></ViewFrame>
  }
}
