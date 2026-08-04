/**
 * PR-08 — o assessment inicial do produto chega inteiro ao editor.
 *
 * `ProductsView` produz `publicationIssues` a partir de `assessProductPublication`;
 * este teste cobre a preservação do contrato e o encaminhamento ao formulário.
 */
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PublicationIssue } from '../../src/issues/types'

type DraftFormProps = {
  productId: string | number
  initialRevision?: string | null
  initialUpdatedAt?: string | null
  initialPublicationIssues?: PublicationIssue[]
  publicationReady?: boolean | null
}

const captured = vi.hoisted(() => ({ props: [] as DraftFormProps[] }))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href, ...props }, children),
}))

// `views/shared` arrasta @payloadcms/next/templates (e o CSS do react-image-crop)
// só para os helpers de layout; aqui interessa apenas o encaminhamento das props.
vi.mock('../../src/admin/views/shared', () => ({
  PageHeader: ({ title, actions, context }: { title: string; actions?: React.ReactNode; context?: React.ReactNode }) =>
    React.createElement('header', null, title, actions, context),
  TechnicalLink: ({ children }: { children: React.ReactNode }) => React.createElement('a', { href: '#' }, children),
  money: (cents: number | null | undefined) => (typeof cents === 'number' ? String(cents) : 'Sob consulta'),
  shortDate: (value: string | null | undefined) => value || '—',
}))

vi.mock('../../src/admin/modules/products/ProductMediaManager', () => ({
  ProductMediaManager: () => React.createElement('div', { 'data-testid': 'media-manager' }),
}))

vi.mock('../../src/admin/modules/products/ProductDraftForm', () => ({
  ProductDraftForm: (props: DraftFormProps) => {
    captured.props.push(props)
    return React.createElement('div', { 'data-testid': 'draft-form' })
  },
}))

const { ProductDocumentView } = await import('../../src/admin/modules/products/ProductDocumentView')

const blocker: PublicationIssue = {
  code: 'product.price_required',
  severity: 'blocker',
  path: 'basePriceCents',
  tab: 'commercial',
  label: 'Preço base',
  message: 'Informe o preço base antes de publicar.',
  suggestion: 'Preencha o valor em reais.',
  anchor: 'product-base-price',
  source: 'readiness',
}

const warning: PublicationIssue = {
  code: 'product.gallery_alt_review',
  severity: 'warning',
  path: 'gallery.alt',
  tab: 'gallery',
  label: 'Texto alternativo da imagem 1',
  message: 'Revise o texto alternativo da primeira imagem.',
  anchor: 'product-gallery-item-1-alt',
  source: 'media',
}

function renderDocument(issues: PublicationIssue[], publicationReady = false) {
  return render(React.createElement(ProductDocumentView, {
    product: {
      id: 7,
      title: 'Anel Solar',
      _status: 'draft',
      catalogStatus: 'active',
      availability: 'available',
      priceMode: 'inquiry',
      revision: 'rev-7',
      updatedAt: '2026-02-01T09:00:00.000Z',
      publicationReady,
      publicationIssues: issues,
    },
    tab: 'overview' as const,
    searchParams: {},
  }))
}

afterEach(() => {
  cleanup()
  captured.props.length = 0
})

describe('ProductsView → ProductDocumentView → ProductDraftForm', () => {
  it('ProductsView encaminha assessment.issues sem reduzir os campos', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/admin/modules/products/ProductsView.tsx'),
      'utf8',
    )
    expect(source).toContain('publicationIssues: [...assessment.issues]')
    // O mapeamento destrutivo que mantinha apenas `message` não existe mais.
    expect(source).not.toContain('assessment.issues.map')
  })

  it('encaminha as issues estruturadas ao formulário sem transformação', () => {
    const issues = [blocker, warning]
    renderDocument(issues)

    const props = captured.props[0]
    expect(props.initialPublicationIssues).toEqual(issues)
    // Identidade preservada: nenhuma issue foi reconstruída nem derivada de texto.
    expect(props.initialPublicationIssues?.[0]).toBe(blocker)
    expect(props.initialPublicationIssues?.[1]).toBe(warning)
  })

  it('preserva code, severity, path, tab, anchor, label, message e suggestion', () => {
    renderDocument([blocker])

    const forwarded = captured.props[0].initialPublicationIssues?.[0]
    expect(forwarded).toEqual({
      code: 'product.price_required',
      severity: 'blocker',
      path: 'basePriceCents',
      tab: 'commercial',
      label: 'Preço base',
      message: 'Informe o preço base antes de publicar.',
      suggestion: 'Preencha o valor em reais.',
      anchor: 'product-base-price',
      source: 'readiness',
    })
  })

  it('encaminha publicationReady, revisão e updatedAt recebidos do documento', () => {
    renderDocument([], true)

    const props = captured.props[0]
    expect(props.publicationReady).toBe(true)
    expect(props.initialPublicationIssues).toEqual([])
    expect(props.initialRevision).toBe('rev-7')
    expect(props.initialUpdatedAt).toBe('2026-02-01T09:00:00.000Z')
  })
})
