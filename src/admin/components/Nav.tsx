'use client'

import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import type { EsmeraRole } from '../../access/roles'
import { isShellLinkActive, visibleOperationalLinks, visibleTechnicalLinks } from '../shell/navigation'
import { ShellIcon } from '../shell/ShellIcon'
import { EsmeraIcon } from './Brand'

type NavUser = {
  id: number | string
  collection?: string
  email?: string | null
  name?: string | null
  role?: EsmeraRole | null
}

export function EsmeraNav() {
  const pathname = usePathname()
  const auth = useAuth()
  const user = auth.user as NavUser | null
  const role = user?.role || null
  const name = user?.name || user?.email?.split('@')[0] || 'Esméra'
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editorial' : role === 'commercial' ? 'Comercial' : 'Sem papel'

  if (!user) return null

  return (
    <nav className="esmera-nav" data-testid="esmera-nav" aria-label="Navegação principal">
      <Link className="esmera-nav-brand" href="/admin" aria-label="Esméra CMS — Dashboard">
        <EsmeraIcon />
        <div><strong>Esméra CMS</strong><span>Management Portal</span></div>
      </Link>

      <div className="esmera-nav-section" aria-label="Portal operacional">
        {visibleOperationalLinks(role).map((item) => (
          <Link
            className={`esmera-nav-link${isShellLinkActive(pathname, item) ? ' is-active' : ''}`}
            href={item.href}
            key={item.href}
            title={item.label}
          >
            <ShellIcon name={item.icon} className="esmera-nav-icon" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="esmera-nav-divider" />
      <div className="esmera-nav-caption">Admin técnico</div>
      <div className="esmera-nav-section esmera-nav-section--technical">
        {visibleTechnicalLinks(role).map((item) => (
          <Link
            className={`esmera-nav-link${isShellLinkActive(pathname, item) ? ' is-active' : ''}`}
            href={item.href}
            key={item.href}
            title={item.label}
          >
            <ShellIcon name={item.icon} className="esmera-nav-icon" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="esmera-nav-footer">
        <Link className="esmera-user" href="/admin/account" title={`${name} · ${roleLabel}`}>
          <span className="esmera-avatar">{name.slice(0, 2).toUpperCase()}</span>
          <span className="esmera-user-copy"><strong>{name}</strong><small>{roleLabel}</small></span>
        </Link>
        <button className="esmera-logout" type="button" onClick={() => void auth.logOut()} aria-label="Sair">Sair</button>
      </div>
    </nav>
  )
}
