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
    code: 'product.gallery.empty',
    severity: 'blocker',
    path: 'gallery',
    tab: 'gallery',
    label: 'Galeria',
    anchor: 'product-gallery',
    message: 'Adicione imagens válidas.',
    source: 'readiness',
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

describe('mapCoordinatorOutcome — mapeamento coordenador → item do lote', () => {
  it('mapeia publicação bem-sucedida usando o updatedAt do documento publicado', () => {
    const result = mapCoordinatorOutcome({
      ok: true,
      result: {
        status: 'published',
        entityId: 7,
        revision: 'rev-abc',
        document: { updatedAt: '2026-08-04T10:00:09.000Z' },
        assessment: assessment([]),
      },
    }, context)

    expect(result.status).toBe('published')
    expect(result.revision).toBe('rev-abc')
    expect(result.updatedAt).toBe('2026-08-04T10:00:09.000Z')
  })

  it('trata published_but_unverified como publicado (verify fora de escopo do PR-03)', () => {
    const result = mapCoordinatorOutcome({
      ok: true,
      result: {
        status: 'published_but_unverified',
        entityId: 7,
        revision: 'rev-abc',
        assessment: assessment([]),
      },
    }, context)

    expect(result.status).toBe('published')
  })

  it('mapeia bloqueio preservando as issues blocker e devolvendo o updatedAt novo', () => {
    const blockers = [issue(), issue({ code: 'product.title.missing', severity: 'warning' })]
    const result = mapCoordinatorOutcome({
      ok: false,
      error: new PublicationBlockedError(assessment(blockers)),
    }, context)

    expect(result.status).toBe('blocked')
    expect(result.issues).toHaveLength(1)
    expect(result.issues?.[0].code).toBe('product.gallery.empty')
    // PublicationBlockedError é lançado depois do saveDraft do coordenador:
    // sem o updatedAt novo, corrigir e tentar de novo daria revision_conflict.
    expect(result.updatedAt).toBe(DRAFT_UPDATED_AT)
  })

  it('mapeia conflito de revisão e NUNCA devolve token fresco', () => {
    const result = mapCoordinatorOutcome({
      ok: false,
      error: new RevisionConflictError(),
    }, context)

    expect(result.status).toBe('revision_conflict')
    // Devolver um updatedAt fresco permitiria retry cego publicando conteúdo
    // que ninguém revisou — o operador precisa recarregar.
    expect(result.updatedAt).toBeUndefined()
  })

  it('mapeia erro inesperado como failed sem token', () => {
    const result = mapCoordinatorOutcome({
      ok: false,
      error: new Error('conexão perdida'),
    }, context)

    expect(result.status).toBe('failed')
    expect(result.message).toBe('conexão perdida')
    expect(result.updatedAt).toBeUndefined()
  })
})

describe('handshake de confirmação de warnings em duas etapas', () => {
  // Regressão do bug bloqueante: coordinatePublication valida expectedUpdatedAt
  // ANTES de saveDraft(), e o retorno requires_confirmation não inclui o
  // documento. Reenviar o updatedAt original da lista faria o coordenador
  // lançar RevisionConflictError antes mesmo de olhar o confirmationToken.
  it('devolve token, revisão e um updatedAt posterior ao primeiro saveDraft', () => {
    const warning = issue({ code: 'product.price_review', severity: 'warning', message: 'Revise o preço.' })

    const result = mapCoordinatorOutcome({
      ok: true,
      result: {
        status: 'requires_confirmation',
        entityId: 7,
        revision: 'rev-abc',
        assessment: assessment([warning]),
        confirmationToken: 'token-123',
      },
    }, context)

    expect(result.status).toBe('warning_requires_confirmation')
    expect(result.confirmationToken).toBe('token-123')
    expect(result.revision).toBe('rev-abc')
    expect(result.issues?.map((entry) => entry.code)).toEqual(['product.price_review'])

    expect(result.updatedAt).toBe(DRAFT_UPDATED_AT)
    expect(result.updatedAt).not.toBe(LIST_UPDATED_AT)
    expect(new Date(result.updatedAt as string).getTime())
      .toBeGreaterThan(new Date(LIST_UPDATED_AT).getTime())
  })

  it('a requisição de confirmação usa o updatedAt devolvido, não o da lista', () => {
    const result = mapCoordinatorOutcome({
      ok: true,
      result: {
        status: 'requires_confirmation',
        entityId: 7,
        revision: 'rev-abc',
        assessment: assessment([issue({ severity: 'warning' })]),
        confirmationToken: 'token-123',
      },
    }, context)

    // Exatamente o payload que ProductsWorkspaceClient monta no segundo passo.
    const confirmationRequest = {
      id: result.id,
      expectedUpdatedAt: result.updatedAt,
      confirmationToken: result.confirmationToken,
    }

    expect(confirmationRequest).toEqual({
      id: 7,
      expectedUpdatedAt: DRAFT_UPDATED_AT,
      confirmationToken: 'token-123',
    })
    expect(confirmationRequest.expectedUpdatedAt).not.toBe(LIST_UPDATED_AT)
  })
})

describe('guard estático — o lote não publica fora do coordenador', () => {
  it('não faz payload.update({_status: published}) fora do callback publish do coordenador', async () => {
    const source = await fs.readFile(
      path.join(root, 'src/app/(payload)/api/admin-products/route.ts'),
      'utf8',
    )

    // O único publish direto que resta na rota é o callback entregue ao
    // coordenador em save-and-publish; o caminho em lote foi removido.
    const occurrences = source.match(/_status:\s*'published'/g) || []
    expect(occurrences).toHaveLength(1)

    expect(source).toContain('publishProductsInBulk')
    expect(source).not.toContain('assessment.ready')
  })
})
