'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { useAuth } from '@payloadcms/ui'

import type { EsmeraRole } from '../../access/roles'
import { EsmeraIcon } from './Brand'

type NavUser = {
  id: number | string
  collection?: string
  email?: string | null
  name?: string | null
  role?: EsmeraRole | null
}

type LinkItem = {
  href: string
  label: string
  icon: string
  area: 'all' | 'site' | 'business' | 'admin'
}

const operationalLinks: LinkItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'grid', area: 'all' },
  { href: '/admin/content', label: 'Conteúdo do site', icon: 'page', area: 'site' },
  { href: '/admin/products', label: 'Produtos', icon: 'box', area: 'site' },
  { href: '/admin/categories', label: 'Categorias', icon: 'tag', area: 'site' },
  { href: '/admin/customers', label: 'Clientes', icon: 'users', area: 'business' },
  { href: '/admin/sales', label: 'Vendas', icon: 'receipt', area: 'business' },
  { href: '/admin/pipeline', label: 'Pipeline', icon: 'pipeline', area: 'business' },
  { href: '/admin/after-sales', label: 'Pós-venda', icon: 'heart', area: 'business' },
  { href: '/admin/reports', label: 'Relatórios', icon: 'chart', area: 'business' },
  { href: '/admin/settings', label: 'Configurações', icon: 'settings', area: 'site' },
]

const technicalLinks: LinkItem[] = [
  { href: '/admin/technical', label: 'Admin técnico', icon: 'database', area: 'all' },
  { href: '/admin/collections/users', label: 'Usuários', icon: 'shield', area: 'admin' },
]

function roleAllows(role: EsmeraRole, area: LinkItem['area']) {
  if (area === 'all') return true
  if (role === 'admin') return true
  if (area === 'site') return role === 'editor'
  if (area === 'business') return role === 'commercial'
  return false
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    page: <><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h7M9 16h7"/></>,
    box: <><path d="m4 7 8-4 8 4-8 4z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4z"/><path d="M12 11v10"/></>,
    tag: <><path d="M4 5h8l8 8-7 7-8-8z"/><circle cx="9" cy="9" r="1"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2.5-7 6-7s6 3 6 7"/><path d="M15 5c3 0 5 2 5 5 0 1.5-.6 2.8-1.6 3.7M16 14c3 .6 5 2.8 5 6"/></>,
    receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    pipeline: <><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3M14 12h3"/></>,
    heart: <path d="M12 20s-8-4.7-8-11a4 4 0 0 1 7-2.7L12 8l1-1.7A4 4 0 0 1 20 9c0 6.3-8 11-8 11Z"/>,
    chart: <><path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></>,
    database: <><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
    shield: <path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6z"/>,
  }
  return <svg className="esmera-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" aria-hidden="true">{paths[name]}</svg>
}

export function EsmeraNav() {
  const pathname = usePathname()
  const auth = useAuth()
  const user = auth.user as NavUser | null
  const role = user?.role || 'admin'
  const name = user?.name || user?.email?.split('@')[0] || 'Esméra'

  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <nav className="esmera-nav" data-testid="esmera-nav" aria-label="Navegação principal">
      <div className="esmera-nav-brand">
        <EsmeraIcon />
        <div><strong>Esméra CMS</strong><span>Management Portal</span></div>
      </div>

      <div className="esmera-nav-section" aria-label="Portal operacional">
        {operationalLinks.filter((item) => roleAllows(role, item.area)).map((item) => (
          <Link className={`esmera-nav-link${isActive(item.href) ? ' is-active' : ''}`} href={item.href} key={item.href}>
            <NavIcon name={item.icon} /><span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="esmera-nav-divider" />
      <div className="esmera-nav-caption">Admin técnico</div>
      <div className="esmera-nav-section esmera-nav-section--technical">
        {technicalLinks.filter((item) => roleAllows(role, item.area)).map((item) => (
          <Link className="esmera-nav-link" href={item.href} key={item.href}>
            <NavIcon name={item.icon} /><span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="esmera-nav-footer">
        <Link className="esmera-user" href="/admin/account">
          <span className="esmera-avatar">{name.slice(0, 2).toUpperCase()}</span>
          <span><strong>{name}</strong><small>{role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editorial' : 'Comercial'}</small></span>
        </Link>
        <button className="esmera-logout" type="button" onClick={() => void auth.logOut()} aria-label="Sair">Sair</button>
      </div>
    </nav>
  )
}
