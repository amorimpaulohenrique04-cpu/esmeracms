import { describe, expect, it, vi } from 'vitest'

import {
  coordinatePublication,
  PublicationVerificationRequiredError,
  type PublicationVerification,
} from '../../src/server/publication/coordinator'
import { createDocumentRevision } from '../../src/server/publication/revision'
import { RevisionConflictError, type PublicationAssessment, type PublicationIssue } from '../../src/server/publication/types'

// PR-05 — statuses, retry e rollback condicional (Fase 3 do plano mestre).
// PR-04 (f24d021) introduziu publicRevision.ts e storefrontProbe.ts "sem
// conectar a verificação ao coordenador" (mensagem do commit); este arquivo
// cobre exclusivamente a matriz de testes obrigatória (docs/cms-implementation-plan.md
// §17.1) para o que este PR conecta: PUB-U01 a PUB-U06.

type Doc = { id: number; title: string; body: string; updatedAt?: string }

function doc(overrides: Partial<Doc> = {}): Doc {
  return { id: 1, title: 'Produto', body: 'conteúdo original', updatedAt: '2026-08-05T00:00:00.000Z', ...overrides }
}

function assessmentFor(revision: string, issues: PublicationIssue[] = []): PublicationAssessment {
  return {
    version: '1',
    entity: 'product',
    entityId: 1,
    revision,
    ready: issues.every((issue) => issue.severity !== 'blocker'),
    issues,
    storefront: { contractVersion: '1', compatible: true, issues: [], probeStatus: 'not_run' },
    assessedAt: '2026-08-05T00:00:01.000Z',
  }
}

function warningIssue(id: string): PublicationIssue {
  return {
    id,
    severity: 'warning',
    message: 'Revise antes de publicar.',
    source: 'business_rule',
  }
}

describe('PUB-U01 — incompatible não resulta em published', () => {
  it('devolve published_but_incompatible quando não há revertPublish configurado', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)
    const verify = vi.fn(async (): Promise<PublicationVerification> => ({ status: 'incompatible' }))

    const result = await coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      readDraft: async () => current,
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify,
    })

    expect(result.status).toBe('published_but_incompatible')
    expect(result.status).not.toBe('published')
    expect(verify).toHaveBeenCalledTimes(1)
  })
})

describe('PUB-U02 — not_run em entidade pública falha', () => {
  it('rejeita save-and-publish de produto sem verify configurado', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)

    await expect(coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      readDraft: async () => current,
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      // verify intencionalmente omitido
    })).rejects.toBeInstanceOf(PublicationVerificationRequiredError)
  })

  it('categoria também exige verify (entidade pública)', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)

    await expect(coordinatePublication({
      entity: 'category',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      readDraft: async () => current,
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
    })).rejects.toBeInstanceOf(PublicationVerificationRequiredError)
  })
})

describe('PUB-U03 — unavailable resulta em unverified', () => {
  it('devolve published_but_unverified quando o probe está indisponível', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)

    const result = await coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      readDraft: async () => current,
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify: async () => ({ status: 'unavailable' }),
    })

    expect(result.status).toBe('published_but_unverified')
  })
})

describe('PUB-U04 — revision mismatch executa retries', () => {
  it('tenta novamente em revision_mismatch e converge para compatible', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)
    let calls = 0
    const verify = vi.fn(async (): Promise<PublicationVerification> => {
      calls += 1
      if (calls < 3) return { status: 'revision_mismatch', retryAfterMs: 0 }
      return { status: 'compatible' }
    })

    const result = await coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      readDraft: async () => current,
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify,
    })

    expect(verify).toHaveBeenCalledTimes(3)
    expect(result.status).toBe('published')
  })

  it('esgota as tentativas e reporta unverified em vez de revisão antiga como incompatível', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)
    const verify = vi.fn(async (): Promise<PublicationVerification> => ({ status: 'revision_mismatch', retryAfterMs: 0 }))

    const result = await coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      readDraft: async () => current,
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify,
    })

    // orçamento de 3 tentativas (ver MAX_VERIFY_ATTEMPTS em coordinator.ts)
    expect(verify).toHaveBeenCalledTimes(3)
    expect(result.status).toBe('published_but_unverified')
    expect(result.status).not.toBe('published_but_incompatible')
  })
})

describe('PUB-U05 — rollback só ocorre com revisão ainda idêntica', () => {
  it('reverte quando o rascunho ainda é a mesma revisão publicada', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)
    const revertPublish = vi.fn(async () => ({ ...current, _status: 'draft' as const }))

    const result = await coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      // readDraft é chamado de novo após o publish para checar se a revisão
      // ainda é a mesma — aqui devolve o mesmo documento, revisão idêntica.
      readDraft: async () => current,
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify: async () => ({ status: 'incompatible' }),
      revertPublish,
    })

    expect(revertPublish).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('publish_reverted')
  })

  it('NÃO reverte quando o rascunho já mudou de novo (evita apagar edição concorrente)', async () => {
    const current = doc()
    const revision = createDocumentRevision(current)
    const changedAgain = doc({ body: 'edição concorrente feita durante a verificação' })
    const revertPublish = vi.fn(async () => ({ ...current, _status: 'draft' as const }))
    let readDraftCalls = 0

    const result = await coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: current,
      readCurrent: async () => current,
      saveDraft: async () => current,
      readDraft: async () => {
        readDraftCalls += 1
        // 1ª chamada (após saveDraft): snapshot que será publicado.
        // 2ª chamada (antes do publish): ainda igual, segue o fluxo normal.
        // 3ª chamada (pós-publish, checagem de rollback): já mudou.
        return readDraftCalls <= 2 ? current : changedAgain
      },
      assess: async () => assessmentFor(revision),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify: async () => ({ status: 'incompatible' }),
      revertPublish,
    })

    expect(revertPublish).not.toHaveBeenCalled()
    expect(result.status).toBe('published_but_incompatible')
  })
})

describe('PUB-U06 — warning token expira quando revisão muda', () => {
  it('rejeita um confirmationToken emitido para uma revisão anterior', async () => {
    const firstDoc = doc()
    const firstRevision = createDocumentRevision(firstDoc)

    const staged = await coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: firstDoc,
      readCurrent: async () => firstDoc,
      saveDraft: async () => firstDoc,
      readDraft: async () => firstDoc,
      assess: async () => assessmentFor(firstRevision, [warningIssue('product.price_review')]),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify: async () => ({ status: 'compatible' }),
    })

    expect(staged.status).toBe('requires_confirmation')
    const staleToken = staged.confirmationToken as string

    const changedDoc = doc({ body: 'conteúdo revisado depois do token' })
    const changedRevision = createDocumentRevision(changedDoc)

    await expect(coordinatePublication({
      entity: 'product',
      entityId: 1,
      data: changedDoc,
      confirmationToken: staleToken,
      readCurrent: async () => firstDoc,
      saveDraft: async () => changedDoc,
      readDraft: async () => changedDoc,
      assess: async () => assessmentFor(changedRevision, [warningIssue('product.price_review')]),
      publish: async (snapshot, rev) => ({ ...snapshot, publicationRevision: rev }),
      verify: async () => ({ status: 'compatible' }),
    })).rejects.toBeInstanceOf(RevisionConflictError)
  })
})
