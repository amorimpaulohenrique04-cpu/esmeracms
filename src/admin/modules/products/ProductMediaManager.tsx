'use client'

import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import React, { useRef, useState } from 'react'

import { Button, InlineFeedback, SavingState, Status } from '../../design-system'
import { announceAdmin, announceDraftChanged } from '../../state/AdminStateProvider'
import { imageURL, relationId, roleLabels, type ProductGalleryItem } from './types'

function SortableMedia({
  item,
  index,
  total,
  disabled,
  onMove,
  onRemove,
}: {
  item: ProductGalleryItem
  index: number
  total: number
  disabled: boolean
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}) {
  const id = item.mediaKey || item.id || `media-${index}`
  const sortable = useSortable({ id: String(id), index })
  const url = imageURL(item)

  return (
    <li ref={sortable.ref} className={`esmera-product-media-item esmera-spatial-selection${sortable.isDragging ? ' is-dragging' : ''}`}>
      <button ref={sortable.handleRef} className="esmera-product-media-handle" type="button" disabled={disabled} aria-label={`Reordenar ${item.mediaKey || `imagem ${index + 1}`}`}>⋮⋮</button>
      <div className="esmera-product-media-thumb">{url ? <img src={url} alt={item.alt || ''} /> : <span>Sem preview</span>}</div>
      <div className="esmera-product-media-copy">
        <strong>{item.mediaKey || `Imagem ${index + 1}`}</strong>
        <span>{item.alt || 'Sem texto alternativo'}</span>
        <small>{index + 1} de {total}</small>
      </div>
      <Status tone={item.role === 'cover' ? 'success' : 'neutral'}>{roleLabels[item.role || ''] || 'Imagem'}</Status>
      <div className="esmera-product-media-move" aria-label="Ações da imagem">
        <Button className="esmera-product-media-move-button" disabled={disabled || index === 0} onClick={() => onMove(index, index - 1)} aria-label="Mover para cima">↑</Button>
        <Button className="esmera-product-media-move-button" disabled={disabled || index === total - 1} onClick={() => onMove(index, index + 1)} aria-label="Mover para baixo">↓</Button>
        <Button tone="danger" disabled={disabled} onClick={() => onRemove(index)} aria-label={`Remover ${item.mediaKey || `imagem ${index + 1}`} da galeria`}>Remover</Button>
      </div>
    </li>
  )
}

function nextGalleryWithout(gallery: ProductGalleryItem[], index: number) {
  const next = gallery.filter((_, itemIndex) => itemIndex !== index)
  const removed = gallery[index]
  if (removed?.role === 'cover' && next.length && !next.some((item) => item.role === 'cover')) {
    next[0] = { ...next[0], role: 'cover' }
  }
  return next
}

export function ProductMediaManager({ productId, initialGallery }: { productId: string | number; initialGallery: ProductGalleryItem[] }) {
  const [gallery, setGallery] = useState(initialGallery)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rollback, setRollback] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const lastSaved = useRef(initialGallery)

  async function persist(next: ProductGalleryItem[], successMessage = 'Galeria salva no rascunho.') {
    setSaving(true)
    setRollback(false)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'reorder-gallery',
          id: productId,
          gallery: next.map((item) => ({
            id: item.id || undefined,
            image: relationId(item.image),
            mediaKey: item.mediaKey,
            role: item.role,
            alt: item.alt,
          })),
        }),
      })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar a galeria.')
      lastSaved.current = next
      setFeedback(successMessage)
      announceDraftChanged({ kind: 'product', id: productId, field: 'gallery' })
      announceAdmin(successMessage)
    } catch (error) {
      setGallery(lastSaved.current)
      setRollback(true)
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a galeria.'
      setFeedback(`${message} A galeria anterior foi restaurada.`)
      announceAdmin('Falha ao alterar a galeria. A versão anterior foi restaurada.', true)
    } finally {
      setSaving(false)
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= gallery.length || from === to || saving) return
    setClearArmed(false)
    const next = [...gallery]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setGallery(next)
    announceAdmin(`${item.mediaKey || `Imagem ${from + 1}`} movida para a posição ${to + 1}.`)
    void persist(next, 'Ordem da galeria salva no rascunho.')
  }

  function remove(index: number) {
    if (saving || index < 0 || index >= gallery.length) return
    const removed = gallery[index]
    const next = nextGalleryWithout(gallery, index)
    setClearArmed(false)
    setGallery(next)
    void persist(next, `${removed?.mediaKey || `Imagem ${index + 1}`} removida da galeria.`)
  }

  function removeAll() {
    if (saving || !gallery.length) return
    if (!clearArmed) {
      setClearArmed(true)
      setRollback(false)
      setFeedback(`Você vai remover ${gallery.length} imagem${gallery.length === 1 ? '' : 'ns'} deste produto. Clique novamente em “Confirmar remoção” para continuar.`)
      announceAdmin('Confirme a remoção de todas as imagens da galeria.')
      return
    }

    const count = gallery.length
    setClearArmed(false)
    setGallery([])
    void persist([], `${count} imagem${count === 1 ? '' : 'ns'} removida${count === 1 ? '' : 's'} da galeria.`)
  }

  if (!gallery.length) {
    return (
      <div className="esmera-product-media-manager">
        <div className="esmera-empty"><strong>Galeria vazia</strong><span>Importe ou adicione novas mídias antes de publicar o produto.</span></div>
        {saving ? <SavingState state="saving" message="Limpando galeria…" /> : null}
        {feedback ? <InlineFeedback className={rollback ? 'is-rollback' : ''} tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
      </div>
    )
  }

  return (
    <div className="esmera-product-media-manager">
      <div className="esmera-product-media-note">
        <span>Arraste para ordenar. Para teclado ou tecnologia assistiva, use os botões ↑ e ↓.</span>
        <Button tone={clearArmed ? 'danger' : 'quiet'} disabled={saving} onClick={removeAll}>
          {clearArmed ? 'Confirmar remoção' : 'Remover todas'}
        </Button>
        {saving ? <SavingState state="saving" message="Salvando galeria…" /> : null}
      </div>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || saving) return
          const { source } = event.operation
          if (!isSortable(source)) return
          if (source.initialIndex === source.index) return
          move(source.initialIndex, source.index)
        }}
      >
        <ol className="esmera-product-media-list">
          {gallery.map((item, index) => (
            <SortableMedia
              key={String(item.id || item.mediaKey || index)}
              item={item}
              index={index}
              total={gallery.length}
              disabled={saving}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </ol>
      </DragDropProvider>
      {feedback ? <InlineFeedback className={rollback ? 'is-rollback' : ''} tone={rollback ? 'danger' : clearArmed ? 'warning' : 'success'}>{feedback}</InlineFeedback> : null}
    </div>
  )
}
