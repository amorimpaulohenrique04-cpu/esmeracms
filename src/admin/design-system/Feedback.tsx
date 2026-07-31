import React from 'react'

export type StatusTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info'

export function Status({ tone = 'neutral', children, className = '' }: { tone?: StatusTone; children: React.ReactNode; className?: string }) {
  const toneClass = tone === 'neutral' ? '' : ` esmera-status--${tone}`
  return <span className={`esmera-status${toneClass}${className ? ` ${className}` : ''}`}>{children}</span>
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return (
    <div className="esmera-empty">
      <strong>{title}</strong>
      <span>{copy}</span>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  )
}

export function ErrorState({ title, error, detail }: { title: string; error?: unknown; detail?: string }) {
  return (
    <div className="esmera-error-state" role="alert">
      <strong>{title}</strong>
      <p>{error instanceof Error ? error.message : detail || 'Não foi possível concluir esta operação.'}</p>
      {detail && error instanceof Error ? <small>{detail}</small> : null}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 16, className = '' }: { width?: string | number; height?: string | number; className?: string }) {
  return <span className={`esmera-skeleton${className ? ` ${className}` : ''}`} style={{ width, height }} aria-hidden="true" />
}
