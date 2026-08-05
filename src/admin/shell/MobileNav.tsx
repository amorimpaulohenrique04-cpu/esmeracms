'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import type { EsmeraRole } from '../../access/roles'
import { EsmeraIcon } from '../components/Brand'
import { isShellLinkActive, visibleOperationalLinks, visibleTechnicalLinks } from './navigation'
import { ShellIcon } from './ShellIcon'

export function MobileNav({
  open,
  onOpenChange,
  role,
  name,
  onLogout,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: EsmeraRole | null
  name: string
  onLogout: () => void
}) {
  const pathname = usePathname()
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editorial' : role === 'commercial' ? 'Comercial' : 'Sem papel'

  const renderLinks = (items: ReturnType<typeof visibleOperationalLinks>) => items.map((item) => {
    const active = isShellLinkActive(pathname, item)
    return (
      <Link
        key={item.href}
        className={`esmera-mobile-nav-link${active ? ' is-active' : ''}`}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        onClick={() => onOpenChange(false)}
      >
        <ShellIcon name={item.icon} />
        <span>{item.label}</span>
      </Link>
    )
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="esmera-mobile-nav-backdrop" />
        <Dialog.Viewport className="esmera-mobile-nav-viewport">
          <Dialog.Popup className="esmera-mobile-nav" data-testid="esmera-mobile-nav">
            <Dialog.Title className="esmera-command-sr-title">Navegação Esméra CMS</Dialog.Title>
            <div className="esmera-mobile-nav-head">
              <div className="esmera-mobile-nav-brand"><EsmeraIcon /><span><strong>Esméra CMS</strong><small>Management Portal</small></span></div>
              <Dialog.Close className="esmera-mobile-nav-close" aria-label="Fechar menu"><ShellIcon name="close" /></Dialog.Close>
            </div>

            <nav className="esmera-mobile-nav-links" aria-label="Portal operacional">
              {renderLinks(visibleOperationalLinks(role))}
            </nav>

            <div className="esmera-mobile-nav-divider" />
            <div className="esmera-mobile-nav-caption">Admin técnico</div>
            <nav className="esmera-mobile-nav-links" aria-label="Admin técnico">
              {renderLinks(visibleTechnicalLinks(role))}
            </nav>

            <div className="esmera-mobile-nav-footer">
              <Link className="esmera-mobile-user" href="/admin/account" onClick={() => onOpenChange(false)}>
                <span className="esmera-avatar">{name.slice(0, 2).toUpperCase()}</span>
                <span><strong>{name}</strong><small>{roleLabel}</small></span>
              </Link>
              <button className="esmera-mobile-logout" type="button" onClick={onLogout}>Sair</button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
