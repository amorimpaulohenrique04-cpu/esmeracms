import React from 'react'

export function DataTable({ children, label, className = '' }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <div className={`esmera-data-table-wrap${className ? ` ${className}` : ''}`}>
      <table className="esmera-data-table" aria-label={label}>{children}</table>
    </div>
  )
}

export function FilterBar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`esmera-filter-bar${className ? ` ${className}` : ''}`}>{children}</div>
}

export function Inspector({ header, children, footer, className = '' }: { header?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <aside className={`esmera-inspector${className ? ` ${className}` : ''}`}>
      {header ? <div className="esmera-inspector-header">{header}</div> : null}
      <div className="esmera-inspector-body">{children}</div>
      {footer ? <div className="esmera-inspector-header">{footer}</div> : null}
    </aside>
  )
}

export function BulkActionBar({
  count,
  subtitle,
  footer,
  children,
  className = '',
}: {
  count: number
  subtitle?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const title = `${count} ${count === 1 ? 'item selecionado' : 'itens selecionados'}`
  // Painel recolhível nativo (<details>): sem JS/estado, o cabeçalho é o
  // disclosure acessível e o corpo agrupa as ações em seções rotuladas em vez
  // de uma fileira única que estoura a largura.
  return (
    <details className={`esmera-bulk-panel${className ? ` ${className}` : ''}`} open aria-label="Ações em lote">
      <summary className="esmera-bulk-panel__header">
        <span className="esmera-bulk-panel__heading">
          <strong>{title}</strong>
          {subtitle ? <span className="esmera-bulk-panel__subtitle">{subtitle}</span> : null}
        </span>
        <span className="esmera-bulk-panel__toggle" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
        </span>
      </summary>
      <div className="esmera-bulk-panel__body">{children}</div>
      {footer ? <div className="esmera-bulk-panel__footer">{footer}</div> : null}
    </details>
  )
}
