/**
 * PR-11 — Rail peek do EsmeraNav (1024–1279px), sem reflow do workspace.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts`, e a config está fora do escopo
 * deste PR. Sem `@testing-library/jest-dom` no projeto: usa assertions nativas
 * de DOM (getAttribute/className), como no restante da suíte.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let pathname = '/admin'
let authUser: { role: string | null; name: string; email: string } | null = {
  role: 'admin',
  name: 'Ana Admin',
  email: 'ana@esmera.test',
}
const logOut = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: authUser, logOut }),
}))

const { EsmeraNav } = await import('../../src/admin/components/Nav')

type MediaQueryListMock = {
  matches: boolean
  media: string
  addEventListener: (type: string, cb: () => void) => void
  removeEventListener: (type: string, cb: () => void) => void
  addListener: () => void
  removeListener: () => void
  dispatchEvent: () => boolean
}

function mockMatchMedia(matches: boolean): MediaQueryListMock {
  const mql: MediaQueryListMock = {
    matches,
    media: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => true,
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return mql
}

function peekState(nav: Element) {
  return nav.getAttribute('data-peek')
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  pathname = '/admin'
  authUser = { role: 'admin', name: 'Ana Admin', email: 'ana@esmera.test' }
})

describe('PR-11 — EsmeraNav: filtragem, item ativo e labels', () => {
  it('filtra os links operacionais pela role existente', () => {
    authUser = { role: 'editor', name: 'Edi Editor', email: 'edi@esmera.test' }
    mockMatchMedia(false)
    render(React.createElement(EsmeraNav))
    expect(screen.getByRole('link', { name: /Produtos/ })).not.toBeNull()
    expect(screen.queryByRole('link', { name: /^Clientes$/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Vendas$/ })).toBeNull()
  })

  it('marca aria-current="page" apenas no item ativo', () => {
    pathname = '/admin/products'
    mockMatchMedia(false)
    render(React.createElement(EsmeraNav))
    const active = screen.getByRole('link', { name: /Produtos/ })
    const inactive = screen.getByRole('link', { name: /Categorias/ })
    expect(active.getAttribute('aria-current')).toBe('page')
    expect(inactive.getAttribute('aria-current')).toBeNull()
    expect(active.className).toContain('is-active')
  })

  it('mantém os labels no DOM (não usa display:none via JS) mesmo na faixa de rail', () => {
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const link = screen.getByRole('link', { name: /Produtos/ })
    expect(within(link).getByText('Produtos').tagName).toBe('SPAN')
  })

  it('mantém o item ativo evidente também quando o rail está recolhido', () => {
    pathname = '/admin/products'
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')
    expect(peekState(nav)).toBe('closed')
    expect(screen.getByRole('link', { name: /Produtos/ }).getAttribute('aria-current')).toBe('page')
  })
})

describe('PR-11 — EsmeraNav: peek do rail (1024–1279px)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('pointerenter (mouse) abre o peek após o delay de intenção (100–140ms)', () => {
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')

    act(() => {
      nav.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    })
    expect(peekState(nav)).toBe('closed')

    act(() => { vi.advanceTimersByTime(119) })
    expect(peekState(nav)).toBe('closed')

    act(() => { vi.advanceTimersByTime(21) })
    expect(peekState(nav)).toBe('open')
  })

  it('pointerleave (mouse) agenda o fechamento (~120ms)', () => {
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')

    act(() => {
      nav.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
      vi.advanceTimersByTime(140)
    })
    expect(peekState(nav)).toBe('open')

    act(() => {
      nav.dispatchEvent(new window.PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: window.document.body }))
    })
    expect(peekState(nav)).toBe('open')

    act(() => { vi.advanceTimersByTime(140) })
    expect(peekState(nav)).toBe('closed')
  })

  it('não inicia o delay de intenção para pointerType diferente de mouse', () => {
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')

    act(() => {
      nav.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'touch' }))
      vi.advanceTimersByTime(200)
    })
    expect(peekState(nav)).toBe('closed')
  })

  it('o foco abre o peek imediatamente, sem esperar o delay de intenção', () => {
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')
    const link = screen.getByRole('link', { name: /Produtos/ })

    act(() => { link.focus() })
    expect(peekState(nav)).toBe('open')
  })

  it('Escape fecha o peek sem navegar e sem remover o foco do link', () => {
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')
    const link = screen.getByRole('link', { name: /Produtos/ })

    act(() => { link.focus() })
    expect(peekState(nav)).toBe('open')

    act(() => {
      link.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    expect(peekState(nav)).toBe('closed')
    expect(window.document.activeElement).toBe(link)
  })

  it('Tab e Shift+Tab continuam funcionando após Escape (uma nova entrada de foco reabre o peek)', () => {
    mockMatchMedia(true)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')
    const first = screen.getByRole('link', { name: /Produtos/ })
    const second = screen.getByRole('link', { name: /Categorias/ })

    act(() => { first.focus() })
    act(() => {
      first.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    expect(peekState(nav)).toBe('closed')

    act(() => { second.focus() })
    expect(peekState(nav)).toBe('open')
    expect(window.document.activeElement).toBe(second)
  })

  it('limpa os timers no unmount, sem gerar atualização de estado após desmontagem', () => {
    mockMatchMedia(true)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')

    act(() => {
      nav.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
    })
    unmount()
    act(() => { vi.advanceTimersByTime(500) })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('restringe o peek à faixa 1024–1279px', () => {
    mockMatchMedia(false)
    render(React.createElement(EsmeraNav))
    const nav = screen.getByTestId('esmera-nav')

    act(() => {
      nav.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
      vi.advanceTimersByTime(200)
    })
    expect(peekState(nav)).toBe('closed')

    const link = screen.getByRole('link', { name: /Produtos/ })
    act(() => { link.focus() })
    expect(peekState(nav)).toBe('closed')
  })

  it('não introduz estado global: instâncias independentes não compartilham o peek', () => {
    mockMatchMedia(true)
    const first = render(React.createElement(EsmeraNav))
    const navA = screen.getByTestId('esmera-nav')
    act(() => {
      navA.dispatchEvent(new window.PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))
      vi.advanceTimersByTime(140)
    })
    expect(peekState(navA)).toBe('open')
    first.unmount()
    cleanup()

    render(React.createElement(EsmeraNav))
    const navB = screen.getByTestId('esmera-nav')
    expect(peekState(navB)).toBe('closed')
  })
})
