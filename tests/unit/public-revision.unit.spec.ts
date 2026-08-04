import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  createPublicDocumentRevision,
  createPublicProjection,
  PublicRevisionProjectionError,
  type PublicRevisionEntity,
} from '../../src/server/publication/publicRevision'
import { createDocumentRevision } from '../../src/server/publication/revision'

type Fixture = {
  name: string
  entity: PublicRevisionEntity
  document: Record<string, unknown>
  expectedProjection: unknown
  expectedRevision: string
}

const fixturePath = path.join(process.cwd(), 'tests/fixtures/public-revision.fixtures.json')
const fixtures = JSON.parse(await fs.readFile(fixturePath, 'utf8')) as Fixture[]
const byEntity = Object.fromEntries(fixtures.map((fixture) => [fixture.entity, fixture])) as Record<PublicRevisionEntity, Fixture>

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe('revisão pública determinística', () => {
  for (const fixture of fixtures) {
    it(`${fixture.entity} corresponde à projeção e ao SHA-256 da fixture`, () => {
      expect(createPublicProjection(fixture.entity, fixture.document)).toEqual(fixture.expectedProjection)
      expect(createPublicDocumentRevision(fixture.entity, fixture.document)).toBe(fixture.expectedRevision)
      expect(fixture.expectedRevision).toMatch(/^[a-f0-9]{64}$/)
    })
  }

  it('ordem de propriedades não altera o hash', () => {
    const document = byEntity.category.document
    const reordered = Object.fromEntries(Object.entries(document).reverse())
    expect(createPublicDocumentRevision('category', reordered))
      .toBe(createPublicDocumentRevision('category', document))
  })

  it('timestamps, metadados de publicação e campos administrativos não alteram o hash público', () => {
    const document = clone(byEntity.product.document)
    const changed = {
      ...document,
      createdAt: '2099-01-01T00:00:00.000Z',
      updatedAt: '2099-01-02T00:00:00.000Z',
      publicationRevision: 'forjado',
      publicationContractVersion: '999',
      publicationReady: false,
      publicationIssues: [{ message: 'admin' }],
      internalNotes: 'outro valor administrativo',
    }
    expect(createPublicDocumentRevision('product', changed))
      .toBe(createPublicDocumentRevision('product', document))
  })

  it('título, preço e URL de mídia públicos alteram o hash', () => {
    const document = clone(byEntity.product.document)
    const title = { ...document, title: 'Nódulo II' }
    const price = { ...document, basePriceCents: 1590000 }
    const media = clone(document)
    ;((media.gallery as Array<Record<string, unknown>>)[0].image as Record<string, unknown>).url = 'https://cdn.example.com/novo.jpg'

    const base = createPublicDocumentRevision('product', document)
    expect(createPublicDocumentRevision('product', title)).not.toBe(base)
    expect(createPublicDocumentRevision('product', price)).not.toBe(base)
    expect(createPublicDocumentRevision('product', media)).not.toBe(base)
  })

  it('preserva ordem de arrays semânticos como a galeria', () => {
    const document = clone(byEntity.product.document)
    const reversed = clone(document)
    reversed.gallery = [...(reversed.gallery as unknown[])].reverse()
    expect(createPublicDocumentRevision('product', reversed))
      .not.toBe(createPublicDocumentRevision('product', document))
  })

  it('normaliza disabledSections como conjunto ordenado', () => {
    const document = clone(byEntity.home.document)
    const reordered = clone(document)
    reordered.disabledSections = [...(reordered.disabledSections as unknown[])].reverse()
    expect(createPublicDocumentRevision('home', reordered))
      .toBe(createPublicDocumentRevision('home', document))
  })

  it('relação que exige conteúdo populado rejeita ID escalar', () => {
    const document = clone(byEntity.product.document)
    document.categories = [7]
    expect(() => createPublicDocumentRevision('product', document))
      .toThrow(PublicRevisionProjectionError)
  })

  it('relação projetada apenas por identidade aceita ID ou objeto', () => {
    const scalarParent = clone(byEntity.category.document)
    scalarParent.parent = 2
    const objectParent = clone(byEntity.category.document)
    objectParent.parent = { id: 2, title: 'Título não projetado' }
    expect(createPublicDocumentRevision('category', scalarParent))
      .toBe(createPublicDocumentRevision('category', objectParent))
  })
})

describe('separação da revisão editorial', () => {
  it('createDocumentRevision ignora os dois metadados públicos', () => {
    const document = { title: 'Objeto', updatedAt: '2026-08-04T00:00:00.000Z' }
    const stamped = {
      ...document,
      publicationRevision: 'a'.repeat(64),
      publicationContractVersion: '1',
    }
    expect(createDocumentRevision(stamped)).toBe(createDocumentRevision(document))
  })

  it('conteúdo editorial continua alterando createDocumentRevision', () => {
    expect(createDocumentRevision({ title: 'A' })).not.toBe(createDocumentRevision({ title: 'B' }))
  })
})
