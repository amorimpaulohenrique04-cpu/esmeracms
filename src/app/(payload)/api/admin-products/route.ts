import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageSite } from '../../../../access/roles'
import { adminErrorCopy } from '../../../../issues/copy'
import {
  ADMIN_ERROR_VERSION,
  adminActionResponse,
  adminCodedError,
  adminErrorResponse,
  adminInputError,
  httpStatusByCode,
  newTraceId,
} from '../../../../server/admin/errors'
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
import { probeStorefrontRevision } from '../../../../server/publication/storefrontProbe'
import { RevisionConflictError, STOREFRONT_CONTRACT_VERSION } from '../../../../server/publication/types'

export const dynamic = 'force-dynamic'

type ProductAction =
  | 'create'
  | 'publish'
  | 'save-and-publish'
  | 'unpublish'
  | 'archive'
  | 'restore'
  | 'add-category'
  | 'set-availability'
  | 'save-draft'
  | 'reorder-gallery'
  | 'add-gallery-image'

type RequestBody = {
  action?: ProductAction
  ids?: Array<string | number>
  items?: BulkPublicationItemInput[]
  id?: string | number
  categoryId?: string | number
  availability?: string
  data?: Record<string, unknown>
  gallery?: Array<Record<string, unknown>>
  mediaId?: string | number
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
  const specs = source.physicalSpecs
  if (specs && typeof specs === 'object' && !Array.isArray(specs)) {
    const specsRecord = specs as Record<string, unknown>
    const physicalSpecs: Record<string, number | null> = {}
    for (const field of ['heightMm', 'widthMm', 'depthMm', 'weightGrams'] as const) {
      const value = specsRecord[field]
      if (typeof value === 'number' || value === null) physicalSpecs[field] = value
    }
    data.physicalSpecs = physicalSpecs
  }
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
  if (!user) return adminCodedError('unauthenticated')
  if (!canManageSite(user)) return adminCodedError('forbidden', { summary: 'Sem permissão para operar produtos.' })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return adminCodedError('invalid_request', { summary: 'Corpo da requisição inválido.' })
  }

  const action = body.action
  if (!action) return adminCodedError('invalid_request', { summary: 'Ação não informada.' })

  if (action === 'create') {
    const title = String((body.data?.title as string) || '').trim()
    if (!title) return adminInputError('Informe o nome do produto.')
    const priceMode = body.data?.priceMode === 'fixed' ? 'fixed' : 'inquiry'
    const basePriceCents = priceMode === 'fixed' && typeof body.data?.basePriceCents === 'number'
      ? body.data.basePriceCents
      : null

    try {
      const product = await payload.create({
        collection: 'products',
        data: { title, priceMode, basePriceCents, _status: 'draft' } as never,
        draft: true,
        depth: 0,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ id: product.id, created: 1 })
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'product',
        operation: 'create',
        logger: payload.logger,
      })
    }
  }

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
        verify: (published, revision) => probeStorefrontRevision({
          entity: 'product',
          entityId: body.id as string | number,
          expectedRevision: revision,
          contractVersion: STOREFRONT_CONTRACT_VERSION,
        }),
        revertPublish: () => payload.update({
          collection: 'products',
          id: body.id as string | number,
          data: { _status: 'draft' } as never,
          draft: false,
          depth: 2,
          overrideAccess: true,
          user,
        }),
      })

      return adminActionResponse(result.status, {
        entityId: result.entityId,
        revision: result.revision,
        assessment: result.assessment,
        message: result.status === 'requires_confirmation'
          ? 'Revise e confirme os avisos antes de publicar.'
          : result.status === 'publish_reverted'
          ? 'A publicação foi revertida: a vitrine reportou incompatibilidade e o produto voltou para rascunho.'
          : result.status === 'published_but_incompatible'
          ? 'Produto publicado, mas a vitrine reportou incompatibilidade e não foi possível reverter automaticamente.'
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
      // Nenhum item publicado e há bloqueio/falha de negócio: o lote inteiro
      // reprovou por readiness, não por payload malformado — 422, espelhando
      // o mesmo critério do handler legado de mutação em lote (linha ~383).
      // Payload/contrato inválido já foi rejeitado acima (400); revision_conflict
      // isolado por item continua 200 (o cliente decide o retry pelo status
      // de cada resultado).
      const allBlockedOrFailed = result.published === 0 && (result.blocked > 0 || result.failed > 0)
      return adminActionResponse('bulk_completed', {
        message: `${result.published} de ${result.requested} produto(s) publicados.`,
        meta: result as unknown as Record<string, unknown>,
      }, allBlockedOrFailed ? httpStatusByCode.publication_blocked : 200)
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'product',
        operation: 'bulk-publish',
        logger: payload.logger,
      })
    }
  }

  try {
    if (action === 'add-gallery-image') {
      if (body.id === undefined || body.id === null) return adminInputError('Produto não informado.')
      if (body.mediaId === undefined || body.mediaId === null) return adminInputError('Mídia não informada.')

      const current = await payload.findByID({
        collection: 'products',
        id: body.id,
        draft: true,
        depth: 0,
        overrideAccess: false,
        user,
      })
      const gallery = Array.isArray(current.gallery) ? current.gallery : []
      if (gallery.length >= 12) return adminInputError('A galeria aceita no máximo 12 imagens.')

      const document = await payload.update({
        collection: 'products',
        id: body.id,
        data: { gallery: [...gallery, { image: body.mediaId }], _status: 'draft' } as never,
        draft: true,
        depth: 2,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ updated: 1, gallery: document.gallery || [] })
    }

    if (action === 'reorder-gallery') {
      if (body.id === undefined || body.id === null || !Array.isArray(body.gallery)) return adminCodedError('invalid_request', { summary: 'Galeria inválida.' })
      if (body.gallery.some((item) => relationID(item.image) === null)) return adminCodedError('invalid_request', { summary: 'Toda imagem precisa manter uma mídia válida.' })
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
    if (!ids.length) return adminCodedError('invalid_request', { summary: 'Selecione ao menos um produto.' })
    if (action === 'add-category' && (body.categoryId === undefined || body.categoryId === null || body.categoryId === '')) return adminCodedError('invalid_request', { summary: 'Categoria não informada.' })
    if (action === 'set-availability' && (!body.availability || !availabilities.has(body.availability))) return adminCodedError('invalid_request', { summary: 'Disponibilidade inválida.' })

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

    // Mutação em lote legada (add-category / set-availability). A forma
    // `{ updated, errors }` é lida direto por ProductsWorkspaceClient, fora do
    // expectAdminResponse, e a PR-07 é quem substitui essa UI — então ela é
    // preservada. No caminho de falha o envelope tipado vai JUNTO, de modo
    // aditivo: quem lê `updated`/`errors` continua funcionando e quem lê o
    // contrato recebe code, traceId, retryable e fieldErrors.
    if (!updated && errors.length) {
      const traceId = newTraceId()
      return NextResponse.json({
        updated,
        errors,
        ok: false,
        error: {
          code: 'validation_error',
          summary: `${errors.length} produto(s) não foram atualizados.`,
          message: adminErrorCopy.validation_error.message,
          fieldErrors: [],
          traceId,
          retryable: false,
          version: ADMIN_ERROR_VERSION,
          detail: null,
          entityErrors: errors.map((entry) => ({
            code: 'product.bulk_item_failed',
            message: entry.message,
            suggestion: null,
            related: [{ collection: 'products', id: entry.id }],
          })),
          meta: { updated },
        },
      }, {
        status: httpStatusByCode.validation_error,
        headers: { 'x-esmera-trace-id': traceId },
      })
    }
    return NextResponse.json({ updated, errors }, { status: 200 })
  } catch (error) {
    return adminErrorResponse(error, {
      entity: 'product',
      operation: action,
      logger: payload.logger,
    })
  }
}
