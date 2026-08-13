'use client'

import React, { useRef, useState } from 'react'

import { Button, Field, InlineFeedback, SavingState, Status } from '../../design-system'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'
import { imageURL, relationId, roleLabels, type ProductGalleryItem } from './types'

type UploadResponse = { id?: string | number }
type GalleryResponse = { gallery?: ProductGalleryItem[] }

// Uploader completo da galeria para o popup de criação. Sobe a imagem para a
// coleção `media` (endpoint admin-product-media) e anexa via `add-gallery-image`,
// que já gera mediaKey, capa automática e texto alternativo no servidor. Remover
// e reordenar reaproveitam `reorder-gallery`, com otimista-com-rollback.
export function ProductGalleryUploader({
  productId,
  onGalleryChange,
}: {
  productId: string | number
  onGalleryChange?: (gallery: ProductGalleryItem[]) => void
}) {
  const [gallery, setGallery] = useState<ProductGalleryItem[]>([])
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [rollback, setRollback] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const lastSaved = useRef<ProductGalleryItem[]>([])

  function commit(next: ProductGalleryItem[]) {
    lastSaved.current = next
    setGallery(next)
    onGalleryChange?.(next)
  }

  async function addImage(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setRollback(true)
      setFeedback('Selecione uma imagem.')
      return
    }

    setBusy(true)
    setRollback(false)
    setFeedback(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const upload = await fetch('/api/admin-product-media', { method: 'POST', credentials: 'same-origin', body: form })
      const media = await expectAdminResponse<UploadResponse>(upload, 'Não foi possível enviar a imagem.')
      if (media.id === undefined) throw new Error('A imagem foi enviada sem identificador retornado.')

      const response = await fetch('/api/admin-products', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ action: 'add-gallery-image', id: productId, mediaId: media.id }),
      })
      const body = await expectAdminResponse<GalleryResponse>(response, 'Não foi possível adicionar a imagem à galeria.')
      commit(body.gallery || [])
      setFeedback('Imagem adicionada à galeria.')
      if (fileRef.current) fileRef.current.value = ''
    } catch (error) {
      setRollback(true)
      setFeedback(normalizeAdminError(error, 'Não foi possível enviar a imagem.').summary)
    } finally {
      setBusy(false)
    }
  }

  async function persist(next: ProductGalleryItem[], successMessage: string) {
    setBusy(true)
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
            image: relationId(item.image),
            mediaKey: item.mediaKey,
            role: item.role,
            alt: item.alt,
          })),
        }),
      })
      await expectAdminResponse(response, 'Não foi possível salvar a galeria.')
      commit(next)
      setFeedback(successMessage)
    } catch (error) {
      setGallery(lastSaved.current)
      onGalleryChange?.(lastSaved.current)
      setRollback(true)
      setFeedback(`${normalizeAdminError(error, 'Não foi possível salvar a galeria.').summary} A galeria anterior foi restaurada.`)
    } finally {
      setBusy(false)
    }
  }

  function move(from: number, to: number) {
    if (busy || to < 0 || to >= gallery.length || from === to) return
    const next = [...gallery]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    void persist(next, 'Ordem da galeria atualizada.')
  }

  function remove(index: number) {
    if (busy || index < 0 || index >= gallery.length) return
    const removed = gallery[index]
    const next = gallery.filter((_, itemIndex) => itemIndex !== index)
    void persist(next, `${removed?.mediaKey || `Imagem ${index + 1}`} removida da galeria.`)
  }

  function makeCover(index: number) {
    if (busy || gallery[index]?.role === 'cover') return
    const next = gallery.map((item, itemIndex) => ({
      ...item,
      role: itemIndex === index ? 'cover' : item.role === 'cover' ? 'detail' : item.role,
    }))
    void persist(next, 'Capa atualizada.')
  }

  return (
    <div className="esmera-product-gallery-uploader">
      <form className="esmera-product-gallery-uploader__add" onSubmit={addImage}>
        <Field label="Adicionar imagem" hint="Código de mídia, capa e texto alternativo são gerados automaticamente.">
          <input ref={fileRef} className="esmera-input" type="file" accept="image/*" disabled={busy} />
        </Field>
        <Button type="submit" busy={busy}>Enviar imagem</Button>
      </form>

      {gallery.length ? (
        <ol className="esmera-product-media-list">
          {gallery.map((item, index) => {
            const url = imageURL(item)
            return (
              <li key={String(item.id || item.mediaKey || index)} className="esmera-product-media-item">
                <span className="esmera-product-media-handle" aria-hidden="true">{index + 1}</span>
                <div className="esmera-product-media-thumb">{url ? <img src={url} alt={item.alt || ''} /> : <span>Sem preview</span>}</div>
                <div className="esmera-product-media-copy">
                  <strong>{item.mediaKey || `Imagem ${index + 1}`}</strong>
                  <span>{item.alt || 'Sem texto alternativo'}</span>
                  <small>{index + 1} de {gallery.length}</small>
                </div>
                <Status tone={item.role === 'cover' ? 'success' : 'neutral'}>{roleLabels[item.role || ''] || 'Imagem'}</Status>
                <div className="esmera-product-media-move" aria-label="Ações da imagem">
                  <Button className="esmera-product-media-move-button" disabled={busy || index === 0} onClick={() => move(index, index - 1)} aria-label="Mover para cima">↑</Button>
                  <Button className="esmera-product-media-move-button" disabled={busy || index === gallery.length - 1} onClick={() => move(index, index + 1)} aria-label="Mover para baixo">↓</Button>
                  <Button disabled={busy || item.role === 'cover'} onClick={() => makeCover(index)} aria-label={`Definir ${item.mediaKey || `imagem ${index + 1}`} como capa`}>Capa</Button>
                  <Button tone="danger" disabled={busy} onClick={() => remove(index)} aria-label={`Remover ${item.mediaKey || `imagem ${index + 1}`} da galeria`}>Remover</Button>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="esmera-empty"><strong>Galeria vazia</strong><span>Envie a primeira imagem acima. Ela vira a capa automaticamente.</span></div>
      )}

      {busy ? <SavingState state="saving" message="Salvando galeria…" /> : null}
      {feedback ? <InlineFeedback tone={rollback ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}
    </div>
  )
}
