'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useRef, useState } from 'react'

import { importColumnLabels, importColumnRequired, importColumns, type ImportColumn } from '../../../businessRules/products/importSchema'
import { Button } from '../../design-system'

type PreviewIssue = { column: ImportColumn | 'general'; message: string }
type PreviewRow = {
  rowIndex: number
  values: Record<ImportColumn, string>
  issues: PreviewIssue[]
  isDuplicate: boolean
  action: 'create' | 'update' | 'skip'
}
type PreviewResponse = { rows: PreviewRow[]; unknownHeaders: string[] }
type CommitRowResult = { rowIndex: number; status: 'created' | 'updated' | 'skipped' | 'error'; error?: string }
type CommitResponse = { created: number; updated: number; skipped: number; errored: number; rows: CommitRowResult[] }

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
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('input')
    setRawText('')
    setRows([])
    setUnknownHeaders([])
    setError(null)
    setResult(null)
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
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível pré-visualizar.')
    } finally {
      setBusy(false)
    }
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setRawText(text)
      void runPreview(text)
    }
    reader.readAsText(file, 'utf-8')
  }

  function updateCell(rowIndex: number, column: ImportColumn, value: string) {
    setRows((current) => current.map((row) => row.rowIndex === rowIndex
      ? { ...row, values: { ...row.values, [column]: value }, issues: [{ column: 'general', message: 'Edição não revalidada. Clique em "Revalidar".' }] }
      : row))
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

  const blockingCount = rows.reduce((sum, row) => sum + row.issues.length, 0)

  async function confirmImport() {
    setBusy(true)
    setError(null)
    try {
      const payload = rows.map((row) => ({
        rowIndex: row.rowIndex,
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

  return <Dialog.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
    <Dialog.Trigger className="esmera-button">Importar produtos</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="esmera-overlay-backdrop" />
      <Dialog.Viewport className="esmera-dialog-viewport">
        <Dialog.Popup className="esmera-dialog esmera-products-import-dialog">
          <div className="esmera-overlay-header">
            <div><Dialog.Title>Importar produtos</Dialog.Title><Dialog.Description>Envie um arquivo .csv ou cole os dados de uma planilha (Excel/Google Sheets).</Dialog.Description></div>
            <Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close>
          </div>
          <div className="esmera-overlay-body esmera-products-import">
            {error ? <p className="esmera-quick-create-feedback" role="alert">{error}</p> : null}

            {step === 'input' ? (
              <div className="esmera-products-import__input">
                <Link className="esmera-button esmera-button--quiet" href="/api/admin-products-import" download>Baixar modelo (.csv)</Link>
                <label className="esmera-products-import__field"><span>Arquivo .csv</span><input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} /></label>
                <label className="esmera-products-import__field"><span>Ou cole os dados copiados do Excel/Google Sheets (com cabeçalho)</span><textarea className="esmera-input" rows={10} value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="nome	codigo	categoria	preco	..." /></label>
                <div className="esmera-actions"><Button type="button" onClick={() => void runPreview(rawText)} disabled={busy || !rawText.trim()}>{busy ? 'Lendo…' : 'Pré-visualizar'}</Button></div>
              </div>
            ) : null}

            {step === 'preview' ? (
              <div className="esmera-products-import__preview">
                {unknownHeaders.length ? <p className="esmera-products-import__warning">Colunas não reconhecidas (ignoradas): {unknownHeaders.join(', ')}</p> : null}
                <div className="esmera-data-table-wrap">
                  <table className="esmera-data-table esmera-products-import-table">
                    <thead><tr>
                      <th>#</th>
                      {importColumns.map((column) => <th key={column}>{importColumnLabels[column]}{importColumnRequired[column] ? ' *' : ''}</th>)}
                      <th>Conflito</th>
                      <th />
                    </tr></thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.rowIndex} className={row.issues.length ? 'has-error' : ''}>
                          <td>{row.rowIndex + 1}</td>
                          {importColumns.map((column) => {
                            const issue = row.issues.find((item) => item.column === column)
                            return <td key={column} className={issue ? 'has-error' : ''}>
                              <input className="esmera-input" value={row.values[column] || ''} onChange={(event) => updateCell(row.rowIndex, column, event.target.value)} />
                              {issue ? <small className="esmera-products-import-table__error">{issue.message}</small> : null}
                            </td>
                          })}
                          <td>{row.isDuplicate ? (
                            <select className="esmera-input" value={row.action} onChange={(event) => setConflictAction(row.rowIndex, event.target.value as 'update' | 'skip')}>
                              <option value="skip">Ignorar</option>
                              <option value="update">Atualizar</option>
                            </select>
                          ) : <span>Novo</span>}</td>
                          <td><button type="button" className="esmera-icon-button" aria-label="Remover linha" onClick={() => removeRow(row.rowIndex)}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="esmera-products-import__summary">
                  <span>{rows.length} linha{rows.length === 1 ? '' : 's'}</span>
                  <span className={blockingCount ? 'is-danger' : 'is-success'}>{blockingCount ? `${blockingCount} pendência(s) bloqueando` : 'Sem pendências'}</span>
                </div>
                <div className="esmera-actions">
                  <button className="esmera-button" type="button" onClick={() => setStep('input')}>Voltar</button>
                  <Button type="button" onClick={() => void revalidate()} disabled={busy || !rows.length}>{busy ? 'Revalidando…' : 'Revalidar'}</Button>
                  <Button type="button" onClick={() => void confirmImport()} disabled={busy || !rows.length || blockingCount > 0}>{busy ? 'Importando…' : `Confirmar importação (${rows.length})`}</Button>
                </div>
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
                  <div className="esmera-data-table-wrap"><table className="esmera-data-table"><thead><tr><th>Linha</th><th>Erro</th></tr></thead><tbody>
                    {result.rows.filter((item) => item.status === 'error').map((item) => <tr key={item.rowIndex}><td>{item.rowIndex + 1}</td><td>{item.error}</td></tr>)}
                  </tbody></table></div>
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
