import Link from 'next/link'
import type React from 'react'

import { Status } from '../../design-system'
import { CategoryDetailEditor, type CategoryEditorTab } from './CategoryDetailEditor'
import {
  categoryStatusLabels,
  type CategoryDetail,
  type CategoryMedia,
  type CategoryParent,
  type CategoryTab,
  type CategoryWorkspaceFilters,
} from './types'

type Props = {
  category: CategoryDetail
  tab: CategoryTab
  filters: CategoryWorkspaceFilters
  categories: CategoryParent[]
  media: CategoryMedia[]
  termSuggestions: string[]
  relatedSection: React.ReactNode
  relatedTotal: number
}

// A aba pedida pela URL continua valendo como aba inicial do editor.
const editorTabs: Record<CategoryTab, CategoryEditorTab> = {
  general: 'content',
  media: 'media',
  products: 'related',
}

function backHref(filters: CategoryWorkspaceFilters) {
  const params = new URLSearchParams()
  params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  return `/admin/categories?${params.toString()}`
}

export function CategoryDetailView({
  category,
  tab,
  filters,
  categories,
  media,
  termSuggestions,
  relatedSection,
  relatedTotal,
}: Props) {
  return (
    <section className="esmera-category-detail" aria-label={`Detalhe de ${category.title || 'categoria'}`}>
      <header className="esmera-category-detail__header">
        <div>
          <Link className="esmera-category-back" href={backHref(filters)}>← Categorias</Link>
          <span className="esmera-eyebrow">Categoria</span>
          <h2>{category.title || 'Categoria sem título'}</h2>
          <p>/{category.slug || 'sem-slug'} · ordem {category.order ?? '—'} · {relatedTotal} produto{relatedTotal === 1 ? '' : 's'}</p>
        </div>
        <div className="esmera-category-detail__status">
          <Status tone={category.status === 'active' ? 'success' : 'neutral'}>{categoryStatusLabels[category.status || ''] || '—'}</Status>
          <Status tone={category._status === 'published' ? 'info' : 'neutral'}>{category._status === 'published' ? 'Publicada' : 'Rascunho'}</Status>
        </div>
      </header>

      {/* As abas passaram a ser as do FormShell dentro do editor: com uma única
          barra, a navegação a partir de uma issue consegue abrir a aba certa. */}
      <CategoryDetailEditor
        category={category}
        categories={categories}
        media={media}
        termSuggestions={termSuggestions}
        filters={filters}
        initialTab={editorTabs[tab]}
        initialRevision={category.revision ?? null}
        initialUpdatedAt={category.updatedAt ?? null}
        relatedSection={relatedSection}
      />
    </section>
  )
}
