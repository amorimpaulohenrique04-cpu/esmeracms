/**
 * Parser mínimo de CSV/TSV (RFC 4180: aspas duplas, vírgula/tab como delimitador,
 * quebras de linha dentro de campos entre aspas). Escrito à mão para não trazer
 * uma dependência nova só para separar texto por vírgula/tab.
 */
export function detectDelimiter(text: string): ',' | '\t' {
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  return firstLine.includes('\t') ? '\t' : ','
}

export function parseDelimited(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const normalized = text.replace(/^﻿/, '')

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; index += 1 }
      else if (char === '"') inQuotes = false
      else field += char
      continue
    }

    if (char === '"') { inQuotes = true }
    else if (char === delimiter) { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char === '\r') { /* ignora, \n cuida da quebra */ }
    else field += char
  }

  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length))
}

export function parseTabularText(text: string): string[][] {
  return parseDelimited(text, detectDelimiter(text))
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => {
    const value = cell ?? ''
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  }).join(',')).join('\r\n')
}
