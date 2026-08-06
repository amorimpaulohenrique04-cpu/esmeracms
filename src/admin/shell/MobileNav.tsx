'use client'

import { Dialog } from '@base-ui/react/dialog'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import React from 'react'

import type { EsmeraRole } from '../../access/roles'
import { EsmeraIcon } from '../components/Brand'
import { isShellLinkActive, type ShellNavGroup, visibleOperationalLinks, visibleTechnicalLinks } from './navigation'
import { ShellIcon } from './ShellIcon'

const GROUP_LABELS: Record<ShellNavGroup, string | null> = {
  dashboard: null,
  funil: 'Funil comercial',
  relacionamento: 'Relacionamento',
  catalogo: 'Catálogo',
  outros: null,
}

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
  const search = useSearchParams().toString()
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editorial' : role === 'commercial' ? 'Comercial' : 'Sem papel'
  const technicalNavLinks = visibleTechnicalLinks(role)

  const renderLinks = (items: ReturnType<typeof visibleOperationalLinks>) => items.map((item, index) => {
    const active = isShellLinkActive(pathname, search, item)
    const groupLabel = GROUP_LABELS[item.group]
    const showGroupHeader = groupLabel && items[index - 1]?.group !== item.group
    return (
      <React.Fragment key={item.href}>
        {showGroupHeader ? <div className="esmera-mobile-nav-group-label">{groupLabel}</div> : null}
        <Link
          className={`esmera-mobile-nav-link${active ? ' is-active' : ''}`}
          href={item.href}
          aria-current={active ? 'page' : undefined}
          onClick={() => onOpenChange(false)}
        >
          <ShellIcon name={item.icon} />
          <span>{item.label}</span>
          {item.step ? <small className="esmera-nav-step">{item.step}</small> : null}
        </Link>
      </React.Fragment>
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

            {technicalNavLinks.length ? <>
            <div className="esmera-mobile-nav-divider" />
            <div className="esmera-mobile-nav-caption">Configurações avançadas</div>
            <nav className="esmera-mobile-nav-links" aria-label="Configurações avançadas">
              {renderLinks(technicalNavLinks)}
            </nav>
            </> : null}

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
