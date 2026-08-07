import {
  importColumnLabels,
  importColumnRequired,
  importColumns,
  resolveHeaderColumn,
  type ImportColumn,
} from '../../../businessRules/products/importSchema'
import { foldKey } from '../../../businessRules/products/importValidation'
import { detectDelimiter, parseTabularText, type Delimiter } from '../../../server/domain/products/csv'

export type ImportHeaderInspection = {
  delimiter: Delimiter
  headers: string[]
  mapping: Array<ImportColumn | null>
  needsMapping: boolean
  missingRequired: ImportColumn[]
}

function levenshtein(left: string, right: string) {
  const a = foldKey(left).replace(/[^a-z0-9]/g, '')
  const b = foldKey(right).replace(/[^a-z0-9]/g, '')
  if (!a) return b.length
  if (!b) return a.length
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + cost,
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

function fuzzyColumn(header: string, used: Set<ImportColumn>) {
  let best: ImportColumn | null = null
  let score = Number.POSITIVE_INFINITY
  for (const column of importColumns) {
    if (used.has(column)) continue
    const distance = levenshtein(header, importColumnLabels[column])
    if (distance < score) {
      score = distance
      best = column
    }
  }
  return score <= 2 ? best : null
}

export function inspectImportHeaders(text: string): ImportHeaderInspection {
  const delimiter = detectDelimiter(text)
  const first = parseTabularText(text, delimiter)[0]
  if (!first) return { delimiter, headers: [], mapping: [], needsMapping: false, missingRequired: [] }

  const used = new Set<ImportColumn>()
  const mapping = first.cells.map((header) => {
    const exact = resolveHeaderColumn(header)
    if (exact && !used.has(exact)) {
      used.add(exact)
      return exact
    }
    const fuzzy = fuzzyColumn(header, used)
    if (fuzzy) used.add(fuzzy)
    return fuzzy
  })

  const missingRequired = importColumns.filter((column) => importColumnRequired[column] && !mapping.includes(column))
  const hasUnknown = first.cells.some((header, index) => header.trim() && mapping[index] === null)
  return {
    delimiter,
    headers: first.cells,
    mapping,
    missingRequired,
    needsMapping: hasUnknown || missingRequired.length > 0,
  }
}

function firstRowEnd(text: string) {
  let inQuotes = false
  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && inQuotes && next === '"') { index += 1; continue }
    if (char === '"') { inQuotes = !inQuotes; continue }
    if (!inQuotes && char === '\n') return { start, end: index, newlineLength: 1 }
    if (!inQuotes && char === '\r') {
      return { start, end: index, newlineLength: next === '\n' ? 2 : 1 }
    }
  }
  return { start, end: text.length, newlineLength: 0 }
}

export function applyImportMapping(
  text: string,
  delimiter: Delimiter,
  mapping: Array<ImportColumn | null>,
) {
  const assigned = mapping.filter((column): column is ImportColumn => column !== null)
  const duplicate = assigned.find((column, index) => assigned.indexOf(column) !== index)
  if (duplicate) throw new Error(`A coluna ${importColumnLabels[duplicate]} foi mapeada mais de uma vez.`)

  const missing = importColumns.filter((column) => importColumnRequired[column] && !assigned.includes(column))
  if (missing.length) {
    throw new Error(`Mapeie as colunas obrigatórias: ${missing.map((column) => importColumnLabels[column]).join(', ')}.`)
  }

  const header = mapping.map((column) => column ? importColumnLabels[column] : '').join(delimiter)
  const boundary = firstRowEnd(text)
  const bodyStart = boundary.end + boundary.newlineLength
  if (bodyStart >= text.length) return header
  const newline = boundary.newlineLength === 2 ? '\r\n' : '\n'
  return `${header}${newline}${text.slice(bodyStart)}`
}
