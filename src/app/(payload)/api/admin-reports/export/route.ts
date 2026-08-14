import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type PayloadRequest } from 'payload'

import { canManageBusiness } from '../../../../../access/roles'
import {
  estimateReportRows,
  generateReportingPDF,
  normalizedExportFilters,
  reportExportFilename,
  resolveReportFilterLabels,
  shouldQueueAfterSnapshot,
  shouldQueueBeforeSnapshot,
  type ReportExportIdentity,
} from '../../../../../server/reporting/export'
import {
  getReportingSnapshot,
  REPORTING_SEMANTIC_VERSION,
  type ReportingFilters,
} from '../../../../../server/reporting'
import {
  GENERATE_REPORT_EXPORT_JOB,
  REPORT_EXPORT_QUEUE,
} from '../../../../../server/jobs/reportExport'

export const dynamic = 'force-dynamic'

type ExportRecord = {
  id: string | number
  status?: 'queued' | 'processing' | 'ready' | 'failed' | null
  delivery?: 'sync' | 'job' | null
  filename?: string | null
  semanticVersion?: string | null
  requestedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  snapshotGeneratedAt?: string | null
  estimatedRows?: number | null
  fileSizeBytes?: number | null
  file?: unknown
  error?: string | null
}

type ExportFile = {
  id: string | number
  url?: string | null
  filename?: string | null
  mimeType?: string | null
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível exportar o relatório.'
}

function relationshipID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function userIdentity(user: NonNullable<PayloadRequest['user']>): ReportExportIdentity {
  const record = user as unknown as { id: string | number; name?: string | null; email?: string | null }
  return {
    id: String(record.id),
    name: record.name || record.email || `Usuário ${record.id}`,
    email: record.email || null,
  }
}

async function createRecord(
  req: PayloadRequest,
  input: {
    status: 'queued' | 'processing'
    delivery: 'sync' | 'job'
    filters: ReturnType<typeof normalizedExportFilters>
    identity: ReportExportIdentity
    // ID cru do usuário autenticado (número no Postgres). `identity.id` é uma
    // string pensada para exibição no PDF; passá-la para o campo relationship
    // `requestedBy` falha a validação de tipo do Payload (espera number aqui),
    // que aparece na UI como "O campo a seguir está inválido: Requested By".
    userId: string | number
    filename: string
  },
) {
  return await req.payload.create({
    collection: 'report-exports',
    overrideAccess: true,
    req,
    data: {
      status: input.status,
      delivery: input.delivery,
      requestedAt: new Date().toISOString(),
      startedAt: input.status === 'processing' ? new Date().toISOString() : null,
      requestedBy: input.userId,
      requestedByName: input.identity.name,
      requestedByEmail: input.identity.email,
      filename: input.filename,
      semanticVersion: REPORTING_SEMANTIC_VERSION,
      filters: input.filters,
    },
  } as never) as unknown as ExportRecord
}

async function updateRecord(req: PayloadRequest, id: string | number, data: Record<string, unknown>) {
  return await req.payload.update({
    collection: 'report-exports',
    id,
    depth: 0,
    overrideAccess: true,
    req,
    data,
  } as never)
}

async function queueExport(req: PayloadRequest, record: ExportRecord) {
  await req.payload.jobs.queue({
    task: GENERATE_REPORT_EXPORT_JOB,
    queue: REPORT_EXPORT_QUEUE,
    input: { exportId: String(record.id) },
  } as never)
}

function queuedResponse(record: ExportRecord) {
  return NextResponse.json({
    id: String(record.id),
    status: 'queued',
    delivery: 'job',
    filename: record.filename,
    semanticVersion: record.semanticVersion || REPORTING_SEMANTIC_VERSION,
    pollUrl: `/api/admin-reports/export?id=${encodeURIComponent(String(record.id))}`,
  }, {
    status: 202,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

async function authenticatedRequest(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return { payload, response: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  if (!canManageBusiness(user)) {
    return { payload, response: NextResponse.json({ error: 'Seu papel não possui acesso aos relatórios comerciais.' }, { status: 403 }) }
  }
  const req = { payload, user, headers: request.headers } as PayloadRequest
  return { payload, user, req }
}

export async function POST(request: Request) {
  const auth = await authenticatedRequest(request)
  if ('response' in auth) return auth.response
  const { payload, user, req } = auth
  let record: ExportRecord | null = null

  try {
    const body = await request.json().catch(() => ({})) as { filters?: ReportingFilters }
    const filters = normalizedExportFilters(body.filters || {})
    const identity = userIdentity(user)
    const filename = reportExportFilename(filters)

    if (shouldQueueBeforeSnapshot(filters)) {
      record = await createRecord(req, { status: 'queued', delivery: 'job', filters, identity, userId: user.id, filename })
      await queueExport(req, record)
      return queuedResponse(record)
    }

    record = await createRecord(req, { status: 'processing', delivery: 'sync', filters, identity, userId: user.id, filename })
    const snapshot = await getReportingSnapshot(req, filters)
    const estimatedRows = estimateReportRows(snapshot)

    if (shouldQueueAfterSnapshot(snapshot)) {
      await updateRecord(req, record.id, {
        status: 'queued',
        delivery: 'job',
        startedAt: null,
        snapshotGeneratedAt: snapshot.generatedAt,
        semanticVersion: snapshot.semanticVersion,
        estimatedRows,
      })
      const queued = { ...record, status: 'queued' as const, delivery: 'job' as const, semanticVersion: snapshot.semanticVersion }
      await queueExport(req, queued)
      return queuedResponse(queued)
    }

    const filterLabels = await resolveReportFilterLabels(payload, snapshot.filters)
    const exportedAt = new Date().toISOString()
    const pdf = generateReportingPDF({ snapshot, identity, filterLabels, exportedAt })
    await updateRecord(req, record.id, {
      status: 'ready',
      completedAt: exportedAt,
      snapshotGeneratedAt: snapshot.generatedAt,
      semanticVersion: snapshot.semanticVersion,
      estimatedRows,
      fileSizeBytes: pdf.byteLength,
      error: null,
    })

    return new Response(pdf, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.byteLength),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Report-Export-ID': String(record.id),
        'X-Reporting-Semantic-Version': snapshot.semanticVersion,
      },
    })
  } catch (error) {
    if (record) {
      await updateRecord(req, record.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: message(error).slice(0, 4000),
      }).catch((updateError) => payload.logger.error({ err: updateError, exportID: record?.id }, 'failed to persist report export error'))
    }
    payload.logger.error({ err: error }, 'admin report export failed')
    return NextResponse.json({ error: message(error) }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await authenticatedRequest(request)
  if ('response' in auth) return auth.response
  const { payload, req } = auth
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Exportação não informada.' }, { status: 400 })

  try {
    const record = await payload.findByID({
      collection: 'report-exports',
      id: /^\d+$/.test(id) ? Number(id) : id,
      depth: 0,
      overrideAccess: true,
      req,
    } as never) as unknown as ExportRecord

    if (url.searchParams.get('download') === '1') {
      if (record.status !== 'ready') {
        return NextResponse.json({ error: 'A exportação ainda não está pronta.' }, { status: 409 })
      }
      const fileID = relationshipID(record.file)
      if (fileID === null) {
        return NextResponse.json({ error: 'Esta exportação síncrona já foi entregue diretamente ao navegador.' }, { status: 410 })
      }
      const file = await payload.findByID({
        collection: 'report-export-files',
        id: fileID,
        depth: 0,
        overrideAccess: true,
        req,
      } as never) as unknown as ExportFile
      if (!file.url) return NextResponse.json({ error: 'Arquivo da exportação indisponível.' }, { status: 404 })

      const fileURL = new URL(file.url, request.url)
      const forwardedHeaders = new Headers()
      const cookie = request.headers.get('cookie')
      const authorization = request.headers.get('authorization')
      if (cookie) forwardedHeaders.set('cookie', cookie)
      if (authorization) forwardedHeaders.set('authorization', authorization)
      const fileResponse = await fetch(fileURL, { headers: forwardedHeaders, cache: 'no-store' })
      if (!fileResponse.ok) return NextResponse.redirect(fileURL)
      const bytes = await fileResponse.arrayBuffer()
      return new Response(bytes, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': file.mimeType || 'application/pdf',
          'Content-Length': String(bytes.byteLength),
          'Content-Disposition': `attachment; filename="${record.filename || file.filename || 'esmera-relatorio.pdf'}"`,
        },
      })
    }

    const fileID = relationshipID(record.file)
    return NextResponse.json({
      id: String(record.id),
      status: record.status,
      delivery: record.delivery,
      filename: record.filename,
      semanticVersion: record.semanticVersion,
      requestedAt: record.requestedAt,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      snapshotGeneratedAt: record.snapshotGeneratedAt,
      estimatedRows: record.estimatedRows,
      fileSizeBytes: record.fileSizeBytes,
      error: record.error,
      downloadUrl: record.status === 'ready' && fileID !== null
        ? `/api/admin-reports/export?id=${encodeURIComponent(String(record.id))}&download=1`
        : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    payload.logger.error({ err: error, exportID: id }, 'admin report export status failed')
    return NextResponse.json({ error: message(error) }, { status: 500 })
  }
}
