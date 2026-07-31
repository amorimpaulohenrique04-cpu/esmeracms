import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'

import { canManageSite } from '../../../../access/roles'

export const dynamic = 'force-dynamic'

type CategoryAction = 'save-draft' | 'publish' | 'unpublish' | 'reorder'

type RequestBody = {
  action?: CategoryAction
  id?: string | number
  data?: Record<string, unknown>
  orderedIds?: Array<string | number>
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

  try {
    if (body.action === 'save-draft') {
      if (body.id === undefined || body.id === null) return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })
      await payload.update({
        collection: 'categories',
        id: body.id,
        data: categoryDraftData(body.data) as never,
        draft: true,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ updated: 1 })
    }

    if (body.action === 'publish') {
      if (body.id === undefined || body.id === null) return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })
      await payload.update({
        collection: 'categories',
        id: body.id,
        data: { _status: 'published' } as never,
        draft: false,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ updated: 1 })
    }

    if (body.action === 'unpublish') {
      if (body.id === undefined || body.id === null) return NextResponse.json({ error: 'Categoria não informada.' }, { status: 400 })
      const linkedProducts = await activePublishedProductCount(payload, user, body.id)
      if (linkedProducts > 0) {
        return NextResponse.json({ error: `Esta categoria é usada por ${linkedProducts} produto(s) ativo(s) e publicado(s). Mova ou arquive esses produtos antes de despublicar.` }, { status: 422 })
      }
      await payload.update({
        collection: 'categories',
        id: body.id,
        data: { _status: 'draft' } as never,
        draft: true,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ updated: 1 })
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
        await payload.update({
          collection: 'categories',
          id,
          data: { order: nextOrder } as never,
          draft: doc._status !== 'published',
          overrideAccess: false,
          user,
        })
      }
      return NextResponse.json({ updated: orderedIds.length })
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin category operation failed')
    return NextResponse.json({ error: errorMessage(error) }, { status: 422 })
  }
}
