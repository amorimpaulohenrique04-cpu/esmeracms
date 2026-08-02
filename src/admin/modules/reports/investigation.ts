import type { NormalizedReportingFilters, ReportingDrilldownKind } from '../../../server/reporting'

export type InvestigationLevel = {
  kind: ReportingDrilldownKind
  value: string | null
  label: string
}

const stackKey = 'investigation'

export function serializeInvestigation(levels: InvestigationLevel[]) {
  return levels.map((level) => [level.kind, level.value || '', level.label].map(encodeURIComponent).join(':')).join('|')
}

export function parseInvestigation(value: string | null | undefined): InvestigationLevel[] {
  if (!value) return []
  return value.split('|').flatMap((entry) => {
    const [kind, rawValue, label] = entry.split(':').map((part) => decodeURIComponent(part || ''))
    if (!kind || !label) return []
    return [{ kind: kind as ReportingDrilldownKind, value: rawValue || null, label }]
  })
}

export function reportSearchParams(filters: NormalizedReportingFilters, investigation: InvestigationLevel[] = []) {
  const params = new URLSearchParams()
  params.set('from', filters.period.from)
  params.set('to', filters.period.to)
  if (filters.compareWith) params.set('compareWith', filters.compareWith)
  if (filters.ownerId !== null) params.set('owner', String(filters.ownerId))
  if (filters.source) params.set('source', filters.source)
  if (filters.categoryId !== null) params.set('category', String(filters.categoryId))
  if (filters.productId !== null) params.set('product', String(filters.productId))
  if (investigation.length) params.set(stackKey, serializeInvestigation(investigation))
  return params
}

export function pushInvestigation(levels: InvestigationLevel[], level: InvestigationLevel) {
  return [...levels, level]
}

export function popInvestigation(levels: InvestigationLevel[]) {
  return levels.slice(0, -1)
}

export function clearInvestigation() {
  return [] as InvestigationLevel[]
}
