import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Payload, type Where } from 'payload'

import { canManageBusiness, isAdmin } from '../../../../access/roles'
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../../../../businessRules/customers/normalization'

export const dynamic = 'force-dynamic'

type CustomerAction = 'create' | 'save-profile' | 'add-note' | 'add-interest' | 'set-interest-status' | 'merge'

type RequestBody = {
  action?: CustomerAction
  id?: string | number
  sourceId?: string | number
  targetId?: string | number
  interestId?: string | number
  productId?: string | number
  status?: string
  note?: string
  force?: boolean
  data?: Record<string, unknown>
}

function relationId(value: unknown): string | number | null {
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
  return 'Não foi possível atualizar o cliente.'
}

function customerData(input: Record<string, unknown> | undefined) {
  const source = input || {}
  const data: Record<string, unknown> = {}
  for (const field of ['name', 'company', 'city', 'state', 'relationshipNotes'] as const) {
    if (typeof source[field] === 'string' || source[field] === null) data[field] = source[field]
  }

  if ('email' in source) data.email = normalizeCustomerEmail(source.email)
  if ('phone' in source) data.phone = normalizeCustomerPhone(source.phone)
  if (['active', 'follow_up', 'inactive', 'archived'].includes(String(source.status))) data.status = source.status
  if (['instagram', 'referral', 'site', 'architect', 'organic', 'whatsapp', 'other'].includes(String(source.origin))) data.origin = source.origin
  if (source.owner === null || relationId(source.owner) !== null) data.owner = relationId(source.owner)

  if (Array.isArray(source.tags)) {
    data.tags = source.tags.map((item) => typeof item === 'string' ? item : item && typeof item === 'object' && 'value' in item ? String((item as { value?: unknown }).value || '') : '')
      .map((value) => value.trim()).filter(Boolean)
      .filter((value, index, values) => values.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')) === index)
      .map((value) => ({ value }))
  }

  if (source.interestProfile && typeof source.interestProfile === 'object') {
    const profileSource = source.interestProfile as Record<string, unknown>
    const profile: Record<string, unknown> = {}
    if (Array.isArray(profileSource.categories)) profile.categories = profileSource.categories.map(relationId).filter((id) => id !== null)
    if (Array.isArray(profileSource.materials)) {
      profile.materials = profileSource.materials.map((item) => typeof item === 'string' ? item : item && typeof item === 'object' && 'value' in item ? String((item as { value?: unknown }).value || '') : '')
        .map((value) => value.trim()).filter(Boolean).map((value) => ({ value }))
    }
    for (const field of ['investmentMinCents', 'investmentMaxCents'] as const) {
      if (typeof profileSource[field] === 'number' && profileSource[field] >= 0) profile[field] = profileSource[field]
      else if (profileSource[field] === null) profile[field] = null
    }
    data.interestProfile = profile
  }

  return data
}

async function duplicateCandidates(payload: Payload, user: unknown, email: string | null, phone: string | null, excludeId?: string | number) {
  const or: Where[] = []
  if (email) or.push({ or: [{ normalizedEmail: { equals: email } }, { email: { equals: email } }] } as Where)
  if (phone) or.push({ or: [{ normalizedPhone: { equals: phone } }, { phone: { equals: phone } }] } as Where)
  if (!or.length) return []

  const and: Where[] = [{ or } as Where]
  if (excludeId !== undefined) and.push({ id: { not_equals: excludeId } } as Where)
  const result = await payload.find({
    collection: 'customers',
    depth: 0,
    limit: 20,
    pagination: false,
    overrideAccess: false,
    user: user as never,
    where: { and } as Where,
    select: { id: true, name: true, company: true, phone: true, email: true, status: true },
  })
  return result.docs
}

function replaceCustomerRelation(items: unknown, sourceId: string | number, targetId: string | number) {
  if (!Array.isArray(items)) return items
  const next: Array<{ relationTo: string; value: string | number }> = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const relationTo = String((item as { relationTo?: unknown }).relationTo || '')
    const value = relationId((item as { value?: unknown }).value)
    if (!relationTo || value === null) continue
    const replacement = relationTo === 'customers' && String(value) === String(sourceId) ? targetId : value
    if (!next.some((candidate) => candidate.relationTo === relationTo && String(candidate.value) === String(replacement))) {
      next.push({ relationTo, value: replacement })
    }
  }
  return next
}

async function transferDirectRelations(payload: Payload, user: unknown, sourceId: string | number, targetId: string | number) {
  const collections = [
    ['sales', 'customer'],
    ['after-sales', 'customer'],
    ['leads', 'customer'],
    ['client-interests', 'customer'],
  ] as const

  for (const [collection, field] of collections) {
    const result = await payload.find({
      collection,
      depth: 0,
      limit: 1000,
      pagination: false,
      overrideAccess: false,
      user: user as never,
      where: { [field]: { equals: sourceId } } as Where,
    })
    for (const doc of result.docs) {
      await payload.update({ collection, id: doc.id, data: { [field]: targetId } as never, overrideAccess: false, user: user as never })
    }
  }
}

async function transferPolymorphicRelations(payload: Payload, user: unknown, sourceId: string | number, targetId: string | number) {
  for (const collection of ['tasks', 'activities'] as const) {
    const result = await payload.find({ collection, depth: 0, limit: 1000, pagination: false, overrideAccess: false, user: user as never })
    for (const doc of result.docs) {
      const relatedTo = (doc as unknown as { relatedTo?: unknown }).relatedTo
      const replaced = replaceCustomerRelation(relatedTo, sourceId, targetId)
      if (JSON.stringify(replaced) === JSON.stringify(relatedTo)) continue
      await payload.update({ collection, id: doc.id, data: { relatedTo: replaced } as never, overrideAccess: true })
    }
  }
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageBusiness(user)) return NextResponse.json({ error: 'Sem permissão para operar clientes.' }, { status: 403 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'create') {
      const data = customerData(body.data)
      const name = String(data.name || '').trim()
      const email = normalizeCustomerEmail(data.email)
      const phone = normalizeCustomerPhone(data.phone)
      if (!name) return NextResponse.json({ error: 'Informe o nome do cliente.' }, { status: 400 })
      if (!email && !phone) return NextResponse.json({ error: 'Informe telefone ou e-mail.' }, { status: 400 })

      const candidates = await duplicateCandidates(payload, user, email, phone)
      if (candidates.length && !body.force) return NextResponse.json({ error: 'Encontramos registros possivelmente duplicados.', candidates }, { status: 409 })

      const customer = await payload.create({ collection: 'customers', data: { ...data, name, status: data.status || 'active' } as never, overrideAccess: false, user })
      return NextResponse.json({ id: customer.id, created: 1 })
    }

    if (body.action === 'save-profile') {
      if (body.id === undefined) return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 })
      const data = customerData(body.data)
      const email = 'email' in data ? normalizeCustomerEmail(data.email) : null
      const phone = 'phone' in data ? normalizeCustomerPhone(data.phone) : null
      if (email || phone) {
        const candidates = await duplicateCandidates(payload, user, email, phone, body.id)
        if (candidates.length) return NextResponse.json({ error: 'Este contato coincide com outro cliente. Revise os candidatos antes de salvar.', candidates }, { status: 409 })
      }
      await payload.update({ collection: 'customers', id: body.id, data: data as never, overrideAccess: false, user })
      return NextResponse.json({ updated: 1 })
    }

    if (body.action === 'add-note') {
      if (body.id === undefined) return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 })
      const note = String(body.note || '').trim()
      if (!note) return NextResponse.json({ error: 'Escreva a nota antes de salvar.' }, { status: 400 })
      const customer = await payload.findByID({ collection: 'customers', id: body.id, depth: 0, overrideAccess: false, user })
      const activity = await payload.create({
        collection: 'activities',
        overrideAccess: false,
        user,
        data: {
          eventType: 'note.created',
          kind: 'note',
          occurredAt: new Date().toISOString(),
          summary: `Nota sobre ${customer.name}`,
          details: note,
          owner: user.id,
          relatedTo: [{ relationTo: 'customers', value: body.id }],
        },
      })
      return NextResponse.json({ id: activity.id, created: 1 })
    }

    if (body.action === 'add-interest') {
      if (body.id === undefined || body.productId === undefined) return NextResponse.json({ error: 'Cliente e produto são obrigatórios.' }, { status: 400 })
      const existing = await payload.find({
        collection: 'client-interests', depth: 0, limit: 1, pagination: false, overrideAccess: false, user,
        where: { and: [{ customer: { equals: body.id } }, { product: { equals: body.productId } }, { status: { in: ['active', 'curation', 'paused'] } }] } as Where,
      })
      if (existing.docs.length) return NextResponse.json({ error: 'Este produto já possui interesse aberto para o cliente.' }, { status: 409 })
      const product = await payload.findByID({ collection: 'products', id: body.productId, depth: 0, draft: true, overrideAccess: false, user })
      const interest = await payload.create({
        collection: 'client-interests', overrideAccess: false, user,
        data: { customer: body.id, product: body.productId, status: 'active', source: 'manual', owner: user.id, notes: String(body.note || '').trim() || null, addedAt: new Date().toISOString() },
      })
      await payload.create({
        collection: 'activities', overrideAccess: false, user,
        data: {
          eventType: 'interest.added', kind: 'contact', occurredAt: new Date().toISOString(),
          summary: `Interesse adicionado: ${product.title}`, details: String(body.note || '').trim() || undefined, owner: user.id,
          relatedTo: [{ relationTo: 'customers', value: body.id }, { relationTo: 'client-interests', value: interest.id }],
        },
      })
      return NextResponse.json({ id: interest.id, created: 1 })
    }

    if (body.action === 'set-interest-status') {
      if (body.interestId === undefined || !['active', 'curation', 'purchased', 'paused', 'archived'].includes(String(body.status))) {
        return NextResponse.json({ error: 'Interesse ou status inválido.' }, { status: 400 })
      }
      await payload.update({
        collection: 'client-interests', id: body.interestId, overrideAccess: false, user,
        data: { status: body.status, closedAt: ['purchased', 'archived'].includes(String(body.status)) ? new Date().toISOString() : null } as never,
      })
      return NextResponse.json({ updated: 1 })
    }

    if (body.action === 'merge') {
      if (!isAdmin(user)) return NextResponse.json({ error: 'Somente administradores podem mesclar clientes.' }, { status: 403 })
      if (body.sourceId === undefined || body.targetId === undefined || String(body.sourceId) === String(body.targetId)) {
        return NextResponse.json({ error: 'Informe registros de origem e destino distintos.' }, { status: 400 })
      }

      const [source, target] = await Promise.all([
        payload.findByID({ collection: 'customers', id: body.sourceId, depth: 1, overrideAccess: false, user }),
        payload.findByID({ collection: 'customers', id: body.targetId, depth: 1, overrideAccess: false, user }),
      ])

      await transferDirectRelations(payload, user, source.id, target.id)
      await transferPolymorphicRelations(payload, user, source.id, target.id)

      const tags = [...(target.tags || []), ...(source.tags || [])]
        .map((item) => item.value?.trim() || '').filter(Boolean)
        .filter((value, index, values) => values.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')) === index)
        .map((value) => ({ value }))
      const preferences = [...(target.preferences || []), ...(source.preferences || [])]
        .map((item) => item.value?.trim() || '').filter(Boolean)
        .filter((value, index, values) => values.findIndex((candidate) => candidate.toLocaleLowerCase('pt-BR') === value.toLocaleLowerCase('pt-BR')) === index)
        .map((value) => ({ value }))

      await payload.update({
        collection: 'customers', id: target.id, overrideAccess: false, user,
        data: {
          phone: target.phone || source.phone || null,
          email: target.email || source.email || null,
          company: target.company || source.company || null,
          city: target.city || source.city || null,
          state: target.state || source.state || null,
          tags,
          preferences,
        } as never,
      })
      await payload.update({
        collection: 'customers', id: source.id, overrideAccess: false, user,
        data: { status: 'archived', mergedInto: target.id, mergedAt: new Date().toISOString() } as never,
      })
      await payload.create({
        collection: 'activities', overrideAccess: true,
        data: {
          eventType: 'note.created', kind: 'note', occurredAt: new Date().toISOString(), owner: user.id,
          summary: `Clientes mesclados: ${source.name} → ${target.name}`,
          details: 'Relações comerciais transferidas e registro duplicado arquivado por operação administrativa.',
          relatedTo: [{ relationTo: 'customers', value: source.id }, { relationTo: 'customers', value: target.id }],
        },
      })
      return NextResponse.json({ merged: 1, targetId: target.id })
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin customer operation failed')
    return NextResponse.json({ error: errorMessage(error) }, { status: 422 })
  }
}
