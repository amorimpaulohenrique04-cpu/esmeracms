import type { Payload } from 'payload'

import type { PublicationRecheckInput } from './types'

export const PUBLICATION_VERIFICATION_QUEUE = 'publication-verification'
export const RECHECK_PUBLICATION_TASK = 'recheckPublication'

const STAGE_DELAY_MS: Record<1 | 2 | 3, number> = {
  1: 60_000,
  2: 5 * 60_000,
  3: 15 * 60_000,
}

export async function queuePublicationRecheck(
  payload: Payload,
  input: PublicationRecheckInput,
  options: { immediate?: boolean } = {},
): Promise<void> {
  await payload.jobs.queue({
    task: RECHECK_PUBLICATION_TASK,
    queue: PUBLICATION_VERIFICATION_QUEUE,
    waitUntil: options.immediate ? new Date() : new Date(Date.now() + STAGE_DELAY_MS[input.stage]),
    input: {
      entity: input.entity,
      documentId: String(input.documentId),
      expectedPublicationRevision: input.expectedPublicationRevision,
      contractVersion: input.contractVersion,
      parentTraceId: input.parentTraceId,
      stage: input.stage,
    },
  } as never)
}
