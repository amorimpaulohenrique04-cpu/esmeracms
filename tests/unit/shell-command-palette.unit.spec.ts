/**
 * PR-11 — CommandPalette: preservação de resultados durante refetch, retry
 * em erro e navegação por teclado.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts`, e a config está fora do
 * escopo deste PR.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const { CommandPalette } = await import('../../src/admin/shell/CommandPalette')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

type DeferredCall = { url: string; resolve: (body: unknown) => void; reject: (error: unknown) => void }

function deferredFetch() {
  const calls: DeferredCall[] = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
    calls.push({
      url,
      resolve: (body: unknown) => resolve(jsonResponse(body)),
      reject,
    })
    init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
  }))
  return { fetchMock, calls }
}

async function openInput(calls: DeferredCall[]) {
  const input = screen.getByLabelText('Buscar no CMS') as HTMLInputElement
  act(() => { vi.advanceTimersByTime(0) })
  await act(async () => { calls[0].resolve({ results: [] }) })
  return input
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  push.mockClear()
})

describe('PR-11 — CommandPalette: base e foco', () => {
  it('usa Base UI Dialog e foca o input ao abrir sem esperar a animação', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })))
    render(React.createElement(CommandPalette, { open: true, onOpenChange: vi.fn(), selection: null, currentHref: '/admin' }))
    expect(screen.getByTestId('esmera-command-palette')).not.toBeNull()
    await waitFor(() => expect(window.document.activeElement?.tagName).toBe('INPUT'))
  })

  it('preserva os grupos reais (Seções de Relatórios) sem inventar registros', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })))
    render(React.createElement(CommandPalette, { open: true, onOpenChange: vi.fn(), selection: null, currentHref: '/admin' }))
    await waitFor(() => expect(screen.getByText('Seções de Relatórios')).not.toBeNull())
  })

  it('Escape fecha a palette', async () => {
    const onOpenChange = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })))
    render(React.createElement(CommandPalette, { open: true, onOpenChange, currentHref: '/admin', selection: null }))
    await waitFor(() => expect(window.document.activeElement?.tagName).toBe('INPUT'))
    fireEvent.keyDown(window.document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('devolve o foco ao trigger quando fecha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })))

    function Harness() {
      const [open, setOpen] = React.useState(false)
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('button', { type: 'button', onClick: () => setOpen(true) }, 'Abrir'),
        React.createElement(CommandPalette, { open, onOpenChange: setOpen, currentHref: '/admin', selection: null }),
      )
    }

    render(React.createElement(Harness))
    const trigger = screen.getByRole('button', { name: 'Abrir' })
    act(() => { trigger.focus() })
    act(() => { fireEvent.click(trigger) })
    await waitFor(() => expect(window.document.activeElement?.tagName).toBe('INPUT'))
    fireEvent.keyDown(window.document.activeElement as HTMLElement, { key: 'Escape' })
    await waitFor(() => expect(window.document.activeElement).toBe(trigger))
  })
})

describe('PR-11 — CommandPalette: refetch e erro', () => {
  it('preserva resultados anteriores durante o refetch, com indicador "Atualizando"', async () => {
    vi.useFakeTimers()
    const { fetchMock, calls } = deferredFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(React.createElement(CommandPalette, { open: true, onOpenChange: vi.fn(), currentHref: '/admin', selection: null }))
    const input = await openInput(calls)

    act(() => { fireEvent.change(input, { target: { value: 'anel' } }) })
    act(() => { vi.advanceTimersByTime(140) })
    expect(calls.length).toBe(2)
    await act(async () => {
      calls[1].resolve({ results: [{ id: 'r1', group: 'Produtos', label: 'Anel Solar', href: '/x1' }] })
    })
    expect(screen.getByText('Anel Solar')).not.toBeNull()

    act(() => { fireEvent.change(input, { target: { value: 'anel s' } }) })
    act(() => { vi.advanceTimersByTime(140) })
    expect(calls.length).toBe(3)
    expect(screen.getByText('Anel Solar')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/Atualizando/)

    await act(async () => {
      calls[2].resolve({ results: [{ id: 'r1b', group: 'Produtos', label: 'Anel Solar Grande', href: '/x1b' }] })
    })
    expect(screen.getByText('Anel Solar Grande')).not.toBeNull()
    expect(screen.queryByText('Anel Solar')).toBeNull()
  })

  it('erro preserva resultados anteriores e o retry repete a query atual', async () => {
    vi.useFakeTimers()
    const { fetchMock, calls } = deferredFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(React.createElement(CommandPalette, { open: true, onOpenChange: vi.fn(), currentHref: '/admin', selection: null }))
    const input = await openInput(calls)

    act(() => { fireEvent.change(input, { target: { value: 'anel' } }) })
    act(() => { vi.advanceTimersByTime(140) })
    await act(async () => {
      calls[1].resolve({ results: [{ id: 'r1', group: 'Produtos', label: 'Anel Solar', href: '/x1' }] })
    })
    expect(screen.getByText('Anel Solar')).not.toBeNull()

    act(() => { fireEvent.change(input, { target: { value: 'anel s' } }) })
    act(() => { vi.advanceTimersByTime(140) })
    expect(calls.length).toBe(3)
    await act(async () => { calls[2].reject(new Error('Falha de rede')) })

    expect(screen.getByText('Anel Solar')).not.toBeNull()
    expect(screen.getByRole('alert')).not.toBeNull()

    const retryButton = screen.getByRole('button', { name: 'Tentar novamente' })
    act(() => { fireEvent.click(retryButton) })
    act(() => { vi.advanceTimersByTime(140) })
    expect(calls.length).toBe(4)
    expect(calls[3].url).toContain(encodeURIComponent('anel s'))
    expect(screen.getByTestId('esmera-command-palette')).not.toBeNull()

    await act(async () => {
      calls[3].resolve({ results: [{ id: 'r2', group: 'Produtos', label: 'Anel Solar Nano', href: '/x2' }] })
    })
    expect(screen.getByText('Anel Solar Nano')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('PR-11 — CommandPalette: navegação por teclado', () => {
  it('ArrowDown/ArrowUp navegam e Enter abre o item ativo', async () => {
    vi.useFakeTimers()
    const { fetchMock, calls } = deferredFetch()
    vi.stubGlobal('fetch', fetchMock)
    const onOpenChange = vi.fn()
    render(React.createElement(CommandPalette, { open: true, onOpenChange, currentHref: '/admin', selection: null }))
    const input = await openInput(calls)

    act(() => { fireEvent.change(input, { target: { value: 'anel' } }) })
    act(() => { vi.advanceTimersByTime(140) })
    await act(async () => {
      calls[1].resolve({
        results: [
          { id: 'r1', group: 'Produtos', label: 'Anel Solar', href: '/x1' },
          { id: 'r2', group: 'Produtos', label: 'Anel Lunar', href: '/x2' },
        ],
      })
    })

    let options = screen.getAllByRole('option')
    expect(options[0].getAttribute('aria-selected')).toBe('true')

    act(() => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
    options = screen.getAllByRole('option')
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id)

    act(() => { fireEvent.keyDown(input, { key: 'ArrowUp' }) })
    options = screen.getAllByRole('option')
    expect(options[0].getAttribute('aria-selected')).toBe('true')

    act(() => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
    act(() => { fireEvent.keyDown(input, { key: 'Enter' }) })
    expect(push).toHaveBeenCalledWith('/x2')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('ajusta o activeIndex e o aria-activedescendant quando a lista de resultados diminui', async () => {
    vi.useFakeTimers()
    const { fetchMock, calls } = deferredFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(React.createElement(CommandPalette, { open: true, onOpenChange: vi.fn(), currentHref: '/admin', selection: null }))
    const input = await openInput(calls)

    act(() => { fireEvent.change(input, { target: { value: 'anel' } }) })
    act(() => { vi.advanceTimersByTime(140) })
    await act(async () => {
      calls[1].resolve({
        results: [
          { id: 'r1', group: 'Produtos', label: 'Anel Solar', href: '/x1' },
          { id: 'r2', group: 'Produtos', label: 'Anel Lunar', href: '/x2' },
        ],
      })
    })
    act(() => { fireEvent.keyDown(input, { key: 'ArrowDown' }) })
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true')

    act(() => { fireEvent.change(input, { target: { value: 'anel solar' } }) })
    act(() => { vi.advanceTimersByTime(140) })
    await act(async () => {
      calls[2].resolve({ results: [{ id: 'r1', group: 'Produtos', label: 'Anel Solar', href: '/x1' }] })
    })

    const options = screen.getAllByRole('option')
    expect(options.length).toBe(1)
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id)
  })
})
