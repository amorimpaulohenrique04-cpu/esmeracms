import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Payload, type PayloadRequest } from 'payload'

import { canManageSite } from '../../../../access/roles'
import {
  importColumnLabels,
  importColumns,
  templateRows,
} from '../../../../businessRules/products/importSchema'
import { toCsv } from '../../../../server/domain/products/csv'
import {
  commitImport,
  previewImport,
  type ImportCommitInput,
  type ImportRowResult,
} from '../../../../server/domain/products/importOperations'
import { createProductImportXlsxTemplate } from '../../../../server/domain/products/xlsxTemplate'
import { PRODUCT_IMPORT_JOB, PRODUCT_IMPORT_QUEUE } from '../../../../server/jobs/productImport'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 4 * 1024 * 1024
const MAX_ROWS = 2_000
const SYNC_ROWS = 25

let payloadInstance: Payload | null = null
async function cms() {
  if (!payloadInstance) payloadInstance = await getPayload({ config })
  return payloadInstance
}

type Body = {
  action?: 'preview' | 'commit' | 'cancel'
  text?: string
  rows?: ImportCommitInput[]
  idempotencyKey?: string
  importId?: string
}

type ProductImportRecord = {
  id: string | number
  status?: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled' | null
  idempotencyKey?: string | null
  requestedBy?: unknown
  requestedAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  totalRows?: number | null
  processedRows?: number | null
  created?: number | null
  updated?: number | null
  skipped?: number | null
  errored?: number | null
  payloadSnapshot?: unknown
  results?: unknown
  error?: string | null
}

type RequestUser = { id: string | number; role?: string | null }

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível processar a importação.'
}

function storedID(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

function relationshipID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function canAccessImport(record: ProductImportRecord, user: RequestUser) {
  if (user.role === 'admin') return true
  const requestedBy = relationshipID(record.requestedBy)
  return requestedBy !== null && String(requestedBy) === String(user.id)
}

function bodyTooLarge(request: Request) {
  const length = Number(request.headers.get('content-length') || 0)
  return Number.isFinite(length) && length > MAX_BODY_BYTES
}

async function authenticatedRequest(request: Request) {
  const payload = await cms()
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return { payload, response: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  if (!canManageSite(user)) {
    return { payload, response: NextResponse.json({ error: 'Sem permissão para importar produtos.' }, { status: 403 }) }
  }
  const req = { payload, user, headers: request.headers } as PayloadRequest
  return { payload, user, req }
}

function rowsAsSheet(rows: ImportCommitInput[]) {
  return toCsv([
    importColumns.map((column) => importColumnLabels[column]),
    ...rows.map((row) => importColumns.map((column) => row.values[column] || '')),
  ])
}

async function findByIdempotency(req: PayloadRequest, key: string) {
  const found = await req.payload.find({
    collection: 'product-imports',
    where: { idempotencyKey: { equals: key } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
  } as never)
  return (found.docs[0] || null) as unknown as ProductImportRecord | null
}

function queuedResponse(record: ProductImportRecord) {
  return NextResponse.json({
    importId: String(record.id),
    status: record.status || 'queued',
    totalRows: record.totalRows || 0,
    processedRows: record.processedRows || 0,
    pollUrl: `/api/admin-products-import?importId=${encodeURIComponent(String(record.id))}`,
  }, {
    status: 202,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

async function createImport(req: PayloadRequest, key: string, rows: ImportCommitInput[]) {
  const user = req.user as unknown as { id: string | number; name?: string | null; email?: string | null }
  return await req.payload.create({
    collection: 'product-imports',
    overrideAccess: true,
    req,
    data: {
      status: 'queued',
      idempotencyKey: key,
      requestedBy: user.id,
      requestedByName: user.name || user.email || null,
      requestedByEmail: user.email || null,
      requestedAt: new Date().toISOString(),
      totalRows: rows.length,
      processedRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errored: 0,
      payloadSnapshot: rows,
      results: [],
    },
  } as never) as unknown as ProductImportRecord
}

async function queueImport(req: PayloadRequest, record: ProductImportRecord) {
  await req.payload.jobs.queue({
    task: PRODUCT_IMPORT_JOB,
    queue: PRODUCT_IMPORT_QUEUE,
    input: { importId: String(record.id) },
  } as never)
}

async function readImport(req: PayloadRequest, id: string) {
  return await req.payload.findByID({
    collection: 'product-imports',
    id: storedID(id),
    depth: 0,
    overrideAccess: true,
    req,
  } as never) as unknown as ProductImportRecord
}

function errorCsv(record: ProductImportRecord) {
  const snapshot = Array.isArray(record.payloadSnapshot) ? record.payloadSnapshot as ImportCommitInput[] : []
  const results = Array.isArray(record.results) ? record.results as ImportRowResult[] : []
  const errors = new Map(results.filter((row) => row.status === 'error').map((row) => [row.rowIndex, row.error || 'Falha desconhecida']))
  return toCsv([
    [...importColumns.map((column) => importColumnLabels[column]), 'linha_origem', 'erro'],
    ...snapshot.filter((row) => errors.has(row.rowIndex)).map((row) => [
      ...importColumns.map((column) => row.values[column] || ''),
      String(row.sourceLine ?? row.rowIndex + 2),
      errors.get(row.rowIndex) || '',
    ]),
  ])
}

export async function GET(request: Request) {
  const auth = await authenticatedRequest(request)
  if ('response' in auth) return auth.response
  const { req, user } = auth
  const url = new URL(request.url)
  const importId = url.searchParams.get('importId')

  if (!importId) {
    if (url.searchParams.get('template') === 'xlsx') {
      const workbook = createProductImportXlsxTemplate()
      return new NextResponse(new Uint8Array(workbook), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="modelo-importacao-produtos.xlsx"',
          'Cache-Control': 'no-store',
        },
      })
    }

    const csv = toCsv(templateRows())
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="modelo-importacao-produtos.csv"',
        'Cache-Control': 'no-store',
      },
    })
  }

  try {
    const record = await readImport(req, importId)
    if (!canAccessImport(record, user as RequestUser)) {
      return NextResponse.json({ error: 'Você não pode acessar esta importação.' }, { status: 403 })
    }
    if (url.searchParams.get('format') === 'csv') {
      const csv = errorCsv(record)
      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="erros-importacao-${String(record.id)}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    return NextResponse.json({
      importId: String(record.id),
      status: record.status,
      requestedAt: record.requestedAt,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      totalRows: record.totalRows || 0,
      processedRows: record.processedRows || 0,
      created: record.created || 0,
      updated: record.updated || 0,
      skipped: record.skipped || 0,
      errored: record.errored || 0,
      results: record.results || [],
      error: record.error || null,
      errorCsvUrl: Number(record.errored || 0) > 0
        ? `/api/admin-products-import?importId=${encodeURIComponent(String(record.id))}&format=csv`
        : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    req.payload.logger.error({ err: error, importId }, 'admin product import status failed')
    return NextResponse.json({ error: message(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticatedRequest(request)
  if ('response' in auth) return auth.response
  const { payload, user, req } = auth
  if (bodyTooLarge(request)) return NextResponse.json({ error: 'Arquivo maior que 4 MB. Divida a importação em lotes menores.' }, { status: 413 })

  let body: Body
  try {
    body = await request.json() as Body
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'preview') {
      if (typeof body.text !== 'string' || !body.text.trim()) {
        return NextResponse.json({ error: 'Envie um arquivo ou cole os dados antes de pré-visualizar.' }, { status: 400 })
      }
      const data = await previewImport(payload, user as never, body.text, req)
      if (data.rows.length > MAX_ROWS) {
        return NextResponse.json({ error: `Limite de ${MAX_ROWS} linhas por importação.` }, { status: 400 })
      }
      return NextResponse.json(data)
    }

    if (body.action === 'cancel') {
      if (!body.importId) return NextResponse.json({ error: 'Importação não informada.' }, { status: 400 })
      const record = await readImport(req, body.importId)
      if (!canAccessImport(record, user as RequestUser)) {
        return NextResponse.json({ error: 'Você não pode cancelar esta importação.' }, { status: 403 })
      }
      if (record.status === 'completed' || record.status === 'completed_with_errors' || record.status === 'failed') {
        return NextResponse.json({ error: 'Esta importação já foi finalizada.' }, { status: 409 })
      }
      await payload.update({
        collection: 'product-imports',
        id: record.id,
        overrideAccess: true,
        req,
        data: { status: 'cancelled', completedAt: new Date().toISOString() },
      } as never)
      return NextResponse.json({ importId: String(record.id), status: 'cancelled' })
    }

    if (body.action === 'commit') {
      if (!Array.isArray(body.rows) || !body.rows.length) {
        return NextResponse.json({ error: 'Nenhuma linha para importar.' }, { status: 400 })
      }
      if (body.rows.length > MAX_ROWS) {
        return NextResponse.json({ error: `Limite de ${MAX_ROWS} linhas por importação.` }, { status: 400 })
      }

      const preflight = await previewImport(payload, user as never, rowsAsSheet(body.rows), req)
      if (preflight.blockingCount > 0) {
        return NextResponse.json({
          error: 'A importação contém pendências. Revalide a planilha antes de confirmar.',
          blockingCount: preflight.blockingCount,
          rows: preflight.rows,
        }, { status: 422 })
      }

      if (body.rows.length <= SYNC_ROWS) {
        return NextResponse.json(await commitImport(payload, user as never, body.rows, { req, chunkSize: SYNC_ROWS }))
      }

      const key = body.idempotencyKey?.trim()
      if (!key || key.length > 120) {
        return NextResponse.json({ error: 'Chave de idempotência ausente ou inválida.' }, { status: 400 })
      }
      const existing = await findByIdempotency(req, key)
      if (existing) {
        if (!canAccessImport(existing, user as RequestUser)) {
          return NextResponse.json({ error: 'Chave de idempotência já utilizada.' }, { status: 409 })
        }
        return queuedResponse(existing)
      }

      let record: ProductImportRecord | null = null
      try {
        record = await createImport(req, key, body.rows)
        await queueImport(req, record)
        return queuedResponse(record)
      } catch (error) {
        if (record) {
          await payload.update({
            collection: 'product-imports',
            id: record.id,
            overrideAccess: true,
            req,
            data: { status: 'failed', completedAt: new Date().toISOString(), error: message(error).slice(0, 4000) },
          } as never).catch(() => undefined)
        }
        throw error
      }
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin products import failed')
    return NextResponse.json({ error: message(error) }, { status: 500 })
  }
}
