import { describe, expect, it, test } from 'vitest'

import { ISSUE_CODES } from '../../src/issues/codes'
import { assessProductPublication } from '../../src/server/publication/productAssessment'
import { canonicalizeForRevision } from '../../src/server/publication/revision'
import canonicalRevisionFixtures from '../fixtures/canonical-revision.fixtures.json'

describe('canonicalizeForRevision — shared fixture parity (backend/frontend must agree)', () => {
  for (const fixture of canonicalRevisionFixtures) {
    it(`matches fixture: ${fixture.name}`, () => {
      expect(canonicalizeForRevision(fixture.input)).toBe(fixture.canonical)
    })
  }
})

describe('FLOW-03 — readiness emite issues estruturadas na origem', () => {
  // Estes dois testes eram `test.fails`: documentavam que productAssessment.ts
  // adivinhava path/tab por substring da mensagem em português (issueMap), e que
  // mensagens sem regra caíam em `publicationIssues` com id posicional
  // (`product.legacy_issue_N`). A PR-06 corrigiu a origem — agora passam.
  const invalidCatalogStatus = () => assessProductPublication({
    title: 'Objeto Esméra',
    slug: 'objeto-esmera',
    code: 'ESM-001',
    categories: [1],
    catalogStatus: 'invalid-status' as never,
    availability: 'unique',
    priceMode: 'fixed',
    basePriceCents: 145_000,
    gallery: [{ image: 1, mediaKey: 'cover', role: 'cover', alt: 'Objeto em esmeralda' }],
    optionDefinitions: [],
    variants: [],
  })

  test('um status de catálogo inválido aponta para o campo real, não para o balde genérico', () => {
    const assessment = invalidCatalogStatus()
    const issue = assessment.issues.find((entry) => entry.code === ISSUE_CODES.productCatalogStatusInvalid)

    expect(issue?.path).toBe('catalogStatus')
    expect(issue?.tab).toBe('identity')
    expect(issue?.anchor).toBe('product-catalog-status')
    expect(assessment.issues.some((entry) => entry.path === 'publicationIssues')).toBe(false)
  })

  test('o código é semântico e estável, não derivado da posição no array', () => {
    const assessment = invalidCatalogStatus()

    expect(assessment.issues.some((entry) => entry.code === ISSUE_CODES.productCatalogStatusInvalid)).toBe(true)
    expect(assessment.issues.some((entry) => /legacy_issue/.test(entry.code))).toBe(false)
  })
})
