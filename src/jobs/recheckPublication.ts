import type { PayloadRequest, TaskConfig } from 'payload'

import { RECHECK_PUBLICATION_TASK } from '../server/publication/publicationJobs'
import { recheckPublication } from '../server/publication/recheckPublication'

export const RecheckPublicationTask = {
  slug: RECHECK_PUBLICATION_TASK,
  label: 'Verificar publicação na vitrine',
  retries: 0,
  inputSchema: [
    {
      name: 'entity',
      type: 'select',
      required: true,
      options: [
        { label: 'Produto', value: 'product' },
        { label: 'Categoria', value: 'category' },
        { label: 'Home', value: 'home' },
      ],
    },
    { name: 'documentId', type: 'text', required: true },
    { name: 'expectedPublicationRevision', type: 'text', required: true },
    { name: 'contractVersion', type: 'text', required: true },
    { name: 'parentTraceId', type: 'text', required: true },
    { name: 'stage', type: 'number', required: true, min: 1, max: 3 },
  ],
  outputSchema: [
    { name: 'status', type: 'text', required: true },
    { name: 'traceId', type: 'text', required: true },
    { name: 'retryable', type: 'checkbox', required: true },
  ],
  handler: async ({ input, req }: {
    input: {
      entity: 'product' | 'category' | 'home'
      documentId: string
      expectedPublicationRevision: string
      contractVersion: string
      parentTraceId: string
      stage: number
    }
    req: PayloadRequest
  }) => {
    const stage = Number(input.stage)
    if (![1, 2, 3].includes(stage)) throw new Error('Estágio de recheck inválido.')
    const result = await recheckPublication(req.payload, {
      entity: input.entity,
      documentId: input.documentId,
      expectedPublicationRevision: input.expectedPublicationRevision,
      contractVersion: input.contractVersion,
      parentTraceId: input.parentTraceId,
      stage: stage as 1 | 2 | 3,
      source: 'scheduled-recheck',
      user: req.user,
      req,
    })
    return {
      output: {
        status: result.status,
        traceId: result.traceId,
        retryable: result.retryable,
      },
    }
  },
} as TaskConfig<typeof RECHECK_PUBLICATION_TASK>
