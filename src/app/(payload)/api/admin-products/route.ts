import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageSite } from '../../../../access/roles'
import { adminActionResponse, adminErrorResponse, adminInputError } from '../../../../server/admin/errors'
import {
  BULK_PUBLICATION_LIMIT,
  publishProductsInBulk,
  type BulkPublicationItemInput,
} from '../../../../server/publication/bulkPublication'
import { coordinatePublication } from '../../../../server/publication/coordinator'
import { assessProductPublication } from '../../../../server/publication/productAssessment'
import { withSerializableTransaction } from '../../../../server/publication/concurrency'
import { createPublicPublicationMetadata } from '../../../../server/publication/publicRevision'
import { assertExpectedDocumentRevision, createDocumentRevision } from '../../../../server/publication/revision'
import { stampPublishedDocumentMetadata } from '../../../../server/publication/stampPublicationMetadata'
import { RevisionConflictError } from '../../../../server/publication/types'

export const dynamic = 'force-dynamic'

type ProductAction =
  | 'publish'
  | 'save-and-publish'
  | 'unpublish'
  | 'archive'
  | 'restore'
  | 'add-category'
  | 'set-availability'
  | 'save-draft'
  | 'reorder-gallery'

type RequestBody = {
  action?: ProductAction
  ids?: Array<string | number>
  items?: BulkPublicationItemInput[]
  id?: string | number
  categoryId?: string | number
  availability?: string
  data?: Record<string, unknown>
  gallery?: Array<Record<string, unknown>>
  expectedRevision?: string | null
  expectedUpdatedAt?: string | null
  confirmationToken?: string | null
}

const availabilities = new Set(['unique', 'available', 'made_to_order', 'limited'])

function relationID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Erro de validação.')
  return 'Não foi possível atualizar o produto.'
}

function draftData(input: Record<string, unknown> | undefined) {
  const source = input || {}
  const data: Record<string, unknown> = {}
  const textFields = ['title', 'subtitle', 'material', 'edition'] as const
  for (const field of textFields) {
    if (typeof source[field] === 'string' || source[field] === null) data[field] = source[field]
  }
  if (typeof source.availability === 'string') data.availability = source.availability
  if (typeof source.priceMode === 'string') data.priceMode = source.priceMode
  if (typeof source.basePriceCents === 'number' || source.basePriceCents === null) data.basePriceCents = source.basePriceCents
  data._status = 'draft'
  return data
}

function updatedAt(document: unknown): string | null {
  return document && typeof document === 'object' && 'updatedAt' in document && typeof document.updatedAt === 'string'
    ? document.updatedAt
    : null
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageSite(user)) return NextResponse.json({ error: 'Sem permissão para operar produtos.' }, { status: 403 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const action = body.action
  if (!action) return NextResponse.json({ error: 'Ação não informada.' }, { status: 400 })

  if (action === 'save-draft') {
    if (body.id === undefined || body.id === null) return adminInputError('Produto não informado.')
    try {
      const document = await withSerializableTransaction(payload, user, async (req) => {
        const current = await payload.findByID({
          collection: 'products',
          id: body.id as string | number,
          draft: true,
          depth: 2,
          overrideAccess: false,
          user,
          req,
        })
        assertExpectedDocumentRevision(current, {
          expectedRevision: body.expectedRevision,
          expectedUpdatedAt: body.expectedUpdatedAt,
        })

        return await payload.update({
          collection: 'products',
          id: body.id as string | number,
          data: draftData(body.data) as never,
          draft: true,
          depth: 2,
          overrideAccess: false,
          user,
          req,
        })
      })

      const persisted = await payload.findByID({
        collection: 'products',
        id: body.id,
        draft: true,
        depth: 2,
        overrideAccess: false,
        user,
      })
      if (createDocumentRevision(persisted) !== createDocumentRevision(document)) {
        throw new RevisionConflictError('O conteúdo foi alterado por outra sessão durante a gravação. Tente novamente.')
      }

      return adminActionResponse('saved', {
        entityId: body.id,
        revision: createDocumentRevision(document),
        message: 'Rascunho salvo.',
        meta: { updated: 1, updatedAt: updatedAt(document) },
      })
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'product',
        operation: 'save-draft',
        logger: payload.logger,
        meta: { entityId: body.id },
      })
    }
  }

  if (action === 'save-and-publish') {
    if (body.id === undefined || body.id === null) return adminInputError('Produto não informado.')
    try {
      const result = await coordinatePublication({
        entity: 'product',
        entityId: body.id,
        data: draftData(body.data),
        expectedRevision: body.expectedRevision,
        expectedUpdatedAt: body.expectedUpdatedAt,
        confirmationToken: body.confirmationToken,
        readCurrent: () => payload.findByID({
          collection: 'products',
          id: body.id as string | number,
          draft: true,
          depth: 2,
          overrideAccess: false,
          user,
        }),
        saveDraft: (data) => payload.update({
          collection: 'products',
          id: body.id as string | number,
          data: data as never,
          draft: true,
          depth: 2,
          overrideAccess: false,
          user,
        }),
        readDraft: () => payload.findByID({
          collection: 'products',
          id: body.id as string | number,
          draft: true,
          depth: 2,
          overrideAccess: false,
          user,
        }),
        assess: assessProductPublication,
        publish: (snapshot) => {
          const publicSnapshot = { ...snapshot, _status: 'published' as const }
          const metadata = createPublicPublicationMetadata('product', publicSnapshot)
          return payload.update({
            collection: 'products',
            id: body.id as string | number,
            data: {
              _status: publicSnapshot._status,
              publicationRevision: metadata.revision,
              publicationContractVersion: metadata.contractVersion,
            } as never,
            draft: false,
            depth: 2,
            overrideAccess: true,
            user,
          })
        },
      })

      return adminActionResponse(result.status, {
        entityId: result.entityId,
        revision: result.revision,
        assessment: result.assessment,
        message: result.status === 'requires_confirmation'
          ? 'Revise e confirme os avisos antes de publicar.'
          : result.status === 'published_but_unverified'
          ? 'Produto publicado, mas a confirmação visual do site está indisponível.'
          : 'Produto publicado.',
        meta: {
          confirmationToken: result.confirmationToken,
          verification: result.verification,
          updatedAt: updatedAt(result.document),
        },
      })
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'product',
        operation: 'save-and-publish',
        logger: payload.logger,
        meta: { entityId: body.id },
      })
    }
  }

  if (action === 'publish') {
    if (Array.isArray(body.ids) && body.ids.length) {
      return adminInputError('A publicação em lote agora exige items[] com o token de concorrência de cada produto.')
    }
    if (!Array.isArray(body.items) || !body.items.length) {
      return adminInputError('Selecione ao menos um produto para publicar.')
    }
    if (body.items.length > BULK_PUBLICATION_LIMIT) {
      return adminInputError(`Publique no máximo ${BULK_PUBLICATION_LIMIT} produtos por vez.`)
    }
    const itemIds = body.items.map((item) => String(item?.id))
    if (new Set(itemIds).size !== itemIds.length) {
      return adminInputError('O lote possui produtos repetidos.')
    }

    try {
      const result = await publishProductsInBulk(payload, user, body.items)
      return adminActionResponse('bulk_completed', {
        message: `${result.published} de ${result.requested} produto(s) publicados.`,
        meta: result as unknown as Record<string, unknown>,
      })
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'product',
        operation: 'bulk-publish',
        logger: payload.logger,
      })
    }
  }

  try {
    if (action === 'reorder-gallery') {
      if (body.id === undefined || body.id === null || !Array.isArray(body.gallery)) return NextResponse.json({ error: 'Galeria inválida.' }, { status: 400 })
      if (body.gallery.some((item) => relationID(item.image) === null)) return NextResponse.json({ error: 'Toda imagem precisa manter uma mídia válida.' }, { status: 400 })
      await payload.update({
        collection: 'products',
        id: body.id,
        data: { gallery: body.gallery, _status: 'draft' } as never,
        draft: true,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ updated: 1 })
    }

    const ids = Array.from(new Set((body.ids || []).filter((id): id is string | number => typeof id === 'string' || typeof id === 'number'))).slice(0, 100)
    if (!ids.length) return NextResponse.json({ error: 'Selecione ao menos um produto.' }, { status: 400 })
    if (action === 'add-category' && (body.categoryId === undefined || body.categoryId === null || body.categoryId === '')) return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })
    if (action === 'set-availability' && (!body.availability || !availabilities.has(body.availability))) return NextResponse.json({ error: 'Disponibilidade inválida.' }, { status: 400 })

    let updated = 0
    const errors: Array<{ id: string | number; message: string }> = []

    for (const id of ids) {
      try {
        const current = await payload.findByID({
          collection: 'products',
          id,
          draft: true,
          depth: 0,
          overrideAccess: false,
          user,
        })

        if (action === 'unpublish') {
          await payload.update({ collection: 'products', id, data: { _status: 'draft' } as never, draft: true, overrideAccess: false, user })
        } else if (action === 'archive' || action === 'restore') {
          const currentStatus = (current as { _status?: string })._status
          const mutated = await payload.update({
            collection: 'products',
            id,
            data: { catalogStatus: action === 'archive' ? 'archived' : 'active' } as never,
            draft: currentStatus !== 'published',
            depth: 2,
            overrideAccess: false,
            user,
          })
          await stampPublishedDocumentMetadata({ payload, entity: 'product', collection: 'products', id, user, document: mutated })
        } else if (action === 'add-category') {
          const existing = ((current as { categories?: unknown[] }).categories || []).map(relationID).filter((value): value is string | number => value !== null)
          const categoryId = body.categoryId as string | number
          const categories = existing.some((value) => String(value) === String(categoryId)) ? existing : [...existing, categoryId]
          const mutated = await payload.update({
            collection: 'products',
            id,
            data: { categories } as never,
            draft: (current as { _status?: string })._status !== 'published',
            depth: 2,
            overrideAccess: false,
            user,
          })
          await stampPublishedDocumentMetadata({ payload, entity: 'product', collection: 'products', id, user, document: mutated })
        } else if (action === 'set-availability') {
          const mutated = await payload.update({
            collection: 'products',
            id,
            data: { availability: body.availability } as never,
            draft: (current as { _status?: string })._status !== 'published',
            depth: 2,
            overrideAccess: false,
            user,
          })
          await stampPublishedDocumentMetadata({ payload, entity: 'product', collection: 'products', id, user, document: mutated })
        }
        updated += 1
      } catch (error) {
        errors.push({ id, message: errorMessage(error) })
      }
    }

    return NextResponse.json({ updated, errors }, { status: updated || !errors.length ? 200 : 422 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin product operation failed')
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
