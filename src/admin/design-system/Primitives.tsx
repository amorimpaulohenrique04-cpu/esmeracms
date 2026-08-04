import React from 'react'

export type Density = 'compact' | 'standard'
export type FeedbackTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function PageCommandBar({
  eyebrow,
  title,
  description,
  actions,
  context,
  sticky = false,
  className = '',
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  context?: React.ReactNode
  sticky?: boolean
  className?: string
}) {
  return (
    <header className={classes('esmera-command-bar', sticky && 'is-sticky', className)}>
      <div className="esmera-command-bar__main">
        <div className="esmera-command-bar__copy">
          {eyebrow ? <span className="esmera-eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="esmera-command-bar__actions">{actions}</div> : null}
      </div>
      {context ? <div className="esmera-command-bar__context">{context}</div> : null}
    </header>
  )
}

export function SegmentedControl({
  label,
  children,
  density = 'compact',
  className = '',
}: {
  label: string
  children: React.ReactNode
  density?: Density
  className?: string
}) {
  return <div className={classes('esmera-segmented-control', `is-${density}`, className)} role="group" aria-label={label}>{children}</div>
}

export function SegmentedControlLink({
  selected = false,
  className = '',
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { selected?: boolean }) {
  return <a className={classes('esmera-segmented-control__item', selected && 'is-selected', className)} aria-current={selected ? 'page' : undefined} {...props} />
}

export function SegmentedControlButton({
  selected = false,
  className = '',
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type={type} className={classes('esmera-segmented-control__item', selected && 'is-selected', className)} aria-pressed={selected} {...props} />
}

export function MetricStrip({
  children,
  columns,
  className = '',
  label = 'Indicadores',
}: {
  children: React.ReactNode
  columns?: number
  className?: string
  label?: string
}) {
  return (
    <section
      className={classes('esmera-metric-strip', 'esmera-metric-grid', className)}
      style={columns ? ({ '--esmera-metric-columns': columns } as React.CSSProperties) : undefined}
      aria-label={label}
    >
      {children}
    </section>
  )
}

export function MetricStripItem({
  label,
  value,
  meta,
  href,
  tone = 'neutral',
  active = false,
  className = '',
}: {
  label: React.ReactNode
  value: React.ReactNode
  meta?: React.ReactNode
  href?: string
  tone?: FeedbackTone
  active?: boolean
  className?: string
}) {
  const content = <><span>{label}</span><strong>{value}</strong>{meta ? <small>{meta}</small> : null}</>
  const classNames = classes('esmera-metric-strip__item', `is-${tone}`, active && 'is-active', className)
  return href ? <a className={classNames} href={href}>{content}</a> : <article className={classNames}>{content}</article>
}

export function FilterPanel({
  primary,
  advanced,
  actions,
  advancedLabel = 'Mais filtros',
  advancedActive = false,
  className = '',
}: {
  primary: React.ReactNode
  advanced?: React.ReactNode
  actions?: React.ReactNode
  advancedLabel?: string
  advancedActive?: boolean
  className?: string
}) {
  return (
    <section className={classes('esmera-filter-panel', className)} aria-label="Filtros">
      <div className="esmera-filter-panel__primary">{primary}</div>
      {actions ? <div className="esmera-filter-panel__actions">{actions}</div> : null}
      {advanced ? (
        <details className="esmera-filter-panel__advanced" open={advancedActive || undefined}>
          <summary>{advancedLabel}{advancedActive ? ' · ativos' : ''}</summary>
          <div className="esmera-filter-panel__advanced-panel">{advanced}</div>
        </details>
      ) : null}
    </section>
  )
}

export function SplitWorkspace({
  master,
  detail,
  hasDetail = Boolean(detail),
  detailWidth = 'minmax(380px, 1.15fr)',
  className = '',
}: {
  master: React.ReactNode
  detail?: React.ReactNode
  hasDetail?: boolean
  detailWidth?: string
  className?: string
}) {
  return (
    <div
      className={classes('esmera-split-workspace', hasDetail && 'has-detail', className)}
      style={{ '--esmera-detail-width': detailWidth } as React.CSSProperties}
    >
      <div className="esmera-split-workspace__master">{master}</div>
      {detail ? <div className="esmera-split-workspace__detail">{detail}</div> : null}
    </div>
  )
}

export function ContextInspector({
  header,
  children,
  footer,
  open = true,
  className = '',
  label = 'Detalhes do registro',
}: {
  header?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  open?: boolean
  className?: string
  label?: string
}) {
  if (!open) return null
  return (
    <aside className={classes('esmera-context-inspector', className)} aria-label={label}>
      {header ? <header className="esmera-context-inspector__header">{header}</header> : null}
      <div className="esmera-context-inspector__body">{children}</div>
      {footer ? <footer className="esmera-context-inspector__footer">{footer}</footer> : null}
    </aside>
  )
}

export function DataSection({
  eyebrow,
  title,
  description,
  action,
  children,
  compact = false,
  className = '',
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <section className={classes('esmera-data-section', compact && 'is-compact', className)}>
      <header className="esmera-data-section__header">
        <div>
          {eyebrow ? <span className="esmera-eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="esmera-data-section__action">{action}</div> : null}
      </header>
      <div className="esmera-data-section__body">{children}</div>
    </section>
  )
}

export function EmptyVisualization({
  title,
  description,
  action,
  compact = false,
  className = '',
}: {
  title: React.ReactNode
  description: React.ReactNode
  action?: React.ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={classes('esmera-empty-visualization', compact && 'is-compact', className)} data-state="empty-visualization">
      <span className="esmera-empty-visualization__mark" aria-hidden="true" />
      <div><strong>{title}</strong><p>{description}</p></div>
      {action ? <div>{action}</div> : null}
    </div>
  )
}

export function InlineFeedback({
  children,
  tone = 'neutral',
  busy = false,
  className = '',
}: {
  children: React.ReactNode
  tone?: FeedbackTone
  busy?: boolean
  className?: string
}) {
  return <div className={classes('esmera-inline-feedback', `is-${tone}`, busy && 'is-busy', className)} role="status" aria-live="polite" aria-busy={busy || undefined}>{children}</div>
}

export function SectionNav({ label = 'Seções', children, className = '' }: { label?: string; children: React.ReactNode; className?: string }) {
  return <nav className={classes('esmera-section-nav', className)} aria-label={label}>{children}</nav>
}

export function SectionNavLink({ active = false, className = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }) {
  return <a className={classes('esmera-section-nav__link', active && 'is-active', className)} aria-current={active ? 'page' : undefined} {...props} />
}

export function QuickActionMenu({
  label = 'Mais ações',
  children,
  align = 'end',
  className = '',
}: {
  label?: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'end'
  className?: string
}) {
  return (
    <details className={classes('esmera-quick-actions', `is-${align}`, className)}>
      <summary className="esmera-button">{label}<span aria-hidden="true">⌄</span></summary>
      <div className="esmera-quick-actions__menu">{children}</div>
    </details>
  )
}

export function QuickActionItem({ className = '', ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={classes('esmera-quick-actions__item', className)} {...props} />
}
