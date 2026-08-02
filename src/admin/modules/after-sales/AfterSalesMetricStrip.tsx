import Link from 'next/link'
import React from 'react'

import type { AfterSalesFilters } from './types'
import { filterHref } from './workspace'

type Props = {
  filters: AfterSalesFilters
  metrics: {
    today: number
    overdue: number
    occurrences: number
    deliveries: number
  }
}

export function AfterSalesMetricStrip({ filters, metrics }: Props) {
  return (
    <nav className="esmera-after-sales-metrics" aria-label="Filtros rápidos do pós-venda">
      <Link className={filters.focus === 'today' ? 'is-active' : ''} href={filterHref(filters, 'today')}>
        <span>Follow-ups hoje</span><strong>{metrics.today}</strong><small>Tasks abertas com prazo hoje</small>
      </Link>
      <Link className={filters.focus === 'overdue' ? 'is-active is-danger' : 'is-danger'} href={filterHref(filters, 'overdue')}>
        <span>Atrasados</span><strong>{metrics.overdue}</strong><small>Tasks abertas com prazo vencido</small>
      </Link>
      <Link className={filters.focus === 'occurrences' ? 'is-active' : ''} href={filterHref(filters, 'occurrences')}>
        <span>Ocorrências abertas</span><strong>{metrics.occurrences}</strong><small>Casos ainda não resolvidos</small>
      </Link>
      <Link className={filters.focus === 'deliveries' ? 'is-active' : ''} href={filterHref(filters, 'deliveries')}>
        <span>Entregas ativas</span><strong>{metrics.deliveries}</strong><small>Estados ainda em andamento</small>
      </Link>
    </nav>
  )
}
