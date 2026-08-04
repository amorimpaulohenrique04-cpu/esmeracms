import { describe, expect, it } from 'vitest'

import { mapCoordinatorOutcome } from '../../src/server/publication/bulkPublication'
import type { PublicationAssessment } from '../../src/server/publication/types'

const assessment: PublicationAssessment = {
  version: '1',
  entity: 'product',
  entityId: 7,
  revision: 'editorial',
  ready: true,
  issues: [],
  storefront: { contractVersion: '1', compatible: true, issues: [], probeStatus: 'not_run' },
  assessedAt: '2026-08-04T00:00:00.000Z',
}
const context = { id: 7, title: 'Nódulo I', updatedAt: '2026-08-04T00:00:00.000Z' }

for (const status of ['published', 'published_but_unverified', 'published_but_incompatible', 'publish_reverted'] as const) {
  it(`preserva o estado operacional ${status}`, () => {
    const result = mapCoordinatorOutcome({
      ok: true,
      result: {
        status,
        entityId: 7,
        revision: 'editorial',
        publicationRevision: 'public',
        assessment,
        retryable: status === 'published_but_unverified',
        traceId: 'trace',
        verification: {
          status: status === 'published'
            ? 'compatible'
            : status === 'published_but_incompatible'
            ? 'incompatible'
            : 'unavailable',
          expectedRevision: 'public',
          contractVersion: '1',
          checkedAt: 'now',
        },
      },
    }, context)
    expect(result.status).toBe(status)
    expect(result.publicationRevision).toBe('public')
  })
}
