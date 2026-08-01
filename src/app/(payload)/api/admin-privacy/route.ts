import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Payload, type Where } from 'payload'

import { canManageBusiness, isAdmin } from '../../../../access/roles'

export const dynamic = 'force-dynamic'

type PrivacyAction = 'set-consent' | 'request-deletion' | 'start-review' | 'complete-review' | 'anonymize'

type PrivacyRequest = {
  action?: PrivacyAction
  customerId?: string | number
  consent?: boolean
}

const openOpportunityStages = ['new', 'curation', 'proposal', 'negotiation']
const openTaskStatuses = ['pending', 'in_progress']

function customerID(value: unknown): string | number | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

async function authenticated(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  return { payload, user }
}

async function exportCustomerData(payload: Payload, user: NonNullable<Awaited<ReturnType<Payload['auth']>>['user']>, id: string | number) {
  const customer = await payload.findByID({
    collection: 'customers',
    id,
    depth: 1,
    overrideAccess: false,
    user,
  })

  const [sales, opportunities, afterSales, interests] = await Promise.all([
    payload.find({ collection: 'sales', depth: 1, limit: 1000, pagination: false, overrideAccess: false, user, where: { customer: { equals: id } } as Where }),
    payload.find({ collection: 'opportunities', depth: 1, limit: 1000, pagination: false, overrideAccess: false, user, where: { customer: { equals: id } } as Where }),
    payload.find({ collection: 'after-sales', depth: 1, limit: 1000, pagination: false, overrideAccess: false, user, where: { customer: { equals: id } } as Where }),
    payload.find({ collection: 'client-interests', depth: 1, limit: 1000, pagination: false, overrideAccess: false, user, where: { customer: { equals: id } } as Where }),
  ])

  return {
    exportedAt: new Date().toISOString(),
    controller: 'Esméra',
    scope: 'Dados pessoais e registros operacionais diretamente relacionados ao cliente no CMS.',
    customer,
    sales: sales.docs,
    opportunities: opportunities.docs,
    afterSales: afterSales.docs,
    interests: interests.docs,
  }
}

async function activeObligations(payload: Payload, user: NonNullable<Awaited<ReturnType<Payload['auth']>>['user']>, id: string | number) {
  const [opportunities, cases, tasks] = await Promise.all([
    payload.count({
      collection: 'opportunities',
      overrideAccess: false,
      user,
      where: { and: [{ customer: { equals: id } }, { stage: { in: openOpportunityStages } }] } as Where,
    }),
    payload.count({
      collection: 'after-sales',
      overrideAccess: false,
      user,
      where: { and: [{ customer: { equals: id } }, { status: { not_in: ['resolved', 'closed'] } }] } as Where,
    }),
    payload.count({
      collection: 'tasks',
      overrideAccess: false,
      user,
      where: {
        and: [
          { status: { in: openTaskStatuses } },
          { 'relatedTo.relationTo': { equals: 'customers' } },
          { 'relatedTo.value': { equals: id } },
        ],
      } as Where,
    }),
  ])

  return {
    opportunities: opportunities.totalDocs,
    afterSales: cases.totalDocs,
    tasks: tasks.totalDocs,
  }
}

export async function GET(request: Request) {
  const { payload, user } = await authenticated(request)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageBusiness(user)) return NextResponse.json({ error: 'Sem permissão para operar privacidade.' }, { status: 403 })

  const id = customerID(new URL(request.url).searchParams.get('customer'))
  if (id === null) return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 })

  try {
    const data = await exportCustomerData(payload, user, id)
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="esmera-dados-cliente-${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}.json"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível exportar os dados.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const { payload, user } = await authenticated(request)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageBusiness(user)) return NextResponse.json({ error: 'Sem permissão para operar privacidade.' }, { status: 403 })

  let body: PrivacyRequest
  try {
    body = await request.json() as PrivacyRequest
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const id = customerID(body.customerId)
  if (id === null) return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 })

  try {
    if (body.action === 'set-consent') {
      if (typeof body.consent !== 'boolean') return NextResponse.json({ error: 'Estado de consentimento inválido.' }, { status: 400 })
      await payload.update({
        collection: 'customers',
        id,
        overrideAccess: false,
        user,
        data: { marketingConsent: body.consent } as never,
      })
      return NextResponse.json({ updated: 1, consent: body.consent })
    }

    if (body.action === 'request-deletion') {
      const reviewAt = new Date()
      reviewAt.setUTCDate(reviewAt.getUTCDate() + 30)
      await payload.update({
        collection: 'customers',
        id,
        overrideAccess: false,
        user,
        data: {
          privacyRequestStatus: 'requested',
          processingRestricted: true,
          retentionReviewAt: reviewAt.toISOString(),
        } as never,
      })
      return NextResponse.json({ updated: 1, status: 'requested' })
    }

    if (body.action === 'start-review' || body.action === 'complete-review') {
      if (!isAdmin(user)) return NextResponse.json({ error: 'Apenas administradores podem concluir a análise LGPD.' }, { status: 403 })
      await payload.update({
        collection: 'customers',
        id,
        overrideAccess: false,
        user,
        data: {
          privacyRequestStatus: body.action === 'start-review' ? 'reviewing' : 'completed',
          processingRestricted: body.action !== 'complete-review',
        } as never,
      })
      return NextResponse.json({ updated: 1, status: body.action === 'start-review' ? 'reviewing' : 'completed' })
    }

    if (body.action === 'anonymize') {
      if (!isAdmin(user)) return NextResponse.json({ error: 'Apenas administradores podem anonimizar clientes.' }, { status: 403 })
      const obligations = await activeObligations(payload, user, id)
      const totalOpen = obligations.opportunities + obligations.afterSales + obligations.tasks
      if (totalOpen > 0) {
        await payload.update({
          collection: 'customers',
          id,
          overrideAccess: false,
          user,
          data: { privacyRequestStatus: 'blocked', processingRestricted: true } as never,
        })
        return NextResponse.json({
          error: 'A anonimização foi bloqueada porque existem obrigações operacionais abertas.',
          obligations,
        }, { status: 409 })
      }

      await payload.update({
        collection: 'customers',
        id,
        overrideAccess: false,
        user,
        data: {
          name: 'Cliente anonimizado',
          company: null,
          phone: null,
          email: `anonimo-${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}@invalid.local`,
          city: null,
          state: null,
          status: 'archived',
          owner: null,
          interestProfile: { categories: [], materials: [], investmentMinCents: null, investmentMaxCents: null },
          preferences: [],
          tags: [],
          relationshipNotes: null,
          marketingConsent: false,
          processingRestricted: true,
          dataHandlingNotes: 'Registro anonimizado após análise LGPD. Vínculos transacionais foram preservados para integridade contábil e operacional.',
          privacyRequestStatus: 'completed',
        } as never,
      })
      return NextResponse.json({ updated: 1, anonymized: true })
    }

    return NextResponse.json({ error: 'Ação de privacidade inválida.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }, { status: 500 })
  }
}
