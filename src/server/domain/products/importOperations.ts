import type { Payload } from 'payload'

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
import { fetchRemoteImage } from './mediaFetch'
import { textToRichText } from './textToRichText'

type WorkflowUser = { id?: string | number } | null | undefined

type ExistingProduct = {
  id: string | number
  code?: string | null
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
}

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

function codeVariants(code: string) {
  const trimmed = code.trim()
  return [...new Set([trimmed, trimmed.toUpperCase(), trimmed.toLowerCase()])]
}

async function findProductsByCodes(payload: Payload, user: WorkflowUser, codes: string[]) {
  const variants = [...new Set(codes.flatMap(codeVariants).filter(Boolean))]
  if (!variants.length) return [] as ExistingProduct[]
  const result = await payload.find({
    collection: 'products',
    where: { code: { in: variants } },
    depth: 0,
    limit: Math.max(variants.length, 1),
    pagination: false,
    overrideAccess: false,
    user: user as never,
    select: {
      code: true,
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
    },
  } as never)
  return result.docs as unknown as ExistingProduct[]
}

export async function previewImport(payload: Payload, user: WorkflowUser, rawText: string): Promise<ImportPreviewResult> {
  const { rows, unknownHeaders, delimiter } = parseImportSheet(rawText)
  const existing = await findProductsByCodes(payload, user, rows.map((row) => row.values.code).filter(Boolean))
  const existingByCode = new Map(existing.map((doc) => [foldKey(String(doc.code || '')), doc.id]))
  const seenCodes = new Set<string>()

  const preview: ImportRowPreview[] = rows.map(({ values, sourceLine }, rowIndex) => {
    const code = foldKey(values.code)
    const existingId = code ? existingByCode.get(code) ?? null : null
    const issues = validateRowShape(values, {
      requireActiveAssets: existingId === null,
      allowPartialUpdate: existingId !== null,
    })

    if (code && seenCodes.has(code)) {
      issues.push({ column: 'code', code: 'duplicate_batch', message: 'Código repetido nesta importação.', severity: 'error' })
    }
    if (code) seenCodes.add(code)

    return {
      rowIndex,
      sourceLine,
      values,
      issues,
      isDuplicate: existingId !== null,
      existingProductId: existingId,
      action: existingId !== null ? 'skip' : 'create',
    }
  })

  return {
    rows: preview,
    unknownHeaders,
    delimiter,
    blockingCount: preview.reduce((sum, row) => sum + blockingIssueCount(row.issues), 0),
  }
}

async function resolveCategoryIds(payload: Payload, user: WorkflowUser, names: string[]) {
  if (!names.length) return { ids: [] as Array<string | number>, missing: [] as string[] }

  // Categorias são uma taxonomia pequena. Ler títulos em lote elimina a comparação
  // case/acento-sensitive do `IN` sem introduzir SQL cru ou migration nesta etapa.
  const result = await payload.find({
    collection: 'categories',
    depth: 0,
    limit: 2000,
    pagination: false,
    overrideAccess: false,
    user: user as never,
    select: { title: true },
  })
  const byTitle = new Map(result.docs.map((doc) => [foldKey(String(doc.title || '')), doc.id]))
  const ids: Array<string | number> = []
  const missing: string[] = []
  for (const name of names) {
    const id = byTitle.get(foldKey(name))
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

async function fetchImageAsMedia(
  payload: Payload,
  user: WorkflowUser,
  url: string,
  altFallback: string,
  cache: MediaCache,
  createdThisRow: Array<string | number>,
) {
  const cachedURL = cache.byURL.get(url)
  if (cachedURL) return cachedURL
  if (cache.downloads >= 200) throw new Error('Limite de 200 downloads externos por importação excedido.')
  cache.downloads += 1

  const remote = await fetchRemoteImage(url)
  const cachedHash = cache.byHash.get(remote.sha256)
  if (cachedHash) {
    cache.byURL.set(url, cachedHash)
    return cachedHash
  }

  const media = await payload.create({
    collection: 'media',
    overrideAccess: false,
    user: user as never,
    data: { alt: altFallback } as never,
    file: {
      data: remote.buffer,
      mimetype: remote.mime,
      name: remote.name,
      size: remote.buffer.byteLength,
    },
  }) as unknown as MediaDocument
  cache.byURL.set(url, media)
  cache.byHash.set(remote.sha256, media)
  createdThisRow.push(media.id)
  return media
}

async function compensateMedia(payload: Payload, user: WorkflowUser, ids: Array<string | number>, cache: MediaCache) {
  if (!ids.length) return
  for (const id of ids) {
    try {
      await payload.delete({ collection: 'media', id, overrideAccess: false, user: user as never })
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
}

export type ImportCommitInput = {
  rowIndex: number
  sourceLine?: number
  values: ImportRowValues
  onConflict: 'skip' | 'update'
}

function setCell(data: Record<string, unknown>, key: string, raw: string, transform: (value: string) => unknown = (value) => value.trim()) {
  if (!raw.trim()) return
  data[key] = isClearCell(raw) ? null : transform(raw)
}

function relationshipCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

export async function commitImport(payload: Payload, user: WorkflowUser, inputRows: ImportCommitInput[]): Promise<ImportCommitReport> {
  const startedAt = Date.now()
  const report: ImportCommitReport = { created: 0, updated: 0, skipped: 0, errored: 0, rows: [] }
  const cache: MediaCache = { byURL: new Map(), byHash: new Map(), downloads: 0 }

  for (const input of inputRows) {
    const { values } = input
    const sourceLine = input.sourceLine ?? input.rowIndex + 2
    const createdThisRow: Array<string | number> = []

    try {
      const matches = await findProductsByCodes(payload, user, [values.code])
      const existing = matches.find((doc) => foldKey(String(doc.code || '')) === foldKey(values.code)) || null
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

      if (existingId === null) {
        data.slug = values.slug.trim() || slugifyImportTitle(values.title)
      } else if (values.slug.trim()) {
        if (isClearCell(values.slug)) throw new Error('Slug é obrigatório e não pode ser limpo.')
        data.slug = values.slug.trim()
      }

      if (values.categories.trim()) {
        const categoryNames = isClearCell(values.categories) ? [] : splitMulti(values.categories)
        const { ids, missing } = await resolveCategoryIds(payload, user, categoryNames)
        if (missing.length) throw new Error(`Categoria não encontrada: ${missing.join(', ')}.`)
        data.categories = ids
      } else if (existingId === null) {
        data.categories = []
      }

      if (values.imageUrls.trim()) {
        const imageUrls = isClearCell(values.imageUrls) ? [] : splitMulti(values.imageUrls)
        const gallery: Array<{ image: string | number; mediaKey: string; role: string; alt: string }> = []
        for (const [index, url] of imageUrls.entries()) {
          const media = await fetchImageAsMedia(payload, user, url, values.title || existing?.title || 'Produto', cache, createdThisRow)
          gallery.push({ image: media.id, mediaKey: `img-${index + 1}`, role: index === 0 ? 'cover' : 'detail', alt: values.title || existing?.title || 'Produto' })
        }
        data.gallery = gallery
      } else if (existingId === null) {
        data.gallery = []
      }

      setCell(data, 'material', values.material)
      if (values.description.trim()) data.description = isClearCell(values.description) ? null : textToRichText(values.description)

      if (values.availability.trim()) {
        data.availability = isClearCell(values.availability) ? null : normalizeAvailability(values.availability)
      } else if (existingId === null) data.availability = 'available'

      if (values.catalogStatus.trim()) {
        data.catalogStatus = isClearCell(values.catalogStatus) ? null : normalizeCatalogStatus(values.catalogStatus)
      } else if (existingId === null) data.catalogStatus = 'active'

      const parsedPrice = values.price.trim() && !isClearCell(values.price) ? parsePrice(values.price) : null
      if (values.price.trim()) data.basePriceCents = isClearCell(values.price) ? null : parsedPrice?.ok ? parsedPrice.cents : null

      if (values.priceMode.trim()) {
        data.priceMode = isClearCell(values.priceMode) ? null : normalizePriceMode(values.priceMode)
      } else if (existingId === null) {
        data.priceMode = parsedPrice?.ok ? 'fixed' : 'inquiry'
      }

      const finalStatus = String(data.catalogStatus ?? existing?.catalogStatus ?? 'active')
      const finalCategories = data.categories ?? existing?.categories ?? []
      const finalGallery = data.gallery ?? existing?.gallery ?? []
      if (finalStatus === 'active' && relationshipCount(finalCategories) === 0) throw new Error('Produto ativo precisa ter categoria no estado final.')
      if (finalStatus === 'active' && relationshipCount(finalGallery) === 0) throw new Error('Produto ativo precisa ter ao menos uma imagem no estado final.')

      if (existingId !== null) {
        await payload.update({ collection: 'products', id: existingId, overrideAccess: false, user: user as never, data: data as never })
        report.updated += 1
        report.rows.push({ rowIndex: input.rowIndex, sourceLine, status: 'updated', productId: existingId })
      } else {
        const created = await payload.create({ collection: 'products', overrideAccess: false, user: user as never, data: data as never })
        report.created += 1
        report.rows.push({ rowIndex: input.rowIndex, sourceLine, status: 'created', productId: created.id })
      }
    } catch (error) {
      await compensateMedia(payload, user, createdThisRow, cache)
      report.errored += 1
      report.rows.push({ rowIndex: input.rowIndex, sourceLine, status: 'error', error: error instanceof Error ? error.message : 'Falha desconhecida.' })
    }
  }

  payload.logger.info({
    rows: inputRows.length,
    durationMs: Date.now() - startedAt,
    downloads: cache.downloads,
    created: report.created,
    updated: report.updated,
    skipped: report.skipped,
    errored: report.errored,
  }, 'product import completed')

  return report
}
