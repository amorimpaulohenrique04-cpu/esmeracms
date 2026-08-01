'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useEffect, useState } from 'react'

const CONTEXT_PREFIX = 'esmera:context:'
const ORIGIN_PREFIX = 'esmera:origin:'

export const ADMIN_ANNOUNCE_EVENT = 'esmera:announce'
export const ADMIN_CREATE_EVENT = 'esmera:create-open'

type StoredContext = {
  scrollX: number
  scrollY: number
  focusKey?: string
  savedAt: number
}

function currentContextKey() {
  return `${window.location.pathname}${window.location.search}`
}

function focusKeyFor(element: Element | null) {
  if (!(element instanceof HTMLElement)) return undefined
  return element.dataset.esmeraContextKey || element.id || undefined
}

function storeContext() {
  try {
    const value: StoredContext = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      focusKey: focusKeyFor(document.activeElement),
      savedAt: Date.now(),
    }
    sessionStorage.setItem(`${CONTEXT_PREFIX}${currentContextKey()}`, JSON.stringify(value))
  } catch {
    // Context persistence must never block navigation.
  }
}

function storedContext(): StoredContext | null {
  try {
    const raw = sessionStorage.getItem(`${CONTEXT_PREFIX}${currentContextKey()}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredContext
    if (!Number.isFinite(parsed.scrollX) || !Number.isFinite(parsed.scrollY)) return null
    return parsed
  } catch {
    return null
  }
}

function restoreContext() {
  const context = storedContext()
  if (!context) return

  window.requestAnimationFrame(() => {
    window.scrollTo({ left: context.scrollX, top: context.scrollY, behavior: 'instant' })
    if (!context.focusKey) return
    const escaped = CSS.escape(context.focusKey)
    const target = document.querySelector<HTMLElement>(`[data-esmera-context-key="${escaped}"], #${escaped}`)
    target?.focus({ preventScroll: true })
  })
}

function rememberEditOrigin(anchor: HTMLAnchorElement) {
  try {
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin/collections/')) return
    sessionStorage.setItem(`${ORIGIN_PREFIX}${url.pathname}`, currentContextKey())
  } catch {
    // Invalid or external hrefs are ignored.
  }
}

export function adminOriginFor(pathname: string) {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(`${ORIGIN_PREFIX}${pathname}`)
  } catch {
    return null
  }
}

export function announceAdmin(message: string, assertive = false) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ADMIN_ANNOUNCE_EVENT, { detail: { message, assertive } }))
}

function AdminLiveRegion() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; assertive?: boolean }>).detail
      const message = detail?.message?.trim()
      if (!message) return
      if (detail.assertive) setAssertive(message)
      else setPolite(message)
    }
    window.addEventListener(ADMIN_ANNOUNCE_EVENT, listener)
    return () => window.removeEventListener(ADMIN_ANNOUNCE_EVENT, listener)
  }, [])

  return (
    <>
      <div className="esmera-sr-only" role="status" aria-live="polite" aria-atomic="true">{polite}</div>
      <div className="esmera-sr-only" role="alert" aria-live="assertive" aria-atomic="true">{assertive}</div>
    </>
  )
}

export function AdminStateProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  }))

  useEffect(() => {
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'

    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || anchor.target === '_blank' || event.defaultPrevented) return
      storeContext()
      rememberEditOrigin(anchor)
    }
    const onPageHide = () => storeContext()
    const onPopState = () => restoreContext()

    document.addEventListener('click', onClick, { capture: true })
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('popstate', onPopState)
    restoreContext()

    return () => {
      storeContext()
      history.scrollRestoration = previousRestoration
      document.removeEventListener('click', onClick, { capture: true })
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AdminLiveRegion />
    </QueryClientProvider>
  )
}
