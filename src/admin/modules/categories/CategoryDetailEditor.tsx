'use client'

import { Combobox } from '@base-ui/react/combobox'
import { useRouter } from 'next/navigation'
import React, { useMemo, useRef, useState } from 'react'

import {
  ActionBar,
  Button,
  ErrorSummary,
  FieldV2,
  FormShell,
  InlineFeedback,
  Status,
  type FormTab,
} from '../../design-system'
import type { AdminEntityError, AdminFieldError } from '../../state/asyncState'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import {
  categoryImageAlt,
  categoryImageURL,
  categoryStatusLabels,
  relationId,
  type CategoryDetail,
  type CategoryMedia,
  type CategoryParent,
  type CategoryTab,
  type CategoryWorkspaceFilters,
} from './types'

type TermItem = { id: string; value: string; creatable?: string }

type AdminActionResult = {
  status: 'saved' | 'published' | 'unpublished' | 'requires_confirmation'
  revision?: string | null
  message?: string
  assessment?: {
    issues?: Array<{
      code?: string
      severity?: 'blocker' | 'warning' | 'info'
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

// `scope` mantém o retorno do rascunho separado do retorno de publicação.
type FeedbackState = {
  scope: 'save' | 'publication'
  tone: 'success' | 'warning' | 'danger'
  message: string
  code?: string | null
  fieldErrors?: AdminFieldError[]
  entityErrors?: AdminEntityError[]
  warnings?: Array<{ message: string; suggestion?: string | null }>
  traceId?: string | null
}

export type CategoryEditorTab = 'content' | 'media' | 'related'

type Props = {
  category: CategoryDetail
  categories: CategoryParent[]
  media: CategoryMedia[]
  termSuggestions: string[]
  filters: CategoryWorkspaceFilters
  initialTab?: CategoryEditorTab
  initialRevision?: string | null
  initialUpdatedAt?: string | null
  /**
   * Consulta derivada (Products.categories) renderizada pelo carregador.
   * Entra como slot: nunca é copiada para o draft nem enviada em mutation.
   */
  relatedSection?: React.ReactNode
}

// Os dois primeiros ids são os do registry editorial de categoria; `related` é
// a consulta derivada, que não tem — nem pode ter — campo no registry.
const editorTabs: Array<FormTab & { id: CategoryEditorTab }> = [
  { id: 'content', label: 'Geral' },
  { id: 'media', label: 'Mídia & SEO' },
  { id: 'related', label: 'Produtos relacionados' },
]

// Inverso do mapeamento em CategoryDetailView.tsx (CategoryTab -> CategoryEditorTab):
// as abas precisam de um href real (`?tab=...`) para navegação/deep-link,
// além da troca instantânea no cliente.
const routeTabByEditorTab: Record<CategoryEditorTab, CategoryTab> = {
  content: 'general',
  media: 'media',
  related: 'products',
}

// A aba "Mídia & SEO" hospeda dois grupos do registry (`media` e `seo`) e a
// aba "Geral" hospeda `content` e `advanced`. Nenhum id novo é inventado.
const tabHost: Record<string, CategoryEditorTab> = {
  content: 'content',
  advanced: 'content',
  media: 'media',
  seo: 'media',
}

function termId(value: string) {
  return value.trim().toLocaleLowerCase('pt-BR').replace(/[^a-z0-9à-ÿ]+/gi, '-').replace(/^-+|-+$/g, '') || 'termo'
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function CategoryDetailEditor({
  category,
  categories,
  media,
  termSuggestions,
  filters,
  initialTab = 'content',
  initialRevision,
  initialUpdatedAt,
  relatedSection,
}: Props) {
  const router = useRouter()
  const initialTerms = (category.searchTerms || []).map((item, index) => ({ id: `${termId(item.term || '')}-${index}`, value: item.term || '' })).filter((item) => item.value)
  const [terms, setTerms] = useState<TermItem[]>(initialTerms)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [explicitFailure, setExplicitFailure] = useState(false)
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<CategoryEditorTab>(initialTab)
  const revision = useRef<string | null>(initialRevision ?? null)
  const updatedAt = useRef<string | null>(initialUpdatedAt ?? null)
  // Fila serial: publish aguarda o rascunho em voo antes de promover a revisão.
  const requestQueue = useRef<Promise<boolean>>(Promise.resolve(true))
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

  // Toda edição visível marca o formulário como sujo; o baseline volta a limpo
  // apenas quando o servidor confirma a gravação.
  function edited() {
    setDirty(true)
    setConfirmationToken(null)
  }

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

  function applyError(error: unknown, fallback: string, scope: FeedbackState['scope']) {
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
    // Toda requisição aqui parte de um clique: a falha é sempre explícita.
    setExplicitFailure(true)
  }

  async function runRequest(action: 'save-draft' | 'save-and-publish' | 'unpublish', token?: string | null): Promise<boolean> {
    setBusy(true)
    setFeedback(null)
    setExplicitFailure(false)
    const scope: FeedbackState['scope'] = action === 'save-draft' ? 'save' : 'publication'
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
        setConfirmationToken(result.meta?.confirmationToken || null)
        setFeedback({
          scope: 'publication',
          tone: 'warning',
          message: result.message || 'Revise os avisos antes de publicar.',
          warnings: result.assessment?.issues
            ?.filter((issue) => issue.severity === 'warning')
            .map((issue) => ({ message: issue.message, suggestion: issue.suggestion })),
        })
        return false
      }

      setConfirmationToken(null)
      // Baseline só avança com confirmação do servidor.
      setDirty(false)
      setFeedback({
        scope,
        tone: 'success',
        message: result.message || (action === 'save-and-publish'
          ? 'Categoria publicada.'
          : action === 'unpublish'
          ? 'Categoria movida para rascunho.'
          : 'Rascunho salvo.'),
      })
      router.refresh()
      return true
    } catch (error) {
      applyError(error, 'Não foi possível salvar a categoria.', scope)
      return false
    } finally {
      setBusy(false)
    }
  }

  function enqueue(run: () => Promise<boolean>): Promise<boolean> {
    const next = requestQueue.current.then(run, run)
    requestQueue.current = next
    return next
  }

  function saveDraft(): Promise<boolean> {
    if (busy) return requestQueue.current
    return enqueue(() => runRequest('save-draft'))
  }

  async function publish(token?: string | null) {
    if (busy) return
    // Publish nunca ultrapassa um rascunho em voo; e um save que falhou
    // interrompe a publicação.
    const flushed = dirty ? await saveDraft() : await requestQueue.current
    if (!flushed) return
    await enqueue(() => runRequest('save-and-publish', token))
  }

  function addTerm(item: TermItem | null) {
    if (!item) return
    const value = (item.creatable || item.value).trim()
    if (value && !terms.some((term) => term.value.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR'))) {
      setTerms([...terms, { id: `${termId(value)}-${Date.now()}`, value }])
      edited()
    }
    setQuery('')
  }

  function changeTitle(value: string) {
    setTitle(value)
    if (!slugTouched.current) setSlug(slugify(value))
    edited()
  }

  function changeSlug(value: string) {
    slugTouched.current = true
    setSlug(slugify(value))
    edited()
  }

  const fieldErrors = feedback?.fieldErrors || []
  const errorFor = (path: string) => fieldErrors.find((issue) => issue.path === path)?.message || null

  // Só troca de aba quando o registry aponta para um destino que existe aqui;
  // sem destino a issue permanece listada no resumo.
  const changeTab = (tab: string) => {
    const host = tabHost[tab]
    if (host) setActiveTab(host)
  }

  function tabHref(tabId: CategoryEditorTab) {
    const params = new URLSearchParams()
    params.set('status', filters.status)
    if (filters.q) params.set('q', filters.q)
    params.set('category', String(category.id))
    params.set('tab', routeTabByEditorTab[tabId])
    return `/admin/categories?${params.toString()}`
  }

  const tabs = editorTabs.map((tab) => ({
    ...tab,
    href: tabHref(tab.id),
    issues: fieldErrors.filter((issue) => issue.tab && tabHost[issue.tab] === tab.id).length || undefined,
  }))

  const currentImage = media.find((item) => String(item.id) === image) || (typeof category.image === 'object' && category.image ? category.image : null)
  const currentImageURL = categoryImageURL(currentImage)
  const published = category._status === 'published'
  const saveFeedback = feedback && feedback.scope === 'save' && feedback.tone !== 'danger' ? feedback : null
  const publicationFeedback = feedback && feedback.scope === 'publication' && feedback.tone !== 'danger' ? feedback : null

  return (
    <FormShell
      title="Edição da categoria"
      description="Salvar rascunho grava o estado visível. Salvar e publicar grava o mesmo estado e promove a revisão."
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => setActiveTab(tab === 'media' || tab === 'related' ? tab : 'content')}
      actions={
        <div className="esmera-category-editor__state">
          <Status tone={status === 'active' ? 'success' : 'neutral'}>{categoryStatusLabels[status] || status}</Status>
          <Status tone={published ? 'info' : 'neutral'}>{published ? 'Publicada' : 'Rascunho'}</Status>
        </div>
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

      {feedback?.code === 'revision_conflict' ? (
        <div className="esmera-category-conflict">
          <InlineFeedback tone="warning">
            Esta categoria foi alterada em outra sessão. Suas edições continuam nesta tela; recarregue para ver a versão atual antes de gravar.
          </InlineFeedback>
          <Button onClick={() => window.location.reload()}>Recarregar versão atual</Button>
        </div>
      ) : null}

      {activeTab === 'content' ? (
        <div className="esmera-category-form">
          <FieldV2 id="category-title" path="title" label="Nome" required error={errorFor('title')}>
            {(control) => <input {...control} className="esmera-input" value={title} onChange={(event) => changeTitle(event.target.value)} />}
          </FieldV2>
          <FieldV2 id="category-slug" path="slug" label="Slug" required hint="Gerado pelo nome até ser editado manualmente." error={errorFor('slug')}>
            {(control) => <input {...control} className="esmera-input" value={slug} pattern="[a-z0-9-]+" onChange={(event) => changeSlug(event.target.value)} />}
          </FieldV2>
          <FieldV2 path="description" label="Descrição" optional className="esmera-category-field--wide" error={errorFor('description')}>
            {(control) => <textarea {...control} className="esmera-input esmera-category-textarea" rows={5} value={description} onChange={(event) => { setDescription(event.target.value); edited() }} />}
          </FieldV2>
          <FieldV2 id="category-parent" path="parent" label="Categoria principal" hint="Ciclos em qualquer nível são rejeitados no servidor." error={errorFor('parent')}>
            {(control) => (
              <select {...control} className="esmera-input" value={parent} onChange={(event) => { setParent(event.target.value); edited() }}>
                <option value="">Sem categoria principal</option>
                {categories.filter((item) => String(item.id) !== String(category.id)).map((item) => <option key={String(item.id)} value={String(item.id)}>{item.title || item.slug || item.id}</option>)}
              </select>
            )}
          </FieldV2>
          <FieldV2 id="category-status" path="status" label="Status" error={errorFor('status')}>
            {(control) => (
              <select {...control} className="esmera-input" value={status} onChange={(event) => { setStatus(event.target.value); edited() }}>
                <option value="active">Ativa</option>
                <option value="archive">Arquivada</option>
              </select>
            )}
          </FieldV2>
          <details className="esmera-category-advanced esmera-category-field--wide">
            <summary>Ajustes avançados</summary>
            <FieldV2 id="category-order" path="order" label="Ordem editorial" hint="Normalmente controlada pela reordenação da lista." error={errorFor('order')}>
              {(control) => <input {...control} className="esmera-input" type="number" min="0" step="1" value={order} onChange={(event) => { setOrder(event.target.value); edited() }} />}
            </FieldV2>
          </details>
        </div>
      ) : null}

      {activeTab === 'media' ? (
        <div className="esmera-category-form">
          <div className="esmera-category-media-preview">
            {currentImageURL ? <img src={currentImageURL} alt={categoryImageAlt(currentImage)} /> : <div className="esmera-category-media-placeholder">Sem imagem</div>}
          </div>
          <FieldV2 id="category-image" path="image" label="Imagem da categoria" className="esmera-category-field--wide" error={errorFor('image')}>
            {(control) => (
              <select {...control} className="esmera-input" value={image} onChange={(event) => { setImage(event.target.value); edited() }}>
                <option value="">Sem imagem</option>
                {media.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.filename || item.alt || `Mídia ${item.id}`}</option>)}
              </select>
            )}
          </FieldV2>

          <div className="esmera-category-field--wide">
            <label className="esmera-field-label" htmlFor={`category-terms-${category.id}`}>Taxonomia & sinônimos</label>
            <div className="esmera-category-chips" aria-label="Sinônimos atuais">
              {terms.map((item) => (
                <span className="esmera-category-chip" key={item.id}>
                  <span>{item.value}</span>
                  <button className="esmera-category-chip-remove" type="button" aria-label={`Remover ${item.value}`} onClick={() => { setTerms((current) => current.filter((term) => term.id !== item.id)); edited() }}>×</button>
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

          <FieldV2 id="category-seo" path="seo" label="Título SEO" optional error={errorFor('seo')}>
            {(control) => <input {...control} className="esmera-input" maxLength={60} value={seoTitle} onChange={(event) => { setSeoTitle(event.target.value); edited() }} />}
          </FieldV2>
          <FieldV2 path="seo.description" label="Descrição SEO" optional className="esmera-category-field--wide" error={errorFor('seo.description')}>
            {(control) => <textarea {...control} className="esmera-input esmera-category-textarea" maxLength={160} rows={3} value={seoDescription} onChange={(event) => { setSeoDescription(event.target.value); edited() }} />}
          </FieldV2>
          <FieldV2 path="seo.socialImage" label="Imagem social" optional error={errorFor('seo.socialImage')}>
            {(control) => (
              <select {...control} className="esmera-input" value={socialImage} onChange={(event) => { setSocialImage(event.target.value); edited() }}>
                <option value="">Sem imagem social</option>
                {media.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.filename || item.alt || `Mídia ${item.id}`}</option>)}
              </select>
            )}
          </FieldV2>
          <label className="esmera-category-checkbox"><input type="checkbox" checked={noIndex} onChange={(event) => { setNoIndex(event.target.checked); edited() }} /> Ocultar esta categoria dos buscadores</label>

          <div className="esmera-category-seo-preview esmera-category-field--wide" aria-label="Preview básico de snippet">
            <span>Preview de busca</span>
            <strong>{seoTitle || title || category.title || 'Título da categoria'}</strong>
            <small>/{slug || category.slug || 'categoria'}</small>
            <p>{seoDescription || description || category.description || 'Sem descrição SEO definida.'}</p>
          </div>
        </div>
      ) : null}

      {activeTab === 'related' ? relatedSection : null}

      <div className="esmera-category-editor__save-feedback">
        {saveFeedback ? <InlineFeedback tone={saveFeedback.tone}>{saveFeedback.message}</InlineFeedback> : null}
      </div>

      <div className="esmera-category-editor__publication-feedback">
        {publicationFeedback ? (
          <>
            <InlineFeedback tone={publicationFeedback.tone}>{publicationFeedback.message}</InlineFeedback>
            {publicationFeedback.warnings?.length ? (
              <ul className="esmera-product-issues">
                {publicationFeedback.warnings.map((warning, index) => (
                  <li key={`${warning.message}-${index}`}>
                    {warning.message}
                    {warning.suggestion ? <small>{warning.suggestion}</small> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>

      <ActionBar
        dirty={dirty}
        saving={busy}
        published={published}
        publishLabel={confirmationToken ? 'Confirmar publicação' : 'Salvar e publicar'}
        onSave={() => void saveDraft()}
        onPublish={() => void publish(confirmationToken)}
        onUnpublish={() => void enqueue(() => runRequest('unpublish'))}
        secondary={<a className="esmera-button esmera-button--quiet" href={`/admin/collections/categories/${category.id}`}>Admin técnico</a>}
      />
    </FormShell>
  )
}
