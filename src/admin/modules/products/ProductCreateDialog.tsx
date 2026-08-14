'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button, DialogPanel, ErrorSummary, Field, InlineFeedback } from '../../design-system'
import { expectAdminResponse, normalizeAdminError, type AdminFieldError } from '../../state/asyncState'
import { ProductCategoryPicker } from './ProductCategoryPicker'
import { ProductGalleryUploader } from './ProductGalleryUploader'
import { availabilityLabels, type ProductGalleryItem, type ProductPickerCategory } from './types'

type CreateResponse = { id?: string | number }

type PublishAssessmentIssue = { severity?: string | null; message: string }

type PublishResult = {
  status: string
  message?: string
  meta?: { confirmationToken?: string | null }
  assessment?: { issues?: PublishAssessmentIssue[] } | null
}

type DialogError = { summary: string; fieldErrors: AdminFieldError[]; traceId?: string | null }

function normalizeCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 15)
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currencyInputToCents(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const cents = Number(digits)
  return Number.isSafeInteger(cents) ? cents : null
}

function ProductCreateFlow({ categories, onDone }: { categories: ProductPickerCategory[]; onDone: () => void }) {
  const [stage, setStage] = useState<'essential' | 'details'>('essential')
  const [productId, setProductId] = useState<string | number | null>(null)
  const [draft, setDraft] = useState({ title: '', priceMode: 'inquiry', price: '', availability: 'available' })
  const [selectedCategories, setSelectedCategories] = useState<Array<string | number>>([])
  const [galleryCount, setGalleryCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<DialogError | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [confirmToken, setConfirmToken] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function fail(err: unknown, fallback: string) {
    const normalized = normalizeAdminError(err, fallback)
    setError({ summary: normalized.summary, fieldErrors: normalized.fieldErrors, traceId: normalized.traceId })
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const title = draft.title.trim()
    if (!title) { setError({ summary: 'Informe o nome do produto.', fieldErrors: [] }); return }

    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'create',
          data: {
            title,
            priceMode: draft.priceMode,
            basePriceCents: draft.priceMode === 'fixed' ? currencyInputToCents(draft.price) : null,
            availability: draft.availability,
          },
        }),
      })
      const body = await expectAdminResponse<CreateResponse>(response, 'Não foi possível criar o produto.')
      if (body.id === undefined) throw new Error('O produto foi criado sem identificador retornado.')
      setProductId(body.id)
      setStage('details')
    } catch (err) {
      fail(err, 'Não foi possível criar o produto.')
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (productId === null || busy) return
    setBusy(true)
    setError(null)
    setWarnings([])
    setNotice(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'save-and-publish',
          id: productId,
          data: {
            title: draft.title.trim(),
            priceMode: draft.priceMode,
            basePriceCents: draft.priceMode === 'fixed' ? currencyInputToCents(draft.price) : null,
            availability: draft.availability,
          },
          // Rascunho recém-criado num único fluxo: sem trava de concorrência, já
          // que categorias e galeria foram gravadas ao vivo entre criar e publicar.
          expectedRevision: null,
          expectedUpdatedAt: null,
          confirmationToken: confirmToken || undefined,
        }),
      })
      const result = await expectAdminResponse<PublishResult>(response, 'Não foi possível publicar o produto.')
      if (result.status === 'requires_confirmation') {
        setConfirmToken(result.meta?.confirmationToken || null)
        setWarnings((result.assessment?.issues || []).filter((issue) => issue.severity === 'warning').map((issue) => issue.message))
        setNotice(result.message || 'Revise os avisos e confirme para publicar.')
        return
      }
      onDone()
    } catch (err) {
      setConfirmToken(null)
      fail(err, 'Não foi possível publicar o produto.')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'essential') {
    return (
      <form className="esmera-product-create-dialog" onSubmit={createDraft}>
        {error ? <ErrorSummary summary={error.summary} fieldErrors={error.fieldErrors} traceId={error.traceId} autoFocus /> : null}
        <Field label="Nome">
          <input className="esmera-input" required autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </Field>
        <Field label="Preço">
          <select className="esmera-input" value={draft.priceMode} onChange={(event) => setDraft({ ...draft, priceMode: event.target.value })}>
            <option value="inquiry">Sob consulta</option>
            <option value="fixed">Preço fixo</option>
          </select>
        </Field>
        <Field label="Disponibilidade">
          <select className="esmera-input" value={draft.availability} onChange={(event) => setDraft({ ...draft, availability: event.target.value })}>
            {Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        {draft.priceMode === 'fixed' ? (
          <Field label="Valor (R$)" hint="Opcional na criação; use vírgula para os centavos.">
            <input className="esmera-input" inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: normalizeCurrencyInput(event.target.value) })} placeholder="0,00" />
          </Field>
        ) : null}
        <div className="esmera-product-create-dialog__actions">
          <Button type="submit" tone="primary" busy={busy}>Continuar</Button>
        </div>
      </form>
    )
  }

  const canPublish = productId !== null && selectedCategories.length > 0 && galleryCount > 0 && !busy

  return (
    <div className="esmera-product-create-stage2">
      {error ? <ErrorSummary summary={error.summary} fieldErrors={error.fieldErrors} traceId={error.traceId} autoFocus /> : null}

      <section className="esmera-product-create-section">
        <header className="esmera-product-create-section__header">
          <h3>Categorias</h3>
          <p>Escolha as prateleiras onde este produto aparece.</p>
        </header>
        {productId !== null ? (
          <ProductCategoryPicker
            productId={productId}
            categories={categories}
            selected={selectedCategories}
            onSelectedChange={setSelectedCategories}
            disabled={busy}
          />
        ) : null}
      </section>

      <section className="esmera-product-create-section">
        <header className="esmera-product-create-section__header">
          <h3>Galeria</h3>
          <p>Envie as imagens do produto. A primeira vira a capa automaticamente.</p>
        </header>
        {productId !== null ? <ProductGalleryUploader productId={productId} onGalleryChange={(gallery: ProductGalleryItem[]) => setGalleryCount(gallery.length)} /> : null}
      </section>

      {warnings.length ? (
        <div className="esmera-product-create-warnings">
          <strong>Avisos antes de publicar</strong>
          <ul>{warnings.map((message, index) => <li key={index}>{message}</li>)}</ul>
        </div>
      ) : null}
      {notice ? <InlineFeedback tone="warning">{notice}</InlineFeedback> : null}

      <footer className="esmera-product-create-footer">
        <p className="esmera-product-create-footer__note">O produto já foi salvo como rascunho e aparece na listagem. Você pode fechar e continuar depois pelo editor completo.</p>
        <div className="esmera-product-create-footer__actions">
          <Button onClick={onDone} disabled={busy}>Salvar rascunho</Button>
          <Button tone="primary" onClick={() => void publish()} busy={busy} disabled={!canPublish}>
            {confirmToken ? 'Confirmar publicação' : 'Publicar produto'}
          </Button>
        </div>
        {!canPublish && !busy ? <InlineFeedback tone="info">Adicione ao menos uma categoria e uma imagem para publicar.</InlineFeedback> : null}
      </footer>
    </div>
  )
}

export function ProductCreateDialog({ categories = [] }: { categories?: ProductPickerCategory[] }) {
  const router = useRouter()
  return (
    <DialogPanel
      trigger="Novo produto"
      triggerClassName="esmera-button--primary"
      size="wide"
      title="Novo produto"
      description="Crie o essencial, organize em categorias e envie as primeiras imagens sem sair daqui."
    >
      {(close) => <ProductCreateFlow categories={categories} onDone={() => { close(); router.refresh() }} />}
    </DialogPanel>
  )
}
