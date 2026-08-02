import React from 'react'

import { normalizeAdminError } from '../state/asyncState'

export type StatusTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info'

export function Status({ tone = 'neutral', children, className = '' }: { tone?: StatusTone; children: React.ReactNode; className?: string }) {
  const toneClass = tone === 'neutral' ? '' : ` esmera-status--${tone}`
  return <span className={`esmera-status${toneClass}${className ? ` ${className}` : ''}`}>{children}</span>
}

export function LoadingState({
  label = 'Carregando dados…',
  rows = 3,
  compact = false,
}: {
  label?: string
  rows?: number
  compact?: boolean
}) {
  return (
    <div className={`esmera-state esmera-state--loading${compact ? ' is-compact' : ''}`} role="status" aria-live="polite" aria-busy="true">
      <span className="esmera-sr-only">{label}</span>
      <div aria-hidden="true" style={{ display: 'grid', gap: 8 }}>
        {Array.from({ length: Math.max(1, rows) }, (_, index) => (
          <Skeleton key={index} width={index === 0 ? '62%' : index === rows - 1 ? '76%' : '100%'} height={compact ? 10 : 14} />
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return (
    <div className="esmera-empty" data-state="empty">
      <strong>{title}</strong>
      <span>{copy}</span>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  )
}

export function IntegrationState({
  title = 'Integração não configurada',
  copy,
  action,
}: {
  title?: string
  copy: string
  action?: React.ReactNode
}) {
  return (
    <div className="esmera-state" data-state="integration-unconfigured">
      <strong>{title}</strong>
      <p>{copy}</p>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title,
  error,
  detail,
  action,
}: {
  title: string
  error?: unknown
  detail?: string
  action?: React.ReactNode
}) {
  const normalized = normalizeAdminError(error, detail || 'Não foi possível concluir esta operação.')

  return (
    <div className="esmera-error-state" role="alert" data-state="error" data-error-code={normalized.code}>
      <strong>{title}</strong>
      <p>{normalized.message}</p>
      {detail && normalized.message !== detail ? <small>{detail}</small> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 16, className = '' }: { width?: string | number; height?: string | number; className?: string }) {
  return <span className={`esmera-skeleton${className ? ` ${className}` : ''}`} style={{ width, height }} aria-hidden="true" />
}
