import fs from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { mapCoordinatorOutcome } from '../../src/server/publication/bulkPublication'
import {
  PublicationBlockedError,
  RevisionConflictError,
  type PublicationAssessment,
  type PublicationIssue,
} from '../../src/server/publication/types'

const root = process.cwd()
const LIST_UPDATED_AT = '2026-08-04T10:00:00.000Z'
const DRAFT_UPDATED_AT = '2026-08-04T10:00:05.000Z'

function issue(overrides: Partial<PublicationIssue> = {}): PublicationIssue {
  return {
    id: 'product.gallery_invalid',
    severity: 'blocker',
    path: 'gallery',
    tab: 'media',
    anchor: 'product-gallery',
    message: 'Adicione imagens válidas.',
    suggestion: null,
    source: 'business_rule',
    ...overrides,
  }
}

function assessment(issues: PublicationIssue[]): PublicationAssessment {
  return {
    version: '1',
    entity: 'product',
    entityId: 7,
    revision: 'rev-abc',
    ready: issues.every((entry) => entry.severity !== 'blocker'),
    issues,
    storefront: { contractVersion: '1', compatible: true, issues: [], probeStatus: 'not_run' },
    assessedAt: DRAFT_UPDATED_AT,
  }
}

const context = { id: 7, title: 'Nódulo I', updatedAt: DRAFT_UPDATED_AT }

function result(status: 'published' | 'published_but_unverified' | 'published_but_incompatible' | 'publish_reverted') {
  return {
    status,
    entityId: 7,
    revision: 'rev-abc',
    publicationRevision: 'public-revision',
    document: { updatedAt: '2026-08-04T10:00:09.000Z' },
    assessment: assessment([]),
    retryable: status === 'published_but_unverified',
    traceId: 'trace-7',
    verification: {
      status: status === 'published'
        ? 'compatible' as const
        : status === 'published_but_incompatible'
        ? 'incompatible' as const
        : 'unavailable' as const,
      expectedRevision: 'public-revision',
      contractVersion: '1',
      checkedAt: DRAFT_UPDATED_AT,
    },
  }
}

describe('mapCoordinatorOutcome — mapeamento coordenador → item do lote', () => {
  it('mapeia publicação confirmada usando o updatedAt do documento publicado', () => {
    const mapped = mapCoordinatorOutcome({ ok: true, result: result('published') }, context)
    expect(mapped.status).toBe('published')
    expect(mapped.revision).toBe('rev-abc')
    expect(mapped.updatedAt).toBe('2026-08-04T10:00:09.000Z')
    expect(mapped.publicationRevision).toBe('public-revision')
  })

  for (const status of ['published_but_unverified', 'published_but_incompatible', 'publish_reverted'] as const) {
    it(`preserva o estado operacional ${status}`, () => {
      const mapped = mapCoordinatorOutcome({ ok: true, result: result(status) }, context)
      expect(mapped.status).toBe(status)
      expect(mapped.publicationRevision).toBe('public-revision')
      expect(mapped.traceId).toBe('trace-7')
    })
  }

  it('mapeia bloqueio preservando as issues blocker e devolvendo o updatedAt novo', () => {
    const blockers = [issue(), issue({ id: 'product.title_missing', severity: 'warning' })]
    const mapped = mapCoordinatorOutcome({
      ok: false,
      error: new PublicationBlockedError(assessment(blockers)),
    }, context)
    expect(mapped.status).toBe('blocked')
    expect(mapped.issues).toHaveLength(1)
    expect(mapped.issues?.[0].id).toBe('product.gallery_invalid')
    expect(mapped.updatedAt).toBe(DRAFT_UPDATED_AT)
  })

  it('mapeia conflito de revisão e nunca devolve token fresco', () => {
    const mapped = mapCoordinatorOutcome({ ok: false, error: new RevisionConflictError() }, context)
    expect(mapped.status).toBe('revision_conflict')
    expect(mapped.updatedAt).toBeUndefined()
  })

  it('mapeia erro inesperado como failed sem token', () => {
    const mapped = mapCoordinatorOutcome({ ok: false, error: new Error('conexão perdida') }, context)
    expect(mapped.status).toBe('failed')
    expect(mapped.message).toBe('conexão perdida')
    expect(mapped.updatedAt).toBeUndefined()
  })
})

describe('handshake de confirmação de warnings em duas etapas', () => {
  it('devolve token, revisão e um updatedAt posterior ao primeiro saveDraft', () => {
    const warning = issue({ id: 'product.price_review', severity: 'warning', message: 'Revise o preço.' })
    const mapped = mapCoordinatorOutcome({
      ok: true,
      result: {
        status: 'requires_confirmation',
        entityId: 7,
        revision: 'rev-abc',
        assessment: assessment([warning]),
        confirmationToken: 'token-123',
        retryable: false,
        traceId: 'trace-warning',
      },
    }, context)
    expect(mapped.status).toBe('warning_requires_confirmation')
    expect(mapped.confirmationToken).toBe('token-123')
    expect(mapped.revision).toBe('rev-abc')
    expect(mapped.issues?.map((entry) => entry.id)).toEqual(['product.price_review'])
    expect(mapped.updatedAt).toBe(DRAFT_UPDATED_AT)
    expect(mapped.updatedAt).not.toBe(LIST_UPDATED_AT)
  })

  it('a requisição de confirmação usa o updatedAt devolvido, não o da lista', () => {
    const mapped = mapCoordinatorOutcome({
      ok: true,
      result: {
        status: 'requires_confirmation',
        entityId: 7,
        revision: 'rev-abc',
        assessment: assessment([issue({ severity: 'warning' })]),
        confirmationToken: 'token-123',
        retryable: false,
        traceId: 'trace-warning',
      },
    }, context)
    expect({
      id: mapped.id,
      expectedUpdatedAt: mapped.updatedAt,
      confirmationToken: mapped.confirmationToken,
    }).toEqual({
      id: 7,
      expectedUpdatedAt: DRAFT_UPDATED_AT,
      confirmationToken: 'token-123',
    })
  })
})

describe('guard estático — o lote não publica fora do coordenador', () => {
  it('não faz publicação em lote direta fora do coordenador', async () => {
    const route = await fs.readFile(path.join(root, 'src/app/(payload)/api/admin-products/route.ts'), 'utf8')
    expect(route).toContain('publishProductsInBulk')
    expect(route).not.toContain('assessment.ready')
    const bulk = await fs.readFile(path.join(root, 'src/server/publication/bulkPublication.ts'), 'utf8')
    expect(bulk).toContain('coordinatePublication')
    expect(bulk).toContain('verificationConfig: runtime.verificationConfig')
  })
})
