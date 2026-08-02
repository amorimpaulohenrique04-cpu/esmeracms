/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps } from 'payload'

import {
  getReportingSnapshot,
  type ComparisonMode,
  type ReportingFilters,
} from '../../../server/reporting'
import {
  AccessDenied,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  ViewFrame,
} from '../../views/shared'
import { ReportExportControl } from './ReportExportControl'
import { ReportsWorkspaceClient } from './ReportsWorkspaceClient'
import './report-export.scss'
import './reports.scss'

type OptionRecord = {
  id: string | number
  name?: string | null
  email?: string | null
  title?: string | null
  code?: string | null
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function comparison(value: string | undefined): ComparisonMode {
  if (value === 'previous_period' || value === 'previous_year') return value
  return null
}

function filtersFrom(params: Record<string, string | string[] | undefined>): ReportingFilters {
  const from = first(params.from)
  const to = first(params.to)
  return {
    period: from || to ? { from, to } : undefined,
    compareWith: comparison(first(params.compareWith)),
    ownerId: first(params.owner) || null,
    source: first(params.source) || null,
    categoryId: first(params.category) || null,
    productId: first(params.product) || null,
  }
}

function optionLabel(item: OptionRecord, fallback: string) {
  return item.name || item.title || item.email || item.code || `${fallback} ${item.id}`
}

export async function ReportsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'business')
  if (!allowed) return <AccessDenied props={props} area="comercial" />

  const req = props.initPageResult.req
  const filters = filtersFrom(await paramsOf(props))

  try {
    const [initialData, usersResult, productsResult, categoriesResult] = await Promise.all([
      getReportingSnapshot(req, filters),
      findDocs<OptionRecord>(req, 'users', {
        sort: 'name',
        limit: 100,
        depth: 0,
        select: { id: true, name: true, email: true },
      }),
      findDocs<OptionRecord>(req, 'products', {
        sort: 'title',
        limit: 500,
        depth: 0,
        draft: true,
        select: { id: true, title: true, code: true },
      }),
      findDocs<OptionRecord>(req, 'categories', {
        sort: 'order',
        limit: 300,
        depth: 0,
        draft: true,
        select: { id: true, title: true },
      }),
    ])

    return <ViewFrame props={props}>
      <PageHeader
        eyebrow="Inteligência comercial"
        title="Relatórios"
        subtitle="Investigação orientada por métricas: comece pelo indicador, aprofunde o segmento e abra os registros reais sem perder o período."
        actions={<ReportExportControl />}
      />
      <ReportsWorkspaceClient
        key={JSON.stringify(initialData.filters)}
        initialData={initialData}
        users={usersResult.docs.map((item) => ({ id: item.id, label: optionLabel(item, 'Usuário') }))}
        products={productsResult.docs.map((item) => ({ id: item.id, label: optionLabel(item, 'Produto') }))}
        categories={categoriesResult.docs.map((item) => ({ id: item.id, label: optionLabel(item, 'Categoria') }))}
      />
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Relatórios" subtitle="Inteligência comercial" /><QueryError title="Não foi possível gerar os relatórios" error={error} /></ViewFrame>
  }
}
