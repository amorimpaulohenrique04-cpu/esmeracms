'use client'

import { useAuth } from '@payloadcms/ui'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

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

const RAIL_RANGE_QUERY = '(min-width: 1024px) and (max-width: 1279px)'
const PEEK_INTENT_DELAY = 120
const PEEK_EXIT_DELAY = 120

export function EsmeraNav() {
  const pathname = usePathname()
  const auth = useAuth()
  const user = auth.user as NavUser | null
  const role = user?.role || null
  const name = user?.name || user?.email?.split('@')[0] || 'Esméra'
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'editor' ? 'Editorial' : role === 'commercial' ? 'Comercial' : 'Sem papel'

  const [peekOpen, setPeekOpen] = useState(false)
  const railRangeRef = useRef(false)
  const intentTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const dismissedTargetRef = useRef<EventTarget | null>(null)

  const clearIntentTimer = useCallback(() => {
    if (intentTimerRef.current !== null) {
      window.clearTimeout(intentTimerRef.current)
      intentTimerRef.current = null
    }
  }, [])
  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const railQuery = window.matchMedia(RAIL_RANGE_QUERY)
    const syncRailRange = () => {
      railRangeRef.current = railQuery.matches
      if (!railQuery.matches) {
        clearIntentTimer()
        clearExitTimer()
        setPeekOpen(false)
        dismissedTargetRef.current = null
      }
    }
    syncRailRange()
    railQuery.addEventListener('change', syncRailRange)
    return () => railQuery.removeEventListener('change', syncRailRange)
  }, [clearExitTimer, clearIntentTimer])

  useEffect(() => () => {
    clearIntentTimer()
    clearExitTimer()
  }, [clearExitTimer, clearIntentTimer])

  const openPeekNow = useCallback(() => {
    clearExitTimer()
    clearIntentTimer()
    dismissedTargetRef.current = null
    setPeekOpen(true)
  }, [clearExitTimer, clearIntentTimer])

  const handlePointerEnter = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!railRangeRef.current || event.pointerType !== 'mouse') return
    clearExitTimer()
    clearIntentTimer()
    intentTimerRef.current = window.setTimeout(() => {
      intentTimerRef.current = null
      openPeekNow()
    }, PEEK_INTENT_DELAY)
  }, [clearExitTimer, clearIntentTimer, openPeekNow])

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!railRangeRef.current || event.pointerType !== 'mouse') return
    clearIntentTimer()
    clearExitTimer()
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null
      setPeekOpen(false)
    }, PEEK_EXIT_DELAY)
  }, [clearExitTimer, clearIntentTimer])

  const handleFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (!railRangeRef.current) return
    if (dismissedTargetRef.current && event.target === dismissedTargetRef.current) return
    openPeekNow()
  }, [openPeekNow])

  const handleBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (!railRangeRef.current) return
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    clearIntentTimer()
    clearExitTimer()
    setPeekOpen(false)
    dismissedTargetRef.current = null
  }, [clearExitTimer, clearIntentTimer])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !railRangeRef.current || !peekOpen) return
    event.preventDefault()
    clearIntentTimer()
    clearExitTimer()
    dismissedTargetRef.current = document.activeElement
    setPeekOpen(false)
  }, [clearExitTimer, clearIntentTimer, peekOpen])

  if (!user) return null

  return (
    <nav
      className="esmera-nav"
      data-testid="esmera-nav"
      data-peek={peekOpen ? 'open' : 'closed'}
      aria-label="Navegação principal"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <Link className="esmera-nav-brand" href="/admin" aria-label="Esméra CMS — Dashboard">
        <EsmeraIcon />
        <div><strong>Esméra CMS</strong><span>Management Portal</span></div>
      </Link>

      <div className="esmera-nav-section" aria-label="Portal operacional">
        {visibleOperationalLinks(role).map((item) => {
          const active = isShellLinkActive(pathname, item)
          return (
            <Link
              className={`esmera-nav-link${active ? ' is-active' : ''}`}
              href={item.href}
              key={item.href}
              title={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <ShellIcon name={item.icon} className="esmera-nav-icon" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="esmera-nav-divider" />
      <div className="esmera-nav-caption">Admin técnico</div>
      <div className="esmera-nav-section esmera-nav-section--technical">
        {visibleTechnicalLinks(role).map((item) => {
          const active = isShellLinkActive(pathname, item)
          return (
            <Link
              className={`esmera-nav-link${active ? ' is-active' : ''}`}
              href={item.href}
              key={item.href}
              title={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <ShellIcon name={item.icon} className="esmera-nav-icon" />
              <span>{item.label}</span>
            </Link>
          )
        })}
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
