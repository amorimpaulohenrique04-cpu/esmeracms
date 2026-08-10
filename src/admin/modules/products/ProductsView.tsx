/* eslint-disable react-hooks/error-boundaries -- Query failures are handled here; render failures remain handled by the Next.js/Payload boundaries. */
import type { AdminViewServerProps, Where } from 'payload'

import {
  AccessDenied,
  ensureUser,
  findDocs,
  PageHeader,
  QueryError,
  ViewFrame,
} from '../../views/shared'
import { assessProductPublication } from '../../../server/publication/productAssessment'
import { createDocumentRevision } from '../../../server/publication/revision'
import { ProductCreateDialog } from './ProductCreateDialog'
import { ProductDocumentView } from './ProductDocumentView'
import { ProductImportDialog } from './ProductImportDialog'
import { ProductsWorkspaceClient } from './ProductsWorkspaceClient'
import type {
  ProductCategory,
  ProductDetail,
  ProductDocumentTab,
  ProductListItem,
  ProductsViewMode,
  ProductWorkspaceFilters,
} from './types'
import './products.scss'

const documentTabs: ProductDocumentTab[] = ['overview', 'media', 'commercial', 'variants', 'technical', 'seo', 'history']

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function paramsOf(props: AdminViewServerProps) {
  return await Promise.resolve(props.searchParams as unknown as Record<string, string | string[] | undefined>)
}

function integer(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function filtersFrom(params: Record<string, string | string[] | undefined>): ProductWorkspaceFilters {
  const limitValue = integer(first(params.limit), 50)
  const viewValue = first(params.view)
  return {
    q: (first(params.q) || '').trim().slice(0, 100),
    status: first(params.status) || 'all',
    availability: first(params.availability) || 'all',
    publication: first(params.publication) || 'all',
    category: first(params.category) || 'all',
    page: integer(first(params.page), 1),
    limit: limitValue === 100 ? 100 : 50,
    view: viewValue === 'grid' ? 'grid' : 'list' as ProductsViewMode,
  }
}

function whereFrom(filters: ProductWorkspaceFilters): Where | undefined {
  const and: Where[] = []
  if (filters.q) {
    and.push({
      or: [
        { title: { like: filters.q } },
        { subtitle: { like: filters.q } },
        { code: { like: filters.q } },
        { slug: { like: filters.q } },
        { material: { like: filters.q } },
      ],
    } as Where)
  }
  if (filters.status !== 'all') and.push({ catalogStatus: { equals: filters.status } } as Where)
  if (filters.availability !== 'all') and.push({ availability: { equals: filters.availability } } as Where)
  if (filters.category !== 'all') and.push({ categories: { contains: filters.category } } as Where)
  if (filters.publication === 'published' || filters.publication === 'draft') and.push({ _status: { equals: filters.publication } } as Where)
  if (filters.publication === 'ready') and.push({ publicationReady: { equals: true } } as Where)
  if (filters.publication === 'issues') and.push({ publicationReady: { equals: false } } as Where)
  return and.length ? ({ and } as Where) : undefined
}

async function productDetail(props: AdminViewServerProps, id: string) {
  // depth: 2 matches admin-products/route.ts's readCurrent/saveDraft/readDraft —
  // createDocumentRevision() hashes the resolved relationship shape, so a
  // mismatched depth here would make every first save 409 with a false conflict.
  const product = await props.initPageResult.req.payload.findByID({
    collection: 'products',
    id,
    depth: 2,
    draft: true,
    overrideAccess: false,
    user: props.initPageResult.req.user,
    req: props.initPageResult.req,
  }) as unknown as ProductDetail
  const assessment = assessProductPublication(product)
  const revision = createDocumentRevision(product)

  return {
    ...product,
    publicationReady: assessment.ready,
    // Cópia estrutural do array, sem tocar nos itens: o checklist do editor
    // precisa de severity, path, tab, anchor, label e suggestion.
    publicationIssues: [...assessment.issues],
    revision,
  }
}

export async function ProductsView(props: AdminViewServerProps) {
  const { allowed } = ensureUser(props, 'site')
  if (!allowed) return <AccessDenied props={props} area="editorial" />

  const params = await paramsOf(props)
  const productId = first(params.product)

  try {
    if (productId) {
      const requestedTab = first(params.tab) as ProductDocumentTab | undefined
      const tab = requestedTab && documentTabs.includes(requestedTab) ? requestedTab : 'overview'
      const product = await productDetail(props, productId)
      return <ViewFrame props={props}><ProductDocumentView product={product} tab={tab} searchParams={params} /></ViewFrame>
    }

    const filters = filtersFrom(params)
    const [result, categoryResult] = await Promise.all([
      findDocs<ProductListItem>(props.initPageResult.req, 'products', {
        sort: '-updatedAt',
        limit: filters.limit,
        page: filters.page,
        depth: 1,
        draft: true,
        where: whereFrom(filters),
        select: {
          id: true,
          title: true,
          subtitle: true,
          slug: true,
          code: true,
          catalogStatus: true,
          availability: true,
          _status: true,
          publicationReady: true,
          publicationIssues: true,
          categories: true,
          gallery: true,
          priceMode: true,
          basePriceCents: true,
          updatedAt: true,
        },
      }),
      findDocs<ProductCategory>(props.initPageResult.req, 'categories', {
        sort: 'order',
        limit: 200,
        depth: 0,
        select: { id: true, title: true, slug: true },
      }),
    ])

    return <ViewFrame props={props}>
      <PageHeader eyebrow="Catálogo" title="Produtos" subtitle="Operação do catálogo com filtros, prontidão, publicação, grid, ações em lote e acesso ao documento editorial completo." actions={<><ProductCreateDialog /><ProductImportDialog /></>} />
      <ProductsWorkspaceClient products={result.docs} categories={categoryResult.docs} filters={filters} totalDocs={result.totalDocs} totalPages={result.totalPages} />
    </ViewFrame>
  } catch (error) {
    return <ViewFrame props={props}><PageHeader title="Produtos" subtitle="Catálogo" /><QueryError title="Não foi possível consultar produtos" error={error} /></ViewFrame>
  }
}
