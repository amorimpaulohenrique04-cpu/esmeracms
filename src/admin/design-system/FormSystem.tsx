'use client'

import React, { useEffect, useMemo, useRef } from 'react'

import type { AdminEntityError, AdminFieldError } from '../state/asyncState'
import { Button } from './Button'

export type FormTab = {
  id: string
  label: string
  issues?: number
  /**
   * URL real da aba (opcional). Quando presente, a aba vira um link de
   * verdade — navegável, com role="link", e deep-linkável — em vez de um
   * <button> puramente client-side. O clique ainda troca a aba na hora via
   * onTabChange (preventDefault); o href existe para semântica/navegação
   * real, não para forçar um reload por clique.
   */
  href?: string
}

export function FormShell({
  title,
  description,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  aside,
  actions,
}: {
  title: string
  description?: string
  tabs?: FormTab[]
  activeTab?: string
  onTabChange?: (tab: string) => void
  children: React.ReactNode
  aside?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="esmera-form-shell">
      <header className="esmera-form-shell__header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="esmera-form-shell__header-actions">{actions}</div> : null}
      </header>
      {tabs.length ? (
        <nav className="esmera-form-shell__tabs" aria-label={`Seções de ${title}`}>
          {tabs.map((tab) => tab.href ? (
            <a
              key={tab.id}
              href={tab.href}
              className={tab.id === activeTab ? 'is-active' : ''}
              aria-current={tab.id === activeTab ? 'page' : undefined}
              onClick={(event) => { event.preventDefault(); onTabChange?.(tab.id) }}
            >
              <span>{tab.label}</span>
              {tab.issues ? <small aria-label={`${tab.issues} pendências`}>{tab.issues}</small> : null}
            </a>
          ) : (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? 'is-active' : ''}
              aria-current={tab.id === activeTab ? 'page' : undefined}
              onClick={() => onTabChange?.(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.issues ? <small aria-label={`${tab.issues} pendências`}>{tab.issues}</small> : null}
            </button>
          ))}
        </nav>
      ) : null}
      <div className={`esmera-form-shell__body${aside ? ' has-aside' : ''}`}>
        <div className="esmera-form-shell__content">{children}</div>
        {aside ? <aside className="esmera-form-shell__aside">{aside}</aside> : null}
      </div>
    </section>
  )
}

const FOCUSABLE = 'input,select,textarea,button,a[href],[tabindex]:not([tabindex="-1"])'

function isOutOfView(element: HTMLElement) {
  if (typeof element.getBoundingClientRect !== 'function') return false
  const rect = element.getBoundingClientRect()
  const viewport = window.innerHeight || document.documentElement.clientHeight
  return rect.bottom < 0 || rect.top > viewport
}

function escapeAttributeValue(value: string) {
  // `CSS.escape` não existe em todos os runtimes que renderizam este módulo.
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&')
}

function focusIssue(issue: AdminFieldError) {
  const anchor = issue.anchor ? document.getElementById(issue.anchor) : null
  const path = document.querySelector<HTMLElement>(`[data-field-path="${escapeAttributeValue(issue.path)}"]`)
  const target = anchor || path
  // Issue sem destino resolvível continua listada no resumo; navegar seria
  // inventar um destino.
  if (!target) return
  const destination = target.matches(FOCUSABLE) ? target : target.querySelector<HTMLElement>(FOCUSABLE)
  const focusTarget = destination || target
  // Scroll só quando o destino está fora da viewport — o foco já traz a
  // rolagem nativa nos demais casos.
  if (isOutOfView(focusTarget)) focusTarget.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  focusTarget.focus?.({ preventScroll: true })
}

export function ErrorSummary({
  summary,
  fieldErrors = [],
  entityErrors = [],
  traceId,
  onTabChange,
  autoFocus = true,
}: {
  summary: string
  fieldErrors?: AdminFieldError[]
  entityErrors?: AdminEntityError[]
  traceId?: string | null
  onTabChange?: (tab: string) => void
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const issueCount = fieldErrors.length + entityErrors.length

  useEffect(() => {
    if (autoFocus && issueCount) ref.current?.focus()
  }, [autoFocus, issueCount])

  return (
    // Quando o foco vai para o resumo, ele já é lido: manter `role="alert"`
    // junto faria o leitor de tela anunciar a mesma falha duas vezes.
    <div
      ref={ref}
      className="esmera-error-summary"
      role={autoFocus ? 'group' : 'alert'}
      tabIndex={-1}
      aria-labelledby="esmera-error-summary-title"
    >
      <strong id="esmera-error-summary-title">{summary}</strong>
      {issueCount ? (
        <ul>
          {fieldErrors.map((issue, index) => (
            <li key={`${issue.path}-${issue.message}-${index}`}>
              <button
                type="button"
                onClick={() => {
                  if (issue.tab) onTabChange?.(issue.tab)
                  window.setTimeout(() => focusIssue(issue), issue.tab ? 80 : 0)
                }}
              >
                {issue.message}
              </button>
              {issue.suggestion ? <small>{issue.suggestion}</small> : null}
            </li>
          ))}
          {entityErrors.map((issue, index) => (
            <li key={`${issue.code}-${index}`}>
              <span>{issue.message}</span>
              {issue.suggestion ? <small>{issue.suggestion}</small> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {traceId ? <small className="esmera-error-summary__trace">Referência técnica: {traceId}</small> : null}
    </div>
  )
}

export type PublicationChecklistIssue = {
  code: string
  severity: 'blocker' | 'warning' | 'info'
  message: string
  suggestion?: string | null
  tab?: string | null
  anchor?: string | null
}

export function PublicationChecklist({
  issues,
  onNavigate,
}: {
  issues: PublicationChecklistIssue[]
  onNavigate?: (issue: PublicationChecklistIssue) => void
}) {
  const grouped = useMemo(() => ({
    blockers: issues.filter((issue) => issue.severity === 'blocker'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    recommendations: issues.filter((issue) => issue.severity === 'info'),
  }), [issues])

  const groups: Array<{ key: keyof typeof grouped; label: string }> = [
    { key: 'blockers', label: 'Bloqueios' },
    { key: 'warnings', label: 'Avisos' },
    { key: 'recommendations', label: 'Recomendações' },
  ]

  return (
    <section className="esmera-publication-checklist" aria-label="Checklist de publicação">
      <header>
        <div>
          <strong>{grouped.blockers.length ? 'Ainda não está pronto para publicar' : 'Pronto para publicação'}</strong>
          <span>{issues.length ? `${issues.length} verificação${issues.length === 1 ? '' : 'ões'}` : 'Nenhuma pendência encontrada'}</span>
        </div>
        <output className={grouped.blockers.length ? 'has-blockers' : 'is-ready'}>
          {grouped.blockers.length ? grouped.blockers.length : '✓'}
        </output>
      </header>
      {groups.map((group) => grouped[group.key].length ? (
        <div className={`esmera-publication-checklist__group is-${group.key}`} key={group.key}>
          <h3>{group.label}</h3>
          <ul>
            {grouped[group.key].map((issue) => (
              <li key={issue.code}>
                <button type="button" onClick={() => onNavigate?.(issue)}>{issue.message}</button>
                {issue.suggestion ? <small>{issue.suggestion}</small> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null)}
    </section>
  )
}

export function ActionBar({
  dirty,
  saving,
  published,
  publicationBlocked,
  onSave,
  onPublish,
  onUnpublish,
  secondary,
  publishLabel = 'Publicar',
}: {
  dirty?: boolean
  saving?: boolean
  published?: boolean
  publicationBlocked?: boolean
  onSave?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
  secondary?: React.ReactNode
  publishLabel?: string
}) {
  return (
    <div className="esmera-action-bar" role="region" aria-label="Ações do documento">
      <div className="esmera-action-bar__state" aria-live="polite">
        {saving ? 'Salvando…' : dirty ? 'Alterações não salvas' : 'Rascunho sincronizado'}
      </div>
      <div className="esmera-action-bar__actions">
        {secondary}
        {onSave ? <Button disabled={saving || !dirty} onClick={onSave}>Salvar rascunho</Button> : null}
        {published
          ? <Button disabled={saving} onClick={onUnpublish}>Despublicar</Button>
          : <Button tone="primary" disabled={saving || publicationBlocked} onClick={onPublish}>{publishLabel}</Button>}
      </div>
    </div>
  )
}
