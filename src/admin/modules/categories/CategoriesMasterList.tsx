'use client'

import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { Button, EmptyState, InlineFeedback, SavingState, Status } from '../../design-system'
import { announceAdmin, announceAdminSelection } from '../../state/AdminStateProvider'
import { moveWithinSiblings, siblingsOf } from './hierarchy'
import {
  categoryImageAlt,
  categoryImageURL,
  categoryStatePills,
  relationId,
  type CategoryListItem,
  type CategoryParent,
  type CategoryView,
  type CategoryWorkspaceFilters,
} from './types'

type Props = {
  categories: CategoryListItem[]
  /** Toda a taxonomia em pré-ordem: a reordenação sempre grava o conjunto completo. */
  hierarchy: CategoryParent[]
  filters: CategoryWorkspaceFilters
  selectedId?: string | null
}

const viewOptions: Array<{ value: CategoryView; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'published', label: 'Publicadas' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'hidden', label: 'Ocultas do menu' },
]

function appendFilters(params: URLSearchParams, filters: CategoryWorkspaceFilters) {
  params.set('status', filters.status)
  if (filters.q) params.set('q', filters.q)
  if (filters.view && filters.view !== 'all') params.set('view', filters.view)
}

function categoryHref(filters: CategoryWorkspaceFilters, id: string | number) {
  const params = new URLSearchParams()
  params.set('category', String(id))
  appendFilters(params, filters)
  return `/admin/categories?${params.toString()}`
}

function listHref(filters: CategoryWorkspaceFilters, patch: Partial<CategoryWorkspaceFilters>) {
  const params = new URLSearchParams()
  appendFilters(params, { ...filters, ...patch })
  return `/admin/categories?${params.toString()}`
}

function SortableCategory({
  category,
  index,
  filters,
  selected,
  disabled,
  canMoveUp,
  canMoveDown,
  onStep,
}: {
  category: CategoryListItem
  index: number
  filters: CategoryWorkspaceFilters
  selected: boolean
  disabled: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onStep: (category: CategoryListItem, direction: -1 | 1) => void
}) {
  const sortable = useSortable({ id: String(category.id), index })
  const image = categoryImageURL(category.image)
  const alt = categoryImageAlt(category.image)
  const title = category.title || 'Categoria sem título'

  return (
    <li
      ref={sortable.ref}
      className={`esmera-category-row esmera-spatial-selection${selected ? ' is-selected' : ''}${sortable.isDragging ? ' is-dragging' : ''}${category.hasChildren ? ' is-parent' : ' is-leaf'}`}
      style={{ '--category-depth': category.depth } as React.CSSProperties}
      data-depth={category.depth}
      data-esmera-context-key={`category-${category.id}`}
    >
      <button ref={sortable.handleRef} type="button" className="esmera-category-drag" aria-label={`Arrastar ${title}`} disabled={disabled}>
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <Link className="esmera-category-row__main" href={categoryHref(filters, category.id)} data-esmera-recent-label={title} data-esmera-recent-meta="Categoria">
        {category.depth > 0 ? <span className="esmera-category-branch" aria-hidden="true" /> : null}
        <span className="esmera-category-thumb">{image ? <img src={image} alt={alt} /> : <span aria-hidden="true">◇</span>}</span>
        <span className="esmera-category-row__copy">
          <strong>{title}</strong>
          {category.parentTitle ? <small>dentro de {category.parentTitle}</small> : null}
          <span className="esmera-category-row__states">
            {categoryStatePills(category).map((pill) => <Status key={pill.label} tone={pill.tone}>{pill.label}</Status>)}
          </span>
        </span>
      </Link>
      <span className="esmera-category-count">{category.productCount} prod.</span>
      <span className="esmera-category-step">
        <button type="button" className="esmera-category-step__button" aria-label={`Subir ${title}`} disabled={disabled || !canMoveUp} onClick={() => onStep(category, -1)}>↑</button>
        <button type="button" className="esmera-category-step__button" aria-label={`Descer ${title}`} disabled={disabled || !canMoveDown} onClick={() => onStep(category, 1)}>↓</button>
      </span>
    </li>
  )
}

export function CategoriesMasterList({ categories, hierarchy, filters, selectedId }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(categories)
  const [fullOrder, setFullOrder] = useState(hierarchy)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rollback, setRollback] = useState(false)
  // Remonta a lista quando um arraste é recusado, desfazendo o movimento visual.
  const [dragEpoch, setDragEpoch] = useState(0)

  // Nova lista vinda do servidor substitui o estado otimista durante o render.
  const [syncedCategories, setSyncedCategories] = useState(categories)
  const [syncedHierarchy, setSyncedHierarchy] = useState(hierarchy)
  if (syncedCategories !== categories) {
    setSyncedCategories(categories)
    setItems(categories)
  }
  if (syncedHierarchy !== hierarchy) {
    setSyncedHierarchy(hierarchy)
    setFullOrder(hierarchy)
  }

  useEffect(() => {
    const selected = items.find((item) => String(item.id) === String(selectedId || ''))
    if (!selected) {
      announceAdminSelection(null)
      return
    }
    announceAdminSelection({ kind: 'category', id: selected.id, label: selected.title || 'Categoria sem título', href: categoryHref(filters, selected.id) })
  }, [filters, items, selectedId])

  async function persist(nextVisible: CategoryListItem[], nextFull: CategoryParent[], movedTitle: string, position: number) {
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
        body: JSON.stringify({ action: 'reorder', orderedIds: nextFull.map((category) => category.id) }),
      })
      const body = await response.json() as { error?: string | { summary?: string } }
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : body.error?.summary || 'Não foi possível salvar a ordem.')
      setFeedback(`Ordem salva. ${movedTitle} agora é a ${position}ª do seu nível. O site atualiza em até 1 minuto.`)
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

  function moveTo(category: CategoryListItem, targetIndex: number) {
    if (saving) return
    const nextFull = moveWithinSiblings(fullOrder, category.id, targetIndex)
    if (!nextFull) return
    const rank = new Map(nextFull.map((node, index) => [String(node.id), index]))
    const nextVisible = [...items].sort((left, right) => (rank.get(String(left.id)) ?? 0) - (rank.get(String(right.id)) ?? 0))
    void persist(nextVisible, nextFull, category.title || 'Categoria', targetIndex + 1)
  }

  const visibleIds = new Set(items.map((item) => String(item.id)))
  const visibleSiblings = (id: string | number) => siblingsOf(fullOrder, id).filter((node) => visibleIds.has(String(node.id)))

  function step(category: CategoryListItem, direction: -1 | 1) {
    const siblings = visibleSiblings(category.id)
    const current = siblings.findIndex((node) => String(node.id) === String(category.id))
    const neighbor = siblings[current + direction]
    if (!neighbor) return
    moveTo(category, siblingsOf(fullOrder, category.id).findIndex((node) => String(node.id) === String(neighbor.id)))
  }

  function drop(fromIndex: number, toIndex: number) {
    const moved = items[fromIndex]
    const target = items[toIndex]
    if (!moved || !target) return
    if (String(relationId(moved.parent) ?? '') !== String(relationId(target.parent) ?? '')) {
      setDragEpoch((value) => value + 1)
      setRollback(true)
      setFeedback('Arraste só entre categorias do mesmo nível. Para mudar de grupo, altere a Categoria principal.')
      return
    }
    moveTo(moved, siblingsOf(fullOrder, moved.id).findIndex((node) => String(node.id) === String(target.id)))
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
          {filters.view && filters.view !== 'all' ? <input type="hidden" name="view" value={filters.view} /> : null}
          <label className="esmera-category-search__field">
            <span className="esmera-sr-only">Buscar categorias</span>
            <span className="esmera-category-search__icon" aria-hidden="true">⌕</span>
            <input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Buscar por nome" />
            {filters.q ? <Link className="esmera-category-search__clear" href={listHref(filters, { q: '' })} aria-label="Limpar busca">×</Link> : null}
          </label>
          <Button type="submit">Buscar</Button>
        </form>
      </div>

      <nav className="esmera-category-views" aria-label="Filtrar por situação">
        {viewOptions.map((option) => {
          const active = (filters.view ?? 'all') === option.value
          return <Link key={option.value} className={`esmera-category-view${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} href={listHref(filters, { view: option.value })}>{option.label}</Link>
        })}
      </nav>

      <div className="esmera-category-list-head" aria-hidden="true"><span>Categoria</span><span>Produtos</span><span>Ordem</span></div>

      {!items.length ? <EmptyState title="Nenhuma categoria encontrada" copy={filters.q || (filters.view && filters.view !== 'all') ? 'Ajuste a busca ou troque o filtro.' : 'Crie uma categoria para organizar o catálogo.'} /> : (
        <DragDropProvider onDragEnd={(event) => {
          if (event.canceled) return
          const { source } = event.operation
          if (!isSortable(source) || source.initialIndex === source.index) return
          drop(source.initialIndex, source.index)
        }}>
          <ol className="esmera-category-list" key={dragEpoch}>
            {items.map((category, index) => {
              const siblings = visibleSiblings(category.id)
              const position = siblings.findIndex((node) => String(node.id) === String(category.id))
              return (
                <SortableCategory
                  key={String(category.id)}
                  category={category}
                  index={index}
                  filters={filters}
                  selected={String(category.id) === String(selectedId || '')}
                  disabled={saving}
                  canMoveUp={position > 0}
                  canMoveDown={position >= 0 && position < siblings.length - 1}
                  onStep={step}
                />
              )
            })}
          </ol>
        </DragDropProvider>
      )}

      <div className="esmera-category-master__footer" aria-live="polite">
        <span>{items.length} categoria{items.length === 1 ? '' : 's'} · use as setas ou arraste dentro do mesmo nível.</span>
        {saving ? <SavingState state="saving" message="Salvando ordem…" /> : null}
      </div>
      {feedback ? <InlineFeedback className={rollback ? 'is-rollback' : ''} tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
    </section>
  )
}
