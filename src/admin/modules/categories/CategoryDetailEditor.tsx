'use client'

import { Combobox } from '@base-ui/react/combobox'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
  ActionBar,
  Button,
  ErrorSummary,
  FieldV2,
  FormShell,
  InlineFeedback,
  Status,
} from '../../design-system'
import type { AdminEntityError, AdminFieldError } from '../../state/asyncState'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import { getCategoryDepth, indexCategoriesById, moveWithinSiblings, orderCategoriesHierarchically, siblingsOf } from './hierarchy'
import {
  categoryImageAlt,
  categoryImageURL,
  categoryStatePills,
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

type Props = {
  category: CategoryDetail
  categories: CategoryParent[]
  media: CategoryMedia[]
  termSuggestions: string[]
  initialRevision?: string | null
  initialUpdatedAt?: string | null
  /**
   * Consulta derivada (Products.categories) renderizada pelo carregador.
   * Entra como slot: nunca é copiada para o draft nem enviada em mutation.
   */
  relatedSection?: React.ReactNode
}

// Grupos de erro cujos campos moram em "Configurações avançadas".
const advancedIssueTabs = new Set(['advanced', 'seo'])
const advancedFieldPaths = /^(slug|status|nodeType|taxonomyAxis|menu\.|listingMode|listingRules|collectionPage|externalURL|hubPath|seo)/

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
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [positionBusy, setPositionBusy] = useState(false)
  const [positionError, setPositionError] = useState<string | null>(null)
  const revision = useRef<string | null>(initialRevision ?? null)
  const updatedAt = useRef<string | null>(initialUpdatedAt ?? null)
  // Fila serial: publish aguarda o rascunho em voo antes de promover a revisão.
  const requestQueue = useRef<Promise<boolean>>(Promise.resolve(true))
  const slugTouched = useRef(Boolean(category.slug))

  const [title, setTitle] = useState(category.title || '')
  const [slug, setSlug] = useState(category.slug || '')
  const [description, setDescription] = useState(category.description || '')
  const [status, setStatus] = useState(category.status || 'active')
  const [parent, setParent] = useState(String(relationId(category.parent) ?? ''))
  const [image, setImage] = useState(String(relationId(category.image) ?? ''))
  const [seoTitle, setSeoTitle] = useState(category.seo?.title || '')
  const [seoDescription, setSeoDescription] = useState(category.seo?.description || '')
  const [socialImage, setSocialImage] = useState(String(relationId(category.seo?.socialImage) ?? ''))
  const [noIndex, setNoIndex] = useState(Boolean(category.seo?.noIndex))
  const [nodeType, setNodeType] = useState(category.nodeType || 'collection')
  const [taxonomyAxis, setTaxonomyAxis] = useState(category.taxonomyAxis || 'navigation')
  const [showInMenu, setShowInMenu] = useState(Boolean(category.menu?.showInMenu))
  const [menuLabel, setMenuLabel] = useState(category.menu?.label || '')
  const [menuVisibility, setMenuVisibility] = useState(category.menu?.visibility || 'all')
  const [listingMode, setListingMode] = useState(category.listingMode || 'assigned')
  const [ruleAvailability, setRuleAvailability] = useState<string[]>(category.listingRules?.availability || [])
  const [defaultSort, setDefaultSort] = useState(category.collectionPage?.defaultSort || 'editorial')
  const [productsPerPage, setProductsPerPage] = useState(String(category.collectionPage?.productsPerPage ?? 24))
  const [visibleFilters, setVisibleFilters] = useState<string[]>(category.collectionPage?.visibleFilters || ['category', 'material', 'availability', 'price'])
  const [showProductCount, setShowProductCount] = useState(category.collectionPage?.showProductCount !== false)
  const [collectionLayout, setCollectionLayout] = useState(category.collectionPage?.layout || 'grid')
  const [externalURL, setExternalURL] = useState(category.externalURL || '')
  const [hubPath, setHubPath] = useState(category.hubPath || '')

  // Reordenar muda a revisão fora deste formulário; sem isso o próximo salvar
  // acusaria conflito falso. Com edição em andamento, o conflito é real.
  useEffect(() => {
    if (dirty) return
    if (initialRevision) revision.current = initialRevision
    if (initialUpdatedAt) updatedAt.current = initialUpdatedAt
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dirty` só decide se o novo baseline vale.
  }, [initialRevision, initialUpdatedAt])

  const allTermItems = useMemo<TermItem[]>(() => {
    const values = [...termSuggestions, ...terms.map((item) => item.value)]
    const unique = values.filter(Boolean).filter((value, index) => values.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')) === index)
    const base = unique.map((value, index) => ({ id: `${termId(value)}-${index}`, value }))
    const trimmed = query.trim()
    const exact = base.some((item) => item.value.toLocaleLowerCase('pt-BR') === trimmed.toLocaleLowerCase('pt-BR'))
    return trimmed && !exact ? [...base, { id: `create:${trimmed.toLocaleLowerCase('pt-BR')}`, value: `Adicionar “${trimmed}”`, creatable: trimmed }] : base
  }, [query, termSuggestions, terms])

  // Opções de "Categoria principal" na mesma pré-ordem hierárquica da lista.
  // `<option>` não aceita recuo por CSS, então a profundidade vira prefixo
  // textual. A profundidade é calculada sobre o conjunto completo (com a própria
  // categoria) para nesting correto; a própria é omitida na renderização.
  const parentOptions = useMemo(() => {
    const byId = indexCategoriesById(categories)
    return orderCategoriesHierarchically(categories).map((item) => ({
      id: item.id,
      label: item.title || item.slug || String(item.id),
      depth: getCategoryDepth(item, byId),
    }))
  }, [categories])

  // Toda edição visível marca o formulário como sujo; o baseline volta a limpo
  // apenas quando o servidor confirma a gravação.
  function edited() {
    setDirty(true)
    setConfirmationToken(null)
  }

  function visibleData() {
    const parsedProductsPerPage = Number(productsPerPage)
    return {
      title: title.trim(),
      slug: slug.trim(),
      description,
      status,
      nodeType,
      taxonomyAxis,
      menu: { showInMenu, label: menuLabel.trim(), visibility: menuVisibility },
      listingMode,
      listingRules: {
        availability: ruleAvailability,
        productStatus: ['active'],
        sort: defaultSort,
      },
      collectionPage: {
        visibleFilters,
        defaultSort,
        productsPerPage: Number.isInteger(parsedProductsPerPage) && parsedProductsPerPage >= 1 && parsedProductsPerPage <= 48 ? parsedProductsPerPage : 24,
        showProductCount,
        layout: collectionLayout,
      },
      externalURL: externalURL.trim() || null,
      hubPath: hubPath.trim() || null,
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

  // A issue abre a área avançada só quando o campo apontado mora nela.
  const changeTab = (tab: string) => {
    if (advancedIssueTabs.has(tab) || (tab === 'content' && fieldErrors.some((issue) => advancedFieldPaths.test(issue.path || '')))) {
      setAdvancedOpen(true)
    }
  }

  const hierarchy = orderCategoriesHierarchically(categories)
  const siblings = siblingsOf(hierarchy, category.id)
  const position = siblings.findIndex((item) => String(item.id) === String(category.id))
  const parentCategory = categories.find((item) => String(item.id) === parent)

  async function changePosition(targetIndex: number) {
    const next = moveWithinSiblings(hierarchy, category.id, targetIndex)
    if (!next) return
    setPositionBusy(true)
    setPositionError(null)
    try {
      const response = await fetch('/api/admin-categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderedIds: next.map((item) => item.id) }),
      })
      if (!response.ok) throw new Error('reorder_failed')
      router.refresh()
    } catch {
      setPositionError('Não foi possível mudar a posição. Tente novamente.')
    } finally {
      setPositionBusy(false)
    }
  }

  const currentImage = media.find((item) => String(item.id) === image) || (typeof category.image === 'object' && category.image ? category.image : null)
  const currentImageURL = categoryImageURL(currentImage)
  const published = category._status === 'published'
  const hasPublicVersion = category.published ?? published
  const pills = categoryStatePills({ status, _status: category._status, published: category.published, menu: { showInMenu } })
  const parentName = parentCategory?.title || parentCategory?.slug
  const menuNotice = !showInMenu
    ? 'A categoria continua no site, nos filtros e nos produtos. Só não aparece no menu.'
    : parentCategory && parentCategory.published === false
    ? `A categoria principal “${parentName}” está em rascunho. Enquanto isso, esta aparece direto no menu principal.`
    : parentCategory && !parentCategory.menu?.showInMenu
    ? `A categoria principal “${parentName}” está oculta do menu. Enquanto isso, esta aparece direto no menu principal.`
    : null
  const saveFeedback = feedback && feedback.scope === 'save' && feedback.tone !== 'danger' ? feedback : null
  const publicationFeedback = feedback && feedback.scope === 'publication' && feedback.tone !== 'danger' ? feedback : null

  return (
    <FormShell
      title="Edição da categoria"
      description="Preencha o essencial e use Salvar e publicar para enviar ao site."
      actions={
        <div className="esmera-category-editor__state">
          {pills.map((pill) => <Status key={pill.label} tone={pill.tone}>{pill.label}</Status>)}
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

      <div className="esmera-category-form">
        <FieldV2 id="category-title" path="title" label="Nome" required error={errorFor('title')}>
          {(control) => <input {...control} className="esmera-input" value={title} onChange={(event) => changeTitle(event.target.value)} />}
        </FieldV2>
        <FieldV2 id="category-parent" path="parent" label="Categoria principal" hint="Deixe em branco para aparecer direto no menu principal." error={errorFor('parent')}>
          {(control) => (
            <select {...control} className="esmera-input" value={parent} onChange={(event) => { setParent(event.target.value); edited() }}>
              <option value="">Sem categoria principal</option>
              {parentOptions.filter((item) => String(item.id) !== String(category.id)).map((item) => <option key={String(item.id)} value={String(item.id)}>{item.depth > 0 ? `${' '.repeat(item.depth)}↳ ${item.label}` : item.label}</option>)}
            </select>
          )}
        </FieldV2>
        <FieldV2 path="description" label="Descrição" optional className="esmera-category-field--wide" error={errorFor('description')}>
          {(control) => <textarea {...control} className="esmera-input esmera-category-textarea" rows={4} value={description} onChange={(event) => { setDescription(event.target.value); edited() }} />}
        </FieldV2>
        <div className="esmera-category-media-preview">
          {currentImageURL ? <img src={currentImageURL} alt={categoryImageAlt(currentImage)} /> : <div className="esmera-category-media-placeholder">Sem imagem</div>}
        </div>
        <FieldV2 id="category-image" path="image" label="Imagem" optional error={errorFor('image')}>
          {(control) => (
            <select {...control} className="esmera-input" value={image} onChange={(event) => { setImage(event.target.value); edited() }}>
              <option value="">Sem imagem</option>
              {media.map((item) => <option key={String(item.id)} value={String(item.id)}>{item.filename || item.alt || `Mídia ${item.id}`}</option>)}
            </select>
          )}
        </FieldV2>

        <div className="esmera-category-menu-toggle esmera-category-field--wide">
          <label className="esmera-category-checkbox">
            <input type="checkbox" checked={showInMenu} onChange={(event) => { setShowInMenu(event.target.checked); edited() }} /> Exibir no menu
          </label>
          {menuNotice ? <p className="esmera-field-hint">{menuNotice}</p> : null}
        </div>

        {position >= 0 && siblings.length > 1 ? (
          <FieldV2 id="category-position" path="order" label="Ordem de exibição" hint={dirty ? 'Salve as alterações antes de mudar a posição.' : 'Posição entre as categorias do mesmo nível.'} error={positionError}>
            {(control) => (
              <select {...control} className="esmera-input" value={position} disabled={dirty || busy || positionBusy} onChange={(event) => void changePosition(Number(event.target.value))}>
                {siblings.map((item, index) => <option key={String(item.id)} value={index}>{index + 1}º {index === position ? '(posição atual)' : `no lugar de ${item.title || item.slug || item.id}`}</option>)}
              </select>
            )}
          </FieldV2>
        ) : null}

        <div className="esmera-category-field--wide esmera-category-products">{relatedSection}</div>

        <details className="esmera-category-advanced esmera-category-field--wide" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
          <summary>
            <span className="esmera-category-advanced__title">Configurações avançadas</span>
            <span className="esmera-category-advanced__tag">Opcional</span>
          </summary>
          {advancedOpen ? (
            <div className="esmera-category-advanced__body">
              <FieldV2 id="category-slug" path="slug" label="Endereço (slug)" hint="Criado a partir do nome. Mudar quebra links já divulgados." error={errorFor('slug')}>
                {(control) => <input {...control} className="esmera-input" value={slug} pattern="[a-z0-9-]+" onChange={(event) => changeSlug(event.target.value)} />}
              </FieldV2>
              <FieldV2 id="category-status" path="status" label="Situação" error={errorFor('status')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={status} onChange={(event) => { setStatus(event.target.value); edited() }}>
                    <option value="active">Ativa</option>
                    <option value="archive">Arquivada</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="nodeType" label="Tipo do nó" error={errorFor('nodeType')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={nodeType} onChange={(event) => { setNodeType(event.target.value as typeof nodeType); edited() }}>
                    <option value="collection">Coleção com produtos</option>
                    <option value="editorial">Página editorial</option>
                    <option value="external">Link externo</option>
                    <option value="group">Agrupador de navegação</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="taxonomyAxis" label="Eixo taxonômico" error={errorFor('taxonomyAxis')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={taxonomyAxis} onChange={(event) => { setTaxonomyAxis(event.target.value as typeof taxonomyAxis); edited() }}>
                    <option value="navigation">Navegação</option>
                    <option value="piece_type">Tipo de peça</option>
                    <option value="collection">Coleção</option>
                    <option value="environment">Ambiente</option>
                    <option value="campaign">Campanha</option>
                    <option value="service">Serviço</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="menu.label" label="Rótulo no menu" optional error={errorFor('menu.label')}>
                {(control) => <input {...control} className="esmera-input" value={menuLabel} onChange={(event) => { setMenuLabel(event.target.value); edited() }} />}
              </FieldV2>
              <FieldV2 path="menu.visibility" label="Visibilidade no menu" error={errorFor('menu.visibility')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={menuVisibility} onChange={(event) => { setMenuVisibility(event.target.value as typeof menuVisibility); edited() }}>
                    <option value="all">Desktop e mobile</option>
                    <option value="desktop">Somente desktop</option>
                    <option value="mobile">Somente mobile</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="listingMode" label="Modo de listagem" error={errorFor('listingMode')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={listingMode} onChange={(event) => { setListingMode(event.target.value as typeof listingMode); edited() }}>
                    <option value="assigned">Produtos atribuídos</option>
                    <option value="descendants">Categoria e descendentes</option>
                    <option value="rules">Regras automáticas</option>
                    <option value="hybrid">Atribuídos + regras</option>
                  </select>
                )}
              </FieldV2>
              {(listingMode === 'rules' || listingMode === 'hybrid') ? (
                <fieldset className="esmera-category-options esmera-category-field--wide">
                  <legend>Disponibilidade usada pela regra</legend>
                  {[
                    ['available', 'Disponível'],
                    ['unique', 'Peça única'],
                    ['limited', 'Disponibilidade limitada'],
                    ['made_to_order', 'Sob encomenda'],
                  ].map(([value, label]) => (
                    <label key={value} className="esmera-category-checkbox">
                      <input type="checkbox" checked={ruleAvailability.includes(value)} onChange={(event) => { setRuleAvailability((current) => event.target.checked ? [...new Set([...current, value])] : current.filter((item) => item !== value)); edited() }} /> {label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <FieldV2 path="collectionPage.defaultSort" label="Ordenação padrão" error={errorFor('collectionPage.defaultSort')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={defaultSort} onChange={(event) => { setDefaultSort(event.target.value as typeof defaultSort); edited() }}>
                    <option value="editorial">Editorial</option>
                    <option value="newest">Mais recentes</option>
                    <option value="price_asc">Menor preço</option>
                    <option value="price_desc">Maior preço</option>
                    <option value="name_asc">Nome</option>
                  </select>
                )}
              </FieldV2>
              <FieldV2 path="collectionPage.productsPerPage" label="Produtos por página" hint="Use entre 1 e 48." error={errorFor('collectionPage.productsPerPage')}>
                {(control) => <input {...control} className="esmera-input" type="number" min="1" max="48" step="1" value={productsPerPage} onChange={(event) => { setProductsPerPage(event.target.value); edited() }} />}
              </FieldV2>
              <FieldV2 path="collectionPage.layout" label="Layout da coleção" error={errorFor('collectionPage.layout')}>
                {(control) => (
                  <select {...control} className="esmera-input" value={collectionLayout} onChange={(event) => { setCollectionLayout(event.target.value as typeof collectionLayout); edited() }}>
                    <option value="grid">Grade regular</option>
                    <option value="editorial">Grade com inserções editoriais</option>
                  </select>
                )}
              </FieldV2>
              <label className="esmera-category-checkbox"><input type="checkbox" checked={showProductCount} onChange={(event) => { setShowProductCount(event.target.checked); edited() }} /> Exibir contagem de produtos</label>
              <fieldset className="esmera-category-options esmera-category-field--wide">
                <legend>Filtros disponíveis na página</legend>
                {[
                  ['category', 'Categoria'], ['collection', 'Coleção'], ['environment', 'Ambiente'], ['piece_type', 'Tipo de peça'],
                  ['material', 'Material'], ['availability', 'Disponibilidade'], ['price', 'Preço'],
                ].map(([value, label]) => (
                  <label key={value} className="esmera-category-checkbox">
                    <input type="checkbox" checked={visibleFilters.includes(value)} onChange={(event) => { setVisibleFilters((current) => event.target.checked ? [...new Set([...current, value])] : current.filter((item) => item !== value)); edited() }} /> {label}
                  </label>
                ))}
              </fieldset>
              {nodeType === 'external' ? (
                <FieldV2 path="externalURL" label="URL externa" className="esmera-category-field--wide" error={errorFor('externalURL')}>
                  {(control) => <input {...control} className="esmera-input" type="url" value={externalURL} onChange={(event) => { setExternalURL(event.target.value); edited() }} />}
                </FieldV2>
              ) : null}
              {nodeType === 'group' ? (
                <FieldV2 path="hubPath" label="Rota opcional do agrupador" className="esmera-category-field--wide" error={errorFor('hubPath')}>
                  {(control) => <input {...control} className="esmera-input" placeholder="/colecao/pecas" value={hubPath} onChange={(event) => { setHubPath(event.target.value); edited() }} />}
                </FieldV2>
              ) : null}
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

              <div className="esmera-category-editorial-callout esmera-category-field--wide">
                <div>
                  <strong>Conteúdo editorial e destaques do mega menu</strong>
                  <p>Os blocos são controlados pelo schema e permanecem nesta aba. Use o editor técnico para montar galerias, texto com imagem, manifestos, CTAs e destaques.</p>
                </div>
                <a className="esmera-button esmera-button--quiet" href={`/admin/collections/categories/${category.id}`}>Abrir editor técnico</a>
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
        </details>
      </div>

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
        publicationBlocked={published && !dirty}
        savedLabel={published ? 'Tudo publicado' : 'Rascunho salvo'}
        publishLabel={confirmationToken ? 'Confirmar publicação' : 'Salvar e publicar'}
        onSave={() => void saveDraft()}
        onPublish={() => void publish(confirmationToken)}
        secondary={hasPublicVersion ? <Button disabled={busy} onClick={() => void enqueue(() => runRequest('unpublish'))}>Despublicar</Button> : null}
      />
    </FormShell>
  )
}
