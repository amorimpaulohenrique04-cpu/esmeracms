import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageSite } from '../../../../access/roles'

export const dynamic = 'force-dynamic'

type ProductAction = 'publish' | 'unpublish' | 'archive' | 'restore' | 'add-category' | 'set-availability' | 'save-draft' | 'reorder-gallery'

type RequestBody = {
  action?: ProductAction
  ids?: Array<string | number>
  id?: string | number
  categoryId?: string | number
  availability?: string
  data?: Record<string, unknown>
  gallery?: Array<Record<string, unknown>>
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

  try {
    if (action === 'save-draft') {
      if (body.id === undefined || body.id === null) return NextResponse.json({ error: 'Produto não informado.' }, { status: 400 })
      await payload.update({
        collection: 'products',
        id: body.id,
        data: draftData(body.data) as never,
        draft: true,
        overrideAccess: false,
        user,
      })
      return NextResponse.json({ updated: 1 })
    }

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

        if (action === 'publish') {
          await payload.update({ collection: 'products', id, data: { _status: 'published' } as never, draft: false, overrideAccess: false, user })
        } else if (action === 'unpublish') {
          await payload.update({ collection: 'products', id, data: { _status: 'draft' } as never, draft: true, overrideAccess: false, user })
        } else if (action === 'archive' || action === 'restore') {
          const currentStatus = (current as { _status?: string })._status
          await payload.update({
            collection: 'products',
            id,
            data: { catalogStatus: action === 'archive' ? 'archived' : 'active' } as never,
            draft: currentStatus !== 'published',
            overrideAccess: false,
            user,
          })
        } else if (action === 'add-category') {
          const existing = ((current as { categories?: unknown[] }).categories || []).map(relationID).filter((value): value is string | number => value !== null)
          const categoryId = body.categoryId as string | number
          const categories = existing.some((value) => String(value) === String(categoryId)) ? existing : [...existing, categoryId]
          await payload.update({
            collection: 'products',
            id,
            data: { categories } as never,
            draft: (current as { _status?: string })._status !== 'published',
            overrideAccess: false,
            user,
          })
        } else if (action === 'set-availability') {
          await payload.update({
            collection: 'products',
            id,
            data: { availability: body.availability } as never,
            draft: (current as { _status?: string })._status !== 'published',
            overrideAccess: false,
            user,
          })
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
