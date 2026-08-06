'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button, DialogPanel, Field, InlineFeedback } from '../../design-system'
import type { CategoryParent } from './types'

type CategoryCreateResponse = {
  id?: string | number
  error?: string | { summary?: string; message?: string }
}

function responseError(body: CategoryCreateResponse) {
  if (typeof body.error === 'string') return body.error
  return body.error?.summary || body.error?.message || 'Não foi possível criar a categoria.'
}

export function CategoryCreateDialog({ categories }: { categories: CategoryParent[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', parent: '', status: 'active' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'create',
          data: {
            title: draft.title,
            parent: draft.parent || null,
            status: draft.status,
          },
        }),
      })
      const body = await response.json() as CategoryCreateResponse
      if (!response.ok) throw new Error(responseError(body))
      if (body.id === undefined) throw new Error('A categoria foi criada sem identificador retornado.')
      router.push(`/admin/categories?category=${body.id}&tab=general`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível criar a categoria.')
    } finally {
      setBusy(false)
    }
  }

  return <DialogPanel
    trigger="Nova categoria"
    triggerClassName="esmera-button--primary"
    title="Nova categoria"
    description="Crie a estrutura mínima e complete descrição, mídia, SEO e sinônimos no detalhe."
  >
    <form className="esmera-category-dialog-form" onSubmit={submit}>
      <Field label="Nome">
        <input className="esmera-input" required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </Field>
      <Field label="Categoria principal">
        <select className="esmera-input" value={draft.parent} onChange={(event) => setDraft({ ...draft, parent: event.target.value })}>
          <option value="">Sem categoria principal</option>
          {categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.title || category.slug || category.id}</option>)}
        </select>
      </Field>
      <Field label="Status">
        <select className="esmera-input" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
          <option value="active">Ativa</option>
          <option value="archive">Arquivada</option>
        </select>
      </Field>
      {feedback ? <InlineFeedback tone="danger">{feedback}</InlineFeedback> : null}
      <div className="esmera-category-dialog-actions">
        <Button type="submit" tone="primary" disabled={busy}>{busy ? 'Criando…' : 'Criar categoria'}</Button>
      </div>
    </form>
  </DialogPanel>
}
