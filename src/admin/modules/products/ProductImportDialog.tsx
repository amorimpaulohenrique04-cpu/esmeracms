'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

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
import type { WorkbookCommand, WorkbookReply } from './importWorker'

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
  working: boolean
}

type RowFilter = 'all' | 'pending' | 'new' | 'existing'

type SourceRow = Pick<PreviewRow, 'rowIndex' | 'sourceLine' | 'values'>

const endpoint = '/api/admin-products-import'

class ImportApiError extends Error {
  constructor(message: string, readonly status: number, readonly rows?: PreviewRow[]) {
    super(message)
  }
}

async function importResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as (T & { error?: string; rows?: PreviewRow[] }) | null
  if (!response.ok || !data) {
    throw new ImportApiError(
      data?.error || (response.status === 413 ? 'Dados maiores que 4 MB. Divida a planilha em lotes menores.' : 'Não foi possível comunicar com a importação.'),
      response.status,
      data?.rows,
    )
  }
  return data
}

async function callImportApi<T>(body: Record<string, unknown>, signal: AbortSignal): Promise<T> {
  const json = JSON.stringify(body)
  if (new Blob([json]).size > 4 * 1024 * 1024) {
    throw new ImportApiError('Dados maiores que 4 MB. Divida a planilha em lotes menores.', 413)
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: json,
    signal: AbortSignal.any([signal, AbortSignal.timeout(body.action === 'advance' ? 125_000 : 30_000)]),
  })
  return importResponse<T>(response)
}

async function getImport<T>(params: Record<string, string>, signal: AbortSignal) {
  const response = await fetch(endpoint + '?' + new URLSearchParams(params), {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
  })
  return response.status === 204 ? null : importResponse<T>(response)
}

function readWorkbook(worker: Worker, command: WorkbookCommand, signal: AbortSignal, transfer: Transferable[] = []) {
  return new Promise<WorkbookReply>((resolve, reject) => {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)])
    requestSignal.throwIfAborted()
    function clear() {
      requestSignal.removeEventListener('abort', abort)
      worker.onmessage = null
      worker.onerror = null
    }
    function abort() {
      clear()
      worker.terminate()
      reject(requestSignal.reason)
    }
    requestSignal.addEventListener('abort', abort, { once: true })
    worker.onmessage = ({ data }: MessageEvent<WorkbookReply>) => {
      clear()
      if (data.error) reject(new Error(data.error))
      else resolve(data)
    }
    worker.onerror = () => {
      clear()
      reject(new Error('Não foi possível ler o arquivo Excel.'))
    }
    worker.postMessage(command, transfer)
  })
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
  const [step, setStep] = useState<'input' | 'mapping' | 'preview' | 'progress' | 'result'>('input')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState<string | null>(null)
  const [needsDbRevalidation, setNeedsDbRevalidation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommitResponse | null>(null)
  const [encoding, setEncoding] = useState<string | null>(null)
  const [delimiter, setDelimiter] = useState<PreviewResponse['delimiter'] | null>(null)
  const [filter, setFilter] = useState<RowFilter>('all')
  const [page, setPage] = useState(0)
  const [activePendingRow, setActivePendingRow] = useState<number | null>(null)
  const [progress, setProgress] = useState<ImportStatusResponse | null>(null)
  const [latest, setLatest] = useState<ImportStatusResponse | null>(null)
  const [finishedId, setFinishedId] = useState<string | null>(null)
  const [remoteErrorCsv, setRemoteErrorCsv] = useState<string | null>(null)
  const [finalStatus, setFinalStatus] = useState<ImportStatusResponse['status'] | null>(null)
  const [xlsxSheets, setXlsxSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [mappingInspection, setMappingInspection] = useState<ImportHeaderInspection | null>(null)
  const [mappingValues, setMappingValues] = useState<Array<ImportColumn | null>>([])
  const idempotencyRef = useRef<string | null>(null)
  const taskRef = useRef<AbortController | null>(null)
  const workbookRef = useRef<Worker | null>(null)
  const sourceLinesRef = useRef<number[] | null>(null)

  useEffect(() => () => {
    taskRef.current?.abort()
    workbookRef.current?.terminate()
  }, [])

  function reset() {
    taskRef.current?.abort()
    taskRef.current = null
    workbookRef.current?.terminate()
    workbookRef.current = null
    sourceLinesRef.current = null
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
    setLatest(null)
    setFinishedId(null)
    setRemoteErrorCsv(null)
    setFinalStatus(null)
    setXlsxSheets([])
    setSelectedSheet(0)
    setBusy(false)
    setActivity(null)
    setNeedsDbRevalidation(false)
    setMappingInspection(null)
    setMappingValues([])
  }

  async function runTask(operation: (signal: AbortSignal) => Promise<void>, fallback: string) {
    if (taskRef.current) return
    const task = new AbortController()
    taskRef.current = task
    setBusy(true)
    setError(null)
    try {
      await operation(task.signal)
    } catch (error) {
      if (!task.signal.aborted) setError(error instanceof Error ? error.message : fallback)
    } finally {
      if (taskRef.current === task) {
        taskRef.current = null
        setBusy(false)
        setActivity(null)
      }
    }
  }

  function applyPreview(data: PreviewResponse) {
    setRows(data.rows)
    setUnknownHeaders(data.unknownHeaders)
    setDelimiter(data.delimiter)
    setFilter('all')
    setPage(0)
    setActivePendingRow(null)
    setMappingInspection(null)
    setMappingValues([])
    setStep('preview')
  }

  async function runPreview(text: string, signal: AbortSignal) {
    setActivity('Conferindo produtos e categorias…')
    const data = await callImportApi<PreviewResponse>({ action: 'preview', text }, signal)
    signal.throwIfAborted()
    const sourceLines = sourceLinesRef.current
    applyPreview({
      ...data,
      rows: data.rows.map((row, index) => ({ ...row, sourceLine: sourceLines?.[index] ?? row.sourceLine })),
    })
    setNeedsDbRevalidation(false)
    idempotencyRef.current = null
  }

  async function inspectAndPreview(text: string, signal: AbortSignal) {
    const inspection = inspectImportHeaders(text)
    if (inspection.needsMapping) {
      setMappingInspection(inspection)
      setMappingValues(inspection.mapping)
      setStep('mapping')
      return
    }
    await runPreview(text, signal)
  }

  function beginPreview(text: string) {
    return runTask((signal) => inspectAndPreview(text, signal), 'Não foi possível pré-visualizar a planilha.')
  }

  function confirmMapping() {
    if (!mappingInspection) return
    return runTask((signal) => runPreview(
      applyImportMapping(rawText, mappingInspection.delimiter, mappingValues), signal,
    ), 'Não foi possível aplicar o mapeamento.')
  }

  async function loadSheet(worker: Worker, index: number, signal: AbortSignal) {
    setActivity('Lendo a aba selecionada…')
    setStep('input')
    setRows([])
    setRawText('')
    setSelectedSheet(index)
    const { sheet } = await readWorkbook(worker, { action: 'sheet', index }, signal)
    signal.throwIfAborted()
    if (!sheet) throw new Error('A aba selecionada não pôde ser lida.')
    sourceLinesRef.current = sheet.sourceLines
    setRawText(sheet.text)
    await inspectAndPreview(sheet.text, signal)
  }

  function consumeFile(file: File) {
    return runTask(async (signal) => {
      if (file.size > 4 * 1024 * 1024) throw new Error('Arquivo maior que 4 MB. Divida a importação em lotes menores.')
      setActivity('Lendo arquivo…')
      workbookRef.current?.terminate()
      workbookRef.current = null
      sourceLinesRef.current = null
      setXlsxSheets([])
      setSelectedSheet(0)
      setRawText('')
      const buffer = await file.arrayBuffer()
      signal.throwIfAborted()
      if (/\.xlsx$/i.test(file.name)) {
        const worker = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' })
        workbookRef.current = worker
        const { sheetNames } = await readWorkbook(worker, { action: 'open', buffer }, signal, [buffer])
        signal.throwIfAborted()
        setXlsxSheets(sheetNames ?? [])
        setEncoding('XLSX')
        await loadSheet(worker, 0, signal)
        return
      }
      const decoded = decodeSheet(buffer)
      setEncoding(decoded.encoding)
      setRawText(decoded.text)
      await inspectAndPreview(decoded.text, signal)
    }, 'Não foi possível ler o arquivo.')
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void consumeFile(file)
  }

  function changeXlsxSheet(index: number) {
    const worker = workbookRef.current
    if (worker) void runTask((signal) => loadSheet(worker, index, signal), 'Não foi possível ler a aba.')
  }

  function updateCell(rowIndex: number, column: ImportColumn, value: string) {
    idempotencyRef.current = null
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
    idempotencyRef.current = null
    setRows((current) => current.filter((row) => row.rowIndex !== rowIndex))
    idempotencyRef.current = null
  }

  async function previewRows(input: SourceRow[], signal: AbortSignal) {
    setActivity('Conferindo produtos e categorias…')
    const data = await callImportApi<Pick<PreviewResponse, 'rows'>>({ action: 'preview', rows: input }, signal)
    signal.throwIfAborted()
    applyPreview({ ...data, unknownHeaders, delimiter: delimiter ?? ',' })
    setNeedsDbRevalidation(false)
    idempotencyRef.current = null
  }

  function revalidate() {
    const input = rows.map(({ rowIndex, sourceLine, values }) => ({ rowIndex, sourceLine, values }))
    return runTask((signal) => previewRows(input, signal), 'Não foi possível revalidar a planilha.')
  }

  const blockingCount = rows.reduce((sum, row) => sum + blockingIssueCount(row.issues), 0)
  const pendingRows = useMemo(() => rows.filter((row) => blockingIssueCount(row.issues) > 0), [rows])
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter === 'pending') return blockingIssueCount(row.issues) > 0
    if (filter === 'new') return !row.isDuplicate
    if (filter === 'existing') return row.isDuplicate
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

  async function showResult(id: string, signal: AbortSignal, refresh = false) {
    const status = await getImport<ImportStatusResponse>({ importId: id }, signal)
    signal.throwIfAborted()
    if (!status) throw new Error('Não foi possível carregar o resultado.')
    setFinishedId(id)
    setFinalStatus(status.status)
    setRemoteErrorCsv(status.errorCsvUrl || null)
    setResult({ ...status, rows: status.results })
    if (status.error) setError(status.error)
    setStep('result')
    setProgress(null)
    if (refresh) router.refresh()
  }

  async function driveImport(initial: ImportStatusResponse, signal: AbortSignal) {
    let current = initial
    setStep('progress')
    setProgress(current)
    while (!terminalStatus(current.status)) {
      signal.throwIfAborted()
      const id = current.importId
      const cursor = current.processedRows
      if (current.working) {
        setActivity('Aguardando a etapa em andamento…')
        await new Promise((resolve) => window.setTimeout(resolve, 1500))
        current = await getImport<ImportStatusResponse>({ importId: id }, signal) ?? current
      } else {
        setActivity('Processando produtos e imagens…')
        try {
          current = await callImportApi<ImportStatusResponse>({ action: 'advance', importId: id, cursor }, signal)
        } catch (error) {
          signal.throwIfAborted()
          current = await getImport<ImportStatusResponse>({ importId: id }, signal) ?? current
          if (!current.working && !terminalStatus(current.status) && current.processedRows === cursor) throw error
        }
        if (!current.working && !terminalStatus(current.status) && current.processedRows === cursor) {
          throw new Error('A importação está pausada. Retome para continuar da última linha salva.')
        }
      }
      signal.throwIfAborted()
      setProgress(current)
    }
    await showResult(current.importId, signal, true)
  }

  function confirmImport() {
    return runTask(async (signal) => {
      setActivity('Preparando importação…')
      const input = rows.map(({ rowIndex, sourceLine, values, isDuplicate }) => ({
        rowIndex, sourceLine, values, onConflict: isDuplicate ? 'update' : 'skip',
      }))
      idempotencyRef.current ??= crypto.randomUUID()
      let status: ImportStatusResponse
      try {
        status = await callImportApi<ImportStatusResponse>({ action: 'start', rows: input, idempotencyKey: idempotencyRef.current }, signal)
      } catch (error) {
        if (error instanceof ImportApiError && error.status === 422 && error.rows) {
          applyPreview({ rows: error.rows, unknownHeaders, delimiter: delimiter ?? ',' })
        }
        if (error instanceof ImportApiError && error.status === 409) {
          const pending = await getImport<ImportStatusResponse>({ latest: '1' }, signal)
          signal.throwIfAborted()
          if (pending && !terminalStatus(pending.status)) {
            setProgress(pending)
            setStep('progress')
          }
        }
        throw error
      }
      signal.throwIfAborted()
      await driveImport(status, signal)
    }, 'Não foi possível concluir a importação. Retome a partir da última linha salva.')
  }

  function resumeImport() {
    if (!progress) return
    return runTask(async (signal) => {
      const current = await getImport<ImportStatusResponse>({ importId: progress.importId }, signal)
      signal.throwIfAborted()
      if (current) await driveImport(current, signal)
    }, 'Não foi possível retomar a importação.')
  }

  function cancelImport() {
    if (!progress) return
    taskRef.current?.abort()
    taskRef.current = null
    return runTask(async (signal) => {
      setActivity('Cancelando importação…')
      try {
        await callImportApi({ action: 'cancel', importId: progress.importId }, signal)
      } catch (error) {
        if (!(error instanceof ImportApiError && error.status === 409)) throw error
      }
      await showResult(progress.importId, signal, true)
    }, 'Não foi possível cancelar a importação.')
  }

  function reimportErrors() {
    if (!finishedId) return
    return runTask(async (signal) => {
      const data = await getImport<{ rows: SourceRow[] }>({ importId: finishedId, format: 'retry' }, signal)
      signal.throwIfAborted()
      if (!data?.rows.length) throw new Error('Nenhuma linha com erro para reimportar.')
      setXlsxSheets([])
      setRawText('')
      await previewRows(data.rows, signal)
    }, 'Não foi possível recuperar as linhas com erro.')
  }

  function changeOpen(next: boolean) {
    if (!next && (step === 'mapping' || step === 'preview') && !busy && (rows.length || rawText.trim())) {
      if (!window.confirm('Fechar e descartar as correções desta importação?')) return
    }
    setOpen(next)
    if (!next) {
      reset()
      return
    }
    void runTask(async (signal) => {
      const last = await getImport<ImportStatusResponse>({ latest: '1' }, signal)
      signal.throwIfAborted()
      if (!last) return
      if (terminalStatus(last.status)) setLatest(last)
      else {
        setProgress(last)
        setStep('progress')
      }
    }, 'Não foi possível consultar a última importação.')
  }

  const progressPercent = progress?.totalRows
    ? Math.round((progress.processedRows / progress.totalRows) * 100)
    : 0
  const confirmBlocked = busy || !rows.length || blockingCount > 0 || needsDbRevalidation

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
                {step === 'input' ? '1 de 3 · Enviar planilha' : step === 'mapping' || step === 'preview' ? '2 de 3 · Revisar' : '3 de 3 · Importar'}
              </Dialog.Description>
            </div>
            <Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close>
          </div>

          <div className="esmera-overlay-body esmera-products-import">
            {error ? <p className="esmera-quick-create-feedback" role="alert" aria-live="assertive">{error}</p> : null}

            {activity && step !== 'progress' ? <p className="esmera-products-import__resolving" role="status">{activity}</p> : null}
            {xlsxSheets.length > 1 && (step === 'input' || step === 'mapping' || step === 'preview') ? <label className="esmera-products-import__sheet">
              <span>Aba do Excel</span>
              <select className="esmera-input" value={selectedSheet} disabled={busy} onChange={(event) => changeXlsxSheet(Number(event.target.value))}>
                {xlsxSheets.map((name, index) => <option value={index} key={index}>{name}</option>)}
              </select>
            </label> : null}

            {step === 'input' ? <div className="esmera-products-import__input">
              {latest ? <button type="button" className="esmera-button esmera-button--quiet" disabled={busy}
                onClick={() => void runTask((signal) => showResult(latest.importId, signal), 'Não foi possível carregar o resultado.')}>
                Ver última importação
              </button> : null}
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
                  type="file"
                  accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                  onChange={onFile}
                  disabled={busy}
                />
              </label>
              <label className="esmera-products-import__field">
                <span>Ou cole os dados copiados da planilha (com cabeçalho)</span>
                <textarea
                  className="esmera-input"
                  rows={10}
                  value={rawText}
                  disabled={busy}
                  onChange={(event) => {
                    setRawText(event.target.value)
                    workbookRef.current?.terminate()
                    workbookRef.current = null
                    sourceLinesRef.current = null
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

              </div>

              {unknownHeaders.length ? <p className="esmera-products-import__warning">
                Colunas não reconhecidas (ignoradas): {unknownHeaders.join(', ')}
              </p> : null}
              {needsDbRevalidation ? <p className="esmera-products-import__warning">
                Você alterou código, categoria, nome ou slug. Revalide as referências do catálogo antes de confirmar.
              </p> : null}

              <div className="esmera-products-import__filters" aria-label="Filtrar linhas da importação">
                <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => selectFilter('all')}>Todas ({rows.length})</button>
                <button type="button" className={filter === 'pending' ? 'is-active' : ''} onClick={() => selectFilter('pending')}>Só pendências ({pendingRows.length})</button>
                <button type="button" className={filter === 'new' ? 'is-active' : ''} onClick={() => selectFilter('new')}>Só novas ({rows.filter((row) => !row.isDuplicate).length})</button>
                <button type="button" className={filter === 'existing' ? 'is-active' : ''} onClick={() => selectFilter('existing')}>Já cadastrados ({rows.filter((row) => row.isDuplicate).length})</button>
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
                    <th>Ação</th>
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
                    <td><span>{row.isDuplicate ? 'Atualizar' : 'Criar'}</span></td>
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
                    <span>{blockingIssueCount(row.issues) ? `${blockingIssueCount(row.issues)} pendência(s)` : row.isDuplicate ? 'Atualizar' : 'Criar'}</span>
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
                    <p><strong>Ação:</strong> {row.isDuplicate ? 'Atualizar produto existente' : 'Criar novo produto'}</p>
                    <button type="button" className="esmera-button esmera-button--quiet" disabled={busy} onClick={() => removeRow(row.rowIndex)}>
                      Remover linha
                    </button>
                  </div>
                </details>)}
              </div>

              <p>Células vazias preservam os valores atuais. Use -- para limpar um campo opcional.</p>
              <div className="esmera-products-import__summary" aria-live="polite">
                <span>{rows.length} linha{rows.length === 1 ? '' : 's'}</span>
                <span>{rows.filter((row) => !row.isDuplicate).length} a criar</span>
                <span>{rows.filter((row) => row.isDuplicate).length} a atualizar</span>
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
                  {busy ? 'Preparando…' : `Importar ${rows.length} ${rows.length === 1 ? 'produto' : 'produtos'}`}
                </Button>
              </div>
              {confirmBlocked ? <span id="import-blocking-reason" className="esmera-products-import__sr-note">
                Corrija as pendências e revalide referências alteradas antes de confirmar.
              </span> : null}
            </div> : null}

            {step === 'progress' && progress ? <div className="esmera-products-import__progress">
              <div role="status">
                <strong>{activity || 'Importação pausada'}</strong>
                <span>{progress.processedRows} de {progress.totalRows} linhas processadas · {progressPercent}%</span>
              </div>
              <progress max={progress.totalRows || 1} value={progress.processedRows} aria-label="Linhas processadas" />
              <p>{progress.created + progress.updated} produtos salvos. Você pode fechar e retomar depois.</p>
              <div className="esmera-actions">
                {!busy ? <Button type="button" onClick={() => void resumeImport()}>Retomar importação</Button> : null}
                <button type="button" className="esmera-button esmera-button--quiet"
                  disabled={activity === 'Cancelando importação…' || terminalStatus(progress.status)}
                  onClick={() => void cancelImport()}>Cancelar importação</button>
              </div>
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
                  {remoteErrorCsv ? <a href={remoteErrorCsv} className="esmera-button esmera-button--quiet">Baixar relatório de erros (.csv)</a> : null}
                  <button type="button" className="esmera-button esmera-button--quiet" disabled={busy} onClick={() => void reimportErrors()}>
                    Corrigir e reimportar linhas com erro
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
