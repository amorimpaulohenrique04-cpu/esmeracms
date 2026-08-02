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

function contextualActions(user: unknown, context: string): SearchItem[] {
  const items: SearchItem[] = []
  if (canManageSite(user) && context.startsWith('/admin/products')) {
    items.push(
      { id: 'context-new-product', group: 'Ações contextuais', label: 'Novo produto', meta: 'Criar item do catálogo', href: '/admin/collections/products/create', icon: 'plus' },
      { id: 'context-open-categories', group: 'Ações contextuais', label: 'Abrir Categorias', meta: 'Gerenciar taxonomia do catálogo', href: '/admin/categories', icon: 'tag' },
    )
  }
  if (canManageSite(user) && context.startsWith('/admin/categories')) {
    items.push(
      { id: 'context-new-category', group: 'Ações contextuais', label: 'Nova categoria', meta: 'Criar taxonomia editorial', href: '/admin/collections/categories/create', icon: 'plus' },
      { id: 'context-open-products', group: 'Ações contextuais', label: 'Abrir Produtos', meta: 'Voltar ao catálogo operacional', href: '/admin/products', icon: 'box' },
    )
  }
  if (canManageBusiness(user) && context.startsWith('/admin/customers')) {
    items.push(
      { id: 'context-new-customer', group: 'Ações contextuais', label: 'Novo cliente', meta: 'Cadastrar relacionamento comercial', href: '/admin/collections/customers/create', icon: 'plus' },
      { id: 'context-new-opportunity', group: 'Ações contextuais', label: 'Nova oportunidade', meta: 'Iniciar negociação para um cliente', href: '/admin/collections/opportunities/create', icon: 'receipt' },
    )
  }
  if (canManageBusiness(user) && context.startsWith('/admin/sales')) {
    items.push(
      { id: 'context-new-opportunity-sales', group: 'Ações contextuais', label: 'Nova oportunidade', meta: 'Adicionar ao Pipeline', href: '/admin/collections/opportunities/create', icon: 'plus' },
      { id: 'context-confirm-sale', group: 'Ações contextuais', label: 'Confirmar venda pelo Pipeline', meta: 'Mover uma oportunidade para Ganha e gerar Sale real', href: '/admin/sales?view=pipeline', icon: 'receipt' },
      { id: 'context-new-follow-up', group: 'Ações contextuais', label: 'Novo follow-up', meta: 'Criar Task operacional vinculável', href: '/admin/collections/tasks/create', icon: 'clock' },
    )
  }
  if (canManageBusiness(user) && context.startsWith('/admin/after-sales')) {
    items.push(
      { id: 'context-new-after-sales-task', group: 'Ações contextuais', label: 'Novo follow-up de pós-venda', meta: 'Criar tarefa real para o atendimento', href: '/admin/collections/tasks/create', icon: 'clock' },
      { id: 'context-open-shipments', group: 'Ações contextuais', label: 'Abrir entregas técnicas', meta: 'Consultar Shipments persistidos', href: '/admin/collections/shipments', icon: 'box' },
    )
  }
  if (canManageBusiness(user) && context.startsWith('/admin/reports')) {
    items.push(
      { id: 'context-report-evolution', group: 'Ações contextuais', label: 'Ir para Evolução comercial', href: '/admin/reports#evolution', icon: 'chart' },
      { id: 'context-report-funnel', group: 'Ações contextuais', label: 'Ir para Funil', href: '/admin/reports#funnel', icon: 'chart' },
      { id: 'context-report-catalog', group: 'Ações contextuais', label: 'Ir para Catálogo', href: '/admin/reports#catalog', icon: 'box' },
      { id: 'context-report-team', group: 'Ações contextuais', label: 'Ir para Equipe', href: '/admin/reports#team', icon: 'users' },
    )
  }
  return items
}

function actionsFor(user: unknown, context: string): SearchItem[] {
  const items: SearchItem[] = [
    ...contextualActions(user, context),
    { id: 'action-dashboard', group: 'Ações', label: 'Abrir Dashboard', href: '/admin', icon: 'grid' },
    { id: 'action-technical', group: 'Ações', label: 'Abrir Admin técnico', href: '/admin/technical', icon: 'database' },
  ]

  if (canManageSite(user)) {
    items.push(
      { id: 'action-products', group: 'Ações', label: 'Abrir Produtos', href: '/admin/products', icon: 'box' },
      { id: 'action-categories', group: 'Ações', label: 'Abrir Categorias', href: '/admin/categories', icon: 'tag' },
      { id: 'action-new-product', group: 'Ações', label: 'Novo produto', meta: 'Criar item do catálogo', href: '/admin/collections/products/create', icon: 'plus' },
      { id: 'action-new-category', group: 'Ações', label: 'Nova categoria', meta: 'Criar taxonomia editorial', href: '/admin/collections/categories/create', icon: 'plus' },
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
      { id: 'action-new-lead', group: 'Ações', label: 'Novo lead', meta: 'Registrar entrada e qualificação', href: '/admin/collections/leads/create', icon: 'person' },
      { id: 'action-new-opportunity', group: 'Ações', label: 'Nova oportunidade', meta: 'Iniciar negociação comercial', href: '/admin/collections/opportunities/create', icon: 'plus' },
      { id: 'action-new-follow-up', group: 'Ações', label: 'Novo follow-up', meta: 'Criar Task operacional', href: '/admin/collections/tasks/create', icon: 'clock' },
      { id: 'action-confirm-sale', group: 'Ações', label: 'Confirmar venda pelo Pipeline', meta: 'Gera Sale a partir de oportunidade ganha', href: '/admin/sales?view=pipeline', icon: 'receipt' },
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
  const context = (url.searchParams.get('context') || '').trim().slice(0, 500)
  const needle = query.toLocaleLowerCase('pt-BR')
  const actions = actionsFor(user, context).filter((item) => !needle || `${item.label} ${item.meta || ''}`.toLocaleLowerCase('pt-BR').includes(needle))

  if (query.length < 2) return NextResponse.json({ results: actions.slice(0, 18) })

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
        where: { or: [{ title: { like: query } }, { code: { like: query } }, { slug: { like: query } }] } as Where,
        select: { id: true, title: true, code: true, slug: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `product-${doc.id}`,
        group: 'Produtos',
        label: text(doc.title) || 'Produto sem título',
        meta: text(doc.code) || text(doc.slug) || undefined,
        href: `/admin/products?product=${doc.id}&tab=overview`,
        icon: 'box',
      }))),
      payload.find({
        collection: 'categories',
        overrideAccess: false,
        user,
        draft: true,
        depth: 0,
        limit: 6,
        where: { or: [{ title: { like: query } }, { slug: { like: query } }, { description: { like: query } }] } as Where,
        select: { id: true, title: true, slug: true, status: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `category-${doc.id}`,
        group: 'Categorias',
        label: text(doc.title) || 'Categoria sem título',
        meta: [text(doc.slug), text(doc.status)].filter(Boolean).join(' · ') || undefined,
        href: `/admin/categories?category=${doc.id}&section=general`,
        icon: 'tag',
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
        where: { or: [{ name: { like: query } }, { phone: { like: query } }, { email: { like: query } }] } as Where,
        select: { id: true, name: true, phone: true, email: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `customer-${doc.id}`,
        group: 'Clientes',
        label: text(doc.name) || 'Cliente sem nome',
        meta: text(doc.phone) || text(doc.email) || undefined,
        href: `/admin/customers?customer=${doc.id}&tab=overview`,
        icon: 'users',
      }))),
      payload.find({
        collection: 'opportunities',
        overrideAccess: false,
        user,
        depth: 1,
        limit: 6,
        where: { or: [{ code: { like: query } }, { nextAction: { like: query } }, { 'customer.name': { like: query } }] } as Where,
        select: { id: true, code: true, stage: true, nextAction: true, customer: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `opportunity-${doc.id}`,
        group: 'Oportunidades',
        label: text(doc.code) || 'Oportunidade sem código',
        meta: [relationLabel(doc.customer), opportunityStageLabels[doc.stage as keyof typeof opportunityStageLabels] || text(doc.stage), text(doc.nextAction)].filter(Boolean).join(' · ') || undefined,
        href: `/admin/collections/opportunities/${doc.id}`,
        icon: 'receipt',
      }))),
      payload.find({
        collection: 'leads',
        overrideAccess: false,
        user,
        depth: 0,
        limit: 6,
        where: { or: [{ name: { like: query } }, { phone: { like: query } }, { email: { like: query } }] } as Where,
        select: { id: true, name: true, stage: true, source: true },
      }).then((result) => result.docs.map((doc) => ({
        id: `lead-${doc.id}`,
        group: 'Leads',
        label: text(doc.name) || 'Lead sem nome',
        meta: [text(doc.source), text(doc.stage)].filter(Boolean).join(' · ') || undefined,
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
    return NextResponse.json({ results: [...actions, ...groups.flat()].slice(0, 36) })
  } catch (error) {
    payload.logger.error({ err: error }, 'admin command search failed')
    return NextResponse.json({ error: 'Não foi possível pesquisar agora.' }, { status: 500 })
  }
}
