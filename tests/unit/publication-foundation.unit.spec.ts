import { describe, expect, it, test } from 'vitest'

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

describe('FLOW-03 — readiness issues are unstructured strings reconstructed by fragile matching', () => {
  // Fase 4/PR-06 trocou getProductReadiness() para retornar PublicationIssue[]
  // estruturadas (src/issues/*): path/tab/label agora vêm do registry, não de
  // adivinhação por prefixo/substring da mensagem. Gap fechado — test.fails
  // trocado por test normal conforme instruído abaixo.
  test('an unmapped readiness message gets routed to a real field location, not the generic checklist bucket', () => {
    // "Status de catálogo inválido." (readiness.ts:153) doesn't match any prefix/substring
    // rule in productAssessment.ts's issueMap — it silently falls into the generic
    // 'publicationIssues' bucket (tab: 'review') instead of pointing at catalogStatus.
    const assessment = assessProductPublication({
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

    const issue = assessment.issues.find((entry) => entry.message === 'Status de catálogo inválido.')
    expect(issue?.path).toBe('catalogStatus')
  })

  test.fails('two different unmapped messages get stable, semantic issue ids instead of positional ones', () => {
    // legacyIssue() falls back to `product.legacy_issue_${index + 1}` for unmapped
    // messages — the id depends on array position, not on the message itself, so
    // reordering readiness.issues silently changes issue identity.
    const first = assessProductPublication({
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
    const issue = first.issues.find((entry) => entry.message === 'Status de catálogo inválido.')
    expect(issue?.code).toBe('product.catalog_status_invalid')
  })
})
