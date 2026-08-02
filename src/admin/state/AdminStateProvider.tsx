'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

const CONTEXT_PREFIX = 'esmera:context:'
const ORIGIN_PREFIX = 'esmera:origin:'

export const ADMIN_ANNOUNCE_EVENT = 'esmera:announce'
export const ADMIN_CREATE_EVENT = 'esmera:create-open'
export const ADMIN_SELECTION_EVENT = 'esmera:selection'
export const ADMIN_DRAFT_CHANGED_EVENT = 'esmera:draft-changed'

type StoredContext = {
  scrollX: number
  scrollY: number
  focusKey?: string
  savedAt: number
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>
    ready: Promise<void>
    updateCallbackDone: Promise<void>
  }
}

function currentContextKey() {
  return `${window.location.pathname}${window.location.search}`
}

function focusKeyFor(element: Element | null) {
  if (!(element instanceof HTMLElement)) return undefined
  return element.dataset.esmeraContextKey || element.id || undefined
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function startAdminViewTransition(callback: () => void | Promise<void>, transitionName = 'default') {
  if (typeof document === 'undefined' || prefersReducedMotion()) {
    void callback()
    return null
  }

  const transitionDocument = document as ViewTransitionDocument
  if (!transitionDocument.startViewTransition) {
    void callback()
    return null
  }

  document.documentElement.dataset.esmeraTransition = transitionName
  const transition = transitionDocument.startViewTransition(callback)
  transition.finished.finally(() => {
    delete document.documentElement.dataset.esmeraTransition
  })
  return transition
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

function transitionEligible(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  if (anchor.target === '_blank' || anchor.hasAttribute('download') || anchor.dataset.noViewTransition === 'true') return false
  if (anchor.getAttribute('href')?.startsWith('#')) return false
  try {
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/admin')) return false
    if (`${url.pathname}${url.search}${url.hash}` === `${window.location.pathname}${window.location.search}${window.location.hash}`) return false
    return true
  } catch {
    return false
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

export function announceAdminSelection(detail: { kind: string; id: string | number; label?: string; href?: string } | null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ADMIN_SELECTION_EVENT, { detail }))
}

export function announceDraftChanged(detail: { kind: 'product' | 'category'; id: string | number; field?: string }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ADMIN_DRAFT_CHANGED_EVENT, { detail }))
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`
  const pendingNavigation = useRef<{ resolve: () => void; timeout: number } | null>(null)
  const previousRouteKey = useRef(routeKey)
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
    if (previousRouteKey.current === routeKey) return
    previousRouteKey.current = routeKey
    const pending = pendingNavigation.current
    if (!pending) return
    window.clearTimeout(pending.timeout)
    pending.resolve()
    pendingNavigation.current = null
  }, [routeKey])

  useEffect(() => {
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'

    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor || event.defaultPrevented) return
      storeContext()
      rememberEditOrigin(anchor)

      const transitionDocument = document as ViewTransitionDocument
      if (!transitionEligible(event, anchor) || !transitionDocument.startViewTransition || prefersReducedMotion()) return

      const url = new URL(anchor.href, window.location.href)
      const destination = `${url.pathname}${url.search}${url.hash}`
      event.preventDefault()

      startAdminViewTransition(() => new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => {
          if (pendingNavigation.current?.resolve === resolve) pendingNavigation.current = null
          resolve()
        }, 1_200)
        pendingNavigation.current = { resolve, timeout }
        router.push(destination)
      }), anchor.dataset.esmeraTransition || 'navigation')
    }
    const onPageHide = () => storeContext()
    const onPopState = () => {
      window.requestAnimationFrame(() => restoreContext())
    }

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
      if (pendingNavigation.current) window.clearTimeout(pendingNavigation.current.timeout)
      pendingNavigation.current = null
    }
  }, [router])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <AdminLiveRegion />
    </QueryClientProvider>
  )
}
