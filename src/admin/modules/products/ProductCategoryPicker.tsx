'use client'

import React, { useState } from 'react'

import { InlineFeedback } from '../../design-system'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import type { ProductMedia, ProductPickerCategory } from './types'

function categoryImageURL(image: ProductPickerCategory['image']) {
  if (!image || typeof image !== 'object') return null
  const media = image as ProductMedia
  return media.sizes?.thumb?.url || media.url || null
}

function categoryInitial(category: ProductPickerCategory) {
  const label = String(category.title || category.slug || '').trim()
  return label.charAt(0).toUpperCase() || '?'
}

// Seletor visual de categorias com toggle otimista + rollback: cada clique grava
// via `set-categories` e reverte a seleção se o servidor recusar.
export function ProductCategoryPicker({
  productId,
  categories,
  selected,
  onSelectedChange,
  disabled = false,
}: {
  productId: string | number
  categories: ProductPickerCategory[]
  selected: Array<string | number>
  onSelectedChange: (next: Array<string | number>) => void
  disabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rollback, setRollback] = useState(false)

  async function toggle(id: string | number) {
    if (saving || disabled) return
    const already = selected.some((value) => String(value) === String(id))
    const next = already ? selected.filter((value) => String(value) !== String(id)) : [...selected, id]
    const previous = selected
    setRollback(false)
    setFeedback(null)
    onSelectedChange(next)
    setSaving(true)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'set-categories', id: productId, categories: next }),
      })
      await expectAdminResponse(response, 'Não foi possível atualizar as categorias.')
    } catch (error) {
      onSelectedChange(previous)
      setRollback(true)
      setFeedback(`${normalizeAdminError(error, 'Não foi possível atualizar as categorias.').summary} A seleção anterior foi restaurada.`)
    } finally {
      setSaving(false)
    }
  }

  if (!categories.length) {
    return <InlineFeedback tone="warning">Nenhuma categoria ativa e publicada disponível. Crie e publique uma categoria antes de organizar o produto.</InlineFeedback>
  }

  return (
    <div className="esmera-product-category-picker">
      <div className="esmera-product-category-grid" role="group" aria-label="Categorias do produto">
        {categories.map((category) => {
          const isSelected = selected.some((value) => String(value) === String(category.id))
          const url = categoryImageURL(category.image)
          return (
            <button
              key={String(category.id)}
              type="button"
              className={`esmera-product-category-card${isSelected ? ' is-selected' : ''}`}
              role="checkbox"
              aria-checked={isSelected}
              disabled={saving || disabled}
              onClick={() => void toggle(category.id)}
            >
              <span className="esmera-product-category-card__thumb">
                {url ? <img src={url} alt="" /> : <span aria-hidden="true">{categoryInitial(category)}</span>}
              </span>
              <span className="esmera-product-category-card__title">{category.title || category.slug || category.id}</span>
              <span className="esmera-product-category-card__check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
            </button>
          )
        })}
      </div>
      {feedback ? <InlineFeedback tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
    </div>
  )
}
