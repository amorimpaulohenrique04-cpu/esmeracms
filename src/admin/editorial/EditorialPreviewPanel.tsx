'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
  Button,
  InlineFeedback,
  SegmentedControl,
  SegmentedControlButton,
} from '../design-system'
import { ADMIN_DRAFT_CHANGED_EVENT, announceAdmin } from '../state/AdminStateProvider'

type PreviewKind = 'product' | 'category'
type DeviceMode = 'desktop' | 'tablet' | 'mobile'

type Props = {
  kind: PreviewKind
  recordId: string | number
  title: string
}

function previewPath(kind: PreviewKind, recordId: string | number, revision: number) {
  return `/preview/editorial/${kind}/${encodeURIComponent(String(recordId))}?revision=${revision}`
}

export function EditorialPreviewPanel({ kind, recordId, title }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const debounceRef = useRef<number | null>(null)
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('Preview conectado ao rascunho atual.')
  const src = useMemo(() => previewPath(kind, recordId, revision), [kind, recordId, revision])

  useEffect(() => {
    const onDraftChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: PreviewKind; id?: string | number; field?: string }>).detail
      if (detail?.kind !== kind || String(detail.id) !== String(recordId)) return
      setFeedback(detail.field ? `Atualização pendente: ${detail.field}.` : 'Atualização pendente.')
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        setLoading(true)
        setRevision((value) => value + 1)
        setFeedback('Atualizando o preview do rascunho…')
      }, 650)
    }

    window.addEventListener(ADMIN_DRAFT_CHANGED_EVENT, onDraftChanged)
    return () => {
      window.removeEventListener(ADMIN_DRAFT_CHANGED_EVENT, onDraftChanged)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [kind, recordId])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return
      const data = event.data as { type?: string; field?: string }
      if (data.type !== 'esmera-editorial-preview-field' || !data.field) return
      const escaped = CSS.escape(data.field)
      const field = document.querySelector<HTMLElement>(`[data-preview-field="${escaped}"]`)
      if (!field) {
        setFeedback(`O campo ${data.field} está disponível em outra seção do documento.`)
        return
      }
      field.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
      const control = field.matches('input, textarea, select, button, [tabindex]')
        ? field
        : field.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]')
      window.setTimeout(() => control?.focus({ preventScroll: true }), 180)
      field.dataset.previewFocused = 'true'
      window.setTimeout(() => delete field.dataset.previewFocused, 1_500)
      setFeedback(`Campo em foco: ${data.field}.`)
      announceAdmin(`Campo ${data.field} em foco.`)
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function refresh() {
    setLoading(true)
    setRevision((value) => value + 1)
    setFeedback('Atualizando o preview do rascunho…')
  }

  return (
    <aside className="esmera-editorial-preview" aria-label={`Preview editorial de ${title}`}>
      <header className="esmera-editorial-preview__header">
        <div>
          <span className="esmera-eyebrow">Preview draft</span>
          <h2>{title}</h2>
          <p>Renderização autenticada do documento ainda não publicado.</p>
        </div>
        <div className="esmera-editorial-preview__actions">
          <Button type="button" onClick={refresh}>Atualizar</Button>
          <a className="esmera-button" href={src} target="_blank" rel="noreferrer">Abrir completo</a>
        </div>
      </header>

      <div className="esmera-editorial-preview__toolbar">
        <SegmentedControl label="Dispositivo do preview">
          <SegmentedControlButton selected={device === 'desktop'} onClick={() => setDevice('desktop')}>Desktop</SegmentedControlButton>
          <SegmentedControlButton selected={device === 'tablet'} onClick={() => setDevice('tablet')}>Tablet</SegmentedControlButton>
          <SegmentedControlButton selected={device === 'mobile'} onClick={() => setDevice('mobile')}>Mobile</SegmentedControlButton>
        </SegmentedControl>
        <span>Clique em qualquer área do preview para focar o campo correspondente.</span>
      </div>

      <div className={`esmera-editorial-preview__stage is-${device}`} aria-busy={loading || undefined}>
        {loading ? <div className="esmera-editorial-preview__loading"><span /><strong>Carregando o draft real…</strong></div> : null}
        <iframe
          ref={iframeRef}
          key={src}
          title={`Preview editorial: ${title}`}
          src={src}
          onLoad={() => {
            setLoading(false)
            setFeedback('Preview atualizado com o último rascunho salvo.')
          }}
        />
      </div>

      <InlineFeedback busy={loading} tone={feedback.includes('outra seção') ? 'warning' : 'info'}>{feedback}</InlineFeedback>
    </aside>
  )
}
