'use client'

import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'

import type { EsmeraRole } from '../../access/roles'
import { ADMIN_CREATE_EVENT, ADMIN_SELECTION_EVENT } from '../state/AdminStateProvider'
import { CommandPalette, type CommandSelection } from './CommandPalette'
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

function inferSelection(pathname: string, searchParams: URLSearchParams): CommandSelection | null {
  const title = document.querySelector<HTMLElement>('.esmera-context-inspector h2, .esmera-command-bar h1, .esmera-page-header h1')?.textContent?.trim()
  const workspaceKeys = ['product', 'customer', 'sale', 'inspect'] as const
  for (const key of workspaceKeys) {
    const id = searchParams.get(key)
    if (!id) continue
    const kind = key === 'inspect' && pathname.includes('/products') ? 'product' : key
    return { kind, id, label: title || `${kind} ${id}`, href: `${pathname}?${searchParams.toString()}` }
  }

  const collection = pathname.match(/^\/admin\/collections\/([^/]+)\/([^/]+)\/?$/)
  if (collection && collection[2] !== 'create') {
    return { kind: collection[1], id: collection[2], label: title || `${collection[1]} ${collection[2]}`, href: pathname }
  }
  return null
}

export function AppHeader() {
  const auth = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const user = auth.user as HeaderUser | null
  const role = user?.role || null
  const name = user?.name || user?.email?.split('@')[0] || 'Esméra'
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [shortcutsReady, setShortcutsReady] = useState(false)
  const [selection, setSelection] = useState<CommandSelection | null>(null)

  const openCommand = useCallback(() => {
    const inferred = inferSelection(pathname, new URLSearchParams(search))
    if (inferred) setSelection(inferred)
    setCommandOpen(true)
  }, [pathname, search])

  useEffect(() => {
    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<CommandSelection | null>).detail
      setSelection(detail || null)
    }
    window.addEventListener(ADMIN_SELECTION_EVENT, onSelection)
    return () => window.removeEventListener(ADMIN_SELECTION_EVENT, onSelection)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault()
        openCommand()
        return
      }

      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === '/') {
        event.preventDefault()
        if (!focusLocalSearch()) openCommand()
        return
      }

      if (key === 'n') {
        event.preventDefault()
        window.dispatchEvent(new Event(ADMIN_CREATE_EVENT))
      }
    }

    window.addEventListener('keydown', onKeyDown)
    const readyFrame = window.requestAnimationFrame(() => setShortcutsReady(true))

    return () => {
      window.cancelAnimationFrame(readyFrame)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openCommand])

  if (!user) return null

  return (
    <>
      <header
        className="esmera-app-header"
        data-testid="esmera-app-header"
        data-shortcuts-ready={shortcutsReady ? 'true' : 'false'}
      >
        <div className="esmera-app-header__left">
          <button className="esmera-shell-mobile-trigger" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Abrir navegação">
            <ShellIcon name="menu" />
          </button>
          <button className="esmera-command-trigger" type="button" onClick={openCommand} aria-label="Buscar no CMS">
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

      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        selection={selection}
        currentHref={`${pathname}${search ? `?${search}` : ''}`}
      />
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
