'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { isDifferentAdminRoute, resolveSkeletonVariant, shouldTrackAnchorClick, type SkeletonVariant } from './navigation-intent'
import { RouteProgressBar } from './RouteProgressBar'
import { RouteSkeleton } from './RouteSkeleton'
import './navigation-feedback.scss'

export type NavigationPhase = 'idle' | 'intent' | 'loading' | 'complete'

/** Depois deste atraso sem conclusão, mostra o skeleton estrutural (ver spec §loading). */
const SKELETON_THRESHOLD_MS = 180
/** Só abaixo deste ponto o texto discreto ("Abrindo Produtos…") pode aparecer. */
const ANNOUNCE_DELAY_MS = 1200
/** Rede nunca prende a interface: força idle mesmo se a navegação nunca conclui. */
const SAFETY_TIMEOUT_MS = 8000
/** Janela para a barra completar visualmente antes de recolher — ver navigation-feedback.scss. */
const COMPLETE_HOLD_MS = 260

const ANNOUNCE_LABELS: Record<SkeletonVariant, string> = {
  dashboard: 'Abrindo o painel…',
  list: 'Abrindo a listagem…',
  form: 'Preparando o formulário…',
}

type NavigationFeedbackContextValue = {
  /** Chamado por gatilhos de navegação imperativa (Command Palette, Global Create Menu) antes de router.push. */
  beginNavigation: (href: string) => void
}

const NavigationFeedbackContext = createContext<NavigationFeedbackContextValue | null>(null)

export function useNavigationFeedback(): NavigationFeedbackContextValue {
  const context = useContext(NavigationFeedbackContext)
  if (!context) throw new Error('useNavigationFeedback deve ser usado dentro de NavigationFeedbackProvider')
  return context
}

function clearTimer(ref: React.MutableRefObject<number | null>) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current)
    ref.current = null
  }
}

export function NavigationFeedbackProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [phase, setPhase] = useState<NavigationPhase>('idle')
  const [variant, setVariant] = useState<SkeletonVariant>('list')
  const [message, setMessage] = useState<string | null>(null)

  const currentLocationRef = useRef<string>('')
  const pendingKeyRef = useRef<string | null>(null)
  const announcedRef = useRef(false)
  const skeletonTimerRef = useRef<number | null>(null)
  const announceTimerRef = useRef<number | null>(null)
  const safetyTimerRef = useRef<number | null>(null)
  const completeTimerRef = useRef<number | null>(null)

  const reset = useCallback(() => {
    clearTimer(skeletonTimerRef)
    clearTimer(announceTimerRef)
    clearTimer(safetyTimerRef)
    clearTimer(completeTimerRef)
    pendingKeyRef.current = null
    announcedRef.current = false
    setMessage(null)
    setPhase('idle')
  }, [])

  const completeNavigation = useCallback(() => {
    clearTimer(skeletonTimerRef)
    clearTimer(announceTimerRef)
    clearTimer(safetyTimerRef)
    pendingKeyRef.current = null
    setPhase('complete')
    clearTimer(completeTimerRef)
    completeTimerRef.current = window.setTimeout(() => {
      completeTimerRef.current = null
      announcedRef.current = false
      setMessage(null)
      setPhase('idle')
    }, COMPLETE_HOLD_MS)
  }, [])

  const beginNavigation = useCallback((href: string) => {
    if (typeof window === 'undefined') return
    const base = currentLocationRef.current || window.location.href
    let target: URL
    try {
      target = new URL(href, base)
    } catch {
      return
    }
    if (!isDifferentAdminRoute(target.href, base)) return

    const key = `${target.pathname}${target.search}`
    pendingKeyRef.current = key
    announcedRef.current = false
    clearTimer(completeTimerRef)
    setVariant(resolveSkeletonVariant(target.pathname))
    setMessage(null)
    setPhase('intent')

    clearTimer(skeletonTimerRef)
    skeletonTimerRef.current = window.setTimeout(() => {
      skeletonTimerRef.current = null
      if (pendingKeyRef.current !== key) return
      setPhase((previous) => (previous === 'intent' ? 'loading' : previous))
    }, SKELETON_THRESHOLD_MS)

    clearTimer(announceTimerRef)
    announceTimerRef.current = window.setTimeout(() => {
      announceTimerRef.current = null
      if (pendingKeyRef.current !== key || announcedRef.current) return
      announcedRef.current = true
      setMessage(ANNOUNCE_LABELS[resolveSkeletonVariant(target.pathname)])
    }, ANNOUNCE_DELAY_MS)

    clearTimer(safetyTimerRef)
    safetyTimerRef.current = window.setTimeout(() => {
      safetyTimerRef.current = null
      if (pendingKeyRef.current === key) reset()
    }, SAFETY_TIMEOUT_MS)
  }, [reset])

  // Clique em qualquer <a href> interno do shell (Nav, AppHeader, MobileNav,
  // Command Palette resultados renderizados como link, etc). Só observa —
  // quem de fato navega (preventDefault + router.push) é AdminStateProvider
  // ou o próprio <Link> do Next; os dois handlers de clique em capture não
  // interferem entre si porque nenhum chama stopPropagation.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!anchor) return
      const localNav = anchor.dataset.esmeraLocalNav === 'true'
        || anchor.matches('.esmera-form-shell__tab, .esmera-section-nav__link')
      const modifiers = {
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        defaultPrevented: event.defaultPrevented,
      }
      const meta = {
        href: anchor.href,
        target: anchor.target || null,
        hasDownload: anchor.hasAttribute('download'),
        ariaDisabled: anchor.getAttribute('aria-disabled') === 'true' || anchor.hasAttribute('disabled'),
        localNav,
      }
      if (!shouldTrackAnchorClick(modifiers, meta, currentLocationRef.current || window.location.href)) return
      beginNavigation(anchor.href)
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [beginNavigation])

  // Botão voltar/avançar: no momento do popstate, window.location já é o
  // destino, então comparamos contra o último pathname confirmado
  // (currentLocationRef), não contra window.location de novo.
  useEffect(() => {
    const onPopState = () => beginNavigation(window.location.href)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [beginNavigation])

  // usePathname()/useSearchParams() confirmando a nova localização = rota
  // concluída (spec §complete). Roda também em navegações não rastreadas
  // (filtro/paginação via searchParams) — aí phase já é 'idle' e o early
  // return evita qualquer efeito colateral.
  useEffect(() => {
    const search = searchParams.toString()
    currentLocationRef.current = `${window.location.origin}${pathname}${search ? `?${search}` : ''}`
    if (pendingKeyRef.current === null) return
    completeNavigation()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- completeNavigation/pendingKeyRef são estáveis (refs/useCallback sem deps de estado)
  }, [pathname, searchParams])

  // Rede de segurança: desmontagem em pleno voo nunca deixa timers soltos.
  useEffect(() => () => {
    clearTimer(skeletonTimerRef)
    clearTimer(announceTimerRef)
    clearTimer(safetyTimerRef)
    clearTimer(completeTimerRef)
  }, [])

  const contextValue = useMemo<NavigationFeedbackContextValue>(() => ({ beginNavigation }), [beginNavigation])

  return (
    <NavigationFeedbackContext.Provider value={contextValue}>
      {children}
      <RouteProgressBar phase={phase} />
      {phase === 'loading' ? <RouteSkeleton variant={variant} message={message} /> : null}
    </NavigationFeedbackContext.Provider>
  )
}
