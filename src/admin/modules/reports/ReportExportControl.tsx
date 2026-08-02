'use client'

import React, { useEffect, useRef, useState } from 'react'

type ExportStatus = {
  id: string
  status: 'queued' | 'processing' | 'ready' | 'failed'
  filename?: string | null
  semanticVersion?: string | null
  downloadUrl?: string | null
  error?: string | null
}

function comparison(value: string | null) {
  return value === 'previous_period' || value === 'previous_year' ? value : null
}

function filtersFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const from = params.get('from') || undefined
  const to = params.get('to') || undefined
  return {
    period: from || to ? { from, to } : undefined,
    compareWith: comparison(params.get('compareWith')),
    ownerId: params.get('owner') || null,
    source: params.get('source') || null,
    categoryId: params.get('category') || null,
    productId: params.get('product') || null,
  }
}

function filenameFrom(response: Response, fallback = 'esmera-relatorio.pdf') {
  const disposition = response.headers.get('content-disposition') || ''
  const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf?.[1]) return decodeURIComponent(utf[1])
  const simple = disposition.match(/filename="?([^";]+)"?/i)
  return simple?.[1] || fallback
}

async function downloadResponse(response: Response, fallback?: string) {
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filenameFrom(response, fallback)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(href)
}

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Operação cancelada.', 'AbortError'))
    }, { once: true })
  })
}

async function pollExport(status: ExportStatus, signal: AbortSignal, onStatus: (value: ExportStatus) => void) {
  let current = status
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (current.status === 'ready') return current
    if (current.status === 'failed') throw new Error(current.error || 'A exportação falhou na Jobs Queue.')
    await wait(2_000, signal)
    const response = await fetch(`/api/admin-reports/export?id=${encodeURIComponent(current.id)}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    })
    const body = await response.json() as ExportStatus & { error?: string }
    if (!response.ok) throw new Error(body.error || 'Não foi possível consultar a exportação.')
    current = body
    onStatus(current)
  }
  throw new Error('A exportação continua em processamento. Consulte novamente em alguns instantes.')
}

export function ReportExportControl() {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  async function exportPDF() {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setBusy(true)
    setFeedback('Preparando PDF com os filtros atuais…')

    try {
      const response = await fetch('/api/admin-reports/export', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/pdf, application/json' },
        body: JSON.stringify({ filters: filtersFromLocation() }),
        signal: controller.signal,
      })

      if (response.status === 202) {
        const queued = await response.json() as ExportStatus & { error?: string }
        if (!queued.id) throw new Error(queued.error || 'A Jobs Queue não retornou a exportação.')
        setFeedback(`Relatório enfileirado · contrato ${queued.semanticVersion || 'registrado'}.`)
        const ready = await pollExport(queued, controller.signal, (status) => {
          setFeedback(status.status === 'processing' ? 'Gerando o PDF…' : 'Aguardando a Jobs Queue…')
        })
        if (!ready.downloadUrl) throw new Error('O Job terminou sem disponibilizar o arquivo.')
        const download = await fetch(ready.downloadUrl, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (!download.ok) {
          const body = await download.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error || 'Não foi possível baixar o PDF concluído.')
        }
        await downloadResponse(download, ready.filename || undefined)
        setFeedback(`PDF gerado · contrato ${ready.semanticVersion || 'registrado'}.`)
        return
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error || 'Não foi possível gerar o PDF.')
      }

      await downloadResponse(response)
      setFeedback(`PDF gerado · contrato ${response.headers.get('x-reporting-semantic-version') || 'registrado'}.`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setFeedback(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.')
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setBusy(false)
      }
    }
  }

  return (
    <div className="esmera-report-export-action" aria-live="polite">
      <span role="status">{feedback}</span>
      <button className="esmera-button esmera-button--primary" type="button" disabled={busy} onClick={() => void exportPDF()}>
        {busy ? 'Gerando PDF…' : 'Exportar PDF'}
      </button>
    </div>
  )
}
