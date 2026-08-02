'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Button, InlineFeedback, SavingState } from '../../design-system'
import { availabilityLabels } from './types'

type DraftState = {
  title: string
  subtitle: string
  material: string
  edition: string
  availability: string
  priceMode: string
  basePriceCents: string
}

type Props = {
  productId: string | number
  initial: DraftState
  published: boolean
  archived: boolean
}

export function ProductDraftForm({ productId, initial, published, archived }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [feedback, setFeedback] = useState<string | null>(null)
  const latestRequest = useRef(0)

  const saveDraft = useCallback(async (value: DraftState) => {
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    setSaveState('saving')
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'save-draft',
          id: productId,
          data: {
            title: value.title,
            subtitle: value.subtitle || null,
            material: value.material || null,
            edition: value.edition || null,
            availability: value.availability,
            priceMode: value.priceMode,
            basePriceCents: value.priceMode === 'fixed' && value.basePriceCents !== '' ? Number(value.basePriceCents) : null,
          },
        }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar o rascunho.')
      if (latestRequest.current === requestId) {
        setSaveState('saved')
        setDirty(false)
      }
    } catch (error) {
      if (latestRequest.current === requestId) {
        setSaveState('error')
        setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar o rascunho.')
      }
    }
  }, [productId])

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => void saveDraft(draft), 700)
    return () => window.clearTimeout(timer)
  }, [dirty, draft, saveDraft])

  function field<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setSaveState('idle')
  }

  async function action(name: 'publish' | 'unpublish' | 'archive' | 'restore') {
    setFeedback(null)
    if (dirty) await saveDraft(draft)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: name, ids: [productId] }),
      })
      const body = await response.json() as { updated?: number; errors?: Array<{ message: string }>; error?: string }
      if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a ação.')
      if (!body.updated && body.errors?.length) throw new Error(body.errors.map((item) => item.message).join(' '))
      setFeedback(name === 'publish' ? 'Produto publicado.' : name === 'unpublish' ? 'Produto despublicado.' : name === 'archive' ? 'Produto arquivado.' : 'Produto restaurado.')
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível concluir a ação.')
    }
  }

  return (
    <section className="esmera-product-draft-form" aria-label="Edição rápida do rascunho">
      <div className="esmera-product-draft-form__status">
        <div><strong>Edição rápida</strong><span>Draft oficial do Payload</span></div>
        {saveState === 'saving' ? <SavingState state="saving" /> : null}
        {saveState === 'saved' ? <SavingState state="saved" /> : null}
        {saveState === 'error' ? <SavingState state="rollback" message="Falha ao salvar o rascunho." /> : null}
        {saveState === 'idle' && dirty ? <InlineFeedback tone="warning">Alterações aguardando salvamento automático.</InlineFeedback> : null}
        {saveState === 'idle' && !dirty ? <InlineFeedback>Rascunho sincronizado.</InlineFeedback> : null}
      </div>
      <div className="esmera-product-draft-grid">
        <label><span>Título</span><input className="esmera-input" value={draft.title} onChange={(event) => field('title', event.target.value)} /></label>
        <label><span>Subtítulo</span><input className="esmera-input" value={draft.subtitle} onChange={(event) => field('subtitle', event.target.value)} /></label>
        <label><span>Material</span><input className="esmera-input" value={draft.material} onChange={(event) => field('material', event.target.value)} /></label>
        <label><span>Edição</span><input className="esmera-input" value={draft.edition} onChange={(event) => field('edition', event.target.value)} /></label>
        <label><span>Disponibilidade</span><select className="esmera-input" value={draft.availability} onChange={(event) => field('availability', event.target.value)}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Modo de preço</span><select className="esmera-input" value={draft.priceMode} onChange={(event) => field('priceMode', event.target.value)}><option value="inquiry">Sob consulta</option><option value="fixed">Preço fixo</option></select></label>
        {draft.priceMode === 'fixed' ? <label><span>Preço base em centavos</span><input className="esmera-input" inputMode="numeric" value={draft.basePriceCents} onChange={(event) => field('basePriceCents', event.target.value.replace(/\D/g, ''))} /></label> : null}
      </div>
      <p className="esmera-product-draft-form__hint">Alterações nestes campos são salvas como rascunho após 700 ms. Publicar continua sendo uma ação separada. Descrição rica, opções e variantes completas permanecem no editor técnico.</p>
      <div className="esmera-product-draft-form__actions">
        <div className="esmera-actions">
          <Button tone="primary" onClick={() => void action(published ? 'unpublish' : 'publish')}>{published ? 'Despublicar' : 'Publicar'}</Button>
          <Button onClick={() => void action(archived ? 'restore' : 'archive')}>{archived ? 'Restaurar no catálogo' : 'Arquivar'}</Button>
        </div>
        {feedback ? <InlineFeedback tone={feedback.includes('Não') ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
      </div>
    </section>
  )
}
