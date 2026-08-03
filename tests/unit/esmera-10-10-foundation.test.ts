import { describe, expect, it } from 'vitest'

import { normalizeAdminServerError } from '../../src/server/admin/errors/fromPayload'
import { coordinatePublication } from '../../src/server/publication/coordinator'
import { assessProductPublication } from '../../src/server/publication/productAssessment'
import { canonicalizeForRevision, createDocumentRevision } from '../../src/server/publication/revision'
import { PublicationBlockedError, RevisionConflictError } from '../../src/server/publication/types'
import { validateStorefrontSnapshot } from '../../src/server/storefront-contract/validate'

function validProduct() {
  return {
    id: 21,
    title: 'Nódulo I',
    slug: 'nodulo-i',
    code: 'OBJ-021',
    catalogStatus: 'active',
    categories: [{ id: 8, title: 'Esculturas', slug: 'esculturas', status: 'active', _status: 'published' }],
    gallery: [{
      image: { id: 91, url: 'https://cdn.example.com/nodulo.jpg', alt: 'Escultura em esmeralda sobre base mineral' },
      mediaKey: 'principal',
      role: 'cover',
      alt: 'Escultura em esmeralda sobre base mineral',
    }],
    availability: 'unique',
    priceMode: 'inquiry',
    optionDefinitions: [],
    variants: [],
    _status: 'draft',
    updatedAt: '2026-08-03T10:00:00.000Z',
  }
}

describe('administrative error contract', () => {
  it('preserves nested field paths and maps them to an editorial location', () => {
    const normalized = normalizeAdminServerError({
      name: 'ValidationError',
      status: 422,
      errors: [{ path: 'gallery.1.alt', message: 'Informe o texto alternativo.' }],
    }, { entity: 'product' })

    expect(normalized.code).toBe('validation_failed')
    expect(normalized.fieldErrors).toEqual([
      expect.objectContaining({
        path: 'gallery.1.alt',
        tab: 'gallery',
        anchor: 'product-gallery',
        message: 'Informe o texto alternativo.',
      }),
    ])
  })

  it('does not expose arbitrary server objects as details', () => {
    const normalized = normalizeAdminServerError({
      status: 500,
      message: 'Falha interna',
      stack: 'secret stack',
      sql: 'select * from users',
    }, { entity: 'product' })

    expect(normalized.detail).toBeNull()
    expect(JSON.stringify(normalized)).not.toContain('secret stack')
    expect(JSON.stringify(normalized)).not.toContain('select *')
  })
})

describe('document revisions', () => {
  it('is stable across key order and volatile timestamps', () => {
    const first = { title: 'Peça', updatedAt: 'a', nested: { b: 2, a: 1 } }
    const second = { nested: { a: 1, b: 2 }, title: 'Peça', updatedAt: 'b' }

    expect(canonicalizeForRevision(first)).toBe(canonicalizeForRevision(second))
    expect(createDocumentRevision(first)).toBe(createDocumentRevision(second))
  })
})

describe('storefront and publication assessment', () => {
  it('accepts a renderable product snapshot', () => {
    const product = validProduct()
    const storefront = validateStorefrontSnapshot('product', product)
    const assessment = assessProductPublication(product)

    expect(storefront.compatible).toBe(true)
    expect(assessment.ready).toBe(true)
    expect(assessment.issues).toEqual([])
  })

  it('returns actionable paths for a non-renderable product', () => {
    const product = { ...validProduct(), title: '', categories: [], gallery: [] }
    const assessment = assessProductPublication(product)

    expect(assessment.ready).toBe(false)
    expect(assessment.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'title', severity: 'blocker' }),
      expect.objectContaining({ path: 'categories', severity: 'blocker' }),
      expect.objectContaining({ path: 'gallery', severity: 'blocker' }),
    ]))
  })
})

describe('publication coordinator', () => {
  it('saves the draft and blocks publication when assessment fails', async () => {
    let persisted = { ...validProduct() }
    let published = false

    await expect(coordinatePublication({
      entity: 'product',
      entityId: persisted.id,
      data: { title: '' },
      readCurrent: async () => persisted,
      saveDraft: async (data) => {
        persisted = { ...persisted, ...data, updatedAt: '2026-08-03T10:01:00.000Z' }
        return persisted
      },
      readDraft: async () => persisted,
      assess: assessProductPublication,
      publish: async () => {
        published = true
        return persisted
      },
    })).rejects.toBeInstanceOf(PublicationBlockedError)

    expect(persisted.title).toBe('')
    expect(published).toBe(false)
  })

  it('rejects a stale expected revision before writing', async () => {
    const persisted = validProduct()
    let wrote = false

    await expect(coordinatePublication({
      entity: 'product',
      entityId: persisted.id,
      data: { title: 'Outro título' },
      expectedRevision: 'stale-revision',
      readCurrent: async () => persisted,
      saveDraft: async () => {
        wrote = true
        return persisted
      },
      readDraft: async () => persisted,
      assess: assessProductPublication,
      publish: async () => persisted,
    })).rejects.toBeInstanceOf(RevisionConflictError)

    expect(wrote).toBe(false)
  })
})
