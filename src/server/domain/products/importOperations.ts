import type { Payload } from 'payload'

import {
  availabilityLabelToValue,
  catalogStatusLabelToValue,
  importColumns,
  importColumnRequired,
  resolveHeaderColumn,
  type ImportColumn,
} from '../../../businessRules/products/importSchema'
import { parseTabularText } from './csv'
import { textToRichText } from './textToRichText'

type WorkflowUser = { id?: string | number } | null | undefined

export type ImportRowValues = Record<ImportColumn, string>

export type ImportRowIssue = { column: ImportColumn | 'general'; message: string }

export type ImportRowPreview = {
  rowIndex: number
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
}

function emptyValues(): ImportRowValues {
  const record = {} as ImportRowValues
  importColumns.forEach((column) => { record[column] = '' })
  return record
}

export function parseImportSheet(rawText: string): { rows: ImportRowValues[]; unknownHeaders: string[] } {
  const table = parseTabularText(rawText)
  if (!table.length) return { rows: [], unknownHeaders: [] }
  const [headerRow, ...dataRows] = table
  const mapped = headerRow.map((header) => resolveHeaderColumn(header))
  const unknownHeaders = headerRow.filter((header, index) => !mapped[index])

  const rows = dataRows.map((cells) => {
    const record = emptyValues()
    mapped.forEach((column, index) => {
      if (column) record[column] = (cells[index] || '').trim()
    })
    return record
  })

  return { rows, unknownHeaders }
}

function splitMulti(value: string): string[] {
  return value.split(';').map((item) => item.trim()).filter(Boolean)
}

/** Aceita tanto "1.490,00" (BR) quanto "1490.00" (US); retorna centavos ou null se vazio/inválido. */
function parsePriceToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const lastComma = trimmed.lastIndexOf(',')
  const lastDot = trimmed.lastIndexOf('.')
  let normalized = trimmed
  if (lastComma > lastDot) normalized = trimmed.replaceAll('.', '').replace(',', '.')
  else normalized = trimmed.replaceAll(',', '')
  const parsed = Number(normalized)
  if (Number.isNaN(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validateRowShape(values: ImportRowValues): ImportRowIssue[] {
  const issues: ImportRowIssue[] = []

  for (const column of importColumns) {
    if (importColumnRequired[column] && !values[column]) {
      issues.push({ column, message: 'Campo obrigatório.' })
    }
  }

  if (values.slug && !/^[a-z0-9-]+$/.test(values.slug)) {
    issues.push({ column: 'slug', message: 'Use letras minúsculas, números e hífens.' })
  }

  let availability = 'available'
  if (values.availability) {
    const resolved = availabilityLabelToValue[values.availability.trim().toLocaleLowerCase('pt-BR')]
    if (!resolved) issues.push({ column: 'availability', message: 'Use Peça única, Disponível, Sob encomenda ou Edição limitada.' })
    else availability = resolved
  }

  let catalogStatus = 'active'
  if (values.catalogStatus) {
    const resolved = catalogStatusLabelToValue[values.catalogStatus.trim().toLocaleLowerCase('pt-BR')]
    if (!resolved) issues.push({ column: 'catalogStatus', message: 'Use Ativo ou Arquivado.' })
    else catalogStatus = resolved
  }

  if (values.price && parsePriceToCents(values.price) === null) {
    issues.push({ column: 'price', message: 'Use um número, como 890.00 ou 890,00.' })
  }

  const imageUrls = splitMulti(values.imageUrls)
  const invalidUrl = imageUrls.find((url) => !isHttpUrl(url))
  if (invalidUrl) issues.push({ column: 'imageUrls', message: `URL inválida: ${invalidUrl}` })

  if (catalogStatus === 'active' && imageUrls.length === 0) {
    issues.push({ column: 'imageUrls', message: 'Produto ativo precisa de ao menos uma imagem (separe várias com ";").' })
  }

  if (catalogStatus === 'active' && splitMulti(values.categories).length === 0) {
    issues.push({ column: 'categories', message: 'Produto ativo precisa de ao menos uma categoria (separe várias com ";").' })
  }

  void availability
  return issues
}

export async function previewImport(payload: Payload, user: WorkflowUser, rawText: string): Promise<ImportPreviewResult> {
  const { rows, unknownHeaders } = parseImportSheet(rawText)

  const codes = rows.map((row) => row.code.trim().toUpperCase()).filter(Boolean)
  const existing = codes.length ? await payload.find({
    collection: 'products',
    where: { code: { in: codes } },
    depth: 0,
    limit: codes.length,
    pagination: false,
    overrideAccess: false,
    user: user as never,
    select: { code: true },
  }) : { docs: [] as Array<{ id: string | number; code?: string | null }> }
  const existingByCode = new Map(existing.docs.map((doc) => [String(doc.code || '').toUpperCase(), doc.id]))

  const seenCodes = new Set<string>()
  const preview: ImportRowPreview[] = rows.map((values, index) => {
    const issues = validateRowShape(values)
    const code = values.code.trim().toUpperCase()
    if (code && seenCodes.has(code)) issues.push({ column: 'code', message: 'Código repetido nesta importação.' })
    if (code) seenCodes.add(code)

    const existingId = code ? existingByCode.get(code) ?? null : null
    return {
      rowIndex: index,
      values,
      issues,
      isDuplicate: existingId !== null,
      existingProductId: existingId,
      action: existingId !== null ? 'skip' : 'create',
    }
  })

  return { rows: preview, unknownHeaders, blockingCount: preview.reduce((sum, row) => sum + row.issues.length, 0) }
}

async function resolveCategoryIds(payload: Payload, user: WorkflowUser, names: string[]): Promise<{ ids: Array<string | number>; missing: string[] }> {
  if (!names.length) return { ids: [], missing: [] }
  const result = await payload.find({
    collection: 'categories',
    where: { title: { in: names } },
    depth: 0,
    limit: names.length,
    pagination: false,
    overrideAccess: false,
    user: user as never,
    select: { title: true },
  })
  const byTitle = new Map(result.docs.map((doc) => [String(doc.title || '').trim().toLocaleLowerCase('pt-BR'), doc.id]))
  const ids: Array<string | number> = []
  const missing: string[] = []
  for (const name of names) {
    const id = byTitle.get(name.trim().toLocaleLowerCase('pt-BR'))
    if (id !== undefined) ids.push(id)
    else missing.push(name)
  }
  return { ids, missing }
}

async function fetchImageAsMedia(payload: Payload, user: WorkflowUser, url: string, altFallback: string) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Não foi possível baixar a imagem (${response.status}).`)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.startsWith('image/')) throw new Error('O link não aponta para uma imagem.')
  const arrayBuffer = await response.arrayBuffer()
  const maxBytes = 10 * 1024 * 1024
  if (arrayBuffer.byteLength > maxBytes) throw new Error('Imagem maior que 10MB.')
  const name = decodeURIComponent(url.split('/').pop() || 'imagem').split('?')[0] || 'imagem.jpg'

  const media = await payload.create({
    collection: 'media',
    overrideAccess: false,
    user: user as never,
    data: { alt: altFallback } as never,
    file: {
      data: Buffer.from(arrayBuffer),
      mimetype: contentType,
      name,
      size: arrayBuffer.byteLength,
    },
  })
  return media
}

export type ImportRowResult = {
  rowIndex: number
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
  values: ImportRowValues
  onConflict: 'skip' | 'update'
}

export async function commitImport(payload: Payload, user: WorkflowUser, inputRows: ImportCommitInput[]): Promise<ImportCommitReport> {
  const report: ImportCommitReport = { created: 0, updated: 0, skipped: 0, errored: 0, rows: [] }

  for (const input of inputRows) {
    const { values } = input
    try {
      const issues = validateRowShape(values)
      if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '))

      const code = values.code.trim().toUpperCase()
      const existing = await payload.find({
        collection: 'products',
        where: { code: { equals: code } },
        depth: 0,
        limit: 1,
        overrideAccess: false,
        user: user as never,
      })
      const existingId = existing.docs[0]?.id ?? null

      if (existingId !== null && input.onConflict === 'skip') {
        report.skipped += 1
        report.rows.push({ rowIndex: input.rowIndex, status: 'skipped', productId: existingId })
        continue
      }

      const categoryNames = splitMulti(values.categories)
      const { ids: categoryIds, missing: missingCategories } = await resolveCategoryIds(payload, user, categoryNames)
      if (missingCategories.length) throw new Error(`Categoria não encontrada: ${missingCategories.join(', ')}.`)

      const imageUrls = splitMulti(values.imageUrls)
      const gallery: Array<{ image: string | number; mediaKey: string; role: string; alt: string }> = []
      for (const [index, url] of imageUrls.entries()) {
        const media = await fetchImageAsMedia(payload, user, url, values.title || 'Produto')
        gallery.push({
          image: media.id,
          mediaKey: `img-${index + 1}`,
          role: index === 0 ? 'cover' : 'detail',
          alt: values.title || 'Produto',
        })
      }

      const availability = values.availability
        ? availabilityLabelToValue[values.availability.trim().toLocaleLowerCase('pt-BR')]
        : 'available'
      const catalogStatus = values.catalogStatus
        ? catalogStatusLabelToValue[values.catalogStatus.trim().toLocaleLowerCase('pt-BR')]
        : 'active'
      const priceCents = parsePriceToCents(values.price)

      const data = {
        title: values.title.trim(),
        code,
        slug: values.slug.trim() || undefined,
        catalogStatus,
        availability,
        categories: categoryIds,
        material: values.material.trim() || undefined,
        description: values.description ? textToRichText(values.description) : undefined,
        priceMode: priceCents !== null ? 'fixed' : 'inquiry',
        basePriceCents: priceCents ?? undefined,
        gallery: gallery.length ? gallery : undefined,
      }

      if (existingId !== null) {
        await payload.update({ collection: 'products', id: existingId, overrideAccess: false, user: user as never, data: data as never })
        report.updated += 1
        report.rows.push({ rowIndex: input.rowIndex, status: 'updated', productId: existingId })
      } else {
        const created = await payload.create({ collection: 'products', overrideAccess: false, user: user as never, data: data as never })
        report.created += 1
        report.rows.push({ rowIndex: input.rowIndex, status: 'created', productId: created.id })
      }
    } catch (error) {
      report.errored += 1
      report.rows.push({ rowIndex: input.rowIndex, status: 'error', error: error instanceof Error ? error.message : 'Falha desconhecida.' })
    }
  }

  return report
}
