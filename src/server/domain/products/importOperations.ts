import type { Payload, PayloadRequest } from 'payload'

import { resolveHeaderColumn } from '../../../businessRules/products/importSchema'
import {
  blockingIssueCount,
  emptyImportValues,
  foldKey,
  isClearCell,
  normalizeAvailability,
  normalizeCatalogStatus,
  normalizePriceMode,
  parsePrice,
  slugifyImportTitle,
  splitMulti,
  validateRowShape,
  type ImportRowIssue,
  type ImportRowValues,
} from '../../../businessRules/products/importValidation'
import { detectDelimiter, parseTabularText } from './csv'
import { fetchRemoteImage, type RemoteImage } from './mediaFetch'
import { textToRichText } from './textToRichText'

type WorkflowUser = { id?: string | number; collection?: string; role?: string } | null | undefined

type ExistingProduct = {
  id: string | number
  code?: string | null
  codeNormalized?: string | null
  slug?: string | null
  title?: string | null
  catalogStatus?: string | null
  availability?: string | null
  categories?: unknown[] | null
  material?: string | null
  description?: unknown
  priceMode?: string | null
  basePriceCents?: number | null
  gallery?: unknown[] | null
  deletedAt?: string | null
}

type CategoryRecord = {
  id: string | number
  title?: string | null
  titleNormalized?: string | null
}

type ExistingMedia = { id: string | number; sourceSha256?: string | null }

export type { ImportRowIssue, ImportRowValues }

export type ImportRowPreview = {
  rowIndex: number
  sourceLine: number
  values: ImportRowValues
  issues: ImportRowIssue[]
  isDuplicate: boolean
  existingProductId: string | number | null
  action: 'create' | 'update' | 'skip'
}

export type ImportPreviewResult = {
  rows: ImportRowPreview[]
  unknownHeaders: string[]
  blockingCount: number
  delimiter: ReturnType<typeof detectDelimiter>
}

export function parseImportSheet(rawText: string): {
  rows: Array<{ values: ImportRowValues; sourceLine: number }>
  unknownHeaders: string[]
  delimiter: ReturnType<typeof detectDelimiter>
} {
  const delimiter = detectDelimiter(rawText)
  const table = parseTabularText(rawText, delimiter)
  if (!table.length) return { rows: [], unknownHeaders: [], delimiter }

  const [header, ...dataRows] = table
  const mapped = header.cells.map((cell) => resolveHeaderColumn(cell))
  if (!mapped.some(Boolean)) {
    throw new Error('Cabeçalho não reconhecido. Use o modelo de importação para mapear as colunas corretamente.')
  }

  const unknownHeaders = header.cells.filter((cell, index) => !mapped[index] && cell.trim())
  const rows = dataRows.map(({ cells, sourceLine }) => {
    const values = emptyImportValues()
    mapped.forEach((column, index) => {
      if (column) values[column] = (cells[index] || '').trim()
    })
    return { values, sourceLine }
  })

  return { rows, unknownHeaders, delimiter }
}

function uniqueNonEmpty(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function codeVariants(codes: string[]) {
  return uniqueNonEmpty(codes.flatMap((code) => [code, code.toUpperCase(), code.toLowerCase()]))
}

function proposedSlug(values: ImportRowValues) {
  return values.slug.trim() || (values.title.trim() ? slugifyImportTitle(values.title) : '')
}

function slugLookupCandidates(slugs: string[]) {
  const result = new Set<string>()
  for (const slug of uniqueNonEmpty(slugs)) {
    result.add(slug)
    for (let suffix = 2; suffix <= 20; suffix += 1) result.add(`${slug}-${suffix}`)
  }
  return [...result]
}

async function findImportProducts(
  payload: Payload,
  user: WorkflowUser,
  codes: string[],
  slugs: string[],
  req?: PayloadRequest,
) {
  const normalizedCodes = uniqueNonEmpty(codes.map(foldKey))
  const legacyCodes = codeVariants(codes)
  const slugCandidates = slugLookupCandidates(slugs)
  const or: Array<Record<string, unknown>> = []
  if (normalizedCodes.length) or.push({ codeNormalized: { in: normalizedCodes } })
  if (legacyCodes.length) or.push({ code: { in: legacyCodes } })
  if (slugCandidates.length) or.push({ slug: { in: slugCandidates } })
  if (!or.length) return [] as ExistingProduct[]

  const result = await payload.find({
    collection: 'products',
    trash: true,
    where: { or },
    depth: 0,
    limit: Math.min(10_000, Math.max(100, normalizedCodes.length + legacyCodes.length + slugCandidates.length + 20)),
    pagination: false,
    overrideAccess: false,
    user: user as never,
    req,
    select: {
      code: true,
      codeNormalized: true,
      slug: true,
      title: true,
      catalogStatus: true,
      availability: true,
      categories: true,
      material: true,
      description: true,
      priceMode: true,
      basePriceCents: true,
      gallery: true,
      deletedAt: true,
    },
  } as never)
  return result.docs as unknown as ExistingProduct[]
}

async function loadCategoryMap(
  payload: Payload,
  user: WorkflowUser,
  names: string[],
  req?: PayloadRequest,
) {
  const normalizedNames = uniqueNonEmpty(names.map(foldKey))
  const legacyNames = uniqueNonEmpty(names)
  if (!normalizedNames.length) return new Map<string, string | number>()

  const result = await payload.find({
    collection: 'categories',
    where: {
      or: [
        { titleNormalized: { in: normalizedNames } },
        { title: { in: legacyNames } },
      ],
    },
    depth: 0,
    limit: Math.min(10_000, Math.max(100, normalizedNames.length * 2 + 20)),
    pagination: false,
    overrideAccess: false,
    user: user as never,
    req,
    select: { title: true, titleNormalized: true },
  } as never)

  return new Map((result.docs as unknown as CategoryRecord[]).map((doc) => [
    doc.titleNormalized || foldKey(String(doc.title || '')),
    doc.id,
  ]))
}

function slugSuggestion(base: string, occupied: Set<string>) {
  let suffix = 2
  let candidate = `${base}-${suffix}`
  while (occupied.has(candidate)) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  return candidate
}

export async function previewImport(
  payload: Payload,
  user: WorkflowUser,
  rawText: string,
  req?: PayloadRequest,
): Promise<ImportPreviewResult> {
  const { rows, unknownHeaders, delimiter } = parseImportSheet(rawText)
  const codes = rows.map((row) => row.values.code)
  const slugs = rows.map((row) => proposedSlug(row.values)).filter(Boolean)
  const categoryNames = rows.flatMap((row) => isClearCell(row.values.categories) ? [] : splitMulti(row.values.categories))

  const [existing, categoryByTitle] = await Promise.all([
    findImportProducts(payload, user, codes, slugs, req),
    loadCategoryMap(payload, user, categoryNames, req),
  ])
  const existingByCode = new Map(existing.filter((doc) => doc.code).map((doc) => [
    doc.codeNormalized || foldKey(String(doc.code || '')),
    doc,
  ]))
  const existingBySlug = new Map(existing.filter((doc) => doc.slug).map((doc) => [String(doc.slug), doc.id]))
  const occupiedSlugs = new Set(existingBySlug.keys())
  const seenCodes = new Set<string>()
  const seenSlugs = new Set<string>()

  const preview: ImportRowPreview[] = rows.map(({ values, sourceLine }, rowIndex) => {
    const code = foldKey(values.code)
    const existingDoc = code ? existingByCode.get(code) || null : null
    const existingId = existingDoc?.id ?? null
    const issues = validateRowShape(values, {
      requireActiveAssets: existingId === null,
      allowPartialUpdate: existingId !== null,
    })

    if (code && seenCodes.has(code)) {
      issues.push({ column: 'code', code: 'duplicate_batch', message: 'Código repetido nesta importação.', severity: 'error' })
    }
    if (code) seenCodes.add(code)

    if (values.categories.trim() && !isClearCell(values.categories)) {
      const missing = splitMulti(values.categories).filter((name) => !categoryByTitle.has(foldKey(name)))
      if (missing.length) {
        issues.push({ column: 'categories', code: 'category_missing', message: `Categoria não encontrada: ${missing.join(', ')}.`, severity: 'error' })
      }
    }

    const nextSlug = proposedSlug(values)
    if (nextSlug) {
      const owner = existingBySlug.get(nextSlug)
      const clashesWithExisting = owner !== undefined && String(owner) !== String(existingId ?? '')
      const clashesInBatch = seenSlugs.has(nextSlug)
      if (clashesWithExisting || clashesInBatch) {
        const suggestion = slugSuggestion(nextSlug, new Set([...occupiedSlugs, ...seenSlugs]))
        issues.push({ column: 'slug', code: 'slug_conflict', message: `Slug já existe. Sugestão: ${suggestion}.`, severity: 'error' })
      }
      seenSlugs.add(nextSlug)
    }

    return {
      rowIndex,
      sourceLine,
      values,
      issues,
      isDuplicate: existingId !== null,
      existingProductId: existingId,
      action: existingId !== null ? 'update' : 'create',
    }
  })

  return {
    rows: preview,
    unknownHeaders,
    delimiter,
    blockingCount: preview.reduce((sum, row) => sum + blockingIssueCount(row.issues), 0),
  }
}

function resolveCategoryIds(names: string[], categoryByTitle: Map<string, string | number>) {
  const ids: Array<string | number> = []
  const missing: string[] = []
  for (const name of names) {
    const id = categoryByTitle.get(foldKey(name))
    if (id !== undefined) ids.push(id)
    else missing.push(name)
  }
  return { ids, missing }
}

type MediaDocument = { id: string | number }
type MediaCache = {
  byURL: Map<string, MediaDocument>
  byHash: Map<string, MediaDocument>
  downloads: number
}
type PrefetchedImage = { ok: true; remote: RemoteImage } | { ok: false; error: string }

async function mapLimit<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) return
      results[index] = await mapper(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size))
  return chunks
}

async function prefetchChunkImages(rows: ImportCommitInput[], cache: MediaCache) {
  const urls = [...new Set(rows.flatMap((row) => isClearCell(row.values.imageUrls) ? [] : splitMulti(row.values.imageUrls)).filter((url) => !cache.byURL.has(url)))]
  const result = new Map<string, PrefetchedImage>()
  const remaining = Math.max(0, 200 - cache.downloads)
  const allowed = urls.slice(0, remaining)
  const blocked = urls.slice(remaining)
  blocked.forEach((url) => result.set(url, { ok: false, error: 'Limite de 200 downloads externos por importação excedido.' }))
  cache.downloads += allowed.length

  const fetched = await mapLimit(allowed, 4, async (url): Promise<[string, PrefetchedImage]> => {
    try {
      return [url, { ok: true, remote: await fetchRemoteImage(url) }]
    } catch (error) {
      return [url, { ok: false, error: error instanceof Error ? error.message : 'Falha ao baixar imagem.' }]
    }
  })
  fetched.forEach(([url, image]) => result.set(url, image))
  return result
}

async function seedExistingMedia(
  payload: Payload,
  user: WorkflowUser,
  prefetched: Map<string, PrefetchedImage>,
  cache: MediaCache,
  req?: PayloadRequest,
) {
  const hashes = [...new Set([...prefetched.values()].flatMap((item) => item.ok ? [item.remote.sha256] : []).filter((hash) => !cache.byHash.has(hash)))]
  if (!hashes.length) return
  const found = await payload.find({
    collection: 'media',
    where: { sourceSha256: { in: hashes } },
    depth: 0,
    limit: hashes.length,
    pagination: false,
    overrideAccess: false,
    user: user as never,
    req,
    select: { sourceSha256: true },
  } as never)
  for (const doc of found.docs as unknown as ExistingMedia[]) {
    if (doc.sourceSha256) cache.byHash.set(doc.sourceSha256, { id: doc.id })
  }
}

async function imageAsMedia(
  payload: Payload,
  user: WorkflowUser,
  url: string,
  altFallback: string,
  cache: MediaCache,
  createdThisRow: Array<string | number>,
  prefetched: Map<string, PrefetchedImage>,
  req?: PayloadRequest,
) {
  const cachedURL = cache.byURL.get(url)
  if (cachedURL) return cachedURL

  const fetched = prefetched.get(url)
  if (!fetched) throw new Error(`Imagem não foi preparada: ${url}`)
  if (!fetched.ok) throw new Error(fetched.error)

  const cachedHash = cache.byHash.get(fetched.remote.sha256)
  if (cachedHash) {
    cache.byURL.set(url, cachedHash)
    return cachedHash
  }

  const media = await payload.create({
    collection: 'media',
    overrideAccess: false,
    user: user as never,
    req,
    data: { alt: altFallback, sourceSha256: fetched.remote.sha256 } as never,
    file: {
      data: fetched.remote.buffer,
      mimetype: fetched.remote.mime,
      name: fetched.remote.name,
      size: fetched.remote.buffer.byteLength,
    },
  } as never) as unknown as MediaDocument
  cache.byURL.set(url, media)
  cache.byHash.set(fetched.remote.sha256, media)
  createdThisRow.push(media.id)
  return media
}

async function compensateMedia(
  payload: Payload,
  user: WorkflowUser,
  ids: Array<string | number>,
  cache: MediaCache,
  req?: PayloadRequest,
) {
  if (!ids.length) return
  for (const id of ids) {
    try {
      await payload.delete({ collection: 'media', id, overrideAccess: false, user: user as never, req } as never)
    } catch (error) {
      payload.logger.warn({ err: error, mediaId: id }, 'product import failed to compensate orphan media')
    }
  }
  const deleted = new Set(ids.map(String))
  for (const [key, media] of cache.byURL) if (deleted.has(String(media.id))) cache.byURL.delete(key)
  for (const [key, media] of cache.byHash) if (deleted.has(String(media.id))) cache.byHash.delete(key)
}

export type ImportRowResult = {
  rowIndex: number
  sourceLine: number
  status: 'created' | 'updated' | 'skipped' | 'error'
  productId?: string | number
  error?: string
}

export type ImportCommitReport = {
  created: number
  updated: number
  skipped: number
  errored: number
  rows: ImportRowResult[]
  cancelled?: boolean
}

export type ImportCommitInput = {
  rowIndex: number
  sourceLine?: number
  values: ImportRowValues
  onConflict: 'skip' | 'update'
}

export type ImportCommitProgress = {
  processedRows: number
  totalRows: number
  created: number
  updated: number
  skipped: number
  errored: number
}

export type ImportCommitOptions = {
  req?: PayloadRequest
  chunkSize?: number
  onProgress?: (progress: ImportCommitProgress, report: ImportCommitReport) => void | Promise<void>
  shouldCancel?: () => boolean | Promise<boolean>
}

function setCell(
  data: Record<string, unknown>,
  key: string,
  raw: string,
  transform: (value: string) => unknown = (value) => value.trim(),
) {
  if (!raw.trim()) return
  data[key] = isClearCell(raw) ? null : transform(raw)
}

function relationshipCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function progressOf(report: ImportCommitReport, totalRows: number): ImportCommitProgress {
  return {
    processedRows: report.rows.length,
    totalRows,
    created: report.created,
    updated: report.updated,
    skipped: report.skipped,
    errored: report.errored,
  }
}

function importErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Falha desconhecida.'
  if (!error || typeof error !== 'object') return fallback

  const data = (error as { data?: unknown }).data
  const entries = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { errors?: unknown[] }).errors)
      ? (data as { errors: unknown[] }).errors
      : []

  const details = [...new Set(entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const message = (entry as { message?: unknown }).message
    const label = (entry as { label?: unknown }).label
    if (typeof message === 'string' && message.trim()) return [message.trim()]
    if (typeof label === 'string' && label.trim()) return [label.trim()]
    return []
  }))]

  return details.length ? details.join(' ') : fallback
}

export async function commitImport(
  payload: Payload,
  user: WorkflowUser,
  inputRows: ImportCommitInput[],
  options: ImportCommitOptions = {},
): Promise<ImportCommitReport> {
  const startedAt = Date.now()
  const report: ImportCommitReport = { created: 0, updated: 0, skipped: 0, errored: 0, rows: [] }
  const cache: MediaCache = { byURL: new Map(), byHash: new Map(), downloads: 0 }
  const codes = inputRows.map((row) => row.values.code)
  const slugs = inputRows.map((row) => proposedSlug(row.values)).filter(Boolean)
  const categoryNames = inputRows.flatMap((row) => isClearCell(row.values.categories) ? [] : splitMulti(row.values.categories))
  const [existingProducts, categoryByTitle] = await Promise.all([
    findImportProducts(payload, user, codes, slugs, options.req),
    loadCategoryMap(payload, user, categoryNames, options.req),
  ])
  const existingByCode = new Map(existingProducts.filter((doc) => doc.code).map((doc) => [
    doc.codeNormalized || foldKey(String(doc.code || '')),
    doc,
  ]))
  const existingBySlug = new Map(existingProducts.filter((doc) => doc.slug).map((doc) => [String(doc.slug), doc.id]))
  const seenCodes = new Set<string>()
  const chunkSize = Math.max(1, options.chunkSize || 25)

  for (const chunk of chunkRows(inputRows, chunkSize)) {
    if (await options.shouldCancel?.()) {
      report.cancelled = true
      break
    }

    const prefetched = await prefetchChunkImages(chunk, cache)
    await seedExistingMedia(payload, user, prefetched, cache, options.req)

    for (const input of chunk) {
      const { values } = input
      const sourceLine = input.sourceLine ?? input.rowIndex + 2
      const createdThisRow: Array<string | number> = []
      const codeKey = foldKey(values.code)

      try {
        if (codeKey && seenCodes.has(codeKey)) throw new Error('Código repetido nesta importação.')
        if (codeKey) seenCodes.add(codeKey)

        const existing = existingByCode.get(codeKey) || null
        const existingId = existing?.id ?? null
        const issues = validateRowShape(values, {
          requireActiveAssets: existingId === null,
          allowPartialUpdate: existingId !== null,
        }).filter((issue) => issue.severity !== 'warning')
        if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '))

        if (existingId !== null && input.onConflict === 'skip') {
          report.skipped += 1
          report.rows.push({ rowIndex: input.rowIndex, sourceLine, status: 'skipped', productId: existingId })
          continue
        }

        const data: Record<string, unknown> = {}
        if (existingId === null || values.title.trim()) data.title = values.title.trim()
        if (existingId === null || values.code.trim()) data.code = values.code.trim().toUpperCase()

        const nextSlug = existingId === null
          ? values.slug.trim() || slugifyImportTitle(values.title)
          : values.slug.trim() && !isClearCell(values.slug) ? values.slug.trim() : String(existing?.slug || '')
        if (values.slug.trim() && isClearCell(values.slug)) throw new Error('Slug é obrigatório e não pode ser limpo.')
        const slugOwner = nextSlug ? existingBySlug.get(nextSlug) : undefined
        if (nextSlug && slugOwner !== undefined && String(slugOwner) !== String(existingId ?? '')) {
          throw new Error(`Slug já existe: ${nextSlug}.`)
        }
        if (existingId === null || values.slug.trim()) data.slug = nextSlug

        if (values.categories.trim()) {
          const names = isClearCell(values.categories) ? [] : splitMulti(values.categories)
          const { ids, missing } = resolveCategoryIds(names, categoryByTitle)
          if (missing.length) throw new Error(`Categoria não encontrada: ${missing.join(', ')}.`)
          data.categories = ids
        } else if (existingId === null) {
          data.categories = []
        }

        if (values.imageUrls.trim()) {
          const imageUrls = isClearCell(values.imageUrls) ? [] : splitMulti(values.imageUrls)
          const gallery: Array<{ image: string | number; mediaKey: string; role: string; alt: string }> = []
          for (const [index, url] of imageUrls.entries()) {
            const media = await imageAsMedia(
              payload,
              user,
              url,
              values.title || existing?.title || 'Produto',
              cache,
              createdThisRow,
              prefetched,
              options.req,
            )
            gallery.push({
              image: media.id,
              mediaKey: `img-${index + 1}`,
              role: index === 0 ? 'cover' : 'detail',
              alt: values.title || existing?.title || 'Produto',
            })
          }
          data.gallery = gallery
        } else if (existingId === null) {
          data.gallery = []
        }

        setCell(data, 'material', values.material)
        if (values.description.trim()) {
          data.description = isClearCell(values.description) ? null : textToRichText(values.description)
        }

        if (values.availability.trim()) {
          data.availability = isClearCell(values.availability) ? null : normalizeAvailability(values.availability)
        } else if (existingId === null) {
          data.availability = 'available'
        }

        if (values.catalogStatus.trim()) {
          data.catalogStatus = isClearCell(values.catalogStatus) ? null : normalizeCatalogStatus(values.catalogStatus)
        } else if (existingId === null) {
          data.catalogStatus = 'active'
        }

        const parsedPrice = values.price.trim() && !isClearCell(values.price) ? parsePrice(values.price) : null
        if (values.price.trim()) {
          data.basePriceCents = isClearCell(values.price) ? null : parsedPrice?.ok ? parsedPrice.cents : null
        }

        if (values.priceMode.trim()) {
          data.priceMode = isClearCell(values.priceMode) ? null : normalizePriceMode(values.priceMode)
        } else if (existingId === null) {
          data.priceMode = parsedPrice?.ok ? 'fixed' : 'inquiry'
        }

        const finalStatus = String(data.catalogStatus ?? existing?.catalogStatus ?? 'active')
        const finalCategories = data.categories ?? existing?.categories ?? []
        const finalGallery = data.gallery ?? existing?.gallery ?? []
        if (finalStatus === 'active' && relationshipCount(finalCategories) === 0) {
          throw new Error('Produto ativo precisa ter categoria no estado final.')
        }
        if (finalStatus === 'active' && relationshipCount(finalGallery) === 0) {
          throw new Error('Produto ativo precisa ter ao menos uma imagem no estado final.')
        }

        const transactionID = await payload.db.beginTransaction()
        if (transactionID === null) throw new Error('Não foi possível iniciar a transação desta linha.')
        const rowReq = { ...(options.req || {}), payload, user: user as never, transactionID } as PayloadRequest
        try {
          if (existingId !== null) {
            const updateData = existing?.deletedAt ? { ...data, deletedAt: null } : data
            await payload.update({
              collection: 'products',
              id: existingId,
              trash: true,
              overrideAccess: false,
              user: user as never,
              req: rowReq,
              data: updateData as never,
            } as never)
            await payload.db.commitTransaction(transactionID)
            report.updated += 1
            report.rows.push({ rowIndex: input.rowIndex, sourceLine, status: 'updated', productId: existingId })
            existingByCode.set(codeKey, {
              ...existing,
              ...data,
              id: existingId,
              codeNormalized: codeKey,
              deletedAt: null,
            } as ExistingProduct)
          } else {
            const created = await payload.create({
              collection: 'products',
              overrideAccess: false,
              user: user as never,
              req: rowReq,
              data: data as never,
            } as never)
            await payload.db.commitTransaction(transactionID)
            report.created += 1
            report.rows.push({ rowIndex: input.rowIndex, sourceLine, status: 'created', productId: created.id })
            existingByCode.set(codeKey, {
              ...(data as ExistingProduct),
              id: created.id,
              codeNormalized: codeKey,
            })
          }
          if (nextSlug) existingBySlug.set(nextSlug, existingId ?? report.rows.at(-1)?.productId ?? '')
        } catch (error) {
          await payload.db.rollbackTransaction(transactionID)
          throw error
        }
      } catch (error) {
        await compensateMedia(payload, user, createdThisRow, cache, options.req)
        report.errored += 1
        report.rows.push({
          rowIndex: input.rowIndex,
          sourceLine,
          status: 'error',
          error: importErrorMessage(error),
        })
      }
    }

    await options.onProgress?.(progressOf(report, inputRows.length), report)
  }

  payload.logger.info({
    rows: inputRows.length,
    durationMs: Date.now() - startedAt,
    downloads: cache.downloads,
    created: report.created,
    updated: report.updated,
    skipped: report.skipped,
    errored: report.errored,
    cancelled: Boolean(report.cancelled),
  }, 'product import completed')

  return report
}
