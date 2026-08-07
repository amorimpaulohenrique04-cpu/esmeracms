import type { PayloadRequest, TaskConfig } from 'payload'

import {
  commitImport,
  type ImportCommitInput,
  type ImportCommitReport,
} from '../domain/products/importOperations'
import { INTEGRATION_JOBS_QUEUE } from './index'

export const PRODUCT_IMPORT_JOB = 'productImport'
export const PRODUCT_IMPORT_QUEUE = INTEGRATION_JOBS_QUEUE

type ProductImportRecord = {
  id: string | number
  status?: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled' | null
  requestedBy?: unknown
  totalRows?: number | null
  payloadSnapshot?: unknown
}

function relationshipID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function storedID(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Falha desconhecida na importação de produtos.'
}

function snapshotRows(value: unknown): ImportCommitInput[] {
  if (!Array.isArray(value)) throw new Error('Snapshot da importação ausente ou inválido.')
  return value as ImportCommitInput[]
}

async function updateImport(req: PayloadRequest, importID: string | number, data: Record<string, unknown>) {
  return await req.payload.update({
    collection: 'product-imports',
    id: importID,
    depth: 0,
    overrideAccess: true,
    req,
    data,
  } as never)
}

async function markFailed(req: PayloadRequest, importID: string | number, error: unknown) {
  try {
    await updateImport(req, importID, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      error: errorMessage(error).slice(0, 4000),
    })
  } catch (updateError) {
    req.payload.logger.error({ err: updateError, importID }, 'failed to persist product import error')
  }
}

async function isCancelled(req: PayloadRequest, importID: string | number) {
  const record = await req.payload.findByID({
    collection: 'product-imports',
    id: importID,
    depth: 0,
    overrideAccess: true,
    req,
    select: { status: true },
  } as never) as unknown as ProductImportRecord
  return record.status === 'cancelled'
}

async function persistProgress(req: PayloadRequest, importID: string | number, report: ImportCommitReport) {
  await updateImport(req, importID, {
    processedRows: report.rows.length,
    created: report.created,
    updated: report.updated,
    skipped: report.skipped,
    errored: report.errored,
    results: report.rows,
  })
}

export const ProductImportJob = {
  slug: PRODUCT_IMPORT_JOB,
  label: 'Importar produtos em lote',
  retries: 1,
  inputSchema: [
    { name: 'importId', type: 'text', required: true },
  ],
  outputSchema: [
    { name: 'importId', type: 'text', required: true },
    { name: 'status', type: 'text', required: true },
    { name: 'created', type: 'number', required: true },
    { name: 'updated', type: 'number', required: true },
    { name: 'skipped', type: 'number', required: true },
    { name: 'errored', type: 'number', required: true },
  ],
  handler: async ({ input, req }) => {
    const importID = storedID(input.importId)

    try {
      const record = await req.payload.findByID({
        collection: 'product-imports',
        id: importID,
        depth: 0,
        overrideAccess: true,
        req,
      } as never) as unknown as ProductImportRecord

      if (record.status === 'cancelled') {
        return { output: { importId: String(importID), status: 'cancelled', created: 0, updated: 0, skipped: 0, errored: 0 } }
      }

      const requestedBy = relationshipID(record.requestedBy)
      if (requestedBy === null) throw new Error('A importação não possui usuário solicitante.')
      const user = await req.payload.findByID({
        collection: 'users',
        id: requestedBy,
        depth: 0,
        overrideAccess: true,
        req,
      } as never)
      const importRequest = { ...req, user } as unknown as PayloadRequest

      await updateImport(req, importID, {
        status: 'processing',
        startedAt: new Date().toISOString(),
        error: null,
      })

      const rows = snapshotRows(record.payloadSnapshot)
      const report = await commitImport(req.payload, user as never, rows, {
        req: importRequest,
        chunkSize: 25,
        shouldCancel: () => isCancelled(req, importID),
        onProgress: async (_progress, current) => persistProgress(req, importID, current),
      })

      const completedAt = new Date().toISOString()
      const status = report.cancelled
        ? 'cancelled'
        : report.errored > 0 ? 'completed_with_errors' : 'completed'
      await updateImport(req, importID, {
        status,
        completedAt,
        processedRows: report.rows.length,
        created: report.created,
        updated: report.updated,
        skipped: report.skipped,
        errored: report.errored,
        results: report.rows,
        error: null,
      })

      return {
        output: {
          importId: String(importID),
          status,
          created: report.created,
          updated: report.updated,
          skipped: report.skipped,
          errored: report.errored,
        },
      }
    } catch (error) {
      await markFailed(req, importID, error)
      throw error
    }
  },
} as TaskConfig<typeof PRODUCT_IMPORT_JOB>
