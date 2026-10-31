import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductGalleryUploader } from '../../src/admin/modules/products/ProductGalleryUploader'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProductGalleryUploader — controle de upload acessível', () => {
  it('troca o controle nativo cru por um input focável dentro do rótulo estilizado', () => {
    const { container } = render(React.createElement(ProductGalleryUploader, { productId: 'prod-1' }))
    const field = container.querySelector('.esmera-file-upload')
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null

    expect(field?.tagName).toBe('LABEL')
    expect(input).toBeTruthy()
    // Input real oculto mas focável (técnica de clip, não display:none): preserva
    // a operabilidade por teclado do disparo do upload.
    expect(input?.classList.contains('esmera-file-upload__input')).toBe(true)
    expect(input?.classList.contains('esmera-input')).toBe(false)
    expect(input?.disabled).toBe(false)
    expect(field?.contains(input)).toBe(true)
    // Área de escolha estilizada e botão de envio permanecem presentes.
    expect(container.querySelector('.esmera-file-upload__button')?.textContent).toBe('Escolher imagem')
    expect(screen.getByRole('button', { name: 'Enviar imagem' })).toBeTruthy()
  })


  it('recusa anexar uma mídia enviada sem status published', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(
      JSON.stringify({ id: 1205, _status: 'draft' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const onBusyChange = vi.fn()
    const { container } = render(React.createElement(ProductGalleryUploader, { productId: 778, onBusyChange }))
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['imagem'], 'objeto.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar imagem' }))

    await waitFor(() => expect(screen.getByText(/não está publicada/)).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onBusyChange).toHaveBeenCalledWith(true)
    expect(onBusyChange).toHaveBeenCalledWith(false)
  })

  it('anexa uma mídia publicada e informa a galeria atualizada', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ id: 1205, _status: 'published' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ gallery: [{ id: 'item-1', image: { id: 1205, _status: 'published' }, mediaKey: 'imagem-1', role: 'cover', alt: 'Objeto Esméra' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))
    vi.stubGlobal('fetch', fetchMock)
    const onGalleryChange = vi.fn()
    const { container } = render(React.createElement(ProductGalleryUploader, { productId: 778, onGalleryChange }))
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['imagem'], 'objeto.png', { type: 'image/png' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar imagem' }))

    await waitFor(() => expect(screen.getByText('Imagem adicionada à galeria.')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onGalleryChange).toHaveBeenCalledWith([expect.objectContaining({ role: 'cover' })])
  })

  it('usa o estado vazio canônico (EmptyState) quando a galeria está vazia', () => {
    render(React.createElement(ProductGalleryUploader, { productId: 'prod-1' }))
    expect(screen.getByText('Galeria vazia')).toBeTruthy()
  })
})
