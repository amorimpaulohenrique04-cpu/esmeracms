'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Button, InlineFeedback, SavingState } from '../../design-system'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
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

type PublicationIssue = {
  id?: string
  severity?: 'blocker' | 'warning' | 'recommendation'
  path?: string | null
  tab?: string | null
  anchor?: string | null
  message: string
  suggestion?: string | null
}

type AdminActionResult = {
  status: 'saved' | 'published' | 'unpublished' | 'archived' | 'restored' | 'published_but_unverified' | 'requires_confirmation'
  entityId?: string | number
  revision?: string | null
  assessment?: {
    ready?: boolean
    issues?: PublicationIssue[]
  } | null
  message?: string
  meta?: {
    updated?: number
    updatedAt?: string | null
    confirmationToken?: string | null
  }
}

type LegacyMutationResult = {
  updated?: number
  errors?: Array<{ message: string }>
}

type FeedbackState = {
  tone: 'success' | 'warning' | 'danger'
  message: string
  code?: string | null
  issues?: PublicationIssue[]
  traceId?: string | null
}

type Props = {
  productId: string | number
  initial: DraftState
  published: boolean
  archived: boolean
  initialRevision?: string | null
  initialUpdatedAt?: string | null
}

function formatCurrencyInputFromCents(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const cents = Number(digits)
  if (!Number.isSafeInteger(cents)) return ''
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function normalizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 15)
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function currencyInputToCents(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const cents = Number(digits)
  return Number.isSafeInteger(cents) ? cents : null
}

function requestData(value: DraftState) {
  return {
    title: value.title,
    subtitle: value.subtitle || null,
    material: value.material || null,
    edition: value.edition || null,
    availability: value.availability,
    priceMode: value.priceMode,
    basePriceCents: value.priceMode === 'fixed' ? currencyInputToCents(value.basePriceCents) : null,
  }
}

export function ProductDraftForm({ productId, initial, published, archived, initialRevision, initialUpdatedAt }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<DraftState>(() => ({
    ...initial,
    basePriceCents: formatCurrencyInputFromCents(initial.basePriceCents),
  }))
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null)
  const activeAbort = useRef<AbortController | null>(null)
  // Fila serial: nunca há mais de um save-draft em voo. Uma resposta antiga não
  // pode sobrescrever revision.current depois de uma mais nova porque a próxima
  // gravação só começa depois que a anterior confirma no servidor (abortar o
  // fetch no browser não garante que a escrita já foi cancelada no servidor).
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true))
  const revision = useRef<string | null>(initialRevision ?? null)
  const updatedAt = useRef<string | null>(initialUpdatedAt ?? null)

  const applyError = useCallback((error: unknown, fallback: string) => {
    const normalized = normalizeAdminError(error, fallback)
    setFeedback({
      tone: 'danger',
      message: normalized.summary,
      code: normalized.code,
      issues: [
        ...normalized.fieldErrors.map((issue) => ({
          id: issue.code || undefined,
          severity: issue.severity,
          path: issue.path,
          tab: issue.tab,
          anchor: issue.anchor,
          message: issue.message,
          suggestion: issue.suggestion,
        })),
        ...normalized.entityErrors.map((issue) => ({
          id: issue.code,
          severity: 'blocker' as const,
          message: issue.message,
          suggestion: issue.suggestion,
        })),
      ],
      traceId: normalized.traceId,
    })
  }, [])

  const enqueueSave = useCallback((value: DraftState): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const controller = new AbortController()
      activeAbort.current = controller
      setSaveState('saving')
      setFeedback(null)

      try {
        const response = await fetch('/api/admin-products', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            action: 'save-draft',
            id: productId,
            data: requestData(value),
            expectedRevision: revision.current,
            expectedUpdatedAt: updatedAt.current,
          }),
        })
        const result = await expectAdminResponse<AdminActionResult>(response, 'Não foi possível salvar o rascunho.')
        revision.current = result.revision || revision.current
        updatedAt.current = result.meta?.updatedAt || updatedAt.current
        setSaveState('saved')
        setDirty(false)
        return true
      } catch (error) {
        if (controller.signal.aborted) return false
        setSaveState('error')
        applyError(error, 'Não foi possível salvar o rascunho.')
        return false
      } finally {
        if (activeAbort.current === controller) activeAbort.current = null
      }
    }

    const next = saveQueue.current.then(run)
    saveQueue.current = next
    return next
  }, [applyError, productId])

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => void enqueueSave(draft), 700)
    return () => window.clearTimeout(timer)
  }, [dirty, draft, enqueueSave])

  useEffect(() => () => activeAbort.current?.abort(), [])

  function field<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setSaveState('idle')
    setConfirmationToken(null)
  }

  async function publish(token?: string | null) {
    setFeedback(null)
    // Publish nunca aborta um autosave em voo — ele aguarda a fila confirmar o
    // último estado salvo (e enfileira o draft atual se ainda houver alterações
    // pendentes) antes de publicar exatamente essa revisão.
    const flushed = dirty ? await enqueueSave(draft) : await saveQueue.current
    if (!flushed) return

    setSaveState('saving')
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'save-and-publish',
          id: productId,
          data: requestData(draft),
          expectedRevision: revision.current,
          expectedUpdatedAt: updatedAt.current,
          confirmationToken: token || undefined,
        }),
      })
      const result = await expectAdminResponse<AdminActionResult>(response, 'Não foi possível publicar o produto.')
      revision.current = result.revision || revision.current
      updatedAt.current = result.meta?.updatedAt || updatedAt.current

      if (result.status === 'requires_confirmation') {
        const nextToken = result.meta?.confirmationToken || null
        setConfirmationToken(nextToken)
        setSaveState('saved')
        setFeedback({
          tone: 'warning',
          message: result.message || 'Revise os avisos antes de confirmar a publicação.',
          issues: result.assessment?.issues?.filter((issue) => issue.severity === 'warning'),
        })
        return
      }

      setConfirmationToken(null)
      setDirty(false)
      setSaveState('saved')
      setFeedback({
        tone: result.status === 'published_but_unverified' ? 'warning' : 'success',
        message: result.message || (result.status === 'published_but_unverified'
          ? 'Produto publicado, mas o site não pôde ser verificado agora.'
          : 'Produto publicado.'),
      })
      router.refresh()
    } catch (error) {
      setSaveState('error')
      applyError(error, 'Não foi possível publicar o produto.')
    }
  }

  async function legacyAction(name: 'unpublish' | 'archive' | 'restore') {
    setFeedback(null)
    if (dirty) {
      const saved = await enqueueSave(draft)
      if (!saved) return
    }
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: name, ids: [productId] }),
      })
      const result = await expectAdminResponse<LegacyMutationResult>(response, 'Não foi possível concluir a ação.')
      if (!result.updated && result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join(' '))
      }
      setFeedback({
        tone: 'success',
        message: name === 'unpublish'
          ? 'Produto despublicado.'
          : name === 'archive'
          ? 'Produto arquivado.'
          : 'Produto restaurado.',
      })
      router.refresh()
    } catch (error) {
      applyError(error, 'Não foi possível concluir a ação.')
    }
  }

  return (
    <section className="esmera-product-draft-form" aria-label="Edição rápida do rascunho">
      <div className="esmera-product-draft-form__status">
        <div><strong>Edição rápida</strong><span>Draft oficial do Payload</span></div>
        {saveState === 'saving' ? <SavingState state="saving" message="Salvando rascunho…" /> : null}
        {saveState === 'saved' ? <SavingState state="saved" message="Rascunho salvo" /> : null}
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
        {draft.priceMode === 'fixed' ? <label><span>Preço base (R$)</span><input className="esmera-input" inputMode="decimal" value={draft.basePriceCents} onChange={(event) => field('basePriceCents', normalizeCurrencyInput(event.target.value))} placeholder="0,00" /></label> : null}
      </div>
      <p className="esmera-product-draft-form__hint">Alterações nestes campos são salvas como rascunho após 700 ms. Publicar salva novamente o estado visível, avalia as regras do catálogo e só então promove a mesma revisão.</p>
      <div className="esmera-product-draft-form__actions">
        <div className="esmera-actions">
          {published
            ? <Button tone="primary" onClick={() => void legacyAction('unpublish')}>Despublicar</Button>
            : confirmationToken
            ? <Button tone="primary" onClick={() => void publish(confirmationToken)}>Confirmar publicação</Button>
            : <Button tone="primary" onClick={() => void publish()}>Publicar</Button>}
          <Button onClick={() => void legacyAction(archived ? 'restore' : 'archive')}>{archived ? 'Restaurar no catálogo' : 'Arquivar'}</Button>
        </div>
        {feedback ? (
          <div className="esmera-product-publication-feedback" role="status" aria-live="polite">
            <InlineFeedback tone={feedback.tone}>{feedback.message}</InlineFeedback>
            {feedback.code === 'revision_conflict' ? (
              <Button onClick={() => window.location.reload()}>Recarregar versão atual</Button>
            ) : null}
            {feedback.issues?.length ? (
              <ul className="esmera-product-issues">
                {feedback.issues.map((issue, index) => (
                  <li key={`${issue.id || issue.path || 'issue'}-${index}`}>
                    {issue.anchor
                      ? <a href={`#${issue.anchor}`}>{issue.message}</a>
                      : <span>{issue.message}</span>}
                    {issue.suggestion ? <small>{issue.suggestion}</small> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {feedback.traceId ? <small>Referência técnica: {feedback.traceId}</small> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
