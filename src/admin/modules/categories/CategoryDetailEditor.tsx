'use client'

import { Combobox } from '@base-ui/react/combobox'
import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { Button, Field, Status } from '../../design-system'
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

type Props = {
  category: CategoryDetail
  categories: CategoryParent[]
  media: CategoryMedia[]
  termSuggestions: string[]
  section: 'general' | 'media'
}

function termId(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR').replace(/[^a-z0-9à-ÿ]+/gi, '-').replace(/^-+|-+$/g, '') || 'termo'
}

export function CategoryDetailEditor({ category, categories, media, termSuggestions, section }: Props) {
  const router = useRouter()
  const initialTerms = (category.searchTerms || []).map((item, index) => ({ id: `${termId(item.term || '')}-${index}`, value: item.term || '' })).filter((item) => item.value)
  const [terms, setTerms] = useState<TermItem[]>(initialTerms)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

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

  async function request(action: 'save-draft' | 'publish' | 'unpublish', data?: Record<string, unknown>) {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action, id: category.id, data }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar a categoria.')
      setFeedback(action === 'publish' ? 'Categoria publicada.' : action === 'unpublish' ? 'Categoria movida para rascunho.' : 'Rascunho salvo.')
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar a categoria.')
    } finally {
      setBusy(false)
    }
  }

  function saveGeneral(event: React.FormEvent) {
    event.preventDefault()
    const parsedOrder = Number(order)
    void request('save-draft', {
      title: title.trim(),
      slug: slug.trim(),
      description,
      status,
      order: Number.isInteger(parsedOrder) && parsedOrder >= 0 ? parsedOrder : 100,
      parent: parent || null,
    })
  }

  function saveMedia(event: React.FormEvent) {
    event.preventDefault()
    void request('save-draft', {
      image: image || null,
      searchTerms: terms.map((item) => ({ term: item.value })),
      seo: {
        title: seoTitle,
        description: seoDescription,
        socialImage: socialImage || null,
        noIndex,
      },
    })
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
          {category._status === 'published' ? <Button disabled={busy} onClick={() => void request('unpublish')}>Despublicar</Button> : <Button tone="primary" disabled={busy} onClick={() => void request('publish')}>Publicar</Button>}
          <a className="esmera-button esmera-button--quiet" href={`/admin/collections/categories/${category.id}`}>Admin técnico</a>
        </div>
      </div>

      {section === 'general' ? (
        <form className="esmera-category-form" onSubmit={saveGeneral}>
          <Field label="Nome"><input className="esmera-input" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
          <Field label="Slug" hint="URL estável: letras minúsculas, números e hífens."><input className="esmera-input" value={slug} onChange={(event) => setSlug(event.target.value)} required pattern="[a-z0-9-]+" /></Field>
          <Field label="Descrição" className="esmera-category-field--wide"><textarea className="esmera-input esmera-category-textarea" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></Field>
          <Field label="Categoria principal" hint="Ciclos são rejeitados no servidor.">
            <select className="esmera-input" value={parent} onChange={(event) => setParent(event.target.value)}>
              <option value="">Sem categoria principal</option>
              {categories.filter((item) => String(item.id) !== String(category.id)).map((item) => <option key={String(item.id)} value={String(item.id)}>{item.title || item.slug || item.id}</option>)}
            </select>
          </Field>
          <Field label="Status"><select className="esmera-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Ativa</option><option value="archive">Arquivada</option></select></Field>
          <Field label="Ordem editorial" hint="A lista normaliza a ordem automaticamente ao reordenar."><input className="esmera-input" type="number" min="0" step="1" value={order} onChange={(event) => setOrder(event.target.value)} /></Field>
          <div className="esmera-category-form__actions"><Button tone="primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar rascunho'}</Button></div>
        </form>
      ) : (
        <form className="esmera-category-form" onSubmit={saveMedia}>
          <div className="esmera-category-media-preview">
            {currentImageURL ? <img src={currentImageURL} alt={categoryImageAlt(currentImage)} /> : <div className="esmera-category-media-placeholder">Sem imagem</div>}
          </div>
          <Field label="Imagem da categoria" className="esmera-category-field--wide">
            <select className="esmera-input" value={image} onChange={(event) => setImage(event.target.value)}>
              <option value="">Sem imagem</option>
              {media.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.filename || item.alt || `Mídia ${item.id}`}</option>)}
            </select>
          </Field>

          <div className="esmera-category-field--wide">
            <label className="esmera-field-label" htmlFor={`category-terms-${category.id}`}>Taxonomia & sinônimos</label>
            <Combobox.Root
              items={allTermItems}
              multiple
              value={terms}
              inputValue={query}
              onInputValueChange={setQuery}
              itemToStringLabel={(item: TermItem) => item.value}
              onValueChange={(next) => {
                const creatable = next.find((item) => item.creatable)
                if (creatable?.creatable) {
                  const value = creatable.creatable.trim()
                  if (value && !terms.some((item) => item.value.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'))) {
                    setTerms([...terms, { id: `${termId(value)}-${Date.now()}`, value }])
                  }
                  setQuery('')
                  return
                }
                setTerms(next.filter((item) => !item.creatable))
                setQuery('')
              }}
            >
              <Combobox.InputGroup className="esmera-category-combobox">
                <Combobox.Chips className="esmera-category-chips">
                  <Combobox.Value>
                    {(value: TermItem[]) => <>
                      {value.map((item) => <Combobox.Chip key={item.id} className="esmera-category-chip" aria-label={item.value}>{item.value}<Combobox.ChipRemove className="esmera-category-chip-remove" aria-label={`Remover ${item.value}`}>×</Combobox.ChipRemove></Combobox.Chip>)}
                      <Combobox.Input id={`category-terms-${category.id}`} className="esmera-category-combobox-input" placeholder={value.length ? 'Adicionar outro…' : 'Adicionar sinônimo…'} />
                    </>}
                  </Combobox.Value>
                </Combobox.Chips>
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
            <span className="esmera-field-hint">Digite um termo e escolha “Adicionar” para criar um novo sinônimo. Os chips podem ser removidos por teclado.</span>
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

      {feedback ? <div className="esmera-products-feedback" role="status" aria-live="polite">{feedback}</div> : null}
    </div>
  )
}
