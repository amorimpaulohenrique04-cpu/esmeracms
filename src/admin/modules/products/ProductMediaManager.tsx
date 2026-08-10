'use client'

import { DragDropProvider } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import React, { useRef, useState } from 'react'

import { Button, InlineFeedback, SavingState, Status } from '../../design-system'
import { announceAdmin, announceDraftChanged } from '../../state/AdminStateProvider'
import { imageURL, relationId, roleLabels, type ProductGalleryItem, type ProductMedia } from './types'

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

type MediaUploadResponse = ProductMedia & {
  doc?: ProductMedia
  error?: string | { summary?: string; message?: string }
  errors?: Array<{ message?: string }>
}

function uploadError(body: MediaUploadResponse, fallback: string) {
  if (typeof body.error === 'string') return body.error
  return body.error?.summary || body.error?.message || body.errors?.[0]?.message || fallback
}

export function ProductMediaManager({
  productId,
  productTitle,
  initialGallery,
}: {
  productId: string | number
  productTitle?: string | null
  initialGallery: ProductGalleryItem[]
}) {
  const [gallery, setGallery] = useState(initialGallery)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rollback, setRollback] = useState(false)
  const [clearArmed, setClearArmed] = useState(false)
  const lastSaved = useRef(initialGallery)
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = saving || uploading

  async function addImage(file: File) {
    if (busy || gallery.length >= 12) return
    setUploading(true)
    setRollback(false)
    setClearArmed(false)
    setFeedback(null)

    try {
      const position = gallery.length + 1
      const alt = productTitle?.trim() ? `${productTitle.trim()} — imagem ${position}` : `Imagem ${position}`
      const formData = new FormData()
      formData.append('file', file)
      formData.append('_payload', JSON.stringify({ alt, _status: 'published' }))

      const uploadResponse = await fetch('/api/media', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        body: formData,
      })
      const uploadBody = await uploadResponse.json() as MediaUploadResponse
      if (!uploadResponse.ok) throw new Error(uploadError(uploadBody, 'Não foi possível enviar a imagem.'))
      const media = uploadBody.doc || uploadBody
      if (media.id === undefined || media.id === null) throw new Error('A mídia foi enviada sem identificador retornado.')

      const appendResponse = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'add-gallery-image', id: productId, mediaId: media.id }),
      })
      const appendBody = await appendResponse.json() as MediaUploadResponse & { gallery?: ProductGalleryItem[] }
      if (!appendResponse.ok) throw new Error(uploadError(appendBody, 'Não foi possível adicionar a imagem à galeria.'))
      if (!Array.isArray(appendBody.gallery)) throw new Error('A galeria atualizada não foi retornada.')

      setGallery(appendBody.gallery)
      lastSaved.current = appendBody.gallery
      const message = 'Imagem adicionada e metadados preenchidos automaticamente.'
      setFeedback(message)
      announceDraftChanged({ kind: 'product', id: productId, field: 'gallery' })
      announceAdmin(message)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível adicionar a imagem.'
      setRollback(true)
      setFeedback(message)
      announceAdmin(message, true)
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function archiveForEmptyGallery() {
    const response = await fetch('/api/admin-products', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'archive', ids: [productId] }),
    })
    const body = await response.json() as { error?: string; errors?: Array<{ message?: string }> }
    const actionError = body.errors?.[0]?.message
    if (!response.ok || actionError) {
      throw new Error(actionError || body.error || 'Não foi possível arquivar o produto antes de limpar a galeria.')
    }
  }

  async function persist(next: ProductGalleryItem[], successMessage = 'Galeria salva no rascunho.') {
    setSaving(true)
    setRollback(false)
    setFeedback(null)
    try {
      if (!next.length) await archiveForEmptyGallery()

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
      const message = next.length ? successMessage : `${successMessage} O produto foi arquivado até receber novas imagens.`
      setFeedback(message)
      announceDraftChanged({ kind: 'product', id: productId, field: 'gallery' })
      announceAdmin(message)
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
    if (to < 0 || to >= gallery.length || from === to || busy) return
    setClearArmed(false)
    const next = [...gallery]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setGallery(next)
    announceAdmin(`${item.mediaKey || `Imagem ${from + 1}`} movida para a posição ${to + 1}.`)
    void persist(next, 'Ordem da galeria salva no rascunho.')
  }

  function remove(index: number) {
    if (busy || index < 0 || index >= gallery.length) return
    const removed = gallery[index]
    const next = nextGalleryWithout(gallery, index)
    setClearArmed(false)
    setGallery(next)
    void persist(next, `${removed?.mediaKey || `Imagem ${index + 1}`} removida da galeria.`)
  }

  function removeAll() {
    if (busy || !gallery.length) return
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
        <div className="esmera-empty"><strong>Galeria vazia</strong><span>Adicione a primeira imagem sem sair deste produto.</span><Button tone="primary" disabled={busy} onClick={() => fileInput.current?.click()}>Adicionar imagem</Button></div>
        <input ref={fileInput} className="esmera-product-media-upload-input" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImage(file) }} />
        {uploading ? <SavingState state="saving" message="Enviando imagem…" /> : null}
        {saving ? <SavingState state="saving" message="Limpando galeria…" /> : null}
        {feedback ? <InlineFeedback className={rollback ? 'is-rollback' : ''} tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
      </div>
    )
  }

  return (
    <div className="esmera-product-media-manager">
      <div className="esmera-product-media-note">
        <span>Arraste para ordenar. Para teclado ou tecnologia assistiva, use os botões ↑ e ↓.</span>
        <div className="esmera-product-media-actions">
          <Button tone="primary" disabled={busy || gallery.length >= 12} onClick={() => fileInput.current?.click()}>Adicionar imagem</Button>
          <Button tone={clearArmed ? 'danger' : 'quiet'} disabled={busy} onClick={removeAll}>
            {clearArmed ? 'Confirmar remoção' : 'Remover todas'}
          </Button>
        </div>
        <input ref={fileInput} className="esmera-product-media-upload-input" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImage(file) }} />
        {uploading ? <SavingState state="saving" message="Enviando imagem…" /> : null}
        {saving ? <SavingState state="saving" message="Salvando galeria…" /> : null}
      </div>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled || busy) return
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
              disabled={busy}
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
