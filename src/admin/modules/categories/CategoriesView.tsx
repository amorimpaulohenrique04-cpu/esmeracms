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
  TechnicalLink,
  ViewFrame,
} from '../../views/shared'
import { createDocumentRevision } from '../../../server/publication/revision'
import { CategoriesMasterList } from './CategoriesMasterList'
import { CategoryDetailView } from './CategoryDetailView'
import { CategoryRelatedProductsPanel } from './CategoryRelatedProductsPanel'
import {
  relationId,
  type CategoryDetail,
  type CategoryListItem,
  type CategoryMedia,
  type CategoryParent,
  type CategoryTab,
  type CategoryWorkspaceFilters,
} from './types'
import './categories.scss'

const categoryTabs: CategoryTab[] = ['general', 'media', 'products']

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function filtersFrom(params: Record<string, string | string[] | undefined>): CategoryWorkspaceFilters {
  return {
    q: (first(params.q) || '').trim().slice(0, 100),
    status: first(params.status) === 'archive' ? 'archive' : 'active',
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

function hierarchyDepth(category: CategoryParent, byId: Map<string, CategoryParent>) {
  const visited = new Set<string>([String(category.id)])
  let depth = 0
  let parentId = relationId(category.parent)
  while (parentId !== null && depth < 20) {
    const key = String(parentId)
    if (visited.has(key)) return depth
    visited.add(key)
    const parent = byId.get(key)
    if (!parent) return depth + 1
    depth += 1
    parentId = relationId(parent.parent)
  }
  return depth
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
  const requestedTab = first(params.tab) as CategoryTab | undefined
  const tab = requestedTab && categoryTabs.includes(requestedTab) ? requestedTab : 'general'
  const req = props.initPageResult.req

  try {
    const [visibleResult, allResult] = await Promise.all([
      findDocs<Omit<CategoryListItem, 'productCount' | 'depth'>>(req, 'categories', {
        sort: 'order',
        limit: 500,
        depth: 1,
        draft: true,
        where: whereFrom(filters),
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          order: true,
          parent: true,
          image: true,
          searchTerms: true,
          _status: true,
          updatedAt: true,
        },
      }),
      findDocs<CategoryParent & { searchTerms?: Array<{ term?: string | null }> | null }>(req, 'categories', {
        sort: 'order',
        limit: 500,
        depth: 0,
        draft: true,
        select: { id: true, title: true, slug: true, status: true, order: true, parent: true, searchTerms: true },
      }),
    ])

    const hierarchyMap = new Map(allResult.docs.map((category) => [String(category.id), category]))
    const counts = await Promise.all(visibleResult.docs.map((category) => countDocs(req, 'products', { categories: { contains: category.id } } as Where)))
    const categories: CategoryListItem[] = visibleResult.docs.map((category, index) => ({
      ...category,
      productCount: counts[index],
      depth: hierarchyDepth(category as CategoryParent, hierarchyMap),
    }))

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
      detail.depth = hierarchyDepth(detail, hierarchyMap)
    }

    const termSuggestions = allResult.docs
      .flatMap((category) => category.searchTerms || [])
      .map((item) => item.term?.trim() || '')
      .filter(Boolean)
      .filter((term, index, terms) => terms.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === term.toLocaleLowerCase('pt-BR')) === index)
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))

    const relatedSection = categoryId && tab === 'products' ? (
      <Suspense key={`${categoryId}-${tab}`} fallback={<LoadingState compact label="Carregando produtos relacionados…" />}>
        <CategoryRelatedProductsPanel req={req} categoryId={categoryId} />
      </Suspense>
    ) : <LoadingState compact label="Carregando produtos relacionados…" />

    return (
      <ViewFrame props={props}>
        <PageHeader
          eyebrow="Catálogo"
          title="Categorias"
          subtitle="Taxonomia operacional em master-detail. Relações com produtos são derivadas; ordem e hierarquia permanecem governadas pelo Payload."
          actions={<TechnicalLink href="/admin/collections/categories/create" primary>Nova categoria</TechnicalLink>}
        />
        <div className={`esmera-categories-workspace${detail ? ' has-detail' : ''}`}>
          <CategoriesMasterList categories={categories} allOrderIds={allResult.docs.map((category) => category.id)} filters={filters} selectedId={categoryId} />
          {detail ? (
            <CategoryDetailView
              category={detail}
              tab={tab}
              filters={filters}
              categories={allResult.docs}
              media={media}
              termSuggestions={termSuggestions}
              relatedSection={relatedSection}
              relatedTotal={relatedTotal}
            />
          ) : (
            <section className="esmera-category-detail esmera-category-detail--empty">
              <span className="esmera-eyebrow">Detalhe</span>
              <h2>Selecione uma categoria</h2>
              <p>Abra uma linha para editar taxonomia, SEO, mídia e conferir os produtos relacionados sem sair do workspace.</p>
            </section>
          )}
        </div>
      </ViewFrame>
    )
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Categorias" subtitle="Catálogo" /><QueryError title="Não foi possível consultar categorias" error={error} /></ViewFrame>
  }
}
