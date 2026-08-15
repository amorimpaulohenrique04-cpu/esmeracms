/**
 * PR-11 — GlobalCreateMenu e MobileNav: papel/contexto, rotas reais, Escape
 * e retorno de foco.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts`, e a config está fora do
 * escopo deste PR.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

let pathname = '/admin'
let search = ''
const push = vi.fn()
const navigationFeedback = vi.hoisted(() => ({ beginNavigation: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push }),
}))

vi.mock('../../src/admin/navigation/NavigationFeedbackProvider', () => ({
  useNavigationFeedback: () => navigationFeedback,
}))

const { GlobalCreateMenu } = await import('../../src/admin/shell/GlobalCreateMenu')
const { MobileNav } = await import('../../src/admin/shell/MobileNav')

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  pathname = '/admin'
  search = ''
  push.mockClear()
  navigationFeedback.beginNavigation.mockClear()
})

describe('PR-11 — GlobalCreateMenu', () => {
  it('usa Base UI Menu (trigger + role menu ao abrir)', async () => {
    render(React.createElement(GlobalCreateMenu, { role: 'admin' }))
    const trigger = screen.getByTestId('esmera-global-create')
    expect(trigger.tagName).toBe('BUTTON')
    fireEvent.click(trigger)
    await waitFor(() => expect(screen.getByRole('menu')).not.toBeNull())
  })

  it('editor vê apenas as ações da área "site"', async () => {
    render(React.createElement(GlobalCreateMenu, { role: 'editor' }))
    fireEvent.click(screen.getByTestId('esmera-global-create'))
    const items = await screen.findAllByRole('menuitem')
    const labels = items.map((item) => item.textContent || '')
    expect(labels.some((label) => label.includes('Novo produto'))).toBe(true)
    expect(labels.some((label) => label.includes('Novo cliente'))).toBe(false)
    expect(labels.some((label) => label.includes('Novo lead'))).toBe(false)
    expect(labels.some((label) => label.includes('Nova oportunidade'))).toBe(false)
  })

  it('commercial vê apenas as ações da área "business"', async () => {
    render(React.createElement(GlobalCreateMenu, { role: 'commercial' }))
    fireEvent.click(screen.getByTestId('esmera-global-create'))
    const items = await screen.findAllByRole('menuitem')
    const labels = items.map((item) => item.textContent || '')
    expect(labels.some((label) => label.includes('Novo produto'))).toBe(false)
    expect(labels.some((label) => label.includes('Novo cliente'))).toBe(true)
    expect(labels.some((label) => label.includes('Novo lead'))).toBe(true)
    expect(labels.some((label) => label.includes('Nova oportunidade'))).toBe(true)
  })

  it('admin vê todas as ações permitidas, incluindo "Nova venda" desabilitada', async () => {
    render(React.createElement(GlobalCreateMenu, { role: 'admin' }))
    fireEvent.click(screen.getByTestId('esmera-global-create'))
    const items = await screen.findAllByRole('menuitem')
    expect(items.length).toBe(5)
    const saleItem = items.find((item) => (item.textContent || '').includes('Nova venda'))
    expect(saleItem).not.toBeUndefined()
    expect(saleItem?.getAttribute('aria-disabled')).toBe('true')
  })

  it('o item contextual aparece primeiro', async () => {
    pathname = '/admin/customers'
    render(React.createElement(GlobalCreateMenu, { role: 'admin' }))
    fireEvent.click(screen.getByTestId('esmera-global-create'))
    const items = await screen.findAllByRole('menuitem')
    expect(items[0].textContent || '').toContain('Novo cliente')
  })

  it('a ação usa a rota real do registro', async () => {
    render(React.createElement(GlobalCreateMenu, { role: 'admin' }))
    fireEvent.click(screen.getByTestId('esmera-global-create'))
    const items = await screen.findAllByRole('menuitem')
    const productItem = items.find((item) => (item.textContent || '').includes('Novo produto'))
    expect(productItem).not.toBeUndefined()
    fireEvent.click(productItem as HTMLElement)
    expect(navigationFeedback.beginNavigation).toHaveBeenCalledWith('/admin/products?novo=produto')
    expect(push).toHaveBeenCalledWith('/admin/products?novo=produto')
  })

  it('Escape fecha o menu', async () => {
    render(React.createElement(GlobalCreateMenu, { role: 'admin' }))
    fireEvent.click(screen.getByTestId('esmera-global-create'))
    const menu = await screen.findByRole('menu')
    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })
})

describe('PR-11 — MobileNav', () => {
  it('filtra os links por role', () => {
    render(React.createElement(MobileNav, {
      open: true,
      onOpenChange: vi.fn(),
      role: 'editor',
      name: 'Edi Editor',
      onLogout: vi.fn(),
    }))
    expect(screen.getByRole('link', { name: /Produtos/ })).not.toBeNull()
    expect(screen.queryByRole('link', { name: /^Clientes$/ })).toBeNull()
  })

  it('marca o item ativo com aria-current="page"', () => {
    pathname = '/admin/products'
    render(React.createElement(MobileNav, {
      open: true,
      onOpenChange: vi.fn(),
      role: 'admin',
      name: 'Ana Admin',
      onLogout: vi.fn(),
    }))
    const active = screen.getByRole('link', { name: /Produtos/ })
    expect(active.getAttribute('aria-current')).toBe('page')
    expect(active.className).toContain('is-active')
  })

  it('clicar em um link fecha o drawer sem outro efeito colateral', () => {
    const onOpenChange = vi.fn()
    const onLogout = vi.fn()
    render(React.createElement(MobileNav, {
      open: true, onOpenChange, role: 'admin', name: 'Ana Admin', onLogout,
    }))
    fireEvent.click(screen.getByRole('link', { name: /Produtos/ }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onLogout).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('o botão Sair aciona onLogout (o chamador fecha o drawer antes de executar)', () => {
    const onLogout = vi.fn()
    render(React.createElement(MobileNav, {
      open: true, onOpenChange: vi.fn(), role: 'admin', name: 'Ana Admin', onLogout,
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('Escape fecha o drawer', async () => {
    const onOpenChange = vi.fn()
    render(React.createElement(MobileNav, {
      open: true, onOpenChange, role: 'admin', name: 'Ana Admin', onLogout: vi.fn(),
    }))
    const dialog = await screen.findByTestId('esmera-mobile-nav')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(onOpenChange.mock.calls.some((call) => call[0] === false)).toBe(true))
  })

  it('devolve o foco ao trigger quando fecha', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return React.createElement(
        React.Fragment,
        null,
        React.createElement('button', { type: 'button', onClick: () => setOpen(true) }, 'Abrir navegação'),
        React.createElement(MobileNav, { open, onOpenChange: setOpen, role: 'admin', name: 'Ana Admin', onLogout: vi.fn() }),
      )
    }
    render(React.createElement(Harness))
    const trigger = screen.getByRole('button', { name: 'Abrir navegação' })
    act(() => { trigger.focus() })
    fireEvent.click(trigger)
    const dialog = await screen.findByTestId('esmera-mobile-nav')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(window.document.activeElement).toBe(trigger))
  })
})
