'use client'

import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'

import type { EsmeraRole } from '../../access/roles'
import { ADMIN_CREATE_EVENT } from '../state/AdminStateProvider'
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

function isVisibleControl(element: HTMLElement) {
  const style = getComputedStyle(element)
  const rect = element.getBoundingClientRect()
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
}

function focusLocalSearch() {
  const candidates = document.querySelectorAll<HTMLInputElement>(
    '.esmera-view input[type="search"], .esmera-view input[name="q"], main input[type="search"], main input[name="q"]',
  )
  const target = Array.from(candidates).find((element) => !element.disabled && isVisibleControl(element))
  if (!target) return false
  target.focus({ preventScroll: false })
  target.select()
  return true
}

export function AppHeader() {
  const auth = useAuth()
  const user = auth.user as HeaderUser | null
  const role = user?.role || null
  const name = user?.name || user?.email?.split('@')[0] || 'Esméra'
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const headerNode = headerRef.current
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        setCommandOpen(true)
        return
      }

      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === '/') {
        event.preventDefault()
        if (!focusLocalSearch()) setCommandOpen(true)
        return
      }

      if (key === 'n') {
        event.preventDefault()
        window.dispatchEvent(new Event(ADMIN_CREATE_EVENT))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    headerNode?.setAttribute('data-shortcuts-ready', 'true')

    return () => {
      headerNode?.setAttribute('data-shortcuts-ready', 'false')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (!user) return null

  return (
    <>
      <header
        ref={headerRef}
        className="esmera-app-header"
        data-testid="esmera-app-header"
        data-shortcuts-ready="false"
      >
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
