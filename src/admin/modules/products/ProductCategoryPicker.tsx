'use client'

import { Combobox } from '@base-ui/react/combobox'
import React, { useMemo, useState } from 'react'

import { InlineFeedback } from '../../design-system'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import { getAncestorChain, indexCategoriesById, orderCategoriesHierarchically } from '../categories/hierarchy'
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

function categoryLabel(category: ProductPickerCategory) {
  return category.title || category.slug || String(category.id)
}

// Seletor hierárquico de categorias com seleção automática de ancestrais.
// Marcar uma categoria seleciona também seus ancestrais ELEGÍVEIS (mesmo filtro
// do schema: ativos, publicados, não-agrupadores). Como a lista recebida já é o
// conjunto elegível, um pai `group` termina a cadeia naturalmente — grupos nunca
// entram em Products.categories. Persistimos sempre a união (diretas ∪ derivadas)
// pela mesma ação `set-categories`, mantendo o productCount do admin correto.
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
  const [query, setQuery] = useState('')
  // Seleções DIRETAS (clicadas/buscadas). As derivadas são recalculadas sempre a
  // partir deste conjunto, então desmarcar uma direta libera os ancestrais que
  // nenhuma outra direta ainda exige.
  const [direct, setDirect] = useState<Set<string>>(() => new Set(selected.map((value) => String(value))))

  const eligibleById = useMemo(() => indexCategoriesById(categories), [categories])
  const ordered = useMemo(() => orderCategoriesHierarchically(categories), [categories])
  // Profundidade = nº de ancestrais elegíveis presentes (mesma base do
  // orderCategoriesHierarchically), para o recuo casar com a árvore renderizada.
  const depthById = useMemo(
    () => new Map(categories.map((category) => [String(category.id), getAncestorChain(category, eligibleById).length])),
    [categories, eligibleById],
  )

  function unionIdsFrom(directSet: Set<string>): Array<string | number> {
    const keys = new Set<string>(directSet)
    directSet.forEach((key) => {
      const node = eligibleById.get(key)
      if (node) getAncestorChain(node, eligibleById).forEach((ancestor) => keys.add(String(ancestor.id)))
    })
    return [...keys].map((key) => eligibleById.get(key)?.id ?? key)
  }

  // Conjunto marcado (união) para o estado dos checkboxes.
  const unionKeys = useMemo(() => {
    const keys = new Set<string>(direct)
    direct.forEach((key) => {
      const node = eligibleById.get(key)
      if (node) getAncestorChain(node, eligibleById).forEach((ancestor) => keys.add(String(ancestor.id)))
    })
    return keys
  }, [direct, eligibleById])

  // Para cada ancestral herdado (não-direto), quais categorias diretas o exigem —
  // usado no rótulo "Incluída via …".
  const inheritedVia = useMemo(() => {
    const map = new Map<string, string[]>()
    direct.forEach((key) => {
      const node = eligibleById.get(key)
      if (!node) return
      getAncestorChain(node, eligibleById).forEach((ancestor) => {
        const ancestorKey = String(ancestor.id)
        if (direct.has(ancestorKey)) return
        const list = map.get(ancestorKey) || []
        list.push(categoryLabel(node))
        map.set(ancestorKey, list)
      })
    })
    return map
  }, [direct, eligibleById])

  async function commitDirect(nextDirect: Set<string>) {
    if (saving || disabled) return
    const previousDirect = direct
    const nextUnion = unionIdsFrom(nextDirect)
    const previousUnion = unionIdsFrom(previousDirect)
    setRollback(false)
    setFeedback(null)
    setDirect(nextDirect)
    onSelectedChange(nextUnion)
    setSaving(true)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'set-categories', id: productId, categories: nextUnion }),
      })
      await expectAdminResponse(response, 'Não foi possível atualizar as categorias.')
    } catch (error) {
      setDirect(previousDirect)
      onSelectedChange(previousUnion)
      setRollback(true)
      setFeedback(`${normalizeAdminError(error, 'Não foi possível atualizar as categorias.').summary} A seleção anterior foi restaurada.`)
    } finally {
      setSaving(false)
    }
  }

  function toggle(id: string | number) {
    if (saving || disabled) return
    const key = String(id)
    const next = new Set(direct)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    void commitDirect(next)
  }

  function addFromSearch(id: string | number) {
    if (saving || disabled) return
    const key = String(id)
    setQuery('')
    if (direct.has(key)) return
    const next = new Set(direct)
    next.add(key)
    void commitDirect(next)
  }

  if (!categories.length) {
    return <InlineFeedback tone="warning">Nenhuma categoria ativa e publicada disponível. Crie e publique uma categoria antes de organizar o produto.</InlineFeedback>
  }

  return (
    <div className="esmera-product-category-picker">
      <Combobox.Root
        items={categories}
        inputValue={query}
        onInputValueChange={setQuery}
        itemToStringLabel={(item: ProductPickerCategory) => categoryLabel(item)}
        onValueChange={(item: ProductPickerCategory | null) => { if (item) addFromSearch(item.id) }}
      >
        <Combobox.InputGroup className="esmera-product-category-search">
          <span className="esmera-product-category-search__icon" aria-hidden="true">⌕</span>
          <Combobox.Input className="esmera-product-category-search__input" placeholder="Buscar categoria…" aria-label="Buscar categoria" disabled={saving || disabled} />
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner className="esmera-combobox-positioner" sideOffset={6}>
            <Combobox.Popup className="esmera-combobox-popup">
              <Combobox.Empty className="esmera-select-item">Nenhuma categoria encontrada.</Combobox.Empty>
              <Combobox.List>
                {(item: ProductPickerCategory) => (
                  <Combobox.Item key={String(item.id)} className="esmera-select-item" value={item}>
                    {categoryLabel(item)}{unionKeys.has(String(item.id)) ? ' ✓' : ''}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <ul className="esmera-product-category-tree" role="group" aria-label="Categorias do produto">
        {ordered.map((category) => {
          const key = String(category.id)
          const checked = unionKeys.has(key)
          const isDirect = direct.has(key)
          const via = inheritedVia.get(key)
          const url = categoryImageURL(category.image)
          return (
            <li
              key={key}
              className={`esmera-product-category-node${checked ? ' is-selected' : ''}${checked && !isDirect ? ' is-inherited' : ''}`}
              style={{ '--category-depth': depthById.get(key) ?? 0 } as React.CSSProperties}
            >
              <button
                type="button"
                className="esmera-product-category-node__control"
                role="checkbox"
                aria-checked={checked}
                disabled={saving || disabled}
                onClick={() => toggle(category.id)}
              >
                <span className="esmera-product-category-node__check" aria-hidden="true">{checked ? '✓' : ''}</span>
                <span className="esmera-product-category-node__thumb">
                  {url ? <img src={url} alt="" /> : <span aria-hidden="true">{categoryInitial(category)}</span>}
                </span>
                <span className="esmera-product-category-node__copy">
                  <span className="esmera-product-category-node__title">{categoryLabel(category)}</span>
                  {checked && !isDirect && via ? <small className="esmera-product-category-node__via">Incluída via {via.join(', ')}</small> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {feedback ? <InlineFeedback tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
    </div>
  )
}
