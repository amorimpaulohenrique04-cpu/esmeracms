import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type PayloadRequest } from 'payload'

import {
  getReportingDrilldown,
  getReportingSnapshot,
  isReportingDrilldownKind,
  ReportingAccessError,
  type ComparisonMode,
  type ReportingFilters,
} from '../../../../server/reporting'

export const dynamic = 'force-dynamic'

function comparison(value: string | null): ComparisonMode {
  if (value === 'previous_period' || value === 'previous_year') return value
  return null
}

function filtersFrom(params: URLSearchParams): ReportingFilters {
  const from = params.get('from') || undefined
  const to = params.get('to') || undefined
  return {
    period: from || to ? { from, to } : undefined,
    compareWith: comparison(params.get('compareWith')),
    ownerId: params.get('owner') || null,
    source: params.get('source') || null,
    categoryId: params.get('category') || null,
    productId: params.get('product') || null,
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível gerar o relatório.'
}

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const url = new URL(request.url)
  const filters = filtersFrom(url.searchParams)
  const req = { payload, user, headers: request.headers } as PayloadRequest

  try {
    if (url.searchParams.get('mode') === 'drilldown') {
      const kind = url.searchParams.get('kind')
      if (!isReportingDrilldownKind(kind)) {
        return NextResponse.json({ error: 'Drill-down inválido.' }, { status: 400 })
      }
      const result = await getReportingDrilldown(req, filters, kind, url.searchParams.get('value'))
      return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    const result = await getReportingSnapshot(req, filters)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof ReportingAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    payload.logger.error({ err: error }, 'admin reporting query failed')
    return NextResponse.json({ error: message(error) }, { status: 500 })
  }
}
