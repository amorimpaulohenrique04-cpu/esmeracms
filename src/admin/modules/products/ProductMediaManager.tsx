'use client'

import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import React, { useRef, useState } from 'react'

import { Button, InlineFeedback, SavingState, Status } from '../../design-system'
import { announceAdmin, announceDraftChanged } from '../../state/AdminStateProvider'
import { imageURL, relationId, roleLabels, type ProductGalleryItem } from './types'

function SortableMedia({ item, index, total, onMove }: { item: ProductGalleryItem; index: number; total: number; onMove: (from: number, to: number) => void }) {
  const id = item.mediaKey || item.id || `media-${index}`
  const sortable = useSortable({ id: String(id), index })
  const url = imageURL(item)

  return (
    <li ref={sortable.ref} className={`esmera-product-media-item esmera-spatial-selection${sortable.isDragging ? ' is-dragging' : ''}`}>
      <button ref={sortable.handleRef} className="esmera-product-media-handle" type="button" aria-label={`Reordenar ${item.mediaKey || `imagem ${index + 1}`}`}>⋮⋮</button>
      <div className="esmera-product-media-thumb">{url ? <img src={url} alt={item.alt || ''} /> : <span>Sem preview</span>}</div>
      <div className="esmera-product-media-copy">
        <strong>{item.mediaKey || `Imagem ${index + 1}`}</strong>
        <span>{item.alt || 'Sem texto alternativo'}</span>
        <small>{index + 1} de {total}</small>
      </div>
      <Status tone={item.role === 'cover' ? 'success' : 'neutral'}>{roleLabels[item.role || ''] || 'Imagem'}</Status>
      <div className="esmera-product-media-move" aria-label="Mover imagem sem arrastar">
        <Button className="esmera-product-media-move-button" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Mover para cima">↑</Button>
        <Button className="esmera-product-media-move-button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)} aria-label="Mover para baixo">↓</Button>
      </div>
    </li>
  )
}

export function ProductMediaManager({ productId, initialGallery }: { productId: string | number; initialGallery: ProductGalleryItem[] }) {
  const [gallery, setGallery] = useState(initialGallery)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rollback, setRollback] = useState(false)
  const lastSaved = useRef(initialGallery)

  async function persist(next: ProductGalleryItem[]) {
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
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar a ordem da galeria.')
      lastSaved.current = next
      setFeedback('Ordem da galeria salva no rascunho.')
      announceDraftChanged({ kind: 'product', id: productId, field: 'gallery' })
      announceAdmin('Ordem da galeria salva.')
    } catch (error) {
      setGallery(lastSaved.current)
      setRollback(true)
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a ordem da galeria.'
      setFeedback(`${message} A ordem anterior foi restaurada.`)
      announceAdmin('Falha ao reordenar. A ordem anterior foi restaurada.', true)
    } finally {
      setSaving(false)
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= gallery.length || from === to || saving) return
    const next = [...gallery]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setGallery(next)
    announceAdmin(`${item.mediaKey || `Imagem ${from + 1}`} movida para a posição ${to + 1}.`)
    void persist(next)
  }

  if (!gallery.length) return <div className="esmera-empty"><strong>Galeria vazia</strong><span>Adicione mídia pelo editor técnico antes de publicar.</span></div>

  return (
    <div className="esmera-product-media-manager">
      <div className="esmera-product-media-note">
        <span>Arraste para ordenar. Para teclado ou tecnologia assistiva, use os botões ↑ e ↓.</span>
        {saving ? <SavingState state="saving" message="Salvando nova ordem…" /> : null}
      </div>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return
          const { source } = event.operation
          if (!isSortable(source)) return
          if (source.initialIndex === source.index) return
          move(source.initialIndex, source.index)
        }}
      >
        <ol className="esmera-product-media-list">
          {gallery.map((item, index) => <SortableMedia key={String(item.id || item.mediaKey || index)} item={item} index={index} total={gallery.length} onMove={move} />)}
        </ol>
      </DragDropProvider>
      {feedback ? <InlineFeedback className={rollback ? 'is-rollback' : ''} tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
    </div>
  )
}
