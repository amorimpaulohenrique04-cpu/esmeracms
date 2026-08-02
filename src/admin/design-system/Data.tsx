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

export function BulkActionBar({ count, children, className = '' }: { count: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={`esmera-bulk-bar${className ? ` ${className}` : ''}`} role="region" aria-label="Ações em lote">
      <strong>{count} {count === 1 ? 'item selecionado' : 'itens selecionados'}</strong>
      <div className="esmera-actions">{children}</div>
    </div>
  )
}
