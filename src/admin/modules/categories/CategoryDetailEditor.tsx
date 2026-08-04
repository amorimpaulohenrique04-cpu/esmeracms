'use client'

import { Combobox } from '@base-ui/react/combobox'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'

import { Button, Field, InlineFeedback, Status } from '../../design-system'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import {
  categoryImageAlt,
  categoryImageURL,
  categoryStatusLabels,
  relationId,
  type CategoryDetail,
  type CategoryMedia,
  type CategoryParent,
} from './types'

type TermItem = { id: string; value: string; creatable?: string }

type AdminActionResult = {
  status: 'saved' | 'published' | 'unpublished' | 'requires_confirmation'
  revision?: string | null
  message?: string
  assessment?: {
    issues?: Array<{
      id?: string
      severity?: 'blocker' | 'warning' | 'recommendation'
      message: string
      suggestion?: string | null
      anchor?: string | null
    }>
  } | null
  meta?: {
    updatedAt?: string | null
    confirmationToken?: string | null
  }
}

type FeedbackState = {
  tone: 'success' | 'warning' | 'danger'
  message: string
  code?: string | null
  details?: Array<{ message: string; suggestion?: string | null; anchor?: string | null }>
  traceId?: string | null
}

type Props = {
  category: CategoryDetail
  categories: CategoryParent[]
  media: CategoryMedia[]
  termSuggestions: string[]
  section: 'general' | 'media'
  initialRevision?: string | null
  initialUpdatedAt?: string | null
}

function termId(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR').replace(/[^a-z0-9à-ÿ]+/gi, '-').replace(/^-+|-+$/g, '') || 'termo'
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CategoryDetailEditor({ category, categories, media, termSuggestions, section, initialRevision, initialUpdatedAt }: Props) {
  const router = useRouter()
  const initialTerms = (category.searchTerms || []).map((item, index) => ({ id: `${termId(item.term || '')}-${index}`, value: item.term || '' })).filter((item) => item.value)
  const [terms, setTerms] = useState<TermItem[]>(initialTerms)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null)
  const revision = useRef<string | null>(initialRevision ?? null)
  const updatedAt = useRef<string | null>(initialUpdatedAt ?? null)
  const slugTouched = useRef(Boolean(category.slug))

  const [title, setTitle] = useState(category.title || '')
  const [slug, setSlug] = useState(category.slug || '')
  const [description, setDescription] = useState(category.description || '')
  const [status, setStatus] = useState(category.status || 'active')
  const [order, setOrder] = useState(String(category.order ?? 100))
  const [parent, setParent] = useState(String(relationId(category.parent) ?? ''))
  const [image, setImage] = useState(String(relationId(category.image) ?? ''))
  const [seoTitle, setSeoTitle] = useState(category.seo?.title || '')
  const [seoDescription, setSeoDescription] = useState(category.seo?.description || '')
  const [socialImage, setSocialImage] = useState(String(relationId(category.seo?.socialImage) ?? ''))
  const [noIndex, setNoIndex] = useState(Boolean(category.seo?.noIndex))

  const allTermItems = useMemo<TermItem[]>(() => {
    const values = [...termSuggestions, ...terms.map((item) => item.value)]
    const unique = values.filter(Boolean).filter((value, index) => values.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')) === index)
    const base = unique.map((value, index) => ({ id: `${termId(value)}-${index}`, value }))
    const trimmed = query.trim()
    const exact = base.some((item) => item.value.toLocaleLowerCase('pt-BR') === trimmed.toLocaleLowerCase('pt-BR'))
    return trimmed && !exact ? [...base, { id: `create:${trimmed.toLocaleLowerCase('pt-BR')}`, value: `Adicionar “${trimmed}”`, creatable: trimmed }] : base
  }, [query, termSuggestions, terms])

  function visibleData() {
    const parsedOrder = Number(order)
    return {
      title: title.trim(),
      slug: slug.trim(),
      description,
      status,
      order: Number.isInteger(parsedOrder) && parsedOrder >= 0 ? parsedOrder : 100,
      parent: parent || null,
      image: image || null,
      searchTerms: terms.map((item) => ({ term: item.value })),
      seo: {
        title: seoTitle,
        description: seoDescription,
        socialImage: socialImage || null,
        noIndex,
      },
    }
  }

  function applyError(error: unknown, fallback: string) {
    const normalized = normalizeAdminError(error, fallback)
    setFeedback({
      tone: 'danger',
      message: normalized.summary,
      code: normalized.code,
      details: [
        ...normalized.fieldErrors.map((issue) => ({
          message: issue.message,
          suggestion: issue.suggestion,
          anchor: issue.anchor,
        })),
        ...normalized.entityErrors.map((issue) => ({
          message: issue.message,
          suggestion: issue.suggestion,
        })),
      ],
      traceId: normalized.traceId,
    })
  }

  async function request(action: 'save-draft' | 'save-and-publish' | 'unpublish', token?: string | null) {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action,
          id: category.id,
          data: action === 'unpublish' ? undefined : visibleData(),
          expectedRevision: revision.current,
          expectedUpdatedAt: updatedAt.current,
          confirmationToken: token || undefined,
        }),
      })
      const result = await expectAdminResponse<AdminActionResult>(response, 'Não foi possível salvar a categoria.')
      revision.current = result.revision || revision.current
      updatedAt.current = result.meta?.updatedAt || updatedAt.current

      if (result.status === 'requires_confirmation') {
        const nextToken = result.meta?.confirmationToken || null
        setConfirmationToken(nextToken)
        setFeedback({
          tone: 'warning',
          message: result.message || 'Revise os avisos antes de publicar.',
          details: result.assessment?.issues
            ?.filter((issue) => issue.severity === 'warning')
            .map((issue) => ({ message: issue.message, suggestion: issue.suggestion, anchor: issue.anchor })),
        })
        return
      }

      setConfirmationToken(null)
      setFeedback({
        tone: 'success',
        message: result.message || (action === 'save-and-publish'
          ? 'Categoria publicada.'
          : action === 'unpublish'
          ? 'Categoria movida para rascunho.'
          : 'Rascunho salvo.'),
      })
      router.refresh()
    } catch (error) {
      applyError(error, 'Não foi possível salvar a categoria.')
    } finally {
      setBusy(false)
    }
  }

  function saveGeneral(event: React.FormEvent) {
    event.preventDefault()
    void request('save-draft')
  }

  function saveMedia(event: React.FormEvent) {
    event.preventDefault()
    void request('save-draft')
  }

  function addTerm(item: TermItem | null) {
    if (!item) return
    const value = (item.creatable || item.value).trim()
    if (value && !terms.some((term) => term.value.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'))) {
      setTerms([...terms, { id: `${termId(value)}-${Date.now()}`, value }])
    }
    setQuery('')
  }

  function changeTitle(value: string) {
    setTitle(value)
    if (!slugTouched.current) setSlug(slugify(value))
    setConfirmationToken(null)
  }

  function changeSlug(value: string) {
    slugTouched.current = true
    setSlug(slugify(value))
    setConfirmationToken(null)
  }

  const currentImage = media.find((item) => String(item.id) === image) || (typeof category.image === 'object' && category.image ? category.image : null)
  const currentImageURL = categoryImageURL(currentImage)

  return (
    <div className="esmera-category-editor">
      <div className="esmera-category-editor__state">
        <div>
          <Status tone={status === 'active' ? 'success' : 'neutral'}>{categoryStatusLabels[status] || status}</Status>
          <Status tone={category._status === 'published' ? 'info' : 'neutral'}>{category._status === 'published' ? 'Publicada' : 'Rascunho'}</Status>
        </div>
        <div className="esmera-actions">
          {category._status === 'published'
            ? <Button disabled={busy} onClick={() => void request('unpublish')}>Despublicar</Button>
            : confirmationToken
            ? <Button tone="primary" disabled={busy} onClick={() => void request('save-and-publish', confirmationToken)}>Confirmar publicação</Button>
            : <Button tone="primary" disabled={busy} onClick={() => void request('save-and-publish')}>Publicar</Button>}
          <a className="esmera-button esmera-button--quiet" href={`/admin/collections/categories/${category.id}`}>Admin técnico</a>
        </div>
      </div>

      {section === 'general' ? (
        <form className="esmera-category-form" onSubmit={saveGeneral}>
          <Field label="Nome"><input id="category-title" className="esmera-input" value={title} onChange={(event) => changeTitle(event.target.value)} required /></Field>
          <Field label="Slug" hint="Gerado pelo nome até ser editado manualmente."><input id="category-slug" className="esmera-input" value={slug} onChange={(event) => changeSlug(event.target.value)} required pattern="[a-z0-9-]+" /></Field>
          <Field label="Descrição" className="esmera-category-field--wide"><textarea className="esmera-input esmera-category-textarea" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></Field>
          <Field label="Categoria principal" hint="Ciclos em qualquer nível são rejeitados no servidor.">
            <select id="category-parent" className="esmera-input" value={parent} onChange={(event) => setParent(event.target.value)}>
              <option value="">Sem categoria principal</option>
              {categories.filter((item) => String(item.id) !== String(category.id)).map((item) => <option key={String(item.id)} value={String(item.id)}>{item.title || item.slug || item.id}</option>)}
            </select>
          </Field>
          <Field label="Status"><select id="category-status" className="esmera-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Ativa</option><option value="archive">Arquivada</option></select></Field>
          <details className="esmera-category-advanced esmera-category-field--wide">
            <summary>Ajustes avançados</summary>
            <Field label="Ordem editorial" hint="Normalmente controlada pela reordenação da lista."><input className="esmera-input" type="number" min="0" step="1" value={order} onChange={(event) => setOrder(event.target.value)} /></Field>
          </details>
          <div className="esmera-category-form__actions"><Button tone="primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar rascunho'}</Button></div>
        </form>
      ) : (
        <form className="esmera-category-form" onSubmit={saveMedia}>
          <div className="esmera-category-media-preview">
            {currentImageURL ? <img src={currentImageURL} alt={categoryImageAlt(currentImage)} /> : <div className="esmera-category-media-placeholder">Sem imagem</div>}
          </div>
          <Field label="Imagem da categoria" className="esmera-category-field--wide">
            <select id="category-image" className="esmera-input" value={image} onChange={(event) => setImage(event.target.value)}>
              <option value="">Sem imagem</option>
              {media.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.filename || item.alt || `Mídia ${item.id}`}</option>)}
            </select>
          </Field>

          <div className="esmera-category-field--wide">
            <label className="esmera-field-label" htmlFor={`category-terms-${category.id}`}>Taxonomia & sinônimos</label>
            <div className="esmera-category-chips" aria-label="Sinônimos atuais">
              {terms.map((item) => (
                <span className="esmera-category-chip" key={item.id}>
                  <span>{item.value}</span>
                  <button className="esmera-category-chip-remove" type="button" aria-label={`Remover ${item.value}`} onClick={() => setTerms((current) => current.filter((term) => term.id !== item.id))}>×</button>
                </span>
              ))}
            </div>
            <Combobox.Root
              items={allTermItems}
              inputValue={query}
              onInputValueChange={setQuery}
              itemToStringLabel={(item: TermItem) => item.value}
              onValueChange={addTerm}
            >
              <Combobox.InputGroup className="esmera-category-combobox">
                <Combobox.Input id={`category-terms-${category.id}`} className="esmera-category-combobox-input" placeholder="Adicionar sinônimo…" />
              </Combobox.InputGroup>
              <Combobox.Portal>
                <Combobox.Positioner className="esmera-combobox-positioner" sideOffset={6}>
                  <Combobox.Popup className="esmera-combobox-popup">
                    <Combobox.Empty className="esmera-select-item">Nenhuma sugestão.</Combobox.Empty>
                    <Combobox.List>
                      {(item: TermItem) => <Combobox.Item key={item.id} className="esmera-select-item" value={item}>{item.creatable ? `Adicionar “${item.creatable}”` : item.value}</Combobox.Item>}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <span className="esmera-field-hint">Digite um termo e escolha “Adicionar” para criar um novo sinônimo. Os chips possuem remoção explícita por teclado.</span>
          </div>

          <Field label="Título SEO"><input className="esmera-input" value={seoTitle} maxLength={60} onChange={(event) => setSeoTitle(event.target.value)} /></Field>
          <Field label="Descrição SEO" className="esmera-category-field--wide"><textarea className="esmera-input esmera-category-textarea" value={seoDescription} maxLength={160} rows={3} onChange={(event) => setSeoDescription(event.target.value)} /></Field>
          <Field label="Imagem social"><select className="esmera-input" value={socialImage} onChange={(event) => setSocialImage(event.target.value)}><option value="">Sem imagem social</option>{media.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.filename || item.alt || `Mídia ${item.id}`}</option>)}</select></Field>
          <label className="esmera-category-checkbox"><input type="checkbox" checked={noIndex} onChange={(event) => setNoIndex(event.target.checked)} /> Ocultar esta categoria dos buscadores</label>

          <div className="esmera-category-seo-preview esmera-category-field--wide" aria-label="Preview básico de snippet">
            <span>Preview de busca</span>
            <strong>{seoTitle || title || category.title || 'Título da categoria'}</strong>
            <small>/{slug || category.slug || 'categoria'}</small>
            <p>{seoDescription || description || category.description || 'Sem descrição SEO definida.'}</p>
          </div>
          <div className="esmera-category-form__actions"><Button tone="primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar rascunho'}</Button></div>
        </form>
      )}

      {feedback ? (
        <div className="esmera-products-feedback" role="status" aria-live="polite">
          <InlineFeedback tone={feedback.tone}>{feedback.message}</InlineFeedback>
          {feedback.code === 'revision_conflict' ? (
            <Button onClick={() => window.location.reload()}>Recarregar versão atual</Button>
          ) : null}
          {feedback.details?.length ? (
            <ul className="esmera-product-issues">
              {feedback.details.map((detail, index) => (
                <li key={`${detail.message}-${index}`}>
                  {detail.anchor ? <a href={`#${detail.anchor}`}>{detail.message}</a> : detail.message}
                  {detail.suggestion ? <small>{detail.suggestion}</small> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {feedback.traceId ? <small>Referência técnica: {feedback.traceId}</small> : null}
        </div>
      ) : null}
    </div>
  )
}
