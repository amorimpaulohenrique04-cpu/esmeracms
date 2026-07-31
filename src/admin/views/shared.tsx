import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps, PayloadRequest, Where } from 'payload'
import { redirect } from 'next/navigation'
import React from 'react'

import { canManageBusiness, canManageSite, roleOf } from '../../access/roles'
import './views.scss'

export type OperationalArea = 'all' | 'site' | 'business'

type FindOptions = {
  where?: Where
  sort?: string
  limit?: number
  page?: number
  depth?: number
  draft?: boolean
  select?: Record<string, true>
}

export function hasAreaAccess(user: unknown, area: OperationalArea) {
  if (area === 'all') return Boolean(user)
  if (area === 'site') return canManageSite(user)
  return canManageBusiness(user)
}

export function ensureUser(props: AdminViewServerProps, area: OperationalArea = 'all') {
  const user = props.initPageResult.req.user
  if (!user) redirect('/admin/login')
  return {
    user,
    role: roleOf(user),
    allowed: hasAreaAccess(user, area),
  }
}

export function ViewFrame({
  props,
  children,
  withTemplate = true,
}: {
  props: AdminViewServerProps
  children: React.ReactNode
  withTemplate?: boolean
}) {
  const { initPageResult, params, searchParams } = props
  const content = (
    <Gutter>
      <main className="esmera-view">{children}</main>
    </Gutter>
  )

  if (!withTemplate) return content

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={initPageResult.req.user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      {content}
    </DefaultTemplate>
  )
}

export function AccessDenied({
  props,
  area,
  withTemplate = true,
}: {
  props: AdminViewServerProps
  area: string
  withTemplate?: boolean
}) {
  return (
    <ViewFrame props={props} withTemplate={withTemplate}>
      <div className="esmera-state esmera-state--warning">
        <strong>Acesso restrito</strong>
        <p>Seu papel não possui acesso à área {area}. A permissão é aplicada também nas Collections e APIs.</p>
      </div>
    </ViewFrame>
  )
}

export function QueryError({ title, error }: { title: string; error: unknown }) {
  return (
    <div className="esmera-state esmera-state--error" role="alert">
      <strong>{title}</strong>
      <p>{error instanceof Error ? error.message : 'Não foi possível consultar a fonte de dados.'}</p>
      <small>Nenhum erro de consulta é convertido em zero.</small>
    </div>
  )
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="esmera-empty"><strong>{title}</strong><span>{copy}</span></div>
}

export async function findDocs<T>(req: PayloadRequest, collection: string, options: FindOptions = {}) {
  const result = await req.payload.find({
    collection: collection as never,
    depth: options.depth ?? 1,
    limit: options.limit ?? 100,
    page: options.page,
    sort: options.sort as never,
    where: options.where,
    overrideAccess: false,
    user: req.user,
    req,
    draft: options.draft,
    select: options.select as never,
  })
  return result as unknown as {
    docs: T[]
    hasNextPage: boolean
    limit: number
    page: number
    totalDocs: number
    totalPages: number
  }
}

export async function findAllDocs<T>(
  req: PayloadRequest,
  collection: string,
  options: Omit<FindOptions, 'limit' | 'page'> = {},
) {
  const firstPage = await findDocs<T>(req, collection, { ...options, limit: 500, page: 1 })
  if (!firstPage.hasNextPage) return firstPage.docs

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      findDocs<T>(req, collection, { ...options, limit: 500, page: index + 2 }),
    ),
  )

  return [firstPage, ...remainingPages].flatMap((result) => result.docs)
}

export async function countDocs(req: PayloadRequest, collection: string, where?: Where) {
  const result = await req.payload.count({
    collection: collection as never,
    where,
    overrideAccess: false,
    user: req.user,
    req,
  })
  return result.totalDocs
}

export function money(cents: number | null | undefined) {
  if (typeof cents !== 'number') return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function dateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function shortDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', year: 'numeric' })
}

export function monthStartISO() {
  const now = new Date()
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const year = Number(localParts.find((part) => part.type === 'year')?.value)
  const month = Number(localParts.find((part) => part.type === 'month')?.value) - 1
  // São Paulo is UTC-3 and Brazil currently has no daylight-saving time.
  return new Date(Date.UTC(year, month, 1, 3, 0, 0)).toISOString()
}

export function nextDayThreshold() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  return (
    <header className="esmera-page-header">
      <div>
        {eyebrow ? <span className="esmera-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="esmera-actions">{actions}</div> : null}
    </header>
  )
}

type MetricIcon = 'box' | 'lead' | 'money' | 'alert' | 'draft'

function MetricGlyph({ name }: { name: MetricIcon }) {
  const paths: Record<MetricIcon, React.ReactNode> = {
    box: <><path d="m4 7 8-4 8 4-8 4z" /><path d="m4 7 8 4 8-4v10l-8 4-8-4z" /><path d="M12 11v10" /></>,
    lead: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7" /><path d="M15 5c3 0 5 2 5 5 0 1.5-.6 2.8-1.6 3.7M16 14c3 .6 5 2.8 5 6" /></>,
    money: <><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M7 9H6v1M17 15h1v-1" /></>,
    alert: <><path d="M12 3v11" /><path d="M12 19h.01" /></>,
    draft: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h4M9 13h6M9 17h4" /></>,
  }

  return (
    <span className="esmera-metric-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
        {paths[name]}
      </svg>
    </span>
  )
}

export function MetricCard({
  label,
  value,
  meta,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: React.ReactNode
  meta: string
  icon?: MetricIcon
  tone?: 'neutral' | 'green' | 'blue' | 'red'
}) {
  return (
    <article className={`esmera-metric esmera-metric--${tone}`}>
      <div className="esmera-metric-heading">
        {icon ? <MetricGlyph name={icon} /> : null}
        <span>{label}</span>
      </div>
      <strong className="esmera-metric-value">{value}</strong>
      <small>{meta}</small>
    </article>
  )
}

export function TechnicalLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return <a className={primary ? 'esmera-button esmera-button--primary' : 'esmera-button'} href={href}>{children}</a>
}
