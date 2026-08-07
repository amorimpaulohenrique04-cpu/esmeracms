import {
  availabilityLabelToValue,
  catalogStatusLabelToValue,
  importColumns,
  importColumnRequired,
  priceModeLabelToValue,
  type ImportColumn,
} from './importSchema'

export type ImportRowValues = Record<ImportColumn, string>
export type ImportIssueSeverity = 'error' | 'warning'
export type ImportRowIssue = {
  column: ImportColumn | 'general'
  message: string
  code?: string
  severity?: ImportIssueSeverity
}

export type ParsedPrice =
  | { ok: true; cents: number; normalized: string; ambiguous: boolean }
  | { ok: false; reason: 'empty' | 'format' | 'range' }

const CURRENCY = /(?:R\$|\s|\u00a0)/gi
const CLEAR_TOKEN = '--'

export function foldKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

export function splitMulti(value: string): string[] {
  return value.split(';').map((item) => item.trim()).filter(Boolean)
}

export function isClearCell(value: string) {
  return value.trim() === CLEAR_TOKEN
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
  } catch {
    return false
  }
}

export function formatBRL(cents: number) {
  const absolute = Math.abs(Math.trunc(cents))
  const reais = Math.floor(absolute / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const centavos = String(absolute % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}R$ ${reais},${centavos}`
}

/**
 * Interpreta formatos BR/US sem transformar silenciosamente separador de milhar
 * em decimal. Um único separador seguido de 3 dígitos é tratado como milhar e
 * sinalizado como ambíguo para confirmação visual no preview.
 */
export function parsePrice(raw: string): ParsedPrice {
  const value = raw.trim().replace(CURRENCY, '')
  if (!value) return { ok: false, reason: 'empty' }
  if (!/^-?[\d.,]+$/.test(value)) return { ok: false, reason: 'format' }

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')
  const separator = lastComma > lastDot ? ',' : lastDot > -1 ? '.' : null

  let numeric: number
  let ambiguous = false

  if (separator === null) {
    numeric = Number(value)
  } else {
    const separatorIndex = value.lastIndexOf(separator)
    const decimals = value.length - separatorIndex - 1
    const separatorCount = value.split(/[.,]/).length - 1
    const isThousands = decimals === 3 && separatorCount === 1

    if (isThousands) {
      numeric = Number(value.replace(/[.,]/g, ''))
      ambiguous = true
    } else {
      const decimalSeparator = separator
      const thousandsPattern = decimalSeparator === ',' ? /\./g : /,/g
      const normalized = value.replace(thousandsPattern, '').replace(decimalSeparator, '.')
      numeric = Number(normalized)
    }
  }

  const cents = Math.round(numeric * 100)
  if (!Number.isFinite(cents) || cents < 0) return { ok: false, reason: 'range' }
  return { ok: true, cents, normalized: formatBRL(cents), ambiguous }
}

export function normalizeAvailability(value: string): string | null {
  if (!value.trim()) return null
  return availabilityLabelToValue[value.trim().toLocaleLowerCase('pt-BR')] || null
}

export function normalizeCatalogStatus(value: string): string | null {
  if (!value.trim()) return null
  return catalogStatusLabelToValue[value.trim().toLocaleLowerCase('pt-BR')] || null
}

export function normalizePriceMode(value: string): 'fixed' | 'inquiry' | null {
  if (!value.trim()) return null
  return (priceModeLabelToValue[value.trim().toLocaleLowerCase('pt-BR')] as 'fixed' | 'inquiry' | undefined) || null
}

export function slugifyImportTitle(value: string) {
  return foldKey(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function emptyImportValues(): ImportRowValues {
  const record = {} as ImportRowValues
  importColumns.forEach((column) => { record[column] = '' })
  return record
}

export function validateRowShape(
  values: ImportRowValues,
  options: { requireActiveAssets?: boolean; allowPartialUpdate?: boolean } = {},
): ImportRowIssue[] {
  const issues: ImportRowIssue[] = []

  for (const column of importColumns) {
    if (!importColumnRequired[column]) continue
    if (options.allowPartialUpdate && column === 'title') continue
    if (!values[column]?.trim()) {
      issues.push({ column, code: 'required', message: 'Campo obrigatório.', severity: 'error' })
    }
  }

  if (isClearCell(values.code)) {
    issues.push({ column: 'code', code: 'code_clear', message: 'Código identifica o produto e não pode ser limpo.', severity: 'error' })
  }
  if (!options.allowPartialUpdate && isClearCell(values.title)) {
    issues.push({ column: 'title', code: 'title_clear', message: 'Nome é obrigatório e não pode ser limpo.', severity: 'error' })
  }

  if (values.slug && !isClearCell(values.slug) && !/^[a-z0-9-]+$/.test(values.slug.trim())) {
    issues.push({ column: 'slug', code: 'slug_format', message: 'Use letras minúsculas, números e hífens.', severity: 'error' })
  }
  if (isClearCell(values.slug)) {
    issues.push({ column: 'slug', code: 'slug_clear', message: 'Slug é obrigatório e não pode ser limpo.', severity: 'error' })
  }

  if (values.availability && !isClearCell(values.availability) && !normalizeAvailability(values.availability)) {
    issues.push({ column: 'availability', code: 'availability', message: 'Use Peça única, Disponível, Sob encomenda ou Edição limitada.', severity: 'error' })
  }

  const catalogStatus = values.catalogStatus && !isClearCell(values.catalogStatus)
    ? normalizeCatalogStatus(values.catalogStatus)
    : null
  if (values.catalogStatus && !isClearCell(values.catalogStatus) && !catalogStatus) {
    issues.push({ column: 'catalogStatus', code: 'catalog_status', message: 'Use Ativo ou Arquivado.', severity: 'error' })
  }

  if (values.priceMode && !isClearCell(values.priceMode) && !normalizePriceMode(values.priceMode)) {
    issues.push({ column: 'priceMode', code: 'price_mode', message: 'Use Fixo ou Sob consulta.', severity: 'error' })
  }

  if (values.price && !isClearCell(values.price)) {
    const price = parsePrice(values.price)
    if (!price.ok) {
      issues.push({ column: 'price', code: 'price_format', message: 'Use um valor como 890,00 ou 1.490,00.', severity: 'error' })
    } else if (price.ambiguous) {
      issues.push({
        column: 'price',
        code: 'price_ambiguous',
        message: `${values.price.trim()} → interpretado como ${price.normalized}. Confirme o valor.`,
        severity: 'warning',
      })
    }
  }

  const imageUrls = isClearCell(values.imageUrls) ? [] : splitMulti(values.imageUrls)
  const invalidUrl = imageUrls.find((url) => !isHttpUrl(url))
  if (invalidUrl) {
    issues.push({ column: 'imageUrls', code: 'image_url', message: `URL inválida: ${invalidUrl}`, severity: 'error' })
  }

  if (options.requireActiveAssets) {
    const nextStatus = catalogStatus || 'active'
    if (nextStatus === 'active' && imageUrls.length === 0) {
      issues.push({ column: 'imageUrls', code: 'active_image', message: 'Produto ativo precisa de ao menos uma imagem (separe várias com ";").', severity: 'error' })
    }
    if (nextStatus === 'active' && (isClearCell(values.categories) || splitMulti(values.categories).length === 0)) {
      issues.push({ column: 'categories', code: 'active_category', message: 'Produto ativo precisa de ao menos uma categoria (separe várias com ";").', severity: 'error' })
    }
  }

  return issues
}

export function blockingIssueCount(issues: ImportRowIssue[]) {
  return issues.filter((issue) => issue.severity !== 'warning').length
}
