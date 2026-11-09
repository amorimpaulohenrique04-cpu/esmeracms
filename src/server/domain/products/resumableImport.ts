import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { randomUUID } from 'node:crypto'
import type { PayloadRequest } from 'payload'

import {
  commitImport,
  ImportCheckpointError,
  importImageUrls,
  withImportTransaction,
  type ImportCommitInput,
  type ImportRowResult,
} from './importOperations'

const MAX_SLICE_ROWS = 24
const MAX_SLICE_URLS = 12
const SLICE_BUDGET_MS = 75_000
// The route may run for up to 120 seconds. A lease must outlive the invocation.
const LEASE_MS = 135_000

type MediaIds = Record<string, string | number>
type LockedImport = {
  status: string
  processed_rows: number
  lease_token: string | null
  lease_until: Date | string | null
}

type ClaimedSlice = {
  total_rows: number
  media_cache: MediaIds | null
  pending_rows: ImportCommitInput[] | null
}

function resumable(status: string) {
  return status === 'queued' || status === 'processing'
}

export function selectImportSlice(rows: ImportCommitInput[], cached: MediaIds) {
  const urls = new Set<string>()
  const slice: ImportCommitInput[] = []
  for (const row of rows.slice(0, MAX_SLICE_ROWS)) {
    const newUrls = [...new Set(importImageUrls(row.values))].filter((url) => !Object.hasOwn(cached, url) && !urls.has(url))
    if (slice.length && urls.size + newUrls.length > MAX_SLICE_URLS) break
    newUrls.forEach((url) => urls.add(url))
    slice.push(row)
  }
  return slice
}

function database(req: PayloadRequest) {
  return req.payload.db as unknown as PostgresAdapter
}

function transactionDatabase(req: PayloadRequest) {
  const db = database(req).sessions[String(req.transactionID)]?.db as PostgresAdapter['drizzle'] | undefined
  if (!db) throw new Error('Transação da importação indisponível.')
  return db
}

export async function withImportOwnerLock<T>(req: PayloadRequest, operation: (req: PayloadRequest) => Promise<T>) {
  return withImportTransaction(req.payload, req, async (transaction) => {
    await transactionDatabase(transaction).execute(sql`SELECT id FROM users WHERE id = ${req.user?.id} FOR UPDATE`)
    return operation(transaction)
  })
}

async function withLockedImport<T>(
  req: PayloadRequest,
  id: number | string,
  operation: (record: LockedImport, transaction: PayloadRequest, db: PostgresAdapter['drizzle']) => Promise<T>,
) {
  return withImportTransaction(req.payload, req, async (transaction) => {
    const db = transactionDatabase(transaction)
    const result = await db.execute<LockedImport>(sql`
      SELECT status, processed_rows::integer AS processed_rows, lease_token, lease_until
      FROM product_imports WHERE id = ${id} AND resumable FOR UPDATE
    `)
    const record = result.rows[0]
    if (!record) throw new Error('Importação não encontrada.')
    return operation(record, transaction, db)
  })
}

export async function cancelResumableImport(req: PayloadRequest, id: number | string) {
  return withLockedImport(req, id, async (record, _transaction, db) => {
    if (record.status === 'cancelled') return true
    if (!resumable(record.status)) return false
    await db.execute(sql`
      UPDATE product_imports SET status = 'cancelled', completed_at = now(), updated_at = now(),
        lease_token = NULL, lease_until = NULL WHERE id = ${id}
    `)
    return true
  })
}

class ProductWriteError extends Error {
  constructor(cause: unknown) {
    super('Falha ao gravar o produto.', { cause })
  }
}

export async function advanceResumableImport(
  req: PayloadRequest,
  id: string | number,
  cursor: number,
) {
  const startedAt = Date.now()
  const token = randomUUID()
  const claimed = await withLockedImport(req, id, async (record, _transaction, db) => {
    if (!resumable(record.status) || record.processed_rows !== cursor) return null
    if (record.lease_until && new Date(record.lease_until).getTime() > Date.now()) return null
    const result = await db.execute<ClaimedSlice>(sql`
      UPDATE product_imports SET status = 'processing', started_at = COALESCE(started_at, now()),
        updated_at = now(), lease_token = ${token}, lease_until = ${new Date(Date.now() + LEASE_MS).toISOString()}
      WHERE id = ${id}
      RETURNING total_rows::integer, media_cache, (
        SELECT jsonb_agg(payload_snapshot -> n ORDER BY n)
        FROM generate_series(${cursor}::integer, LEAST(${cursor + MAX_SLICE_ROWS - 1}::integer, total_rows::integer - 1)) AS position(n)
      ) AS pending_rows
    `)
    return result.rows[0]
  })
  if (!claimed) return

  const totalRows = claimed.total_rows
  let processed = cursor
  async function checkpoint(
    write: (req: PayloadRequest) => Promise<ImportRowResult>,
    getMediaIds: () => MediaIds = () => ({}),
  ) {
    try {
      const result = await withLockedImport(req, id, async (record, transaction, db) => {
        if (!resumable(record.status) || record.lease_token !== token || record.processed_rows !== processed) return null
        // The Payload product hooks and the checkpoint share the same PostgreSQL transaction.
        const row = await write(transaction).catch((error: unknown) => { throw new ProductWriteError(error) })
        const lastRow = processed + 1 === totalRows
        await db.execute(sql`
          UPDATE product_imports SET
            processed_rows = processed_rows + 1,
            created = created + ${Number(row.status === 'created')},
            updated = updated + ${Number(row.status === 'updated')},
            skipped = skipped + ${Number(row.status === 'skipped')},
            errored = errored + ${Number(row.status === 'error')},
            results = COALESCE(results, '[]'::jsonb) || ${JSON.stringify([row])}::jsonb,
            media_cache = COALESCE(media_cache, '{}'::jsonb) || ${JSON.stringify(getMediaIds())}::jsonb,
            status = CASE WHEN NOT ${lastRow} THEN status
              WHEN errored > 0 OR ${row.status === 'error'} THEN 'completed_with_errors'::enum_product_imports_status
              ELSE 'completed'::enum_product_imports_status END,
            completed_at = CASE WHEN ${lastRow} THEN now() ELSE completed_at END,
            updated_at = now()
          WHERE id = ${id}
        `)
        return row
      })
      if (result) processed += 1
      return result
    } catch (error) {
      if (error instanceof ProductWriteError) throw error.cause
      throw new ImportCheckpointError('Não foi possível confirmar o progresso da importação.', { cause: error })
    }
  }

  try {
    const cached = claimed.media_cache ?? {}
    const slice = selectImportSlice(claimed.pending_rows ?? [], cached)
    const usedUrls = new Set(slice.flatMap((row) => importImageUrls(row.values)))
    const cachedEntries = Object.entries(cached).filter(([url]) => usedUrls.has(url))
    const imageCache = new Map(cachedEntries.map(([url, mediaId]) => [url, { id: mediaId }]))
    const imageCacheAtStart = new Set(imageCache.keys())
    await commitImport(req.payload, req.user, slice, {
      req,
      imageCache,
      chunkSize: MAX_SLICE_ROWS,
      shouldYield: () => processed > cursor && Date.now() - startedAt >= SLICE_BUDGET_MS,
      checkpoint: {
        save: (input, write, images) => checkpoint(write, () => Object.fromEntries(
          importImageUrls(input.values).flatMap((url) => {
            const image = images.get(url)
            return image && !imageCacheAtStart.has(url) ? [[url, image.id]] : []
          }),
        )),
        error: async (_input, result) => Boolean(await checkpoint(async () => result)),
      },
    })
  } finally {
    await database(req).drizzle.execute(sql`
      UPDATE product_imports SET lease_token = NULL, lease_until = NULL, updated_at = now()
      WHERE id = ${id} AND lease_token = ${token}
    `)
    req.payload.logger.info({ importId: id, cursor, processed, durationMs: Date.now() - startedAt }, 'product import slice')
  }
}
