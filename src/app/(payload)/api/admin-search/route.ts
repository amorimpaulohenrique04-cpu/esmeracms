import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'

import { canManageBusiness, canManageSite, isAdmin } from '../../../../access/roles'

export const dynamic = 'force-dynamic'

type SearchItem = {
  id: string
  group: string
  label: string
  meta?: string
  href: string
  icon?: string
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function actionsFor(user: unknown): SearchItem[] {
  const items: SearchItem[] = [
    { id: 'action-dashboard', group: 'Ações', label: 'Abrir Dashboard', href: '/admin', icon: 'grid' },
    { id: 'action-technical', group: 'Ações', label: 'Abrir Admin técnico', href: '/admin/technical', icon: 'database' },
  ]

  if (canManageSite(user)) {
    items.push(
      { id: 'action-products', group: 'Ações', label: 'Abrir Produtos', href: '/admin/products', icon: 'box' },
      { id: 'action-categories', group: 'Ações', label: 'Abrir Categorias', href: '/admin/categories', icon: 'tag' },
      { id: 'action-new-product', group: 'Ações', label: 'Novo produto', meta: 'Criar item do catálogo', href: '/admin/collections/products/create', icon: 'plus' },
    )
  }

  if (canManageBusiness(user)) {
    items.push(
      { id: 'action-customers', group: 'Ações', label: 'Abrir Clientes', href: '/admin/customers', icon: 'users' },
      { id: 'action-sales', group: 'Ações', label: 'Abrir Vendas', href: '/admin/sales?view=list', icon: 'receipt' },
      { id: 'action-pipeline', group: 'Ações', label: 'Abrir Pipeline de Vendas', href: '/admin/sales?view=pipeline', icon: 'receipt' },
      { id: 'action-after-sales', group: 'Ações', label: 'Abrir Pós-venda', href: '/admin/after-sales', icon: 'heart' },
      { id: 'action-reports', group: 'Ações', label: 'Abrir Relatórios', href: '/admin/reports', icon: 'chart' },
      { id: 'action-new-customer', group: 'Ações', label: 'Novo cliente', href: '/admin/collections/customers/create', icon: 'plus' },
      { id: 'action-new-lead', group: 'Ações', label: 'Novo lead', meta: 'Modelo comercial atual até a migração para Opportunities', href: '/admin/collections/leads/create', icon: 'plus' },
    )
  }

  if (isAdmin(user)) items.push({ id: 'action-users', group: 'Ações', label: 'Abrir Usuários', href: '/admin/collections/users', icon: 'shield' })
  return items
}

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const url = new URL(request.url)
  const query = (url.searchParams.get('q') || '').trim().slice(0, 80)
  const needle = query.toLocaleLowerCase('pt-BR')
  const actions = actionsFor(user).filter((item) => !needle || `${item.label} ${item.meta || ''}`.toLocaleLowerCase('pt-BR').includes(needle))

  if (query.length < 2) return NextResponse.json({ results: actions.slice(0, 12) })

  const searches: Array<Promise<SearchItem[]>> = []

  if (canManageSite(user)) {
    searches.push(
      payload.find({
        collection: 'products',
        overrideAccess: false,
        user,
        draft: true,
        depth: 0,
        limit: 6,
        where: {
          or: [
            { title: { like: query } },
            { code: { like: query } },
            { slug: { like: query } },
          ],
        } as Where,
        select: { id: true, title: true, code: true, slug: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `product-${doc.id}`,
        group: 'Produtos',
        label: text(doc.title) || 'Produto sem título',
        meta: text(doc.code) || text(doc.slug) || undefined,
        href: `/admin/collections/products/${doc.id}`,
        icon: 'box',
      }))),
    )
  }

  if (canManageBusiness(user)) {
    searches.push(
      payload.find({
        collection: 'customers',
        overrideAccess: false,
        user,
        depth: 0,
        limit: 6,
        where: {
          or: [
            { name: { like: query } },
            { phone: { like: query } },
            { email: { like: query } },
          ],
        } as Where,
        select: { id: true, name: true, phone: true, email: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `customer-${doc.id}`,
        group: 'Clientes',
        label: text(doc.name) || 'Cliente sem nome',
        meta: text(doc.phone) || text(doc.email) || undefined,
        href: `/admin/collections/customers/${doc.id}`,
        icon: 'users',
      }))),
      payload.find({
        collection: 'leads',
        overrideAccess: false,
        user,
        depth: 0,
        limit: 6,
        where: {
          or: [
            { name: { like: query } },
            { phone: { like: query } },
            { email: { like: query } },
            { nextAction: { like: query } },
          ],
        } as Where,
        select: { id: true, name: true, stage: true, nextAction: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `lead-${doc.id}`,
        group: 'Pipeline',
        label: text(doc.name) || 'Lead sem nome',
        meta: [text(doc.stage), text(doc.nextAction)].filter(Boolean).join(' · ') || undefined,
        href: `/admin/collections/leads/${doc.id}`,
        icon: 'person',
      }))),
      payload.find({
        collection: 'sales',
        overrideAccess: false,
        user,
        depth: 0,
        limit: 6,
        where: { number: { like: query } } as Where,
        select: { id: true, number: true, status: true, totalCents: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `sale-${doc.id}`,
        group: 'Vendas',
        label: `Venda #${text(doc.number) || '—'}`,
        meta: text(doc.status) || undefined,
        href: `/admin/collections/sales/${doc.id}`,
        icon: 'receipt',
      }))),
    )
  }

  try {
    const groups = await Promise.all(searches)
    return NextResponse.json({ results: [...actions, ...groups.flat()].slice(0, 30) })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin command search failed')
    return NextResponse.json({ error: 'Não foi possível pesquisar agora.' }, { status: 500 })
  }
}
