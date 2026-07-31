'use client'

import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import type { EsmeraRole } from '../../access/roles'
import { CommandPalette } from './CommandPalette'
import { GlobalCreateMenu } from './GlobalCreateMenu'
import { MobileNav } from './MobileNav'
import { ShellIcon } from './ShellIcon'

type HeaderUser = {
  id: string | number
  email?: string | null
  name?: string | null
  role?: EsmeraRole | null
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function AppHeader() {
  const auth = useAuth()
  const user = auth.user as HeaderUser | null
  const role = user?.role || null
  const name = user?.name || user?.email?.split('@')[0] || 'Esméra'
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
        return
      }

      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault()
        setCommandOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!user) return null

  return (
    <>
      <header className="esmera-app-header" data-testid="esmera-app-header">
        <div className="esmera-app-header__left">
          <button className="esmera-shell-mobile-trigger" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Abrir navegação">
            <ShellIcon name="menu" />
          </button>
          <button className="esmera-command-trigger" type="button" onClick={() => setCommandOpen(true)} aria-label="Buscar no CMS">
            <ShellIcon name="search" />
            <span>Buscar no CMS</span>
            <kbd>⌘K / Ctrl K</kbd>
          </button>
        </div>

        <div className="esmera-app-header__right">
          <GlobalCreateMenu role={role} />
          <Link className="esmera-header-user" href="/admin/account" aria-label="Abrir conta">
            <span className="esmera-header-avatar">{name.slice(0, 2).toUpperCase()}</span>
            <span className="esmera-header-user-copy"><strong>{name}</strong><small>{role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editorial' : role === 'commercial' ? 'Comercial' : 'Sem papel'}</small></span>
          </Link>
        </div>
      </header>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        role={role}
        name={name}
        onLogout={() => {
          setMobileNavOpen(false)
          void auth.logOut()
        }}
      />
    </>
  )
}
