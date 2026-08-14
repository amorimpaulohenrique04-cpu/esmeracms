'use client'

import { useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  ActionBar,
  Button,
  ErrorSummary,
  FieldV2,
  FormShell,
  InlineFeedback,
  PublicationChecklist,
  SavingState,
  Status,
  type FormTab,
  type PublicationChecklistIssue,
} from '../../design-system'
import type { AdminEntityError, AdminFieldError } from '../../state/asyncState'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import { availabilityLabels, type PublicationIssue } from './types'

type DraftState = {
  title: string
  subtitle: string
  material: string
  edition: string
  availability: string
  priceMode: string
  basePriceCents: string
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

// `scope` separa o retorno do salvamento do retorno de publicação/integração:
// os dois nunca ocupam a mesma zona da interface.
type FeedbackState = {
  scope: 'save' | 'publication'
  tone: 'success' | 'warning' | 'danger'
  message: string
  code?: string | null
  fieldErrors?: AdminFieldError[]
  entityErrors?: AdminEntityError[]
  traceId?: string | null
}

type Props = {
  productId: string | number
  initial: DraftState
  published: boolean
  archived: boolean
  initialRevision?: string | null
  initialUpdatedAt?: string | null
  // Assessment carregado junto com o documento (ProductsView → ProductDocumentView).
  initialPublicationIssues?: PublicationIssue[]
  publicationReady?: boolean | null
}

function toChecklistIssue(issue: PublicationIssue): PublicationChecklistIssue {
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    suggestion: issue.suggestion,
    tab: issue.tab,
    anchor: issue.anchor,
  }
}

// Os ids das abas são os mesmos que o registry editorial devolve em
// `issue.tab`; navegar a partir de uma issue não depende de nenhuma tradução.
const formTabs: FormTab[] = [
  { id: 'identity', label: 'Essencial' },
  { id: 'content', label: 'Conteúdo' },
  { id: 'gallery', label: 'Mídia' },
  { id: 'commercial', label: 'Comercial' },
  { id: 'variants', label: 'Variantes' },
  { id: 'seo', label: 'SEO' },
  { id: 'advanced', label: 'Avançado' },
]

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

export function ProductDraftForm({
  productId,
  initial,
  published,
  archived,
  initialRevision,
  initialUpdatedAt,
  initialPublicationIssues,
  publicationReady,
}: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<DraftState>(() => ({
    ...initial,
    basePriceCents: formatCurrencyInputFromCents(initial.basePriceCents),
  }))
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  // Só uma submissão explícita autoriza mover o foco para o resumo.
  const [explicitFailure, setExplicitFailure] = useState(false)
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null)
  // `null` = nenhuma operação devolveu assessment ainda; o checklist continua
  // mostrando o que veio carregado com o documento.
  const [operationChecklist, setOperationChecklist] = useState<PublicationChecklistIssue[] | null>(null)
  const [activeTab, setActiveTab] = useState('identity')
  const activeAbort = useRef<AbortController | null>(null)
  // Fila serial: nunca há mais de um save-draft em voo. Uma resposta antiga não
  // pode sobrescrever revision.current depois de uma mais nova porque a próxima
  // gravação só começa depois que a anterior confirma no servidor (abortar o
  // fetch no browser não garante que a escrita já foi cancelada no servidor).
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true))
  const revision = useRef<string | null>(initialRevision ?? null)
  const updatedAt = useRef<string | null>(initialUpdatedAt ?? null)
  // Espelho only-render da revisão: o cabeçalho nunca exibe valor sintetizado,
  // apenas o que o contrato entregou.
  const [revisionLabel, setRevisionLabel] = useState<string | null>(initialRevision ?? null)

  const applyError = useCallback((
    error: unknown,
    fallback: string,
    scope: FeedbackState['scope'],
    explicit: boolean,
  ) => {
    const normalized = normalizeAdminError(error, fallback)
    setFeedback({
      scope,
      tone: 'danger',
      message: normalized.summary,
      code: normalized.code,
      fieldErrors: normalized.fieldErrors,
      entityErrors: normalized.entityErrors,
      traceId: normalized.traceId,
    })
    setExplicitFailure(explicit)
    // Só um assessment estruturado troca o checklist. Erro de transporte sem
    // fieldErrors preserva o último assessment válido — nada é fabricado aqui.
    if (normalized.fieldErrors.length) {
      setOperationChecklist(normalized.fieldErrors.map((issue) => ({
        code: issue.code || issue.path,
        severity: issue.severity ?? 'blocker',
        message: issue.message,
        suggestion: issue.suggestion,
        tab: issue.tab,
        anchor: issue.anchor,
      })))
    }
  }, [])

  const enqueueSave = useCallback((value: DraftState, explicit = false): Promise<boolean> => {
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
        setRevisionLabel(revision.current)
        setSaveState('saved')
        setDirty(false)
        return true
      } catch (error) {
        if (controller.signal.aborted) return false
        setSaveState('error')
        applyError(error, 'Não foi possível salvar o rascunho.', 'save', explicit)
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
    setExplicitFailure(false)
    setPublishing(true)
    try {
      // Publish nunca aborta um autosave em voo — ele aguarda a fila confirmar o
      // último estado salvo (e enfileira o draft atual se ainda houver alterações
      // pendentes) antes de publicar exatamente essa revisão.
      const flushed = dirty ? await enqueueSave(draft, true) : await saveQueue.current
      if (!flushed) return

      setSaveState('saving')
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
      setRevisionLabel(revision.current)

      if (result.status === 'requires_confirmation') {
        const nextToken = result.meta?.confirmationToken || null
        setConfirmationToken(nextToken)
        setSaveState('saved')
        setOperationChecklist(
          (result.assessment?.issues || []).filter((issue) => issue.severity === 'warning').map(toChecklistIssue),
        )
        setFeedback({
          scope: 'publication',
          tone: 'warning',
          message: result.message || 'Revise os avisos antes de confirmar a publicação.',
        })
        return
      }

      setConfirmationToken(null)
      setDirty(false)
      setSaveState('saved')
      // O servidor concluiu a publicação: o assessment vigente não tem mais
      // pendências. Nenhuma readiness é recalculada aqui.
      setOperationChecklist([])
      setFeedback({
        scope: 'publication',
        tone: result.status === 'published_but_unverified' ? 'warning' : 'success',
        message: result.message || (result.status === 'published_but_unverified'
          ? 'Produto publicado, mas o site não pôde ser verificado agora.'
          : 'Produto publicado.'),
      })
      router.refresh()
    } catch (error) {
      setSaveState('error')
      applyError(error, 'Não foi possível publicar o produto.', 'publication', true)
    } finally {
      setPublishing(false)
    }
  }

  async function legacyAction(name: 'unpublish' | 'archive' | 'restore') {
    setFeedback(null)
    if (dirty) {
      const saved = await enqueueSave(draft, true)
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
        scope: 'publication',
        tone: 'success',
        message: name === 'unpublish'
          ? 'Produto despublicado.'
          : name === 'archive'
          ? 'Produto arquivado.'
          : 'Produto restaurado.',
      })
      router.refresh()
    } catch (error) {
      applyError(error, 'Não foi possível concluir a ação.', 'publication', true)
    }
  }

  const fieldErrors = feedback?.fieldErrors || []
  const errorFor = (path: string) => fieldErrors.find((issue) => issue.path === path)?.message || null

  // Uma issue só troca de aba quando o registry aponta para uma aba existente
  // aqui; sem destino válido ela permanece listada no resumo.
  const changeTab = (tab: string) => {
    if (formTabs.some((item) => item.id === tab)) setActiveTab(tab)
  }

  const tabs = formTabs.map((tab) => ({
    ...tab,
    issues: fieldErrors.filter((issue) => issue.tab === tab.id).length || undefined,
  }))

  // Fonte única do checklist: o assessment carregado com o documento até que
  // uma operação devolva um assessment mais novo. Nada é recalculado aqui.
  const initialChecklist = (initialPublicationIssues || []).map(toChecklistIssue)
  const checklistIssues = operationChecklist ?? initialChecklist
  const showChecklist = operationChecklist !== null || checklistIssues.length > 0 || publicationReady === true

  const saving = saveState === 'saving' || publishing
  const publicationFeedback = feedback && feedback.scope === 'publication' ? feedback : null

  return (
    <FormShell
      title="Edição rápida do rascunho"
      description="Alterações nestes campos são salvas como rascunho após 700 ms. Publicar salva novamente o estado visível, avalia as regras do catálogo e só então promove a mesma revisão."
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={
        <div className="esmera-product-draft-form__status">
          <Status tone={published ? 'success' : 'neutral'}>{published ? 'Publicado' : 'Rascunho'}</Status>
          {archived ? <Status tone="warning">Arquivado</Status> : null}
          {revisionLabel ? <span className="esmera-product-draft-form__revision">Revisão {revisionLabel}</span> : null}
        </div>
      }
      aside={showChecklist ? (
        <PublicationChecklist
          issues={checklistIssues}
          onNavigate={(issue) => {
            if (issue.tab) changeTab(issue.tab)
          }}
        />
      ) : undefined}
      footer={
        <ActionBar
          dirty={dirty}
          saving={saving}
          published={published}
          publicationBlocked={feedback?.code === 'publication_blocked'}
          publishLabel={confirmationToken ? 'Confirmar publicação' : 'Salvar e publicar'}
          onSave={() => void enqueueSave(draft, true)}
          onPublish={() => void publish(confirmationToken)}
          onUnpublish={() => void legacyAction('unpublish')}
          secondary={
            <Button disabled={saving} onClick={() => void legacyAction(archived ? 'restore' : 'archive')}>
              {archived ? 'Restaurar no catálogo' : 'Arquivar'}
            </Button>
          }
        />
      }
    >
      {feedback?.tone === 'danger' ? (
        <ErrorSummary
          summary={feedback.message}
          fieldErrors={feedback.fieldErrors}
          entityErrors={feedback.entityErrors}
          traceId={feedback.traceId}
          onTabChange={changeTab}
          autoFocus={explicitFailure}
        />
      ) : null}

      <div className="esmera-product-draft-grid">
        {activeTab === 'identity' ? (
          <>
            <FieldV2 id="product-title" path="title" label="Título" required error={errorFor('title')}>
              {(control) => <input {...control} className="esmera-input" value={draft.title} onChange={(event) => field('title', event.target.value)} />}
            </FieldV2>
            <FieldV2 path="subtitle" label="Subtítulo" optional error={errorFor('subtitle')}>
              {(control) => <input {...control} className="esmera-input" value={draft.subtitle} onChange={(event) => field('subtitle', event.target.value)} />}
            </FieldV2>
          </>
        ) : null}

        {activeTab === 'content' ? (
          <>
            <FieldV2 path="material" label="Material" optional error={errorFor('material')}>
              {(control) => <input {...control} className="esmera-input" value={draft.material} onChange={(event) => field('material', event.target.value)} />}
            </FieldV2>
            <FieldV2 path="edition" label="Edição" optional error={errorFor('edition')}>
              {(control) => <input {...control} className="esmera-input" value={draft.edition} onChange={(event) => field('edition', event.target.value)} />}
            </FieldV2>
          </>
        ) : null}

        {activeTab === 'commercial' ? (
          <>
            <FieldV2 id="product-availability" path="availability" label="Disponibilidade" required error={errorFor('availability')}>
              {(control) => (
                <select {...control} className="esmera-input" value={draft.availability} onChange={(event) => field('availability', event.target.value)}>
                  {Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              )}
            </FieldV2>
            <FieldV2 id="product-price-mode" path="priceMode" label="Modo de preço" required error={errorFor('priceMode')}>
              {(control) => (
                <select {...control} className="esmera-input" value={draft.priceMode} onChange={(event) => field('priceMode', event.target.value)}>
                  <option value="inquiry">Sob consulta</option>
                  <option value="fixed">Preço fixo</option>
                </select>
              )}
            </FieldV2>
            {draft.priceMode === 'fixed' ? (
              <FieldV2 id="product-base-price" path="basePriceCents" label="Preço base (R$)" hint="Use vírgula para os centavos." error={errorFor('basePriceCents')}>
                {(control) => <input {...control} className="esmera-input" inputMode="decimal" value={draft.basePriceCents} onChange={(event) => field('basePriceCents', normalizeCurrencyInput(event.target.value))} placeholder="0,00" />}
              </FieldV2>
            ) : null}
          </>
        ) : null}

        {activeTab === 'gallery' ? (
          <p className="esmera-product-draft-form__hint">A galeria é gerenciada na aba Mídia do produto; as pendências de imagem aparecem no checklist de publicação.</p>
        ) : null}
        {activeTab === 'variants' ? (
          <p className="esmera-product-draft-form__hint">Opções e combinações são editadas na aba Variantes do produto; as pendências aparecem no checklist de publicação.</p>
        ) : null}
        {activeTab === 'seo' ? (
          <p className="esmera-product-draft-form__hint">Os campos de SEO são editados na aba SEO do produto.</p>
        ) : null}
        {activeTab === 'advanced' ? (
          <p className="esmera-product-draft-form__hint">Ações de catálogo e histórico ficam no editor técnico do produto.</p>
        ) : null}
      </div>

      <div className="esmera-product-draft-form__save-feedback">
        {saveState === 'saving' ? <SavingState state="saving" message="Salvando rascunho…" /> : null}
        {saveState === 'saved' ? <SavingState state="saved" message="Rascunho salvo" /> : null}
        {saveState === 'error' ? <SavingState state="rollback" message="Falha ao salvar o rascunho." /> : null}
        {saveState === 'idle' && dirty ? <InlineFeedback tone="warning">Alterações aguardando salvamento automático.</InlineFeedback> : null}
        {saveState === 'idle' && !dirty ? <InlineFeedback>Rascunho sincronizado.</InlineFeedback> : null}
      </div>

      <div className="esmera-product-publication-feedback">
        {publishing ? <InlineFeedback busy tone="info">Publicando…</InlineFeedback> : null}
        {publicationFeedback ? (
          <>
            <InlineFeedback tone={publicationFeedback.tone}>{publicationFeedback.message}</InlineFeedback>
            {publicationFeedback.code === 'revision_conflict' ? (
              <Button onClick={() => window.location.reload()}>Recarregar versão atual</Button>
            ) : null}
            {publicationFeedback.code === 'verification_failed' ? (
              <InlineFeedback tone="warning">O site não confirmou a publicação. Tente novamente em instantes.</InlineFeedback>
            ) : null}
          </>
        ) : null}
        {confirmationToken ? (
          <InlineFeedback tone="warning">Publicação aguardando sua confirmação dos avisos.</InlineFeedback>
        ) : null}
      </div>
    </FormShell>
  )
}
