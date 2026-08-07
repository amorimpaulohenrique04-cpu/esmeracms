/// <reference lib="webworker" />

import { resolveHeaderColumn } from '../../../businessRules/products/importSchema'
import {
  emptyImportValues,
  validateRowShape,
  type ImportRowValues,
} from '../../../businessRules/products/importValidation'
import { detectDelimiter, parseTabularText } from '../../../server/domain/products/csv'

type ParseRequest = { id: string; text: string }

type LocalPreviewRow = {
  rowIndex: number
  sourceLine: number
  values: ImportRowValues
  issues: ReturnType<typeof validateRowShape>
  isDuplicate: false
  action: 'create'
}

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const { id, text } = event.data
  try {
    const delimiter = detectDelimiter(text)
    const table = parseTabularText(text, delimiter)
    if (!table.length) {
      self.postMessage({ id, ok: true, result: { rows: [], unknownHeaders: [], delimiter } })
      return
    }

    const [header, ...dataRows] = table
    const mapped = header.cells.map((cell) => resolveHeaderColumn(cell))
    if (!mapped.some(Boolean)) throw new Error('Cabeçalho não reconhecido. Use o modelo de importação ou faça o mapeamento das colunas.')

    const unknownHeaders = header.cells.filter((cell, index) => !mapped[index] && cell.trim())
    const rows: LocalPreviewRow[] = dataRows.map(({ cells, sourceLine }, rowIndex) => {
      const values = emptyImportValues()
      mapped.forEach((column, index) => {
        if (column) values[column] = (cells[index] || '').trim()
      })
      return {
        rowIndex,
        sourceLine,
        values,
        issues: validateRowShape(values, { requireActiveAssets: true }),
        isDuplicate: false,
        action: 'create',
      }
    })

    self.postMessage({ id, ok: true, result: { rows, unknownHeaders, delimiter } })
  } catch (error) {
    self.postMessage({ id, ok: false, error: error instanceof Error ? error.message : 'Falha ao ler a planilha.' })
  }
}

export {}
