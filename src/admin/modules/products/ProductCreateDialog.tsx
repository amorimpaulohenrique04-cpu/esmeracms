'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button, DialogPanel, Field, InlineFeedback } from '../../design-system'

type ProductCreateResponse = {
  id?: string | number
  error?: string | { summary?: string; message?: string }
}

function responseError(body: ProductCreateResponse) {
  if (typeof body.error === 'string') return body.error
  return body.error?.summary || body.error?.message || 'Não foi possível criar o produto.'
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

export function ProductCreateDialog() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', priceMode: 'inquiry', price: '' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'create',
          data: {
            title: draft.title,
            priceMode: draft.priceMode,
            basePriceCents: draft.priceMode === 'fixed' ? currencyInputToCents(draft.price) : null,
          },
        }),
      })
      const body = await response.json() as ProductCreateResponse
      if (!response.ok) throw new Error(responseError(body))
      if (body.id === undefined) throw new Error('O produto foi criado sem identificador retornado.')
      router.push(`/admin/products?product=${body.id}`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível criar o produto.')
    } finally {
      setBusy(false)
    }
  }

  return <DialogPanel
    trigger="Novo produto"
    triggerClassName="esmera-button--primary"
    title="Novo produto"
    description="Informe o nome e, se quiser, o preço. Código, slug e metadados de mídia são gerados automaticamente."
  >
    <form className="esmera-product-create-dialog" onSubmit={submit}>
      <Field label="Nome">
        <input
          className="esmera-input"
          required
          autoFocus
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
      </Field>
      <Field label="Preço">
        <select
          className="esmera-input"
          value={draft.priceMode}
          onChange={(event) => setDraft({ ...draft, priceMode: event.target.value })}
        >
          <option value="inquiry">Sob consulta</option>
          <option value="fixed">Preço fixo</option>
        </select>
      </Field>
      {draft.priceMode === 'fixed' ? (
        <Field label="Valor (R$)" hint="Opcional na criação; use vírgula para os centavos.">
          <input
            className="esmera-input"
            inputMode="decimal"
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: normalizeCurrencyInput(event.target.value) })}
            placeholder="0,00"
          />
        </Field>
      ) : null}
      {feedback ? <InlineFeedback tone="danger">{feedback}</InlineFeedback> : null}
      <div className="esmera-product-create-dialog__actions">
        <Button type="submit" tone="primary" disabled={busy}>{busy ? 'Criando…' : 'Criar produto'}</Button>
      </div>
    </form>
  </DialogPanel>
}
