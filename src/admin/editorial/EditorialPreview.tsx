'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { InlineFeedback, SegmentedControl, SegmentedControlButton } from '../design-system'

type PreviewViewport = 'desktop' | 'tablet' | 'mobile'

type Props = {
  title: string
  previewURL: string | null
  fullPreviewURL?: string | null
  updatedAt?: string | null
}

const viewportWidths: Record<PreviewViewport, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
}

export function EditorialPreview({ title, previewURL, fullPreviewURL, updatedAt }: Props) {
  const [viewport, setViewport] = useState<PreviewViewport>('desktop')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(Boolean(previewURL))
  const source = useMemo(() => {
    if (!previewURL) return null
    const url = new URL(previewURL, window.location.origin)
    url.searchParams.set('esmeraPreviewRevision', String(revision))
    return url.toString()
  }, [previewURL, revision])

  useEffect(() => {
    if (!previewURL) return
    const timer = window.setTimeout(() => {
      setLoading(true)
      setRevision((current) => current + 1)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [previewURL, updatedAt])

  if (!previewURL) {
    return <InlineFeedback tone="warning">Preview editorial indisponível. Configure uma rota draft real antes de habilitar esta superfície.</InlineFeedback>
  }

  return (
    <section className="esmera-editorial-preview" aria-label={`Preview editorial de ${title}`}>
      <header className="esmera-editorial-preview__toolbar">
        <div>
          <span className="esmera-eyebrow">Draft real</span>
          <strong>{title}</strong>
        </div>
        <div className="esmera-editorial-preview__actions">
          <SegmentedControl label="Viewport do preview">
            {(['desktop', 'tablet', 'mobile'] as PreviewViewport[]).map((mode) => (
              <SegmentedControlButton key={mode} selected={viewport === mode} onClick={() => setViewport(mode)}>
                {mode === 'desktop' ? 'Desktop' : mode === 'tablet' ? 'Tablet' : 'Mobile'}
              </SegmentedControlButton>
            ))}
          </SegmentedControl>
          <button className="esmera-button" type="button" onClick={() => { setLoading(true); setRevision((current) => current + 1) }}>Atualizar</button>
          <a className="esmera-button" href={fullPreviewURL || previewURL} target="_blank" rel="noreferrer">Abrir completo</a>
        </div>
      </header>
      {loading ? <InlineFeedback busy tone="info">Atualizando preview após o debounce editorial…</InlineFeedback> : null}
      <div className="esmera-editorial-preview__stage">
        <div className="esmera-editorial-preview__viewport" style={{ '--preview-width': `${viewportWidths[viewport]}px` } as React.CSSProperties}>
          <iframe key={source} title={`Preview draft de ${title}`} src={source || undefined} onLoad={() => setLoading(false)} />
        </div>
      </div>
    </section>
  )
}
