import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { ProductGalleryUploader } from '../../src/admin/modules/products/ProductGalleryUploader'

afterEach(cleanup)

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

  it('usa o estado vazio canônico (EmptyState) quando a galeria está vazia', () => {
    render(React.createElement(ProductGalleryUploader, { productId: 'prod-1' }))
    expect(screen.getByText('Galeria vazia')).toBeTruthy()
  })
})
