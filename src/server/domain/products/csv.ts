/**
 * Parser mínimo de CSV/TSV inspirado no RFC 4180. Mantém a implementação sem
 * dependências, mas cobre o caso real de Excel pt-BR (;), Google Sheets (,),
 * TSV, aspas duplas e quebras de linha dentro de campos.
 */
export type Delimiter = ',' | ';' | '\t' | '|'
export type ParsedDelimitedRow = { cells: string[]; sourceLine: number }

const CANDIDATES: Delimiter[] = [';', ',', '\t', '|']

function countOutsideQuotes(line: string, delimiter: Delimiter) {
  let count = 0
  let inQuotes = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && inQuotes && next === '"') { index += 1; continue }
    if (char === '"') { inQuotes = !inQuotes; continue }
    if (!inQuotes && char === delimiter) count += 1
  }
  return count
}

export function detectDelimiter(text: string): Delimiter {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim()).slice(0, 5)
  let best: Delimiter = ','
  let bestScore = -1

  for (const delimiter of CANDIDATES) {
    const counts = lines.map((line) => countOutsideQuotes(line, delimiter))
    if (!counts.length || counts.some((count) => count === 0)) continue
    const consistent = counts.every((count) => count === counts[0])
    const score = counts[0] * (consistent ? 10 : 1)
    if (score > bestScore) {
      best = delimiter
      bestScore = score
    }
  }

  return best
}

export function parseDelimited(text: string, delimiter: Delimiter): ParsedDelimitedRow[] {
  const rows: ParsedDelimitedRow[] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let physicalLine = 1
  let rowStartLine = 1
  const normalized = text.replace(/^\uFEFF/, '')

  const pushRow = () => {
    row.push(field)
    if (row.some((cell) => cell.trim().length)) rows.push({ cells: row, sourceLine: rowStartLine })
    row = []
    field = ''
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; index += 1 }
      else if (char === '"') inQuotes = false
      else {
        field += char
        if (char === '\n') physicalLine += 1
      }
      continue
    }

    if (char === '"') inQuotes = true
    else if (char === delimiter) { row.push(field); field = '' }
    else if (char === '\n') {
      pushRow()
      physicalLine += 1
      rowStartLine = physicalLine
    } else if (char === '\r') { /* \n cuida da quebra */ }
    else field += char
  }

  if (field.length || row.length) pushRow()
  return rows
}

export function parseTabularText(text: string, delimiter = detectDelimiter(text)): ParsedDelimitedRow[] {
  return parseDelimited(text, delimiter)
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => {
    const value = cell ?? ''
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  }).join(',')).join('\r\n')
}
