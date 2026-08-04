import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'

import { canManageSite } from '../../../../access/roles'
import { adminActionResponse, adminErrorResponse, adminInputError } from '../../../../server/admin/errors'
import { assessCategoryPublication } from '../../../../server/publication/categoryAssessment'
import { coordinatePublication } from '../../../../server/publication/coordinator'
import { withSerializableTransaction } from '../../../../server/publication/concurrency'
import { createPublicPublicationMetadata } from '../../../../server/publication/publicRevision'
import { assertExpectedDocumentRevision, createDocumentRevision } from '../../../../server/publication/revision'
import { stampPublishedDocumentMetadata } from '../../../../server/publication/stampPublicationMetadata'
import { RevisionConflictError, type PublicationAssessment } from '../../../../server/publication/types'

export const dynamic = 'force-dynamic'

type CategoryAction = 'save-draft' | 'save-and-publish' | 'publish' | 'unpublish' | 'reorder'

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

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || 'Erro de validação.')
  return 'Não foi possível atualizar a categoria.'
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
  if (hierarchyCycle && !assessment.issues.some((issue) => issue.id === 'category.parent_cycle')) {
    assessment.issues.push({
      id: 'category.parent_cycle',
      severity: 'blocker',
      path: 'parent',
      tab: 'content',
      anchor: 'category-parent',
      message: 'A categoria cria um ciclo na hierarquia.',
      suggestion: 'Escolha uma categoria principal fora da própria cadeia de descendência.',
      source: 'business_rule',
    })
    assessment.ready = false
  }
  return assessment
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageSite(user)) return NextResponse.json({ error: 'Sem permissão para operar categorias.' }, { status: 403 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
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
            ...(snapshot as Record<string, unknown>),
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
      })

      return adminActionResponse(result.status, {
        entityId: result.entityId,
        revision: result.revision,
        assessment: result.assessment,
        message: result.status === 'requires_confirmation'
          ? 'Revise e confirme os avisos antes de publicar.'
          : 'Categoria publicada.',
        meta: {
          confirmationToken: result.confirmationToken,
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
      if (body.id === undefined || body.id === null) return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })
      const linkedProducts = await activePublishedProductCount(payload, user, body.id)
      if (linkedProducts > 0) {
        return adminInputError(
          `Esta categoria é usada por ${linkedProducts} produto(s) ativo(s) e publicado(s).`,
          {
            code: 'publication_blocked',
            entityErrors: [{
              code: 'category.used_by_published_products',
              message: `A categoria está vinculada a ${linkedProducts} produto(s) ativo(s) e publicado(s).`,
              suggestion: 'Mova ou arquive esses produtos antes de despublicar a categoria.',
              related: [{ collection: 'products', count: linkedProducts }],
            }],
            meta: { linkedProducts },
          },
          422,
        )
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
      if (!sameSet) return NextResponse.json({ error: 'A ordenação precisa conter exatamente todas as categorias atuais.' }, { status: 409 })

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

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin category operation failed')
    return NextResponse.json({ error: errorMessage(error) }, { status: 422 })
  }
}
