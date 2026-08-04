import { expect, it, vi } from 'vitest'

import { persistPublicationReceipt } from '../../src/server/publication/publicationReceipt'
import type { PublicationReceipt } from '../../src/server/publication/types'

it('persiste auditoria sem token, cookie ou authorization', async () => {
  const create = vi.fn(async () => ({}))
  const payload = { create } as never
  const receipt: PublicationReceipt = {
    traceId: 'trace',
    operation: 'publish',
    source: 'individual',
    entity: 'product',
    documentId: 1,
    actorId: 2,
    status: 'published',
    verificationStatus: 'compatible',
    retryable: false,
    verificationAttempts: [{
      attempt: 1,
      startedAt: 'a',
      completedAt: 'b',
      durationMs: 1,
      status: 'compatible',
      issues: [{ id: 'x', severity: 'warning', message: 'ok', source: 'integration', suggestion: 'Bearer secret' }],
    }],
    issues: [{ id: 'safe', severity: 'warning', message: 'safe', source: 'integration', suggestion: null }],
    startedAt: '2026-08-04T00:00:00.000Z',
    completedAt: '2026-08-04T00:00:01.000Z',
    durationMs: 1000,
  }
  ;(receipt as unknown as Record<string, unknown>).probeToken = 'secret'
  await persistPublicationReceipt(payload, receipt)
  const serialized = JSON.stringify(create.mock.calls[0][0])
  expect(serialized).not.toContain('probeToken')
  expect(serialized).not.toContain('secret')
  expect(serialized).toContain('trace')
})
