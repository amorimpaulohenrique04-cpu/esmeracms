'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'

import {
  importColumnLabels,
  importColumnRequired,
  importColumns,
  type ImportColumn,
} from '../../../businessRules/products/importSchema'
import {
  blockingIssueCount,
  parsePrice,
  validateRowShape,
} from '../../../businessRules/products/importValidation'
import { Button } from '../../design-system'
import {
  applyImportMapping,
  inspectImportHeaders,
  type ImportHeaderInspection,
} from './importMapping'
import { parseXlsxWorkbook, type ParsedXlsxSheet } from './xlsx'

const PREVIEW_WINDOW = 40
const DB_ISSUE_CODES = new Set(['category_missing', 'slug_conflict', 'duplicate_batch'])

type PreviewIssue = {
  column: ImportColumn | 'general'
  message: string
  code?: string
  severity?: 'error' | 'warning'
}

type PreviewRow = {
  rowIndex: number
  sourceLine: number
  values: Record<ImportColumn, string>
  issues: PreviewIssue[]
  isDuplicate: boolean
  action: 'create' | 'update' | 'skip'
}

type PreviewResponse = {
  rows: PreviewRow[]
  unknownHeaders: string[]
  delimiter: ',' | ';' | '\t' | '|'
}

type CommitRowResult = {
  rowIndex: number
  sourceLine: number
  status: 'created' | 'updated' | 'skipped' | 'error'
  error?: string
}

type CommitResponse = {
  created: number
  updated: number
  skipped: number
  errored: number
  rows: CommitRowResult[]
}

type QueuedResponse = {
  importId: string
  status: string
  totalRows: number
  processedRows: number
  pollUrl: string
}

type ImportStatusResponse = {
  importId: string
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled'
  totalRows: number
  processedRows: number
  created: number
  updated: number
  skipped: number
  errored: number
  results: CommitRowResult[]
  error?: string | null
  errorCsvUrl?: string | null
}

type RowFilter = 'all' | 'pending' | 'new' | 'conflicts'

type ProgressState = {
  importId: string
  status: ImportStatusResponse['status']
  processedRows: number
  totalRows: number
}

type WorkerResponse = {
  id: string
  ok: boolean
  result?: PreviewResponse
  error?: string
}

async function callImportApi<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/admin-products-import', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error((result as { error?: string }).error || 'Falha na importação.')
  return result
}

async function fetchImportStatus(url: string, signal: AbortSignal): Promise<ImportStatusResponse> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal })
  const data = await response.json() as ImportStatusResponse & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o andamento da importação.')
  return data
}

function parseLocally(text: string): Promise<PreviewResponse | null> {
  if (typeof Worker === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' })
    const id = crypto.randomUUID()
    const timeout = window.setTimeout(() => {
      worker.terminate()
      resolve(null)
    }, 12_000)

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return
      window.clearTimeout(timeout)
      worker.terminate()
      resolve(event.data.ok ? event.data.result || null : null)
    }
    worker.onerror = () => {
      window.clearTimeout(timeout)
      worker.terminate()
      resolve(null)
    }
    worker.postMessage({ id, text })
  })
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function sheetFromRows(rows: PreviewRow[]) {
  const header = importColumns.map((column) => importColumnLabels[column])
  const lines = [header, ...rows.map((row) => importColumns.map((column) => row.values[column] || ''))]
  return lines.map((line) => line.map(csvCell).join(',')).join('\n')
}

function decodeSheet(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8 BOM' }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' }
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252' }
  }
}

function delimiterLabel(delimiter: PreviewResponse['delimiter'] | null) {
  if (delimiter === '\t') return 'TAB'
  return delimiter || 'auto'
}

function downloadErrorCsv(result: CommitResponse) {
  const rows = result.rows.filter((item) => item.status === 'error')
  const csv = [
    ['linha', 'erro'],
    ...rows.map((item) => [String(item.sourceLine), item.error || 'Falha desconhecida']),
  ].map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'erros-importacao-produtos.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function terminalStatus(status: ImportStatusResponse['status']) {
  return status === 'completed' ||
    status === 'completed_with_errors' ||
    status === 'failed' ||
    status === 'cancelled'
}

function affectsDatabaseResolution(column: ImportColumn) {
  return column === 'code' || column === 'categories' || column === 'slug' || column === 'title'
}

export function ProductImportDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'input' | 'mapping' | 'preview' | 'result'>('input')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [needsDbRevalidation, setNeedsDbRevalidation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommitResponse | null>(null)
  const [encoding, setEncoding] = useState<string | null>(null)
  const [delimiter, setDelimiter] = useState<PreviewResponse['delimiter'] | null>(null)
  const [filter, setFilter] = useState<RowFilter>('all')
  const [page, setPage] = useState(0)
  const [activePendingRow, setActivePendingRow] = useState<number | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [remoteErrorCsv, setRemoteErrorCsv] = useState<string | null>(null)
  const [finalStatus, setFinalStatus] = useState<ImportStatusResponse['status'] | null>(null)
  const [xlsxSheets, setXlsxSheets] = useState<ParsedXlsxSheet[]>([])
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [mappingInspection, setMappingInspection] = useState<ImportHeaderInspection | null>(null)
  const [mappingValues, setMappingValues] = useState<Array<ImportColumn | null>>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const idempotencyRef = useRef<string | null>(null)
  const pollAbortRef = useRef<AbortController | null>(null)

  function reset() {
    pollAbortRef.current?.abort()
    pollAbortRef.current = null
    idempotencyRef.current = null
    setStep('input')
    setRawText('')
    setRows([])
    setUnknownHeaders([])
    setError(null)
    setResult(null)
    setEncoding(null)
    setDelimiter(null)
    setFilter('all')
    setPage(0)
    setActivePendingRow(null)
    setProgress(null)
    setRemoteErrorCsv(null)
    setFinalStatus(null)
    setXlsxSheets([])
    setSelectedSheet(0)
    setResolving(false)
    setNeedsDbRevalidation(false)
    setMappingInspection(null)
    setMappingValues([])
    if (fileRef.current) fileRef.current.value = ''
  }

  function applyPreview(data: PreviewResponse, keepActions?: Map<string, 'create' | 'update' | 'skip'>) {
    setRows(data.rows.map((row) => ({
      ...row,
      action: keepActions?.get(row.values.code?.trim().toUpperCase()) || row.action,
    })))
    setUnknownHeaders(data.unknownHeaders)
    setDelimiter(data.delimiter)
    setFilter('all')
    setPage(0)
    setActivePendingRow(null)
    setMappingInspection(null)
    setMappingValues([])
    setStep('preview')
  }

  async function runPreview(text: string, keepActions?: Map<string, 'create' | 'update' | 'skip'>) {
    setBusy(true)
    setResolving(true)
    setError(null)
    setNeedsDbRevalidation(false)
    idempotencyRef.current = null

    const serverPromise = callImportApi<PreviewResponse>({ action: 'preview', text })
    try {
      const local = await parseLocally(text)
      if (local) applyPreview(local, keepActions)

      const data = await serverPromise
      applyPreview(data, keepActions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível pré-visualizar.')
    } finally {
      setResolving(false)
      setBusy(false)
    }
  }

  async function beginPreview(text: string) {
    setError(null)
    const inspection = inspectImportHeaders(text)
    if (inspection.needsMapping) {
      setRawText(text)
      setMappingInspection(inspection)
      setMappingValues(inspection.mapping)
      setStep('mapping')
      setBusy(false)
      return
    }
    await runPreview(text)
  }

  async function confirmMapping() {
    if (!mappingInspection) return
    setBusy(true)
    setError(null)
    try {
      const mapped = applyImportMapping(rawText, mappingInspection.delimiter, mappingValues)
      setRawText(mapped)
      await runPreview(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aplicar o mapeamento.')
    } finally {
      setBusy(false)
    }
  }

  async function consumeFile(file: File) {
    setError(null)
    if (file.size > 4 * 1024 * 1024) {
      setError('Arquivo maior que 4 MB. Divida a importação em lotes menores.')
      return
    }

    setBusy(true)
    try {
      const buffer = await file.arrayBuffer()
      if (/\.xlsx$/i.test(file.name)) {
        const workbook = await parseXlsxWorkbook(buffer)
        const first = workbook.sheets[0]
        if (!first) throw new Error('O arquivo .xlsx não possui uma aba legível.')
        setXlsxSheets(workbook.sheets)
        setSelectedSheet(0)
        setEncoding('XLSX')
        setRawText(first.text)
        await beginPreview(first.text)
        return
      }

      setXlsxSheets([])
      setSelectedSheet(0)
      const decoded = decodeSheet(buffer)
      setEncoding(decoded.encoding)
      setRawText(decoded.text)
      await beginPreview(decoded.text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void consumeFile(file)
  }

  async function changeXlsxSheet(index: number) {
    const sheet = xlsxSheets[index]
    if (!sheet) return
    setSelectedSheet(index)
    setRawText(sheet.text)
    await beginPreview(sheet.text)
  }

  function updateCell(rowIndex: number, column: ImportColumn, value: string) {
    setRows((current) => current.map((row) => {
      if (row.rowIndex !== rowIndex) return row
      const values = { ...row.values, [column]: value }
      const localIssues = validateRowShape(values, {
        requireActiveAssets: !row.isDuplicate,
        allowPartialUpdate: row.isDuplicate,
      })
      const preservedDbIssues = row.issues.filter((issue) => {
        if (!issue.code || !DB_ISSUE_CODES.has(issue.code)) return false
        if (column === 'code' && issue.code === 'duplicate_batch') return false
        if (column === 'categories' && issue.code === 'category_missing') return false
        if ((column === 'slug' || column === 'title') && issue.code === 'slug_conflict') return false
        return true
      })
      return { ...row, values, issues: [...localIssues, ...preservedDbIssues] }
    }))
    if (affectsDatabaseResolution(column)) setNeedsDbRevalidation(true)
    idempotencyRef.current = null
  }

  function removeRow(rowIndex: number) {
    setRows((current) => current.filter((row) => row.rowIndex !== rowIndex))
    idempotencyRef.current = null
  }

  function setConflictAction(rowIndex: number, action: 'update' | 'skip') {
    setRows((current) => current.map((row) => row.rowIndex === rowIndex ? { ...row, action } : row))
    idempotencyRef.current = null
  }

  async function revalidate() {
    const actions = new Map(rows.map((row) => [row.values.code?.trim().toUpperCase(), row.action]))
    await runPreview(sheetFromRows(rows), actions)
  }

  const blockingCount = rows.reduce((sum, row) => sum + blockingIssueCount(row.issues), 0)
  const pendingRows = useMemo(() => rows.filter((row) => blockingIssueCount(row.issues) > 0), [rows])
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter === 'pending') return blockingIssueCount(row.issues) > 0
    if (filter === 'new') return !row.isDuplicate
    if (filter === 'conflicts') return row.isDuplicate
    return true
  }), [filter, rows])
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PREVIEW_WINDOW))
  const safePage = Math.min(page, pageCount - 1)
  const windowRows = visibleRows.slice(safePage * PREVIEW_WINDOW, (safePage + 1) * PREVIEW_WINDOW)
  const windowStart = visibleRows.length ? safePage * PREVIEW_WINDOW + 1 : 0
  const windowEnd = Math.min((safePage + 1) * PREVIEW_WINDOW, visibleRows.length)

  function selectFilter(next: RowFilter) {
    setFilter(next)
    setPage(0)
    setActivePendingRow(null)
  }

  function focusPending(direction: 1 | -1) {
    if (!pendingRows.length) return
    const currentIndex = activePendingRow === null
      ? -1
      : pendingRows.findIndex((row) => row.rowIndex === activePendingRow)
    const nextIndex = direction === 1
      ? (currentIndex + 1 + pendingRows.length) % pendingRows.length
      : (currentIndex <= 0 ? pendingRows.length : currentIndex) - 1
    const target = pendingRows[nextIndex]
    setFilter('pending')
    setPage(Math.floor(nextIndex / PREVIEW_WINDOW))
    setActivePendingRow(target.rowIndex)
    window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-import-row="${target.rowIndex}"] [aria-invalid="true"]`,
      )
      element?.focus()
    }, 0)
  }

  async function pollImport(initial: QueuedResponse) {
    const controller = new AbortController()
    pollAbortRef.current?.abort()
    pollAbortRef.current = controller
    let pollUrl = initial.pollUrl
    setProgress({
      importId: initial.importId,
      status: initial.status as ImportStatusResponse['status'],
      processedRows: initial.processedRows,
      totalRows: initial.totalRows,
    })

    while (!controller.signal.aborted) {
      const status = await fetchImportStatus(pollUrl, controller.signal)
      setProgress({
        importId: status.importId,
        status: status.status,
        processedRows: status.processedRows,
        totalRows: status.totalRows,
      })
      if (terminalStatus(status.status)) {
        setFinalStatus(status.status)
        setRemoteErrorCsv(status.errorCsvUrl || null)
        setResult({
          created: status.created,
          updated: status.updated,
          skipped: status.skipped,
          errored: status.errored,
          rows: status.results || [],
        })
        if (status.status === 'failed') {
          setError(status.error || 'A importação falhou durante o processamento.')
        }
        setStep('result')
        setProgress(null)
        router.refresh()
        pollAbortRef.current = null
        return
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      pollUrl = `/api/admin-products-import?importId=${encodeURIComponent(status.importId)}`
    }
  }

  async function confirmImport() {
    setBusy(true)
    setError(null)
    setFinalStatus(null)
    setRemoteErrorCsv(null)
    try {
      const payload = rows.map((row) => ({
        rowIndex: row.rowIndex,
        sourceLine: row.sourceLine,
        values: row.values,
        onConflict: row.isDuplicate && row.action === 'update' ? 'update' : 'skip',
      }))
      idempotencyRef.current ||= crypto.randomUUID()
      const data = await callImportApi<CommitResponse | QueuedResponse>({
        action: 'commit',
        rows: payload,
        idempotencyKey: idempotencyRef.current,
      })
      if ('importId' in data) {
        await pollImport(data)
      } else {
        setResult(data)
        setFinalStatus(data.errored ? 'completed_with_errors' : 'completed')
        setStep('result')
        router.refresh()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a importação.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelImport() {
    if (!progress?.importId) return
    try {
      await callImportApi<{ status: 'cancelled' }>({ action: 'cancel', importId: progress.importId })
      setProgress((current) => current ? { ...current, status: 'cancelled' } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar a importação.')
    }
  }

  function reimportErrors() {
    if (!result) return
    const failedIndexes = new Set(
      result.rows.filter((item) => item.status === 'error').map((item) => item.rowIndex),
    )
    const failedRows = rows.filter((row) => failedIndexes.has(row.rowIndex))
    if (!failedRows.length) return
    setRows(failedRows)
    setResult(null)
    setRemoteErrorCsv(null)
    setFinalStatus(null)
    setFilter('all')
    setPage(0)
    setNeedsDbRevalidation(false)
    idempotencyRef.current = null
    setStep('preview')
  }

  function changeOpen(next: boolean) {
    if (!next && (step === 'mapping' || step === 'preview') && (rows.length > 0 || rawText.trim())) {
      const message = busy
        ? 'A importação está em andamento. Fechar esta janela não interrompe o job. Fechar mesmo assim?'
        : 'Fechar e descartar as correções desta importação?'
      if (!window.confirm(message)) return
    }
    setOpen(next)
    if (!next) reset()
  }

  const progressPercent = progress?.totalRows
    ? Math.round((progress.processedRows / progress.totalRows) * 100)
    : 0
  const confirmBlocked = busy || resolving || !rows.length || blockingCount > 0 || needsDbRevalidation

  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger className="esmera-button">Importar produtos</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="esmera-overlay-backdrop" />
      <Dialog.Viewport className="esmera-dialog-viewport">
        <Dialog.Popup className="esmera-dialog esmera-products-import-dialog">
          <div className="esmera-overlay-header">
            <div>
              <Dialog.Title>Importar produtos</Dialog.Title>
              <Dialog.Description>
                Envie Excel, CSV ou TSV. Célula vazia preserva o valor em atualizações; use -- para limpar um campo opcional.
              </Dialog.Description>
            </div>
            <Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close>
          </div>

          <div className="esmera-overlay-body esmera-products-import">
            {error ? <p className="esmera-quick-create-feedback" role="alert" aria-live="assertive">{error}</p> : null}

            {step === 'input' ? <div className="esmera-products-import__input">
              <div className="esmera-products-import__templates">
                <Link className="esmera-button esmera-button--quiet" href="/api/admin-products-import?template=xlsx" download>
                  Baixar modelo (.xlsx)
                </Link>
                <Link className="esmera-button esmera-button--quiet" href="/api/admin-products-import" download>
                  Baixar modelo (.csv)
                </Link>
              </div>
              <label
                className="esmera-products-import__dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer.files?.[0]
                  if (file) void consumeFile(file)
                }}
              >
                <strong>Solte Excel, CSV ou TSV aqui</strong>
                <span>.xlsx direto ou arquivos exportados pelo Excel/Google Sheets</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                  onChange={onFile}
                />
              </label>
              <label className="esmera-products-import__field">
                <span>Ou cole os dados copiados da planilha (com cabeçalho)</span>
                <textarea
                  className="esmera-input"
                  rows={10}
                  value={rawText}
                  onChange={(event) => {
                    setRawText(event.target.value)
                    setEncoding('texto colado')
                    setXlsxSheets([])
                  }}
                  placeholder="nome\tcodigo\tcategoria\tpreco\t..."
                />
              </label>
              <div className="esmera-actions">
                <Button type="button" onClick={() => void beginPreview(rawText)} disabled={busy || !rawText.trim()}>
                  {busy ? 'Lendo…' : 'Pré-visualizar'}
                </Button>
              </div>
            </div> : null}

            {step === 'mapping' && mappingInspection ? <div className="esmera-products-import__mapping">
              <div>
                <strong>Mapear colunas</strong>
                <p>Associe cada coluna recebida a um campo do produto. Colunas sem uso podem ficar como “Ignorar”.</p>
              </div>
              {xlsxSheets.length > 1 ? <label className="esmera-products-import__sheet">
                <span>Aba</span>
                <select
                  className="esmera-input"
                  value={selectedSheet}
                  disabled={busy}
                  onChange={(event) => void changeXlsxSheet(Number(event.target.value))}
                >
                  {xlsxSheets.map((sheet, index) => <option value={index} key={`${sheet.name}-${index}`}>{sheet.name}</option>)}
                </select>
              </label> : null}
              <div className="esmera-products-import__mapping-list">
                {mappingInspection.headers.map((header, index) => {
                  const current = mappingValues[index]
                  return <label key={`${header}-${index}`}>
                    <span>{header || `Coluna ${index + 1}`}</span>
                    <select
                      className="esmera-input"
                      value={current || ''}
                      onChange={(event) => {
                        const value = event.target.value ? event.target.value as ImportColumn : null
                        setMappingValues((items) => items.map((item, itemIndex) => itemIndex === index ? value : item))
                      }}
                    >
                      <option value="">Ignorar</option>
                      {importColumns.map((column) => {
                        const usedElsewhere = mappingValues.some((item, itemIndex) => item === column && itemIndex !== index)
                        return <option key={column} value={column} disabled={usedElsewhere}>
                          {importColumnLabels[column]}{importColumnRequired[column] ? ' *' : ''}
                        </option>
                      })}
                    </select>
                  </label>
                })}
              </div>
              <small>* campos obrigatórios</small>
              <div className="esmera-actions">
                <button type="button" className="esmera-button" onClick={() => setStep('input')} disabled={busy}>Voltar</button>
                <Button type="button" onClick={() => void confirmMapping()} disabled={busy}>
                  {busy ? 'Aplicando…' : 'Aplicar mapeamento'}
                </Button>
              </div>
            </div> : null}

            {step === 'preview' ? <div className="esmera-products-import__preview">
              <div className="esmera-products-import__meta" aria-live="polite">
                <span>Formato: <strong>{encoding || 'texto'}</strong></span>
                <span>Delimitador: <strong>{delimiterLabel(delimiter)}</strong></span>
                {xlsxSheets.length > 1 ? <label className="esmera-products-import__sheet">
                  <span>Aba</span>
                  <select
                    className="esmera-input"
                    value={selectedSheet}
                    disabled={busy}
                    onChange={(event) => void changeXlsxSheet(Number(event.target.value))}
                  >
                    {xlsxSheets.map((sheet, index) => <option value={index} key={`${sheet.name}-${index}`}>{sheet.name}</option>)}
                  </select>
                </label> : null}
              </div>

              {resolving ? <p className="esmera-products-import__resolving" aria-live="polite">
                Preview local pronto. Conferindo duplicatas, categorias e slugs no catálogo…
              </p> : null}
              {unknownHeaders.length ? <p className="esmera-products-import__warning">
                Colunas não reconhecidas (ignoradas): {unknownHeaders.join(', ')}
              </p> : null}
              {needsDbRevalidation ? <p className="esmera-products-import__warning">
                Você alterou código, categoria, nome ou slug. Revalide as referências do catálogo antes de confirmar.
              </p> : null}

              {progress ? <div className="esmera-products-import__progress" aria-live="polite">
                <div>
                  <strong>{progress.status === 'queued' ? 'Na fila' : progress.status === 'processing' ? 'Importando produtos' : 'Finalizando'}</strong>
                  <span>{progress.processedRows} de {progress.totalRows} linhas · {progressPercent}%</span>
                </div>
                <progress
                  max={progress.totalRows || 1}
                  value={progress.processedRows}
                  aria-label={`Importação ${progressPercent}% concluída`}
                />
                {progress.status !== 'cancelled'
                  ? <button type="button" className="esmera-button esmera-button--quiet" onClick={() => void cancelImport()}>Cancelar importação</button>
                  : <span>Cancelamento solicitado.</span>}
              </div> : null}

              <div className="esmera-products-import__filters" aria-label="Filtrar linhas da importação">
                <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => selectFilter('all')}>Todas ({rows.length})</button>
                <button type="button" className={filter === 'pending' ? 'is-active' : ''} onClick={() => selectFilter('pending')}>Só pendências ({pendingRows.length})</button>
                <button type="button" className={filter === 'new' ? 'is-active' : ''} onClick={() => selectFilter('new')}>Só novas ({rows.filter((row) => !row.isDuplicate).length})</button>
                <button type="button" className={filter === 'conflicts' ? 'is-active' : ''} onClick={() => selectFilter('conflicts')}>Só conflitos ({rows.filter((row) => row.isDuplicate).length})</button>
                {pendingRows.length ? <>
                  <button type="button" onClick={() => focusPending(-1)} aria-label="Pendência anterior">↑ anterior</button>
                  <button type="button" onClick={() => focusPending(1)} aria-label="Próxima pendência">↓ próxima</button>
                </> : null}
              </div>

              <div className="esmera-products-import__windowbar">
                <span>{visibleRows.length ? `Mostrando ${windowStart}–${windowEnd} de ${visibleRows.length}` : 'Nenhuma linha neste filtro'}</span>
                {pageCount > 1 ? <div>
                  <button
                    type="button"
                    className="esmera-icon-button"
                    disabled={safePage === 0}
                    onClick={() => setPage(Math.max(0, safePage - 1))}
                    aria-label="Página anterior"
                  >←</button>
                  <span>{safePage + 1} / {pageCount}</span>
                  <button
                    type="button"
                    className="esmera-icon-button"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                    aria-label="Próxima página"
                  >→</button>
                </div> : null}
              </div>

              <div className="esmera-products-import__grid esmera-data-table-wrap">
                <table className="esmera-data-table esmera-products-import-table" role="grid" aria-rowcount={visibleRows.length + 1}>
                  <thead><tr>
                    <th>#</th>
                    {importColumns.map((column) => <th key={column} data-col={column}>
                      {importColumnLabels[column]}{importColumnRequired[column] ? ' *' : ''}
                    </th>)}
                    <th>Conflito</th>
                    <th />
                  </tr></thead>
                  <tbody>{windowRows.map((row, windowIndex) => <tr
                    key={row.rowIndex}
                    data-import-row={row.rowIndex}
                    aria-rowindex={safePage * PREVIEW_WINDOW + windowIndex + 2}
                    className={blockingIssueCount(row.issues) ? 'has-error' : ''}
                  >
                    <td>{row.sourceLine}</td>
                    {importColumns.map((column) => {
                      const issue = row.issues.find((item) => item.column === column)
                      const errorID = `import-error-${row.rowIndex}-${column}`
                      const price = column === 'price' && row.values.price ? parsePrice(row.values.price) : null
                      return <td
                        key={column}
                        className={issue?.severity === 'error' ? 'has-error' : issue ? 'has-warning' : ''}
                        data-col={column}
                      >
                        <input
                          className="esmera-input"
                          defaultValue={row.values[column] || ''}
                          aria-label={`${importColumnLabels[column]}, linha ${row.sourceLine}`}
                          aria-invalid={issue?.severity === 'error' ? 'true' : undefined}
                          aria-describedby={issue ? errorID : undefined}
                          inputMode={column === 'price' ? 'decimal' : undefined}
                          disabled={busy}
                          onBlur={(event) => updateCell(row.rowIndex, column, event.target.value)}
                        />
                        {price?.ok ? <small className="esmera-products-import-table__normalized">{price.normalized}</small> : null}
                        {issue ? <small id={errorID} className="esmera-products-import-table__error">{issue.message}</small> : null}
                      </td>
                    })}
                    <td>{row.isDuplicate ? <select
                      className="esmera-input"
                      aria-label={`Conflito, linha ${row.sourceLine}`}
                      value={row.action}
                      disabled={busy}
                      onChange={(event) => setConflictAction(row.rowIndex, event.target.value as 'update' | 'skip')}
                    >
                      <option value="skip">Ignorar</option>
                      <option value="update">Atualizar</option>
                    </select> : <span>Novo</span>}</td>
                    <td><button
                      type="button"
                      className="esmera-icon-button"
                      aria-label={`Remover linha ${row.sourceLine}`}
                      disabled={busy}
                      onClick={() => removeRow(row.rowIndex)}
                    >×</button></td>
                  </tr>)}</tbody>
                </table>
              </div>

              <div className="esmera-products-import__cards">
                {windowRows.map((row) => <details
                  key={row.rowIndex}
                  data-import-row={row.rowIndex}
                  className={blockingIssueCount(row.issues) ? 'has-error' : ''}
                >
                  <summary>
                    <span><strong>Linha {row.sourceLine}</strong><small>{row.values.title || 'Sem nome'} · {row.values.code || 'sem código'}</small></span>
                    <span>{blockingIssueCount(row.issues) ? `${blockingIssueCount(row.issues)} pendência(s)` : row.isDuplicate ? 'Conflito' : 'Novo'}</span>
                  </summary>
                  <div className="esmera-products-import__card-fields">
                    {importColumns.map((column) => {
                      const issue = row.issues.find((item) => item.column === column)
                      const errorID = `import-mobile-error-${row.rowIndex}-${column}`
                      return <label key={column}>
                        <span>{importColumnLabels[column]}{importColumnRequired[column] ? ' *' : ''}</span>
                        <input
                          className="esmera-input"
                          defaultValue={row.values[column] || ''}
                          disabled={busy}
                          aria-invalid={issue?.severity === 'error' ? 'true' : undefined}
                          aria-describedby={issue ? errorID : undefined}
                          inputMode={column === 'price' ? 'decimal' : undefined}
                          onBlur={(event) => updateCell(row.rowIndex, column, event.target.value)}
                        />
                        {issue ? <small id={errorID}>{issue.message}</small> : null}
                      </label>
                    })}
                    {row.isDuplicate ? <label>
                      <span>Conflito</span>
                      <select
                        className="esmera-input"
                        value={row.action}
                        disabled={busy}
                        onChange={(event) => setConflictAction(row.rowIndex, event.target.value as 'update' | 'skip')}
                      >
                        <option value="skip">Ignorar</option>
                        <option value="update">Atualizar</option>
                      </select>
                    </label> : null}
                    <button type="button" className="esmera-button esmera-button--quiet" disabled={busy} onClick={() => removeRow(row.rowIndex)}>
                      Remover linha
                    </button>
                  </div>
                </details>)}
              </div>

              <div className="esmera-products-import__summary" aria-live="polite">
                <span>{rows.length} linha{rows.length === 1 ? '' : 's'}</span>
                <span className={blockingCount || needsDbRevalidation ? 'is-danger' : 'is-success'}>
                  {needsDbRevalidation
                    ? 'Revalidação do catálogo necessária'
                    : blockingCount
                      ? `${blockingCount} pendência(s) bloqueando`
                      : 'Sem pendências'}
                </span>
              </div>
              <div className="esmera-actions">
                <button className="esmera-button" type="button" onClick={() => setStep('input')} disabled={busy}>Voltar</button>
                <Button type="button" onClick={() => void revalidate()} disabled={busy || !rows.length}>
                  {busy && !progress ? 'Validando…' : 'Revalidar catálogo'}
                </Button>
                <Button
                  type="button"
                  aria-describedby={confirmBlocked ? 'import-blocking-reason' : undefined}
                  onClick={() => void confirmImport()}
                  disabled={confirmBlocked}
                >
                  {busy ? (progress ? `Importando ${progressPercent}%` : 'Preparando…') : `Confirmar importação (${rows.length})`}
                </Button>
              </div>
              {confirmBlocked ? <span id="import-blocking-reason" className="esmera-products-import__sr-note">
                Corrija as pendências e revalide referências alteradas antes de confirmar.
              </span> : null}
            </div> : null}

            {step === 'result' && result ? <div className="esmera-products-import__result">
              {finalStatus ? <p className="esmera-products-import__result-status">
                {finalStatus === 'completed'
                  ? 'Importação concluída.'
                  : finalStatus === 'completed_with_errors'
                    ? 'Importação concluída com algumas linhas rejeitadas.'
                    : finalStatus === 'cancelled'
                      ? 'Importação cancelada.'
                      : finalStatus === 'failed'
                        ? 'A importação falhou.'
                        : ''}
              </p> : null}
              <dl className="esmera-leads-facts">
                <div><dt>Criados</dt><dd>{result.created}</dd></div>
                <div><dt>Atualizados</dt><dd>{result.updated}</dd></div>
                <div><dt>Ignorados</dt><dd>{result.skipped}</dd></div>
                <div><dt>Com erro</dt><dd>{result.errored}</dd></div>
              </dl>
              {result.errored ? <>
                <div className="esmera-data-table-wrap">
                  <table className="esmera-data-table">
                    <thead><tr><th>Linha da planilha</th><th>Erro</th></tr></thead>
                    <tbody>{result.rows.filter((item) => item.status === 'error').map((item) => <tr key={item.rowIndex}>
                      <td>{item.sourceLine}</td><td>{item.error}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <div className="esmera-actions">
                  {remoteErrorCsv
                    ? <a href={remoteErrorCsv} className="esmera-button esmera-button--quiet">Baixar relatório de erros (.csv)</a>
                    : <button type="button" className="esmera-button esmera-button--quiet" onClick={() => downloadErrorCsv(result)}>
                      Baixar relatório de erros (.csv)
                    </button>}
                  <button type="button" className="esmera-button esmera-button--quiet" onClick={reimportErrors}>
                    Reimportar apenas linhas com erro
                  </button>
                </div>
              </> : null}
              <div className="esmera-actions">
                <Dialog.Close className="esmera-button esmera-button--primary" type="button">Concluir</Dialog.Close>
              </div>
            </div> : null}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}
