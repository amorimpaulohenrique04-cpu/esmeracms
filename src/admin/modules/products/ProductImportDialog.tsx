'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'

import { importColumnLabels, importColumnRequired, importColumns, type ImportColumn } from '../../../businessRules/products/importSchema'
import { blockingIssueCount, parsePrice, validateRowShape } from '../../../businessRules/products/importValidation'
import { Button } from '../../design-system'

type PreviewIssue = { column: ImportColumn | 'general'; message: string; code?: string; severity?: 'error' | 'warning' }
type PreviewRow = {
  rowIndex: number
  sourceLine: number
  values: Record<ImportColumn, string>
  issues: PreviewIssue[]
  isDuplicate: boolean
  action: 'create' | 'update' | 'skip'
}
type PreviewResponse = { rows: PreviewRow[]; unknownHeaders: string[]; delimiter: ',' | ';' | '\t' | '|' }
type CommitRowResult = { rowIndex: number; sourceLine: number; status: 'created' | 'updated' | 'skipped' | 'error'; error?: string }
type CommitResponse = { created: number; updated: number; skipped: number; errored: number; rows: CommitRowResult[] }
type RowFilter = 'all' | 'pending' | 'new' | 'conflicts'

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

export function ProductImportDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input')
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommitResponse | null>(null)
  const [encoding, setEncoding] = useState<string | null>(null)
  const [delimiter, setDelimiter] = useState<PreviewResponse['delimiter'] | null>(null)
  const [filter, setFilter] = useState<RowFilter>('all')
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('input')
    setRawText('')
    setRows([])
    setUnknownHeaders([])
    setError(null)
    setResult(null)
    setEncoding(null)
    setDelimiter(null)
    setFilter('all')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function runPreview(text: string, keepActions?: Map<string, 'create' | 'update' | 'skip'>) {
    setBusy(true)
    setError(null)
    try {
      const data = await callImportApi<PreviewResponse>({ action: 'preview', text })
      setRows(data.rows.map((row) => ({
        ...row,
        action: keepActions?.get(row.values.code?.trim().toUpperCase()) || row.action,
      })))
      setUnknownHeaders(data.unknownHeaders)
      setDelimiter(data.delimiter)
      setFilter('all')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível pré-visualizar.')
    } finally {
      setBusy(false)
    }
  }

  async function consumeFile(file: File) {
    setError(null)
    if (/\.xlsx$/i.test(file.name)) {
      setError('Arquivos .xlsx ainda não são aceitos neste caminho. Exporte como CSV UTF-8 ou TSV para importar com segurança.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Arquivo maior que 4 MB. Divida a importação em lotes menores.')
      return
    }
    const decoded = decodeSheet(await file.arrayBuffer())
    setEncoding(decoded.encoding)
    setRawText(decoded.text)
    await runPreview(decoded.text)
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void consumeFile(file)
  }

  function updateCell(rowIndex: number, column: ImportColumn, value: string) {
    setRows((current) => current.map((row) => {
      if (row.rowIndex !== rowIndex) return row
      const values = { ...row.values, [column]: value }
      return {
        ...row,
        values,
        issues: validateRowShape(values, {
          requireActiveAssets: !row.isDuplicate,
          allowPartialUpdate: row.isDuplicate,
        }),
      }
    }))
  }

  function removeRow(rowIndex: number) {
    setRows((current) => current.filter((row) => row.rowIndex !== rowIndex))
  }

  function setConflictAction(rowIndex: number, action: 'update' | 'skip') {
    setRows((current) => current.map((row) => row.rowIndex === rowIndex ? { ...row, action } : row))
  }

  async function revalidate() {
    const actions = new Map(rows.map((row) => [row.values.code?.trim().toUpperCase(), row.action]))
    await runPreview(sheetFromRows(rows), actions)
  }

  const blockingCount = rows.reduce((sum, row) => sum + blockingIssueCount(row.issues), 0)
  const pendingRows = rows.filter((row) => blockingIssueCount(row.issues) > 0)
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter === 'pending') return blockingIssueCount(row.issues) > 0
    if (filter === 'new') return !row.isDuplicate
    if (filter === 'conflicts') return row.isDuplicate
    return true
  }), [filter, rows])

  async function confirmImport() {
    setBusy(true)
    setError(null)
    try {
      const payload = rows.map((row) => ({
        rowIndex: row.rowIndex,
        sourceLine: row.sourceLine,
        values: row.values,
        onConflict: row.isDuplicate && row.action === 'update' ? 'update' : 'skip',
      }))
      const data = await callImportApi<CommitResponse>({ action: 'commit', rows: payload })
      setResult(data)
      setStep('result')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a importação.')
    } finally {
      setBusy(false)
    }
  }

  function changeOpen(next: boolean) {
    if (!next && step === 'preview' && rows.length > 0 && !window.confirm('Fechar e descartar as correções desta importação?')) return
    setOpen(next)
    if (!next) reset()
  }

  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger className="esmera-button">Importar produtos</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="esmera-overlay-backdrop" />
      <Dialog.Viewport className="esmera-dialog-viewport">
        <Dialog.Popup className="esmera-dialog esmera-products-import-dialog">
          <div className="esmera-overlay-header">
            <div><Dialog.Title>Importar produtos</Dialog.Title><Dialog.Description>Envie CSV/TSV ou cole os dados do Excel/Google Sheets. Célula vazia preserva o valor em atualizações; use -- para limpar um campo opcional.</Dialog.Description></div>
            <Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close>
          </div>
          <div className="esmera-overlay-body esmera-products-import">
            {error ? <p className="esmera-quick-create-feedback" role="alert" aria-live="assertive">{error}</p> : null}

            {step === 'input' ? (
              <div className="esmera-products-import__input">
                <Link className="esmera-button esmera-button--quiet" href="/api/admin-products-import" download>Baixar modelo (.csv)</Link>
                <label
                  className="esmera-products-import__dropzone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    const file = event.dataTransfer.files?.[0]
                    if (file) void consumeFile(file)
                  }}
                >
                  <strong>Solte o CSV/TSV aqui</strong>
                  <span>ou escolha um arquivo exportado pelo Excel/Google Sheets</span>
                  <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={onFile} />
                </label>
                <label className="esmera-products-import__field"><span>Ou cole os dados copiados da planilha (com cabeçalho)</span><textarea className="esmera-input" rows={10} value={rawText} onChange={(event) => { setRawText(event.target.value); setEncoding('texto colado') }} placeholder="nome\tcodigo\tcategoria\tpreco\t..." /></label>
                <div className="esmera-actions"><Button type="button" onClick={() => void runPreview(rawText)} disabled={busy || !rawText.trim()}>{busy ? 'Lendo…' : 'Pré-visualizar'}</Button></div>
              </div>
            ) : null}

            {step === 'preview' ? (
              <div className="esmera-products-import__preview">
                <div className="esmera-products-import__meta" aria-live="polite">
                  <span>Encoding: <strong>{encoding || 'texto'}</strong></span>
                  <span>Delimitador: <strong>{delimiterLabel(delimiter)}</strong></span>
                </div>
                {unknownHeaders.length ? <p className="esmera-products-import__warning">Colunas não reconhecidas (ignoradas): {unknownHeaders.join(', ')}</p> : null}

                <div className="esmera-products-import__filters" aria-label="Filtrar linhas da importação">
                  <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Todas ({rows.length})</button>
                  <button type="button" className={filter === 'pending' ? 'is-active' : ''} onClick={() => setFilter('pending')}>Só pendências ({pendingRows.length})</button>
                  <button type="button" className={filter === 'new' ? 'is-active' : ''} onClick={() => setFilter('new')}>Só novas ({rows.filter((row) => !row.isDuplicate).length})</button>
                  <button type="button" className={filter === 'conflicts' ? 'is-active' : ''} onClick={() => setFilter('conflicts')}>Só conflitos ({rows.filter((row) => row.isDuplicate).length})</button>
                </div>

                <div className="esmera-products-import__grid esmera-data-table-wrap">
                  <table className="esmera-data-table esmera-products-import-table">
                    <thead><tr>
                      <th>#</th>
                      {importColumns.map((column) => <th key={column} data-col={column}>{importColumnLabels[column]}{importColumnRequired[column] ? ' *' : ''}</th>)}
                      <th>Conflito</th>
                      <th />
                    </tr></thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={row.rowIndex} className={blockingIssueCount(row.issues) ? 'has-error' : ''}>
                          <td>{row.sourceLine}</td>
                          {importColumns.map((column) => {
                            const issue = row.issues.find((item) => item.column === column)
                            const errorID = `import-error-${row.rowIndex}-${column}`
                            const price = column === 'price' && row.values.price ? parsePrice(row.values.price) : null
                            return <td key={column} className={issue?.severity === 'error' ? 'has-error' : issue ? 'has-warning' : ''} data-col={column}>
                              <input
                                className="esmera-input"
                                defaultValue={row.values[column] || ''}
                                aria-label={`${importColumnLabels[column]}, linha ${row.sourceLine}`}
                                aria-invalid={issue?.severity === 'error' ? 'true' : undefined}
                                aria-describedby={issue ? errorID : undefined}
                                inputMode={column === 'price' ? 'decimal' : undefined}
                                onBlur={(event) => updateCell(row.rowIndex, column, event.target.value)}
                              />
                              {price?.ok ? <small className="esmera-products-import-table__normalized">{price.normalized}</small> : null}
                              {issue ? <small id={errorID} className="esmera-products-import-table__error">{issue.message}</small> : null}
                            </td>
                          })}
                          <td>{row.isDuplicate ? (
                            <select className="esmera-input" aria-label={`Conflito, linha ${row.sourceLine}`} value={row.action} onChange={(event) => setConflictAction(row.rowIndex, event.target.value as 'update' | 'skip')}>
                              <option value="skip">Ignorar</option>
                              <option value="update">Atualizar</option>
                            </select>
                          ) : <span>Novo</span>}</td>
                          <td><button type="button" className="esmera-icon-button" aria-label={`Remover linha ${row.sourceLine}`} onClick={() => removeRow(row.rowIndex)}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="esmera-products-import__cards">
                  {visibleRows.map((row) => <details key={row.rowIndex} className={blockingIssueCount(row.issues) ? 'has-error' : ''}>
                    <summary>
                      <span><strong>Linha {row.sourceLine}</strong><small>{row.values.title || 'Sem nome'} · {row.values.code || 'sem código'}</small></span>
                      <span>{blockingIssueCount(row.issues) ? `${blockingIssueCount(row.issues)} pendência(s)` : row.isDuplicate ? 'Conflito' : 'Novo'}</span>
                    </summary>
                    <div className="esmera-products-import__card-fields">
                      {importColumns.map((column) => {
                        const issue = row.issues.find((item) => item.column === column)
                        const errorID = `import-mobile-error-${row.rowIndex}-${column}`
                        return <label key={column}><span>{importColumnLabels[column]}{importColumnRequired[column] ? ' *' : ''}</span>
                          <input className="esmera-input" defaultValue={row.values[column] || ''} aria-invalid={issue?.severity === 'error' ? 'true' : undefined} aria-describedby={issue ? errorID : undefined} inputMode={column === 'price' ? 'decimal' : undefined} onBlur={(event) => updateCell(row.rowIndex, column, event.target.value)} />
                          {issue ? <small id={errorID}>{issue.message}</small> : null}
                        </label>
                      })}
                      {row.isDuplicate ? <label><span>Conflito</span><select className="esmera-input" value={row.action} onChange={(event) => setConflictAction(row.rowIndex, event.target.value as 'update' | 'skip')}><option value="skip">Ignorar</option><option value="update">Atualizar</option></select></label> : null}
                      <button type="button" className="esmera-button esmera-button--quiet" onClick={() => removeRow(row.rowIndex)}>Remover linha</button>
                    </div>
                  </details>)}
                </div>

                <div className="esmera-products-import__summary" aria-live="polite">
                  <span>{rows.length} linha{rows.length === 1 ? '' : 's'}</span>
                  <span className={blockingCount ? 'is-danger' : 'is-success'}>{blockingCount ? `${blockingCount} pendência(s) bloqueando` : 'Sem pendências'}</span>
                </div>
                <div className="esmera-actions">
                  <button className="esmera-button" type="button" onClick={() => setStep('input')}>Voltar</button>
                  <Button type="button" onClick={() => void revalidate()} disabled={busy || !rows.length}>{busy ? 'Revalidando…' : 'Revalidar duplicatas'}</Button>
                  <Button type="button" aria-describedby={blockingCount ? 'import-blocking-reason' : undefined} onClick={() => void confirmImport()} disabled={busy || !rows.length || blockingCount > 0}>{busy ? 'Importando…' : `Confirmar importação (${rows.length})`}</Button>
                </div>
                {blockingCount ? <span id="import-blocking-reason" className="esmera-products-import__sr-note">Corrija as pendências antes de confirmar.</span> : null}
              </div>
            ) : null}

            {step === 'result' && result ? (
              <div className="esmera-products-import__result">
                <dl className="esmera-leads-facts">
                  <div><dt>Criados</dt><dd>{result.created}</dd></div>
                  <div><dt>Atualizados</dt><dd>{result.updated}</dd></div>
                  <div><dt>Ignorados</dt><dd>{result.skipped}</dd></div>
                  <div><dt>Com erro</dt><dd>{result.errored}</dd></div>
                </dl>
                {result.errored ? (
                  <><div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Linha da planilha</th><th>Erro</th></tr></thead><tbody>
                    {result.rows.filter((item) => item.status === 'error').map((item) => <tr key={item.rowIndex}><td>{item.sourceLine}</td><td>{item.error}</td></tr>)}
                  </tbody></table></div>
                  <button type="button" className="esmera-button esmera-button--quiet" onClick={() => downloadErrorCsv(result)}>Baixar relatório de erros (.csv)</button></>
                ) : null}
                <div className="esmera-actions"><Dialog.Close className="esmera-button esmera-button--primary" type="button">Concluir</Dialog.Close></div>
              </div>
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}
