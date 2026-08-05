/**
 * PR-11 — AppHeader: geometria estável, atalhos de teclado e wiring de eventos.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts`, e a config está fora do escopo
 * deste PR. CommandPalette/GlobalCreateMenu/MobileNav são substituídos por
 * stubs para isolar o AppHeader (Base UI + fetch são cobertos nos specs
 * dedicados de cada componente).
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ADMIN_CREATE_EVENT } from '../../src/admin/state/AdminStateProvider'

let pathname = '/admin'
let authUser: { role: string | null; name: string; email: string } | null = {
  role: 'admin',
  name: 'Ana Admin',
  email: 'ana@esmera.test',
}
const logOut = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: authUser, logOut }),
}))

vi.mock('../../src/admin/shell/CommandPalette', () => ({
  CommandPalette: ({ open, selection }: { open: boolean; selection: { kind: string } | null }) =>
    React.createElement('div', {
      'data-testid': 'stub-command-palette',
      'data-open': open ? 'true' : 'false',
      'data-selection': selection ? selection.kind : '',
    }),
}))

vi.mock('../../src/admin/shell/GlobalCreateMenu', () => ({
  GlobalCreateMenu: ({ role }: { role: string | null }) => {
    const [open, setOpen] = React.useState(false)
    React.useEffect(() => {
      const handler = () => setOpen(true)
      window.addEventListener(ADMIN_CREATE_EVENT, handler)
      return () => window.removeEventListener(ADMIN_CREATE_EVENT, handler)
    }, [])
    return React.createElement('div', {
      'data-testid': 'stub-create-menu',
      'data-open': open ? 'true' : 'false',
      'data-role': role ?? '',
    })
  },
}))

vi.mock('../../src/admin/shell/MobileNav', () => ({
  MobileNav: ({ open }: { open: boolean }) =>
    React.createElement('div', { 'data-testid': 'stub-mobile-nav', 'data-open': open ? 'true' : 'false' }),
}))

const { AppHeader } = await import('../../src/admin/shell/AppHeader')

function dispatchWindowKeydown(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  act(() => { target.dispatchEvent(event) })
  return event
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  pathname = '/admin'
  authUser = { role: 'admin', name: 'Ana Admin', email: 'ana@esmera.test' }
})

describe('PR-11 — AppHeader: composição', () => {
  it('renderiza o trigger de busca, o create menu e a conta do usuário', () => {
    render(React.createElement(AppHeader))
    expect(screen.getByRole('button', { name: 'Buscar no CMS' })).not.toBeNull()
    expect(screen.getByTestId('stub-create-menu')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Abrir conta' })).not.toBeNull()
  })
})

describe('PR-11 — AppHeader: atalhos de teclado', () => {
  it('Cmd/Ctrl+K abre a command palette', () => {
    render(React.createElement(AppHeader))
    expect(screen.getByTestId('stub-command-palette').getAttribute('data-open')).toBe('false')
    dispatchWindowKeydown({ key: 'k', metaKey: true })
    expect(screen.getByTestId('stub-command-palette').getAttribute('data-open')).toBe('true')
  })

  it('"/" prioriza um campo de busca local visível quando presente', () => {
    render(React.createElement(AppHeader))
    const view = window.document.createElement('div')
    view.className = 'esmera-view'
    const input = window.document.createElement('input')
    input.type = 'search'
    input.getBoundingClientRect = () => ({ width: 200, height: 32, top: 0, left: 0, right: 200, bottom: 32, x: 0, y: 0, toJSON() { return {} } })
    view.appendChild(input)
    window.document.body.appendChild(view)

    dispatchWindowKeydown({ key: '/' })

    expect(window.document.activeElement).toBe(input)
    expect(screen.getByTestId('stub-command-palette').getAttribute('data-open')).toBe('false')
    view.remove()
  })

  it('"/" abre a command palette quando não há busca local', () => {
    render(React.createElement(AppHeader))
    dispatchWindowKeydown({ key: '/' })
    expect(screen.getByTestId('stub-command-palette').getAttribute('data-open')).toBe('true')
  })

  it('"N" abre o create menu', () => {
    render(React.createElement(AppHeader))
    expect(screen.getByTestId('stub-create-menu').getAttribute('data-open')).toBe('false')
    dispatchWindowKeydown({ key: 'n' })
    expect(screen.getByTestId('stub-create-menu').getAttribute('data-open')).toBe('true')
  })

  it('não dispara atalhos quando o alvo é um input', () => {
    render(React.createElement(AppHeader))
    const input = window.document.createElement('input')
    window.document.body.appendChild(input)
    dispatchWindowKeydown({ key: 'n' }, input)
    expect(screen.getByTestId('stub-create-menu').getAttribute('data-open')).toBe('false')
    input.remove()
  })

  it('não dispara atalhos quando o alvo é um textarea', () => {
    render(React.createElement(AppHeader))
    const textarea = window.document.createElement('textarea')
    window.document.body.appendChild(textarea)
    dispatchWindowKeydown({ key: 'n' }, textarea)
    expect(screen.getByTestId('stub-create-menu').getAttribute('data-open')).toBe('false')
    textarea.remove()
  })

  it('não dispara atalhos quando o alvo é um select', () => {
    render(React.createElement(AppHeader))
    const select = window.document.createElement('select')
    window.document.body.appendChild(select)
    dispatchWindowKeydown({ key: 'n' }, select)
    expect(screen.getByTestId('stub-create-menu').getAttribute('data-open')).toBe('false')
    select.remove()
  })

  it('não dispara atalhos quando o alvo é contenteditable', () => {
    render(React.createElement(AppHeader))
    const editable = window.document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    window.document.body.appendChild(editable)
    dispatchWindowKeydown({ key: 'n' }, editable)
    expect(screen.getByTestId('stub-create-menu').getAttribute('data-open')).toBe('false')
    editable.remove()
  })

  it('respeita event.defaultPrevented', () => {
    const preventer = (event: KeyboardEvent) => event.preventDefault()
    window.addEventListener('keydown', preventer)
    render(React.createElement(AppHeader))
    dispatchWindowKeydown({ key: 'k', metaKey: true })
    expect(screen.getByTestId('stub-command-palette').getAttribute('data-open')).toBe('false')
    window.removeEventListener('keydown', preventer)
  })

  it('não abre múltiplas instâncias da palette ao repetir o atalho', () => {
    render(React.createElement(AppHeader))
    dispatchWindowKeydown({ key: 'k', metaKey: true })
    dispatchWindowKeydown({ key: 'k', metaKey: true })
    expect(screen.getAllByTestId('stub-command-palette').length).toBe(1)
    expect(screen.getByTestId('stub-command-palette').getAttribute('data-open')).toBe('true')
  })

  it('abrir a command palette via atalho não sintetiza uma seleção nova', () => {
    render(React.createElement(AppHeader))
    dispatchWindowKeydown({ key: 'k', metaKey: true })
    expect(screen.getByTestId('stub-command-palette').getAttribute('data-selection')).toBe('')
  })

  it('remove os listeners de teclado no unmount', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(React.createElement(AppHeader))
    unmount()
    expect(() => dispatchWindowKeydown({ key: 'k', metaKey: true })).not.toThrow()
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
