import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'

import { canManageBusiness, canManageSite, isAdmin } from '../../../../access/roles'
import { opportunityStageLabels } from '../../../../businessRules/opportunities/stages'

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

function relationLabel(value: unknown) {
  if (!value || typeof value !== 'object') return ''
  if ('name' in value && typeof value.name === 'string') return value.name
  if ('email' in value && typeof value.email === 'string') return value.email
  return ''
}

function requestContext(request: Request) {
  const referer = request.headers.get('referer')
  if (!referer) return { pathname: '/admin', search: '' }
  try {
    const url = new URL(referer)
    return { pathname: url.pathname, search: url.search }
  } catch {
    return { pathname: '/admin', search: '' }
  }
}

function contextualActions(user: unknown, pathname: string, search: string): SearchItem[] {
  const items: SearchItem[] = []
  const current = `${pathname}${search}`

  if (pathname.startsWith('/admin/products') && canManageSite(user)) {
    items.push(
      { id: 'context-new-product', group: 'Nesta tela', label: 'Novo produto', meta: 'Criar item do catálogo', href: '/admin/collections/products/create', icon: 'plus' },
      { id: 'context-product-issues', group: 'Nesta tela', label: 'Produtos com pendências', meta: 'Aplicar filtro de prontidão', href: '/admin/products?publication=issues', icon: 'box' },
    )
  }

  if (pathname.startsWith('/admin/categories') && canManageSite(user)) {
    items.push({ id: 'context-new-category', group: 'Nesta tela', label: 'Nova categoria', meta: 'Criar categoria editorial', href: '/admin/collections/categories/create', icon: 'plus' })
  }

  if (pathname.startsWith('/admin/customers') && canManageBusiness(user)) {
    items.push(
      { id: 'context-new-customer', group: 'Nesta tela', label: 'Novo cliente', href: '/admin/collections/customers/create', icon: 'plus' },
      { id: 'context-follow-up', group: 'Nesta tela', label: 'Novo follow-up', meta: 'Criar tarefa operacional', href: '/admin/collections/tasks/create?type=follow_up', icon: 'plus' },
    )
  }

  if (pathname.startsWith('/admin/opportunities') && canManageBusiness(user)) {
    items.push(
      { id: 'context-new-opportunity', group: 'Nesta tela', label: 'Nova oportunidade', href: '/admin/collections/opportunities/create', icon: 'plus' },
      { id: 'context-sales-list', group: 'Nesta tela', label: 'Alternar para Lista', href: '/admin/opportunities?view=list', icon: 'receipt' },
      { id: 'context-sales-pipeline', group: 'Nesta tela', label: 'Alternar para Pipeline', href: '/admin/opportunities?view=pipeline', icon: 'receipt' },
    )
  }

  if (pathname.startsWith('/admin/after-sales') && canManageBusiness(user)) {
    items.push(
      { id: 'context-after-sales-task', group: 'Nesta tela', label: 'Nova tarefa de pós-venda', href: '/admin/collections/tasks/create?type=follow_up', icon: 'plus' },
      { id: 'context-after-sales-open', group: 'Nesta tela', label: 'Pendências abertas', href: '/admin/after-sales?focus=all&status=open', icon: 'heart' },
    )
  }

  if (pathname.startsWith('/admin/reports') && canManageBusiness(user)) {
    items.push(
      { id: 'context-report-current', group: 'Nesta tela', label: 'Copiar recorte atual', meta: current, href: current, icon: 'chart' },
      { id: 'context-report-clear', group: 'Nesta tela', label: 'Limpar investigação', meta: 'Manter somente o período padrão', href: '/admin/reports', icon: 'chart' },
      { id: 'context-report-sales', group: 'Nesta tela', label: 'Investigar vendas', meta: 'Abrir visão comercial relacionada', href: '/admin/opportunities?view=list', icon: 'receipt' },
    )
  }

  return items
}

function actionsFor(user: unknown, pathname: string, search: string): SearchItem[] {
  const items: SearchItem[] = [
    ...contextualActions(user, pathname, search),
    { id: 'action-dashboard', group: 'Navegação', label: 'Abrir Dashboard', href: '/admin', icon: 'grid' },
  ]

  if (isAdmin(user)) {
    items.push({ id: 'action-technical', group: 'Navegação', label: 'Abrir Configurações avançadas', href: '/admin/technical', icon: 'database' })
  }

  if (canManageSite(user)) {
    items.push(
      { id: 'action-products', group: 'Navegação', label: 'Abrir Produtos', href: '/admin/products', icon: 'box' },
      { id: 'action-categories', group: 'Navegação', label: 'Abrir Categorias', href: '/admin/categories', icon: 'tag' },
      { id: 'action-new-product', group: 'Criar', label: 'Novo produto', meta: 'Criar item do catálogo', href: '/admin/collections/products/create', icon: 'plus' },
      { id: 'action-new-category', group: 'Criar', label: 'Nova categoria', meta: 'Criar categoria editorial', href: '/admin/collections/categories/create', icon: 'plus' },
    )
  }

  if (canManageBusiness(user)) {
    items.push(
      { id: 'action-customers', group: 'Navegação', label: 'Abrir Clientes', href: '/admin/customers', icon: 'users' },
      { id: 'action-sales', group: 'Navegação', label: 'Abrir Vendas', href: '/admin/sales', icon: 'receipt' },
      { id: 'action-pipeline', group: 'Navegação', label: 'Abrir Oportunidades', href: '/admin/opportunities?view=pipeline', icon: 'receipt' },
      { id: 'action-after-sales', group: 'Navegação', label: 'Abrir Pós-venda', href: '/admin/after-sales', icon: 'heart' },
      { id: 'action-reports', group: 'Navegação', label: 'Abrir Relatórios', href: '/admin/reports', icon: 'chart' },
      { id: 'action-new-customer', group: 'Criar', label: 'Novo cliente', href: '/admin/collections/customers/create', icon: 'plus' },
      { id: 'action-new-lead', group: 'Criar', label: 'Novo lead', meta: 'Registrar entrada e qualificação', href: '/admin/leads', icon: 'person' },
      { id: 'action-new-opportunity', group: 'Criar', label: 'Nova oportunidade', meta: 'Iniciar negociação comercial', href: '/admin/collections/opportunities/create', icon: 'plus' },
      { id: 'action-new-follow-up', group: 'Criar', label: 'Novo follow-up', meta: 'Criar tarefa operacional real', href: '/admin/collections/tasks/create?type=follow_up', icon: 'plus' },
    )
  }

  if (isAdmin(user)) items.push({ id: 'action-users', group: 'Navegação', label: 'Abrir Usuários', href: '/admin/collections/users', icon: 'shield' })
  return items
}

export async function GET(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })

  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const url = new URL(request.url)
  const query = (url.searchParams.get('q') || '').trim().slice(0, 80)
  const needle = query.toLocaleLowerCase('pt-BR')
  const context = requestContext(request)
  const actions = actionsFor(user, context.pathname, context.search).filter((item) => !needle || `${item.label} ${item.meta || ''}`.toLocaleLowerCase('pt-BR').includes(needle))

  if (query.length < 2) return NextResponse.json({ results: actions.slice(0, 16), context })

  const searches: Array<Promise<SearchItem[]>> = []

  if (canManageSite(user)) {
    searches.push(
      payload.find({
        collection: 'products', overrideAccess: false, user, draft: true, depth: 0, limit: 6,
        where: { or: [{ title: { like: query } }, { code: { like: query } }, { slug: { like: query } }] } as Where,
        select: { id: true, title: true, code: true, slug: true },
      }).then((result) => result.docs.map((doc) => ({ id: `product-${doc.id}`, group: 'Produtos recentes', label: text(doc.title) || 'Produto sem título', meta: text(doc.code) || text(doc.slug) || undefined, href: `/admin/products?product=${doc.id}&tab=overview`, icon: 'box' }))),
      payload.find({
        collection: 'categories', overrideAccess: false, user, draft: true, depth: 0, limit: 6,
        where: { or: [{ title: { like: query } }, { slug: { like: query } }] } as Where,
        select: { id: true, title: true, slug: true },
      }).then((result) => result.docs.map((doc) => ({ id: `category-${doc.id}`, group: 'Categorias recentes', label: text(doc.title) || 'Categoria sem título', meta: text(doc.slug) || undefined, href: `/admin/categories?category=${doc.id}`, icon: 'tag' }))),
    )
  }

  if (canManageBusiness(user)) {
    searches.push(
      payload.find({
        collection: 'customers', overrideAccess: false, user, depth: 0, limit: 6,
        where: { or: [{ name: { like: query } }, { phone: { like: query } }, { email: { like: query } }] } as Where,
        select: { id: true, name: true, phone: true, email: true },
      }).then((result) => result.docs.map((doc) => ({ id: `customer-${doc.id}`, group: 'Clientes recentes', label: text(doc.name) || 'Cliente sem nome', meta: text(doc.phone) || text(doc.email) || undefined, href: `/admin/customers?customer=${doc.id}&tab=overview`, icon: 'users' }))),
      payload.find({
        collection: 'opportunities', overrideAccess: false, user, depth: 1, limit: 6,
        where: { or: [{ code: { like: query } }, { nextAction: { like: query } }, { 'customer.name': { like: query } }] } as Where,
        select: { id: true, code: true, stage: true, nextAction: true, customer: true },
      }).then((result) => result.docs.map((doc) => ({ id: `opportunity-${doc.id}`, group: 'Oportunidades', label: text(doc.code) || 'Oportunidade sem código', meta: [relationLabel(doc.customer), opportunityStageLabels[doc.stage as keyof typeof opportunityStageLabels] || text(doc.stage), text(doc.nextAction)].filter(Boolean).join(' · ') || undefined, href: `/admin/opportunities?view=list&q=${encodeURIComponent(text(doc.code) || String(doc.id))}`, icon: 'receipt' }))),
      payload.find({
        collection: 'leads', overrideAccess: false, user, depth: 0, limit: 6,
        where: { or: [{ name: { like: query } }, { phone: { like: query } }, { email: { like: query } }] } as Where,
        select: { id: true, name: true, source: true },
      }).then((result) => result.docs.map((doc) => ({ id: `lead-${doc.id}`, group: 'Leads recentes', label: text(doc.name) || 'Lead sem nome', meta: text(doc.source) || undefined, href: `/admin/leads?q=${encodeURIComponent(text(doc.name) || String(doc.id))}`, icon: 'person' }))),
      payload.find({
        collection: 'sales', overrideAccess: false, user, depth: 0, limit: 6,
        where: { number: { like: query } } as Where,
        select: { id: true, number: true, status: true, totalCents: true },
      }).then((result) => result.docs.map((doc) => ({ id: `sale-${doc.id}`, group: 'Vendas recentes', label: `Venda #${text(doc.number) || '—'}`, meta: text(doc.status) || undefined, href: `/admin/sales?q=${encodeURIComponent(text(doc.number) || String(doc.id))}`, icon: 'receipt' }))),
    )
  }

  try {
    const groups = await Promise.all(searches)
    return NextResponse.json({ results: [...actions, ...groups.flat()].slice(0, 36), context })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin command search failed')
    return NextResponse.json({ error: 'Não foi possível pesquisar agora.' }, { status: 500 })
  }
}
