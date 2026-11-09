/// <reference lib="webworker" />

import { openXlsxWorkbook, type ParsedXlsxSheet } from './xlsx'

export type WorkbookCommand = { action: 'open'; buffer: ArrayBuffer } | { action: 'sheet'; index: number }
export type WorkbookReply = { sheetNames?: string[]; sheet?: ParsedXlsxSheet; error?: string }

let workbook: Awaited<ReturnType<typeof openXlsxWorkbook>> | undefined

self.onmessage = async ({ data }: MessageEvent<WorkbookCommand>) => {
  try {
    if (data.action === 'open') {
      workbook = await openXlsxWorkbook(data.buffer)
      self.postMessage({ sheetNames: workbook.sheetNames } satisfies WorkbookReply)
    } else {
      if (!workbook) throw new Error('Selecione um arquivo Excel primeiro.')
      self.postMessage({ sheet: await workbook.readSheet(data.index) } satisfies WorkbookReply)
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Não foi possível ler o arquivo Excel.' } satisfies WorkbookReply)
  }
}
