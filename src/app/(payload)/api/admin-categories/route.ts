import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'

import { canManageSite } from '../../../../access/roles'
import { decorateIssue } from '../../../../issues/build'
import { ISSUE_CODES } from '../../../../issues/codes'
import { issueCopy } from '../../../../issues/copy'
import { adminActionResponse, adminCodedError, adminErrorResponse, adminInputError } from '../../../../server/admin/errors'
import { assessCategoryPublication } from '../../../../server/publication/categoryAssessment'
import { coordinatePublication } from '../../../../server/publication/coordinator'
import { withSerializableTransaction } from '../../../../server/publication/concurrency'
import { createPublicPublicationMetadata } from '../../../../server/publication/publicRevision'
import { assertExpectedDocumentRevision, createDocumentRevision } from '../../../../server/publication/revision'
import { stampPublishedDocumentMetadata } from '../../../../server/publication/stampPublicationMetadata'
import { probeStorefrontRevision } from '../../../../server/publication/storefrontProbe'
import { RevisionConflictError, STOREFRONT_CONTRACT_VERSION, type PublicationAssessment } from '../../../../server/publication/types'

export const dynamic = 'force-dynamic'

type CategoryAction = 'create' | 'save-draft' | 'save-and-publish' | 'publish' | 'unpublish' | 'reorder'

type RequestBody = {
  action?: CategoryAction
  id?: string | number
  data?: Record<string, unknown>
  orderedIds?: Array<string | number>
  expectedRevision?: string | null
  expectedUpdatedAt?: string | null
  confirmationToken?: string | null
}

function relationID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}


function categoryDraftData(input: Record<string, unknown> | undefined) {
  const source = input || {}
  const data: Record<string, unknown> = {}

  for (const field of ['title', 'slug', 'description'] as const) {
    if (typeof source[field] === 'string' || source[field] === null) data[field] = source[field]
  }

  if (source.status === 'active' || source.status === 'archive') data.status = source.status
  if (typeof source.order === 'number' && Number.isInteger(source.order) && source.order >= 0) data.order = source.order
  if (source.parent === null || relationID(source.parent) !== null) data.parent = relationID(source.parent)
  if (source.image === null || relationID(source.image) !== null) data.image = relationID(source.image)

  if (Array.isArray(source.searchTerms)) {
    data.searchTerms = source.searchTerms
      .map((item) => typeof item === 'string' ? item : item && typeof item === 'object' && 'term' in item ? String((item as { term?: unknown }).term || '') : '')
      .map((term) => term.trim())
      .filter(Boolean)
      .filter((term, index, terms) => terms.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === term.toLocaleLowerCase('pt-BR')) === index)
      .map((term) => ({ term }))
  }

  if (source.seo && typeof source.seo === 'object') {
    const seoSource = source.seo as Record<string, unknown>
    const seo: Record<string, unknown> = {}
    if (typeof seoSource.title === 'string' || seoSource.title === null) seo.title = seoSource.title
    if (typeof seoSource.description === 'string' || seoSource.description === null) seo.description = seoSource.description
    if (typeof seoSource.noIndex === 'boolean') seo.noIndex = seoSource.noIndex
    if (seoSource.socialImage === null || relationID(seoSource.socialImage) !== null) seo.socialImage = relationID(seoSource.socialImage)
    data.seo = seo
  }

  data._status = 'draft'
  return data
}

function updatedAt(document: unknown): string | null {
  return document && typeof document === 'object' && 'updatedAt' in document && typeof document.updatedAt === 'string'
    ? document.updatedAt
    : null
}

async function activePublishedProductCount(payload: Awaited<ReturnType<typeof getPayload>>, user: unknown, categoryId: string | number) {
  const where: Where = {
    and: [
      { categories: { contains: categoryId } },
      { catalogStatus: { equals: 'active' } },
      { _status: { equals: 'published' } },
    ],
  }
  const result = await payload.count({ collection: 'products', where, overrideAccess: false, user: user as never })
  return result.totalDocs
}

async function assessCategoryWithHierarchy(
  payload: Awaited<ReturnType<typeof getPayload>>,
  user: unknown,
  document: Record<string, unknown>,
): Promise<PublicationAssessment> {
  const assessment = assessCategoryPublication(document)
  const entityID = relationID(document.id)
  let parentID = relationID(document.parent)
  const visited = new Set<string>()
  let hierarchyCycle = false

  for (let depth = 0; parentID !== null && depth < 100; depth += 1) {
    const key = String(parentID)
    if ((entityID !== null && key === String(entityID)) || visited.has(key)) {
      hierarchyCycle = true
      break
    }
    visited.add(key)
    const parent = await payload.findByID({
      collection: 'categories',
      id: parentID,
      depth: 0,
      draft: true,
      overrideAccess: false,
      user: user as never,
    })
    parentID = relationID((parent as { parent?: unknown }).parent)
  }

  if (parentID !== null) hierarchyCycle = true
  // A caminhada acima detecta um ciclo na cadeia de ancestrais — condição
  // distinta da auto-referência que `assessCategoryPublication` já cobre, por
  // isso um código próprio. Copy, aba, rótulo e âncora vêm do catálogo/registry.
  if (hierarchyCycle && !assessment.issues.some((issue) => issue.code === ISSUE_CODES.categoryParentCycle)) {
    assessment.issues.push(decorateIssue({
      code: ISSUE_CODES.categoryParentCycle,
      severity: 'blocker',
      path: 'parent',
      source: 'readiness',
    }, 'category'))
    assessment.ready = false
  }
  return assessment
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return adminCodedError('unauthenticated')
  if (!canManageSite(user)) return adminCodedError('forbidden', { summary: 'Sem permissão para operar categorias.' })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return adminCodedError('invalid_request', { summary: 'Corpo da requisição inválido.' })
  }

  if (body.action === 'create') {
    const data = categoryDraftData(body.data)
    const title = String(data.title || '').trim()
    if (!title) return adminInputError('Informe o nome da categoria.')

    try {
      const category = await payload.create({
        collection: 'categories',
        data: {
          title,
          parent: data.parent ?? null,
          status: data.status || 'active',
          _status: 'draft',
        } as never,
        draft: true,
        depth: 0,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ id: category.id, created: 1 })
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'category',
        operation: 'create',
        logger: payload.logger,
      })
    }
  }

  if (body.action === 'save-draft') {
    if (body.id === undefined || body.id === null) return adminInputError('Categoria não informada.')
    try {
      const document = await withSerializableTransaction(payload, user, async (req) => {
        const current = await payload.findByID({
          collection: 'categories',
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
          collection: 'categories',
          id: body.id as string | number,
          data: categoryDraftData(body.data) as never,
          draft: true,
          depth: 2,
          overrideAccess: false,
          user,
          req,
        })
      })

      const persisted = await payload.findByID({
        collection: 'categories',
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
        entity: 'category',
        operation: 'save-draft',
        logger: payload.logger,
        meta: { entityId: body.id },
      })
    }
  }

  if (body.action === 'save-and-publish' || body.action === 'publish') {
    if (body.id === undefined || body.id === null) return adminInputError('Categoria não informada.')
    try {
      const result = await coordinatePublication({
        entity: 'category',
        entityId: body.id,
        data: categoryDraftData(body.data),
        expectedRevision: body.expectedRevision,
        expectedUpdatedAt: body.expectedUpdatedAt,
        confirmationToken: body.confirmationToken,
        readCurrent: () => payload.findByID({
          collection: 'categories',
          id: body.id as string | number,
          depth: 2,
          draft: true,
          overrideAccess: false,
          user,
        }),
        saveDraft: (data) => payload.update({
          collection: 'categories',
          id: body.id as string | number,
          data: data as never,
          draft: true,
          depth: 2,
          overrideAccess: false,
          user,
        }),
        readDraft: () => payload.findByID({
          collection: 'categories',
          id: body.id as string | number,
          depth: 2,
          draft: true,
          overrideAccess: false,
          user,
        }),
        assess: (document) => assessCategoryWithHierarchy(payload, user, document as unknown as Record<string, unknown>),
        publish: (snapshot) => {
          const publicSnapshot = {
            ...(snapshot as unknown as Record<string, unknown>),
            _status: 'published',
          }
          const metadata = createPublicPublicationMetadata('category', publicSnapshot)
          return payload.update({
            collection: 'categories',
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
          entity: 'category',
          entityId: body.id as string | number,
          expectedRevision: revision,
          contractVersion: STOREFRONT_CONTRACT_VERSION,
        }),
        revertPublish: () => payload.update({
          collection: 'categories',
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
          ? 'A publicação foi revertida: a vitrine reportou incompatibilidade e a categoria voltou para rascunho.'
          : result.status === 'published_but_incompatible'
          ? 'Categoria publicada, mas a vitrine reportou incompatibilidade e não foi possível reverter automaticamente.'
          : result.status === 'published_but_unverified'
          ? 'Categoria publicada, mas a confirmação visual do site está indisponível.'
          : 'Categoria publicada.',
        meta: {
          confirmationToken: result.confirmationToken,
          verification: result.verification,
          updatedAt: updatedAt(result.document),
        },
      })
    } catch (error) {
      return adminErrorResponse(error, {
        entity: 'category',
        operation: 'save-and-publish',
        logger: payload.logger,
        meta: { entityId: body.id },
      })
    }
  }

  try {
    if (body.action === 'unpublish') {
      if (body.id === undefined || body.id === null) return adminCodedError('invalid_request', { summary: 'Categoria não informada.' })
      const linkedProducts = await activePublishedProductCount(payload, user, body.id)
      if (linkedProducts > 0) {
        const copy = issueCopy[ISSUE_CODES.categoryUsedByPublishedProducts]
        return adminCodedError('publication_blocked', {
          summary: `Esta categoria é usada por ${linkedProducts} produto(s) ativo(s) e publicado(s).`,
          entityErrors: [{
            code: ISSUE_CODES.categoryUsedByPublishedProducts,
            message: copy.message({ linkedProducts }),
            suggestion: copy.suggestion ?? null,
            related: [{ collection: 'products', count: linkedProducts }],
          }],
          meta: { linkedProducts },
        })
      }
      const document = await payload.update({
        collection: 'categories',
        id: body.id,
        data: { _status: 'draft' } as never,
        draft: true,
        depth: 1,
        overrideAccess: false,
        user,
      })
      return adminActionResponse('unpublished', {
        entityId: body.id,
        revision: createDocumentRevision(document),
        message: 'Categoria movida para rascunho.',
        meta: { updated: 1, updatedAt: updatedAt(document) },
      })
    }

    if (body.action === 'reorder') {
      const orderedIds = Array.from(new Set((body.orderedIds || []).filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')))
      const current = await payload.find({
        collection: 'categories',
        depth: 0,
        draft: true,
        limit: 500,
        pagination: false,
        sort: 'order',
        overrideAccess: false,
        user,
        select: { id: true, order: true, _status: true },
      })

      const currentIds = current.docs.map((doc) => String(doc.id))
      const incomingIds = orderedIds.map(String)
      const sameSet = incomingIds.length === currentIds.length && currentIds.every((id) => incomingIds.includes(id))
      if (!sameSet) return adminCodedError('revision_conflict', { summary: 'A ordenação precisa conter exatamente todas as categorias atuais.' })

      const byId = new Map(current.docs.map((doc) => [String(doc.id), doc]))
      for (let index = 0; index < orderedIds.length; index += 1) {
        const id = orderedIds[index]
        const doc = byId.get(String(id))
        const nextOrder = (index + 1) * 100
        if (!doc || doc.order === nextOrder) continue
        const mutated = await payload.update({
          collection: 'categories',
          id,
          data: { order: nextOrder } as never,
          draft: doc._status !== 'published',
          depth: 2,
          overrideAccess: false,
          user,
        })
        await stampPublishedDocumentMetadata({ payload, entity: 'category', collection: 'categories', id, user, document: mutated })
      }
      return NextResponse.json({ updated: orderedIds.length })
    }

    return adminCodedError('invalid_request', { summary: 'Ação não suportada.' })
  } catch (error) {
    // Antes qualquer falha virava 422, inclusive NotFound e erro interno. Agora
    // o serializer classifica por instanceof e o status sai coerente.
    return adminErrorResponse(error, {
      entity: 'category',
      operation: body.action,
      logger: payload.logger,
    })
  }
}
