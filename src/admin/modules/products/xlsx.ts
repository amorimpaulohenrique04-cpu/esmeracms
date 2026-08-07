const ZIP_EOCD_SIGNATURE = 0x06054b50
const ZIP_CENTRAL_SIGNATURE = 0x02014b50
const ZIP_LOCAL_SIGNATURE = 0x04034b50
const MAX_ENTRY_BYTES = 16 * 1024 * 1024
const MAX_WORKBOOK_BYTES = 32 * 1024 * 1024
const MAX_SHEET_ROWS = 2_100

type ZipEntry = {
  name: string
  method: number
  compressedSize: number
  uncompressedSize: number
  localOffset: number
}

export type ParsedXlsxSheet = {
  name: string
  text: string
}

export type ParsedXlsxWorkbook = {
  sheets: ParsedXlsxSheet[]
}

function uint16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function uint32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder('utf-8').decode(bytes)
}

function findEndOfCentralDirectory(view: DataView) {
  const min = Math.max(0, view.byteLength - 65_557)
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (uint32(view, offset) === ZIP_EOCD_SIGNATURE) return offset
  }
  throw new Error('Arquivo .xlsx inválido: diretório ZIP não encontrado.')
}

function readZipEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const eocd = findEndOfCentralDirectory(view)
  const count = uint16(view, eocd + 10)
  let offset = uint32(view, eocd + 16)
  const entries = new Map<string, ZipEntry>()
  let totalUncompressed = 0

  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > view.byteLength || uint32(view, offset) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error('Arquivo .xlsx inválido: entrada ZIP corrompida.')
    }

    const method = uint16(view, offset + 10)
    const compressedSize = uint32(view, offset + 20)
    const uncompressedSize = uint32(view, offset + 24)
    const nameLength = uint16(view, offset + 28)
    const extraLength = uint16(view, offset + 30)
    const commentLength = uint16(view, offset + 32)
    const localOffset = uint32(view, offset + 42)
    const nameStart = offset + 46
    const nameEnd = nameStart + nameLength
    if (nameEnd > bytes.byteLength) throw new Error('Arquivo .xlsx inválido: nome ZIP truncado.')

    const name = decodeUtf8(bytes.subarray(nameStart, nameEnd)).replaceAll('\\', '/')
    if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error('Arquivo .xlsx excede o limite de segurança por entrada.')
    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_WORKBOOK_BYTES) throw new Error('Arquivo .xlsx excede o limite de descompressão segura.')

    entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset })
    offset = nameEnd + extraLength + commentLength
  }

  return entries
}

async function inflateRaw(compressed: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não oferece descompressão necessária para arquivos .xlsx.')
  }
  const copy = compressed.slice().buffer as ArrayBuffer
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const offset = entry.localOffset
  if (offset + 30 > view.byteLength || uint32(view, offset) !== ZIP_LOCAL_SIGNATURE) {
    throw new Error(`Arquivo .xlsx inválido: cabeçalho ausente em ${entry.name}.`)
  }

  const nameLength = uint16(view, offset + 26)
  const extraLength = uint16(view, offset + 28)
  const start = offset + 30 + nameLength + extraLength
  const end = start + entry.compressedSize
  if (end > bytes.byteLength) throw new Error(`Arquivo .xlsx inválido: conteúdo truncado em ${entry.name}.`)

  const compressed = bytes.subarray(start, end)
  let output: Uint8Array
  if (entry.method === 0) output = compressed.slice()
  else if (entry.method === 8) output = await inflateRaw(compressed)
  else throw new Error(`Método de compressão ZIP não suportado (${entry.method}).`)

  if (output.byteLength > MAX_ENTRY_BYTES || (entry.uncompressedSize && output.byteLength !== entry.uncompressedSize)) {
    throw new Error(`Arquivo .xlsx inválido ou maior que o limite em ${entry.name}.`)
  }
  return output
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function attribute(source: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`(?:^|\\s)${escaped}="([^"]*)"`))
  return match ? decodeXml(match[1]) : null
}

function textNodes(xml: string) {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join('')
}

function normalizeTarget(target: string) {
  const pieces = (target.startsWith('/') ? target.slice(1) : `xl/${target}`).split('/')
  const normalized: string[] = []
  for (const piece of pieces) {
    if (!piece || piece === '.') continue
    if (piece === '..') normalized.pop()
    else normalized.push(piece)
  }
  return normalized.join('/')
}

function workbookSheets(workbookXml: string, relsXml: string) {
  const targets = new Map<string, string>()
  for (const match of relsXml.matchAll(/<Relationship\b([^>]*?)\/?>(?:<\/Relationship>)?/g)) {
    const id = attribute(match[1], 'Id')
    const target = attribute(match[1], 'Target')
    const type = attribute(match[1], 'Type')
    if (id && target && type?.includes('/worksheet')) targets.set(id, normalizeTarget(target))
  }

  const sheets: Array<{ name: string; path: string }> = []
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*?)\/?>(?:<\/sheet>)?/g)) {
    const name = attribute(match[1], 'name')
    const relation = attribute(match[1], 'r:id')
    const path = relation ? targets.get(relation) : null
    if (name && path) sheets.push({ name, path })
  }
  return sheets
}

function sharedStrings(xml: string | null) {
  if (!xml) return []
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => textNodes(match[1]))
}

function columnIndex(cellReference: string) {
  const letters = cellReference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || ''
  let index = 0
  for (const char of letters) index = index * 26 + char.charCodeAt(0) - 64
  return Math.max(0, index - 1)
}

function cellValue(attributes: string, body: string, strings: string[]) {
  const type = attribute(attributes, 't')
  if (type === 'inlineStr') return textNodes(body)
  const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? ''
  if (type === 's') return strings[Number(raw)] ?? ''
  if (type === 'b') return raw === '1' ? 'TRUE' : 'FALSE'
  if (type === 'str') return decodeXml(raw)
  return decodeXml(raw)
}

function quoteTsv(value: string) {
  return /[\t"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function sheetAsText(xml: string, strings: string[]) {
  const rows = new Map<number, string[]>()
  let highestRow = 0

  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const declaredRow = Number(attribute(rowMatch[1], 'r') || highestRow + 1)
    if (!Number.isFinite(declaredRow) || declaredRow < 1) continue
    if (declaredRow > MAX_SHEET_ROWS) throw new Error(`A planilha excede ${MAX_SHEET_ROWS - 100} linhas. Divida o arquivo em lotes menores.`)
    highestRow = Math.max(highestRow, declaredRow)
    const cells: string[] = []
    const rowBody = rowMatch[2]

    for (const cellMatch of rowBody.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const reference = attribute(cellMatch[1], 'r') || ''
      const index = columnIndex(reference)
      cells[index] = cellValue(cellMatch[1], cellMatch[2] || '', strings)
    }
    rows.set(declaredRow, cells)
  }

  const lines: string[] = []
  for (let row = 1; row <= highestRow; row += 1) {
    const cells = rows.get(row) || []
    const last = cells.reduce((max, value, index) => value !== undefined && value !== '' ? index : max, -1)
    lines.push(last < 0 ? '' : cells.slice(0, last + 1).map((value) => quoteTsv(value || '')).join('\t'))
  }
  return lines.join('\n')
}

async function readXml(buffer: ArrayBuffer, entries: Map<string, ZipEntry>, path: string, required = true) {
  const entry = entries.get(path)
  if (!entry) {
    if (required) throw new Error(`Arquivo .xlsx inválido: ${path} não encontrado.`)
    return null
  }
  return decodeUtf8(await readZipEntry(buffer, entry))
}

export async function parseXlsxWorkbook(buffer: ArrayBuffer): Promise<ParsedXlsxWorkbook> {
  const entries = readZipEntries(buffer)
  const workbookXml = await readXml(buffer, entries, 'xl/workbook.xml')
  const relsXml = await readXml(buffer, entries, 'xl/_rels/workbook.xml.rels')
  const sharedXml = await readXml(buffer, entries, 'xl/sharedStrings.xml', false)
  const strings = sharedStrings(sharedXml)
  const definitions = workbookSheets(workbookXml || '', relsXml || '')
  if (!definitions.length) throw new Error('Arquivo .xlsx sem abas de planilha legíveis.')

  const sheets: ParsedXlsxSheet[] = []
  for (const definition of definitions) {
    const xml = await readXml(buffer, entries, definition.path)
    sheets.push({ name: definition.name, text: sheetAsText(xml || '', strings) })
  }
  return { sheets }
}
