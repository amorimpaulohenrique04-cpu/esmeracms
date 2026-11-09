import type { Payload, PayloadRequest } from 'payload'

import { publishSingleProduct } from '../publication/bulkPublication'
import { RevisionConflictError } from '../publication/types'
import { assertStudioGallery, studioDraftData, StudioInputError } from './productDraft'

/** O Studio confirma a vitrine depois; aqui a resposta não espera além disto. */
const STUDIO_VERIFY_TIMEOUT_MS = 2_000

export type StudioPublishInput = {
  id?: string | number | null
  expectedCode?: unknown
  expectedUpdatedAt?: unknown
  expectedRevision?: unknown
  confirmationToken?: unknown
  data?: Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null
}

/**
 * Cria ou atualiza e publica numa única chamada. Falhas de publicação voltam em
 * `item`: um produto recém-criado e bloqueado continua existindo como rascunho.
 */
export async function publishFromStudio(payload: Payload, user: PayloadRequest['user'], input: StudioPublishInput) {
  const data = studioDraftData(input.data)
  const creating = input.id === undefined || input.id === null
  let id: string | number
  let expectedUpdatedAt = text(input.expectedUpdatedAt)

  if (creating) {
    const code = text(input.data?.code)
    const slug = text(input.data?.slug)
    if (!code || !slug) throw new StudioInputError('Informe o código e o endereço do produto.')
    await assertStudioGallery(payload, user, null, data)
    const created = await payload.create({
      collection: 'products',
      data: { ...data, code, slug, _status: 'draft' } as never,
      draft: true,
      depth: 0,
      overrideAccess: false,
      user,
    })
    id = created.id
    expectedUpdatedAt = created.updatedAt
  } else {
    id = input.id as string | number
    if (!expectedUpdatedAt || !text(input.expectedCode)) {
      throw new StudioInputError('Informe a identidade e a revisão do produto.')
    }
  }

  const item = await publishSingleProduct(payload, user, {
    id,
    expectedUpdatedAt: expectedUpdatedAt as string,
    expectedRevision: creating ? null : text(input.expectedRevision),
    confirmationToken: text(input.confirmationToken),
  }, {
    data: creating ? { _status: 'draft' } : data,
    verifyTimeoutMs: STUDIO_VERIFY_TIMEOUT_MS,
    assertCurrent: creating ? undefined : (document) => {
      const current = document as { code?: unknown; deletedAt?: unknown }
      if (current.code !== input.expectedCode || current.deletedAt) {
        throw new RevisionConflictError('O produto não corresponde à identidade confirmada.')
      }
    },
    beforeSave: creating ? undefined : (current, draft) => assertStudioGallery(payload, user, current, draft as typeof data),
  })

  const document = await payload.findByID({
    collection: 'products',
    id,
    draft: true,
    depth: 0,
    overrideAccess: false,
    user,
    select: { title: true, code: true, slug: true, updatedAt: true, _status: true, publicationRevision: true, deletedAt: true },
  })

  return { created: creating, item, document }
}
