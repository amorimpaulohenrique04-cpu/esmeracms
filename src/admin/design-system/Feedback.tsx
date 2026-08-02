import React from 'react'

import { normalizeAdminError } from '../state/asyncState'

export type StatusTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info'
export type StateKind = 'loading' | 'empty-result' | 'empty-system' | 'integration-unconfigured' | 'partial-data' | 'permission-denied' | 'recoverable-error' | 'destructive-error' | 'saving' | 'saved' | 'rollback'

export function Status({ tone = 'neutral', children, className = '' }: { tone?: StatusTone; children: React.ReactNode; className?: string }) {
  const toneClass = tone === 'neutral' ? '' : ` esmera-status--${tone}`
  return <span className={`esmera-status${toneClass}${className ? ` ${className}` : ''}`}>{children}</span>
}

export function StatePanel({
  kind,
  title,
  copy,
  detail,
  action,
  compact = false,
  live = false,
}: {
  kind: StateKind
  title: React.ReactNode
  copy?: React.ReactNode
  detail?: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
  live?: boolean
}) {
  const error = kind === 'recoverable-error' || kind === 'destructive-error'
  return (
    <div
      className={`esmera-state-panel is-${kind}${compact ? ' is-compact' : ''}`}
      data-state={kind}
      role={error ? 'alert' : live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-busy={kind === 'loading' || kind === 'saving' ? true : undefined}
    >
      <span className="esmera-state-panel__mark" aria-hidden="true" />
      <div className="esmera-state-panel__copy">
        <strong>{title}</strong>
        {copy ? <p>{copy}</p> : null}
        {detail ? <small>{detail}</small> : null}
      </div>
      {action ? <div className="esmera-state-panel__action">{action}</div> : null}
    </div>
  )
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
    <div className={`esmera-state esmera-state--loading${compact ? ' is-compact' : ''}`} role="status" aria-live="polite" aria-busy="true" data-state="loading">
      <span className="esmera-sr-only">{label}</span>
      <div aria-hidden="true" style={{ display: 'grid', gap: 8 }}>
        {Array.from({ length: Math.max(1, rows) }, (_, index) => (
          <Skeleton key={index} width={index === 0 ? '62%' : index === rows - 1 ? '76%' : '100%'} height={compact ? 10 : 14} />
        ))}
      </div>
    </div>
  )
}

export function EmptyState({ title, copy, action, system = false }: { title: string; copy: string; action?: React.ReactNode; system?: boolean }) {
  return <StatePanel kind={system ? 'empty-system' : 'empty-result'} title={title} copy={copy} action={action} />
}

export function IntegrationState({ title = 'Integração não configurada', copy, action }: { title?: string; copy: string; action?: React.ReactNode }) {
  return <StatePanel kind="integration-unconfigured" title={title} copy={copy} action={action} />
}

export function PartialDataState({ title = 'Dados parciais', copy, detail, action }: { title?: string; copy: string; detail?: string; action?: React.ReactNode }) {
  return <StatePanel kind="partial-data" title={title} copy={copy} detail={detail} action={action} />
}

export function PermissionState({ title = 'Acesso restrito', copy }: { title?: string; copy: string }) {
  return <StatePanel kind="permission-denied" title={title} copy={copy} />
}

export function ErrorState({
  title,
  error,
  detail,
  action,
  destructive = false,
}: {
  title: string
  error?: unknown
  detail?: string
  action?: React.ReactNode
  destructive?: boolean
}) {
  const normalized = normalizeAdminError(error, detail || 'Não foi possível concluir esta operação.')
  return (
    <StatePanel
      kind={destructive ? 'destructive-error' : 'recoverable-error'}
      title={title}
      copy={normalized.message}
      detail={detail && normalized.message !== detail ? detail : undefined}
      action={action}
    />
  )
}

export function SavingState({ state, message }: { state: 'saving' | 'saved' | 'rollback'; message?: string }) {
  const defaults = {
    saving: 'Salvando alterações…',
    saved: 'Alterações salvas.',
    rollback: 'A alteração não foi salva e o estado anterior foi restaurado.',
  }
  return <StatePanel kind={state} title={message || defaults[state]} compact live />
}

export function Skeleton({ width = '100%', height = 16, className = '' }: { width?: string | number; height?: string | number; className?: string }) {
  return <span className={`esmera-skeleton${className ? ` ${className}` : ''}`} style={{ width, height }} aria-hidden="true" />
}
