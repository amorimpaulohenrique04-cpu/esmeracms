import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
const beginNavigation = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('../../src/admin/navigation/NavigationFeedbackProvider', () => ({
  useNavigationFeedback: () => ({ beginNavigation }),
}))

vi.mock('../../src/admin/state/continuity', () => ({
  recentAdminItems: () => [],
  savedAdminViews: () => [],
}))

const { CommandPalette } = await import('../../src/admin/shell/CommandPalette')

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  push.mockClear()
  beginNavigation.mockClear()
})

describe('CommandPalette — resultados preservados durante debounce', () => {
  it('remove opções antigas irrelevantes antes de Enter abrir o primeiro resultado atual', async () => {
    vi.useFakeTimers()
    let resolveInitial: ((response: Response) => void) | undefined
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveInitial = resolve }))
    vi.stubGlobal('fetch', fetchMock)

    render(React.createElement(CommandPalette, {
      open: true,
      onOpenChange: vi.fn(),
      selection: null,
      currentHref: '/admin/products',
    }))

    act(() => { vi.advanceTimersByTime(0) })
    await act(async () => {
      resolveInitial?.(jsonResponse({
        results: [
          { id: 'create-product', group: 'Ações', label: 'Novo produto', href: '/admin/collections/products/create' },
          { id: 'dashboard', group: 'Ações', label: 'Dashboard', href: '/admin' },
        ],
      }))
    })

    const input = screen.getByLabelText('Buscar no CMS')
    act(() => { fireEvent.change(input, { target: { value: 'Dashboard' } }) })

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0].textContent).toContain('Dashboard')
    expect(options[0].getAttribute('aria-selected')).toBe('true')

    act(() => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(beginNavigation).toHaveBeenCalledWith('/admin')
    expect(push).toHaveBeenCalledWith('/admin')
  })
})
