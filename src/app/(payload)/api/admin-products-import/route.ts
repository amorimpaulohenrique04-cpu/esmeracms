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
  parseImportSheet,
  previewImportRows,
  type ImportCommitInput,
  type ImportRowResult,
} from '../../../../server/domain/products/importOperations'
import { advanceResumableImport, cancelResumableImport, withImportOwnerLock } from '../../../../server/domain/products/resumableImport'
import { createProductImportXlsxTemplate } from '../../../../server/domain/products/xlsxTemplate'
import { PRODUCT_IMPORT_JOB, PRODUCT_IMPORT_QUEUE } from '../../../../server/jobs/productImport'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BODY_BYTES = 4 * 1024 * 1024
const MAX_ROWS = 2_000
const SYNC_ROWS = 25

let payloadInstance: Payload | null = null
async function cms() {
  if (!payloadInstance) payloadInstance = await getPayload({ config })
  return payloadInstance
}

type Body = {
  action?: 'preview' | 'start' | 'advance' | 'commit' | 'cancel'
  text?: string
  rows?: unknown
  idempotencyKey?: string
  importId?: string
  cursor?: number
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
  resumable?: boolean | null
  leaseUntil?: string | null
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

function normalizeRows(input: unknown): ImportCommitInput[] | null {
  if (!Array.isArray(input) || !input.length || input.length > MAX_ROWS) return null
  const seen = new Set<number>()
  const rows: ImportCommitInput[] = []
  for (const row of input) {
    if (!row || typeof row !== 'object' || !row.values || typeof row.values !== 'object' ||
        !Number.isSafeInteger(row.rowIndex) || row.rowIndex < 0 || seen.has(row.rowIndex) ||
        (row.sourceLine !== undefined && (!Number.isSafeInteger(row.sourceLine) || row.sourceLine < 1)) ||
        importColumns.some((column) => typeof row.values[column] !== 'string')) return null
    seen.add(row.rowIndex)
    rows.push({
      rowIndex: row.rowIndex,
      sourceLine: row.sourceLine ?? row.rowIndex + 2,
      values: Object.fromEntries(importColumns.map((column) => [column, row.values[column].trim()])) as ImportCommitInput['values'],
      onConflict: row.onConflict === 'update' ? 'update' : 'skip',
    })
  }
  return rows
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

async function createImport(req: PayloadRequest, key: string, rows: ImportCommitInput[], resumable = false) {
  const user = req.user as unknown as { id: string | number; name?: string | null; email?: string | null }
  return await req.payload.create({
    collection: 'product-imports',
    overrideAccess: true,
    req,
    data: {
      status: 'queued',
      resumable,
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

const statusFields = {
  status: true, requestedBy: true, requestedAt: true, startedAt: true, completedAt: true,
  totalRows: true, processedRows: true, created: true, updated: true, skipped: true, errored: true,
  error: true, resumable: true, leaseUntil: true,
} as const

async function readImport(req: PayloadRequest, id: string, select?: Record<string, true>) {
  return await req.payload.findByID({
    collection: 'product-imports',
    id: storedID(id),
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
    select,
  } as never) as unknown as ProductImportRecord | null
}

function errorRows(record: ProductImportRecord) {
  const snapshot = Array.isArray(record.payloadSnapshot) ? record.payloadSnapshot as ImportCommitInput[] : []
  const results = Array.isArray(record.results) ? record.results as ImportRowResult[] : []
  const errors = new Map(results.filter((row) => row.status === 'error').map((row) => [row.rowIndex, row.error || 'Falha desconhecida']))
  return snapshot.filter((row) => errors.has(row.rowIndex)).map((row) => ({ ...row, error: errors.get(row.rowIndex) }))
}

function errorCsv(record: ProductImportRecord) {
  return toCsv([
    [...importColumns.map((column) => importColumnLabels[column]), 'linha_origem', 'erro'],
    ...errorRows(record).map((row) => [
      ...importColumns.map((column) => row.values[column] || ''),
      String(row.sourceLine ?? row.rowIndex + 2),
      row.error || '',
    ]),
  ])
}

function active(record: ProductImportRecord) {
  return record.status === 'queued' || record.status === 'processing'
}

function previewResponse(data: object, status = 200) {
  const json = JSON.stringify(data)
  if (Buffer.byteLength(json) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'A prévia ficou grande demais. Divida a planilha em lotes menores.' }, { status: 413 })
  }
  return new NextResponse(json, { status, headers: { 'Content-Type': 'application/json' } })
}

function statusResponse(record: ProductImportRecord, status = 200) {
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
    working: Boolean(active(record) && record.leaseUntil && Date.parse(record.leaseUntil) > Date.now()),
    errorCsvUrl: Number(record.errored || 0) > 0
      ? `/api/admin-products-import?importId=${encodeURIComponent(String(record.id))}&format=csv`
      : null,
  }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

async function findOwnResumable(req: PayloadRequest, activeOnly: boolean) {
  const found = await req.payload.find({
    collection: 'product-imports',
    where: { and: [
      { requestedBy: { equals: req.user!.id } },
      { resumable: { equals: true } },
      ...(activeOnly ? [{ status: { in: ['queued', 'processing'] } }] : []),
    ] },
    sort: '-requestedAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
    select: statusFields,
  } as never)
  return found.docs[0] as unknown as ProductImportRecord | undefined
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticatedRequest(request)
  if (auth.response) return auth.response
  const { req, user } = auth
  const url = new URL(request.url)
  const importId = url.searchParams.get('importId')

  if (!importId) {
    if (url.searchParams.has('latest')) {
      const record = await findOwnResumable(req, true) || await findOwnResumable(req, false)
      return record ? statusResponse(record) : new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })
    }
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
    const format = url.searchParams.get('format')
    const record = await readImport(req, importId, format ? undefined : statusFields)
    if (!record) return NextResponse.json({ error: 'Importação não encontrada.' }, { status: 404 })
    if (!canAccessImport(record, user as RequestUser)) {
      return NextResponse.json({ error: 'Você não pode acessar esta importação.' }, { status: 403 })
    }
    if (format === 'retry' && !active(record)) {
      return NextResponse.json({ rows: errorRows(record) }, { headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (format === 'csv') {
      const csv = errorCsv(record)
      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="erros-importacao-${String(record.id)}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    if (!record.resumable || !active(record)) {
      const details = await readImport(req, importId, { results: true })
      record.results = details?.results
    }
    return statusResponse(record)
  } catch (error) {
    req.payload.logger.error({ err: error, importId }, 'admin product import status failed')
    return NextResponse.json({ error: message(error) }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticatedRequest(request)
  if (auth.response) return auth.response
  const { payload, user, req } = auth
  if (bodyTooLarge(request)) return NextResponse.json({ error: 'Arquivo maior que 4 MB. Divida a importação em lotes menores.' }, { status: 413 })

  let body: Body
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return NextResponse.json({ error: 'Dados maiores que 4 MB. Divida a importação em lotes menores.' }, { status: 413 })
    body = JSON.parse(raw) as Body
    if (!body || typeof body !== 'object') throw new Error('Corpo inválido.')
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'preview') {
      if (body.rows !== undefined) {
        const rows = normalizeRows(body.rows)
        if (!rows) return NextResponse.json({ error: 'Linhas da planilha inválidas.' }, { status: 400 })
        return previewResponse(await previewImportRows(payload, user as never, rows, req))
      }
      if (typeof body.text !== 'string' || !body.text.trim()) {
        return NextResponse.json({ error: 'Envie um arquivo ou cole os dados antes de pré-visualizar.' }, { status: 400 })
      }
      const { rows, unknownHeaders, delimiter } = parseImportSheet(body.text, MAX_ROWS + 1)
      if (rows.length > MAX_ROWS) {
        return NextResponse.json({ error: `Limite de ${MAX_ROWS} linhas por importação.` }, { status: 400 })
      }
      const data = await previewImportRows(payload, user as never, rows.map((row, rowIndex) => ({ ...row, rowIndex })), req)
      return previewResponse({ ...data, unknownHeaders, delimiter })
    }

    if (body.action === 'advance') {
      if (typeof body.importId !== 'string' || typeof body.cursor !== 'number' || !Number.isSafeInteger(body.cursor) || body.cursor < 0) {
        return NextResponse.json({ error: 'Importação ou posição inválida.' }, { status: 400 })
      }
      const record = await readImport(req, body.importId, statusFields)
      if (!record) return NextResponse.json({ error: 'Importação não encontrada.' }, { status: 404 })
      if (String(relationshipID(record.requestedBy)) !== String(user.id)) {
        return NextResponse.json({ error: 'Somente quem enviou a planilha pode retomar esta importação.' }, { status: 403 })
      }
      if (!record.resumable) return NextResponse.json({ error: 'Esta importação é processada pela fila.' }, { status: 409 })
      if (active(record) && body.cursor === record.processedRows) {
        try {
          await advanceResumableImport(req, record.id, body.cursor)
        } catch (error) {
          payload.logger.error({ err: error, importId: record.id, cursor: body.cursor }, 'product import slice failed')
          return NextResponse.json({ error: 'Não foi possível confirmar esta etapa. Retome a partir da última linha salva.' }, { status: 503 })
        }
      }
      const current = await readImport(req, body.importId, statusFields)
      return current ? statusResponse(current) : NextResponse.json({ error: 'Importação não encontrada.' }, { status: 404 })
    }

    if (body.action === 'cancel') {
      if (typeof body.importId !== 'string' || !body.importId) return NextResponse.json({ error: 'Importação não informada.' }, { status: 400 })
      const record = await readImport(req, body.importId, statusFields)
      if (!record) return NextResponse.json({ error: 'Importação não encontrada.' }, { status: 404 })
      if (!canAccessImport(record, user as RequestUser)) {
        return NextResponse.json({ error: 'Você não pode cancelar esta importação.' }, { status: 403 })
      }
      if (record.status === 'completed' || record.status === 'completed_with_errors' || record.status === 'failed') {
        return NextResponse.json({ error: 'Esta importação já foi finalizada.' }, { status: 409 })
      }
      if (record.resumable) {
        if (!await cancelResumableImport(req, record.id)) return NextResponse.json({ error: 'Esta importação já foi finalizada.' }, { status: 409 })
        const cancelled = await readImport(req, body.importId, statusFields)
        return statusResponse(cancelled || { ...record, status: 'cancelled' })
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

    if (body.action === 'start' || body.action === 'commit') {
      if (!Array.isArray(body.rows) || !body.rows.length) {
        return NextResponse.json({ error: 'Nenhuma linha para importar.' }, { status: 400 })
      }
      if (body.rows.length > MAX_ROWS) {
        return NextResponse.json({ error: `Limite de ${MAX_ROWS} linhas por importação.` }, { status: 400 })
      }

      const rows = normalizeRows(body.rows)
      if (!rows) return NextResponse.json({ error: 'Linhas da planilha inválidas.' }, { status: 400 })

      const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : ''
      const resumable = body.action === 'start'
      if ((resumable || rows.length > SYNC_ROWS) && (!key || key.length > 120)) {
        return NextResponse.json({ error: 'Chave de idempotência ausente ou inválida.' }, { status: 400 })
      }
      function replay(existing: ProductImportRecord) {
        if (!canAccessImport(existing, user as RequestUser) || Boolean(existing.resumable) !== resumable ||
            (resumable && JSON.stringify(normalizeRows(existing.payloadSnapshot)) !== JSON.stringify(rows))) {
          return NextResponse.json({ error: 'Chave de idempotência já utilizada.' }, { status: 409 })
        }
        return resumable ? statusResponse({ ...existing, results: [] }, 202) : queuedResponse(existing)
      }
      if (key) {
        const existing = await findByIdempotency(req, key)
        if (existing) return replay(existing)
      }
      const activeConflict = () => NextResponse.json({ error: 'Já existe uma importação em andamento. Retome ou cancele essa importação primeiro.' }, { status: 409 })
      if (resumable && await findOwnResumable(req, true)) return activeConflict()

      const preflight = await previewImportRows(payload, user as never, rows, req)
      if (preflight.blockingCount > 0) {
        return previewResponse({
          error: 'A importação contém pendências. Revalide a planilha antes de confirmar.',
          blockingCount: preflight.blockingCount,
          rows: preflight.rows,
        }, 422)
      }

      if (resumable) {
        try {
          return await withImportOwnerLock(req, async (transaction) => {
            const existing = await findByIdempotency(transaction, key)
            if (existing) return replay(existing)
            if (await findOwnResumable(transaction, true)) return activeConflict()
            return statusResponse(await createImport(transaction, key, rows, true), 202)
          })
        } catch (error) {
          const existing = await findByIdempotency(req, key)
          if (existing) return replay(existing)
          if (await findOwnResumable(req, true)) return activeConflict()
          throw error
        }
      }

      if (rows.length <= SYNC_ROWS) {
        return NextResponse.json(await commitImport(payload, user as never, rows, { req, chunkSize: SYNC_ROWS }))
      }

      let record: ProductImportRecord | null = null
      try {
        record = await createImport(req, key, rows)
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
