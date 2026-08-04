import { describe, expect, it, vi } from 'vitest'

import { coordinatePublication } from '../../src/server/publication/coordinator'
import { createDocumentRevision } from '../../src/server/publication/revision'
import type { PublicationAssessment, StorefrontVerification } from '../../src/server/publication/types'

type Document = {
  id: number
  title: string
  _status: 'draft' | 'published'
  publicationRevision?: string
  publicationContractVersion?: string
}

function assessment(document: Document): PublicationAssessment {
  return {
    version: '1',
    entity: 'product',
    entityId: document.id,
    revision: createDocumentRevision(document),
    ready: true,
    issues: [],
    storefront: { contractVersion: '1', compatible: true, issues: [], probeStatus: 'not_run' },
    assessedAt: '2026-08-04T05:00:00.000Z',
  }
}

function base() {
  const current: Document = { id: 7, title: 'Nódulo', _status: 'draft' }
  const states: string[] = []
  const receipts: unknown[] = []
  const scheduleRecheck = vi.fn(async () => undefined)
  const attemptRollback = vi.fn(async () => ({ status: 'skipped' as const, attempted: false as const, reason: 'rollback_disabled' as const }))
  const input = {
    entity: 'product' as const,
    entityId: 7,
    actorId: 2,
    source: 'individual' as const,
    data: current,
    verificationConfig: { enabled: true, rollbackEnabled: false, probeURL: 'https://example.test/probe', probeToken: 'secret' },
    readCurrent: async () => current,
    readPublishedBefore: async () => null,
    saveDraft: async () => current,
    readDraft: async () => current,
    assess: assessment,
    publish: async (_snapshot: Document, _revision: string, _traceId: string): Promise<Document> => ({
      ...current,
      _status: 'published',
      publicationRevision: 'a'.repeat(64),
      publicationContractVersion: '1',
    }),
    extractPublicMetadata: (document: Document) => ({
      publicationRevision: document.publicationRevision as string,
      publicationContractVersion: document.publicationContractVersion as string,
    }),
    verify: async (): Promise<StorefrontVerification> => ({
      status: 'compatible',
      expectedRevision: 'a'.repeat(64),
      observedRevision: 'a'.repeat(64),
      contractVersion: '1',
      checkedAt: '2026-08-04T05:00:01.000Z',
      responseReceived: true,
    }),
    persistOperationalState: async (state: { operationalStatus: string }) => {
      states.push(state.operationalStatus)
    },
    attemptRollback,
    createReceipt: async (receipt: unknown) => {
      receipts.push(receipt)
    },
    scheduleRecheck,
    sleep: vi.fn(async () => undefined),
  }
  return { states, receipts, input, scheduleRecheck, attemptRollback }
}

describe('coordinatePublication — verificação pública obrigatória', () => {
  it('persiste pending antes de published e cria receipt', async () => {
    const fixture = base()
    const result = await coordinatePublication(fixture.input)
    expect(result.status).toBe('published')
    expect(result.publicationRevision).toBe('a'.repeat(64))
    expect(result.retryable).toBe(false)
    expect(fixture.states).toEqual(['pending_verification', 'published'])
    expect(fixture.receipts).toHaveLength(1)
    expect(fixture.scheduleRecheck).not.toHaveBeenCalled()
  })

  it('configuração é validada antes de publicar e ainda gera receipt failed', async () => {
    const fixture = base()
    const publish = vi.fn(fixture.input.publish)
    fixture.input.publish = publish
    fixture.input.verificationConfig = { enabled: false, rollbackEnabled: false, probeURL: '', probeToken: '' }
    await expect(coordinatePublication(fixture.input)).rejects.toMatchObject({ code: 'verification_required' })
    expect(publish).not.toHaveBeenCalled()
    expect(fixture.states).toEqual([])
    expect(fixture.receipts).toHaveLength(1)
    expect(fixture.receipts[0]).toMatchObject({ status: 'failed', verificationStatus: 'not_run' })
  })

  it('unavailable preserva publicação, não executa rollback e agenda recheck', async () => {
    const fixture = base()
    fixture.input.verify = async () => ({
      status: 'unavailable',
      expectedRevision: 'a'.repeat(64),
      contractVersion: '1',
      checkedAt: '2026-08-04T05:00:01.000Z',
      issues: [{ code: 'probe.transport_error', message: 'timeout' }],
    })
    const result = await coordinatePublication(fixture.input)
    expect(result.status).toBe('published_but_unverified')
    expect(result.retryable).toBe(true)
    expect(fixture.states).toEqual(['pending_verification', 'published_but_unverified'])
    expect(fixture.attemptRollback).not.toHaveBeenCalled()
    expect(fixture.scheduleRecheck).toHaveBeenCalledTimes(1)
  })

  it('incompatible nunca retorna published', async () => {
    const fixture = base()
    fixture.input.verify = async () => ({
      status: 'incompatible',
      expectedRevision: 'a'.repeat(64),
      observedRevision: 'a'.repeat(64),
      contractVersion: '1',
      checkedAt: '2026-08-04T05:00:01.000Z',
      responseReceived: true,
    })
    const result = await coordinatePublication(fixture.input)
    expect(result.status).toBe('published_but_incompatible')
    expect(result.status).not.toBe('published')
    expect(fixture.attemptRollback).toHaveBeenCalledTimes(1)
  })
})
