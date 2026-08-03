'use client'

import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { Button, EmptyState, InlineFeedback, SavingState } from '../../design-system'
import { announceAdmin, announceAdminSelection } from '../../state/AdminStateProvider'
import {
  categoryImageAlt,
  categoryImageURL,
  type CategoryListItem,
  type CategoryWorkspaceFilters,
} from './types'

type Props = {
  categories: CategoryListItem[]
  allOrderIds: Array<string | number>
  filters: CategoryWorkspaceFilters
  selectedId?: string | null
}

function categoryHref(filters: CategoryWorkspaceFilters, id: string | number) {
  const params = new URLSearchParams()
  params.set('category', String(id))
  params.set('tab', 'general')
  params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  return `/admin/categories?${params.toString()}`
}

function listHref(filters: CategoryWorkspaceFilters, patch: Partial<CategoryWorkspaceFilters>) {
  const next = { ...filters, ...patch }
  const params = new URLSearchParams()
  params.set('status', next.status)
  if (next.q) params.set('q', next.q)
  return `/admin/categories?${params.toString()}`
}

function SortableCategory({
  category,
  index,
  total,
  filters,
  selected,
  disabled,
  onMove,
}: {
  category: CategoryListItem
  index: number
  total: number
  filters: CategoryWorkspaceFilters
  selected: boolean
  disabled: boolean
  onMove: (from: number, to: number) => void
}) {
  const sortable = useSortable({ id: String(category.id), index })
  const image = categoryImageURL(category.image)
  const alt = categoryImageAlt(category.image)
  const title = category.title || 'Categoria sem título'

  return (
    <li
      ref={sortable.ref}
      className={`esmera-category-row esmera-spatial-selection${selected ? ' is-selected' : ''}${sortable.isDragging ? ' is-dragging' : ''}`}
      style={{ '--category-depth': category.depth } as React.CSSProperties}
      data-esmera-context-key={`category-${category.id}`}
    >
      <button
        ref={sortable.handleRef}
        type="button"
        className="esmera-category-drag"
        aria-label={`Reordenar ${title}`}
        disabled={disabled}
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <Link
        className="esmera-category-row__main"
        href={categoryHref(filters, category.id)}
        data-esmera-transition="inspector"
        data-esmera-recent-label={title}
        data-esmera-recent-meta={`Categoria · /${category.slug || 'sem-slug'}`}
      >
        <span className="esmera-category-thumb">{image ? <img src={image} alt={alt} /> : <span aria-hidden="true">◇</span>}</span>
        <span className="esmera-category-row__copy">
          <strong>{title}</strong>
          <small>/{category.slug || 'sem-slug'}{category.depth > 0 ? ` · nível ${category.depth + 1}` : ''}</small>
        </span>
      </Link>
      <span className="esmera-category-count">{category.productCount} prod.</span>
      <label className="esmera-category-position">
        <span className="esmera-sr-only">Mover {title} para posição</span>
        <select
          className="esmera-input"
          value={index + 1}
          disabled={disabled}
          aria-label={`Mover ${title} para posição`}
          onChange={(event) => onMove(index, Number(event.target.value) - 1)}
        >
          {Array.from({ length: total }, (_, target) => <option key={target + 1} value={target + 1}>{target + 1}</option>)}
        </select>
      </label>
    </li>
  )
}

export function CategoriesMasterList({ categories, allOrderIds, filters, selectedId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(categories)
  const [fullOrder, setFullOrder] = useState(allOrderIds)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rollback, setRollback] = useState(false)

  useEffect(() => {
    const selected = items.find((item) => String(item.id) === String(selectedId || ''))
    if (!selected) {
      announceAdminSelection(null)
      return
    }
    announceAdminSelection({
      kind: 'category',
      id: selected.id,
      label: selected.title || 'Categoria sem título',
      href: categoryHref(filters, selected.id),
    })
  }, [filters, items, selectedId])

  function mergedFullOrder(nextVisible: CategoryListItem[]) {
    const visible = new Set(items.map((item) => String(item.id)))
    let cursor = 0
    return fullOrder.map((id) => visible.has(String(id)) ? nextVisible[cursor++].id : id)
  }

  async function persist(nextVisible: CategoryListItem[], nextFull: Array<string | number>, movedTitle: string, position: number) {
    const previousItems = items
    const previousFull = fullOrder
    setItems(nextVisible)
    setFullOrder(nextFull)
    setSaving(true)
    setRollback(false)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-categories', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderedIds: nextFull }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar a ordem.')
      setFeedback(`${movedTitle} movida para a posição ${position}. Ordem salva.`)
      announceAdmin(`${movedTitle} movida para a posição ${position}.`)
      router.refresh()
    } catch (error) {
      setItems(previousItems)
      setFullOrder(previousFull)
      setRollback(true)
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a ordem.'
      setFeedback(`${message} A posição anterior foi restaurada.`)
      announceAdmin('Falha ao reordenar categorias. A posição anterior foi restaurada.', true)
    } finally {
      setSaving(false)
    }
  }

  function move(from: number, to: number) {
    if (saving || from === to || to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const nextFull = mergedFullOrder(next)
    void persist(next, nextFull, moved.title || 'Categoria', to + 1)
  }

  return (
    <section className="esmera-category-master" aria-label="Lista de categorias">
      <div className="esmera-category-master__toolbar">
        <nav className="esmera-category-segments" aria-label="Status da categoria">
          <Link className={`esmera-category-segment${filters.status === 'active' ? ' is-active' : ''}`} aria-current={filters.status === 'active' ? 'page' : undefined} href={listHref(filters, { status: 'active' })}>Ativas</Link>
          <Link className={`esmera-category-segment${filters.status === 'archive' ? ' is-active' : ''}`} aria-current={filters.status === 'archive' ? 'page' : undefined} href={listHref(filters, { status: 'archive' })}>Arquivadas</Link>
        </nav>
        <form className="esmera-category-search" action="/admin/categories" method="get">
          <input type="hidden" name="status" value={filters.status} />
          <label className="esmera-category-search__field">
            <span className="esmera-sr-only">Buscar categorias</span>
            <span className="esmera-category-search__icon" aria-hidden="true">⌕</span>
            <input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Título, slug ou sinônimo" />
            {filters.q ? <Link className="esmera-category-search__clear" href={listHref(filters, { q: '' })} aria-label="Limpar busca">×</Link> : null}
          </label>
          <Button type="submit">Buscar</Button>
        </form>
      </div>

      <div className="esmera-category-list-head" aria-hidden="true">
        <span>Categoria</span><span>Produtos</span><span>Posição</span>
      </div>

      {!items.length ? <EmptyState title="Nenhuma categoria encontrada" copy={filters.q ? 'Ajuste a busca ou limpe o filtro.' : 'Crie uma categoria para estruturar o catálogo.'} /> : (
        <DragDropProvider onDragEnd={(event) => {
          if (event.canceled) return
          const { source } = event.operation
          if (!isSortable(source) || source.initialIndex === source.index) return
          move(source.initialIndex, source.index)
        }}>
          <ol className="esmera-category-list">
            {items.map((category, index) => (
              <SortableCategory
                key={String(category.id)}
                category={category}
                index={index}
                total={items.length}
                filters={filters}
                selected={String(category.id) === String(selectedId || '')}
                disabled={saving}
                onMove={move}
              />
            ))}
          </ol>
        </DragDropProvider>
      )}

      <div className="esmera-category-master__footer" aria-live="polite">
        <span>{items.length} categoria{items.length === 1 ? '' : 's'} · arraste ou use a posição.</span>
        {saving ? <SavingState state="saving" message="Salvando ordem…" /> : null}
      </div>
      {feedback ? <InlineFeedback className={rollback ? 'is-rollback' : ''} tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
    </section>
  )
}
