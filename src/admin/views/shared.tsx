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
  depth?: number
  draft?: boolean
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
}: {
  props: AdminViewServerProps
  children: React.ReactNode
}) {
  const { initPageResult, params, searchParams } = props
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
      <Gutter>
        <div className="esmera-view">{children}</div>
      </Gutter>
    </DefaultTemplate>
  )
}

export function AccessDenied({ props, area }: { props: AdminViewServerProps; area: string }) {
  return (
    <ViewFrame props={props}>
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
    sort: options.sort as never,
    where: options.where,
    overrideAccess: false,
    user: req.user,
    req,
    draft: options.draft,
  })
  return result as unknown as { docs: T[]; totalDocs: number }
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

export function MetricCard({
  label,
  value,
  meta,
  tone = 'neutral',
}: {
  label: string
  value: React.ReactNode
  meta: string
  tone?: 'neutral' | 'green' | 'blue' | 'red'
}) {
  return (
    <article className={`esmera-metric esmera-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  )
}

export function TechnicalLink({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return <a className={primary ? 'esmera-button esmera-button--primary' : 'esmera-button'} href={href}>{children}</a>
}
