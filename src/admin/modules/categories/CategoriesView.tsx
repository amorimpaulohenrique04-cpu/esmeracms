/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import { Suspense } from 'react'
import type { AdminViewServerProps, Where } from 'payload'

import { LoadingState } from '../../design-system'
import {
  AccessDenied,
  countDocs,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  ViewFrame,
} from '../../views/shared'
import { createDocumentRevision } from '../../../server/publication/revision'
import { CategoriesMasterList } from './CategoriesMasterList'
import { CategoryCreateDialog } from './CategoryCreateDialog'
import { CategoryDetailView } from './CategoryDetailView'
import { CategoryRelatedProductsPanel } from './CategoryRelatedProductsPanel'
import {
  collectParentIds,
  getCategoryDepth,
  indexCategoriesById,
  orderCategoriesHierarchically,
} from './hierarchy'
import { relationId } from './types'
import {
  matchesCategoryView,
  type CategoryDetail,
  type CategoryListItem,
  type CategoryMedia,
  type CategoryParent,
  type CategoryView,
  type CategoryWorkspaceFilters,
} from './types'
import './categories.scss'
import './category-create-dialog.scss'

const categoryViews: CategoryView[] = ['all', 'published', 'draft', 'hidden']

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function filtersFrom(params: Record<string, string | string[] | undefined>): CategoryWorkspaceFilters {
  const view = first(params.view) as CategoryView | undefined
  return {
    q: (first(params.q) || '').trim().slice(0, 100),
    status: first(params.status) === 'archive' ? 'archive' : 'active',
    view: view && categoryViews.includes(view) ? view : 'all',
  }
}

function whereFrom(filters: CategoryWorkspaceFilters): Where {
  const and: Where[] = [{ status: { equals: filters.status } } as Where]
  if (filters.q) {
    and.push({
      or: [
        { title: { like: filters.q } },
        { slug: { like: filters.q } },
        { 'searchTerms.term': { like: filters.q } },
      ],
    } as Where)
  }
  return { and } as Where
}

async function selectedDetail(props: AdminViewServerProps, categoryId: string) {
  // depth: 2 matches admin-categories/route.ts's readCurrent/saveDraft/readDraft —
  // createDocumentRevision() hashes the resolved relationship shape, so a
  // mismatched depth here would make every first save 409 with a false conflict.
  const category = await props.initPageResult.req.payload.findByID({
    collection: 'categories',
    id: categoryId,
    depth: 2,
    draft: true,
    overrideAccess: false,
    user: props.initPageResult.req.user,
    req: props.initPageResult.req,
  }) as unknown as CategoryDetail
  return { ...category, revision: createDocumentRevision(category) }
}

export async function CategoriesView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />

  const params = await paramsOf(props)
  const filters = filtersFrom(params)
  const categoryId = first(params.category)
  const req = props.initPageResult.req

  try {
    const [visibleResult, allResult, publishedResult] = await Promise.all([
      findDocs<Omit<CategoryListItem, 'productCount' | 'depth'>>(req, 'categories', {
        sort: ['order', 'title', 'id'],
        limit: 500,
        depth: 1,
        draft: true,
        where: whereFrom(filters),
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          nodeType: true,
          taxonomyAxis: true,
          order: true,
          parent: true,
          image: true,
          searchTerms: true,
          menu: true,
          _status: true,
          updatedAt: true,
        },
      }),
      findDocs<CategoryParent & { searchTerms?: Array<{ term?: string | null }> | null }>(req, 'categories', {
        sort: ['order', 'title', 'id'],
        limit: 500,
        depth: 0,
        draft: true,
        select: { id: true, title: true, slug: true, status: true, order: true, parent: true, searchTerms: true, menu: true, _status: true },
      }),
      // O site lê a versão publicada; `draft: true` mostraria só a mais recente.
      findDocs<{ id: string | number }>(req, 'categories', {
        limit: 500,
        depth: 0,
        draft: false,
        where: { _status: { equals: 'published' } } as Where,
        select: { id: true },
      }),
    ])

    const publishedIds = new Set(publishedResult.docs.map((category) => String(category.id)))
    const allCategories = allResult.docs.map((category) => ({ ...category, published: publishedIds.has(String(category.id)) }))

    const hierarchyMap = indexCategoriesById(allCategories)
    // Pré-ordem sobre TODA a taxonomia (fonte única de sequência). A lista
    // visível e o `allOrderIds` do reorder derivam desta mesma sequência para
    // que a relação de posição entre item visível e conjunto completo continue
    // consistente — condição de correção do `mergedFullOrder` no cliente.
    const orderedAll = orderCategoriesHierarchically(allCategories)
    const positionInFull = new Map(orderedAll.map((category, index) => [String(category.id), index]))

    const counts = await Promise.all(visibleResult.docs.map((category) => countDocs(req, 'products', { categories: { contains: category.id } } as Where)))
    const visibleParentIds = collectParentIds(visibleResult.docs)
    const categories: CategoryListItem[] = visibleResult.docs
      .map((category, index) => {
        const parentId = relationId(category.parent)
        return {
          ...category,
          published: publishedIds.has(String(category.id)),
          parentTitle: parentId === null ? null : hierarchyMap.get(String(parentId))?.title ?? null,
          productCount: counts[index],
          depth: getCategoryDepth(category as CategoryParent, hierarchyMap),
          hasChildren: visibleParentIds.has(String(category.id)),
        }
      })
      .filter((category) => matchesCategoryView(category, filters.view))
      .sort((left, right) => (positionInFull.get(String(left.id)) ?? 0) - (positionInFull.get(String(right.id)) ?? 0))

    let detail: CategoryDetail | null = null
    let media: CategoryMedia[] = []
    let relatedTotal = 0

    if (categoryId) {
      detail = await selectedDetail(props, categoryId)
      const [mediaResult, productsCount] = await Promise.all([
        findDocs<CategoryMedia>(req, 'media', {
          sort: '-updatedAt',
          limit: 100,
          depth: 0,
          select: { id: true, filename: true, url: true, alt: true },
        }),
        countDocs(req, 'products', { categories: { contains: categoryId } } as Where),
      ])
      media = mediaResult.docs
      relatedTotal = productsCount
      detail.productCount = relatedTotal
      detail.published = publishedIds.has(String(detail.id))
      detail.depth = getCategoryDepth<CategoryParent>(detail, hierarchyMap)
    }

    const termSuggestions = allResult.docs
      .flatMap((category) => category.searchTerms || [])
      .map((item) => item.term?.trim() || '')
      .filter(Boolean)
      .filter((term, index, terms) => terms.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === term.toLocaleLowerCase('pt-BR')) === index)
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))

    const relatedSection = categoryId ? (
      <Suspense key={categoryId} fallback={<LoadingState compact label="Carregando produtos relacionados…" />}>
        <CategoryRelatedProductsPanel req={req} categoryId={categoryId} />
      </Suspense>
    ) : null

    return (
      <ViewFrame props={props}>
        <PageHeader
          eyebrow="Catálogo"
          title="Categorias"
          subtitle="Organize as categorias do site, o menu e os produtos de cada uma."
          actions={<CategoryCreateDialog key={categoryId || 'none'} categories={orderedAll} />}
        />
        <div className={`esmera-categories-workspace${detail ? ' has-detail' : ''}`}>
          <CategoriesMasterList categories={categories} hierarchy={orderedAll} filters={filters} selectedId={categoryId} />
          {detail ? (
            <CategoryDetailView
              category={detail}
              filters={filters}
              categories={allCategories}
              media={media}
              termSuggestions={termSuggestions}
              relatedSection={relatedSection}
              relatedTotal={relatedTotal}
            />
          ) : (
            <section className="esmera-category-detail esmera-category-detail--empty">
              <span className="esmera-eyebrow">Detalhe</span>
              <h2>Selecione uma categoria</h2>
              <p>Escolha uma categoria na lista para editar o nome, o menu e os produtos.</p>
            </section>
          )}
        </div>
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Categorias" subtitle="Catálogo" /><QueryError title="Não foi possível consultar categorias" error={error} /></ViewFrame>
  }
}
