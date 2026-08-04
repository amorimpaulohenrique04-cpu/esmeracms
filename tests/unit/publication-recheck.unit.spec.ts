import { expect, it, vi } from 'vitest'

import { recheckPublication } from '../../src/server/publication/recheckPublication'

it('job antigo é no-op antes do probe', async () => {
  const payload = {
    findByID: vi.fn(async () => ({ id: 1, publicationRevision: 'newer' })),
  } as never
  const result = await recheckPublication(payload, {
    entity: 'product',
    documentId: 1,
    expectedPublicationRevision: 'old',
    contractVersion: '1',
    parentTraceId: 'parent',
    stage: 1,
    source: 'scheduled-recheck',
  })
  expect(result.status).toBe('obsolete')
})
