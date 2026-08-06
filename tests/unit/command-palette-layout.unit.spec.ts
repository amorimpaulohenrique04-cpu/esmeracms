import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../../src/admin/navigation/NavigationFeedbackProvider', () => ({
  useNavigationFeedback: () => ({ beginNavigation: vi.fn() }),
}))

const { CommandPalette } = await import('../../src/admin/shell/CommandPalette')

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Command Palette — composição desktop e tablet', () => {
  it('organiza a abertura em filtros, recentes, ações rápidas e seções de relatórios', async () => {
    window.localStorage.setItem('esmera:recent-admin-items', JSON.stringify([
      { href: '/admin/products', label: 'Produtos', meta: 'Aberto recentemente neste navegador', visitedAt: Date.now() - 60_000 },
    ]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      results: [
        { id: 'new-product', group: 'Criar', label: 'Novo produto', meta: 'Criar item do catálogo', href: '/admin/collections/products/create', icon: 'plus' },
        { id: 'new-customer', group: 'Criar', label: 'Novo cliente', href: '/admin/collections/customers/create', icon: 'plus' },
      ],
    })))

    render(React.createElement(CommandPalette, { open: true, onOpenChange: vi.fn(), selection: null, currentHref: '/admin' }))

    await waitFor(() => expect(screen.getByText('Ações rápidas')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Tudo' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Registros' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Ações' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Relatórios' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Seções' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Configurações' })).not.toBeNull()
    expect(screen.getByText('Recentes')).not.toBeNull()
    expect(screen.getByText('Produtos')).not.toBeNull()
    expect(screen.getByText('Novo produto')).not.toBeNull()
    expect(screen.getByText('Seções de Relatórios')).not.toBeNull()
  })

  it('limpa os itens recentes sem fechar a palette', async () => {
    window.localStorage.setItem('esmera:recent-admin-items', JSON.stringify([
      { href: '/admin/products', label: 'Produtos recentes para limpar', visitedAt: Date.now() },
    ]))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ results: [] })))

    render(React.createElement(CommandPalette, { open: true, onOpenChange: vi.fn(), selection: null, currentHref: '/admin' }))
    const clearButton = await screen.findByRole('button', { name: 'Limpar recentes' })
    fireEvent.click(clearButton)

    await waitFor(() => expect(screen.queryByText('Produtos recentes para limpar')).toBeNull())
    expect(screen.getByTestId('esmera-command-palette')).not.toBeNull()
  })

  it('desconta padding superior, padding inferior e margem de segurança em notebooks', () => {
    const customStyles = readFileSync(resolve(process.cwd(), 'src/app/(payload)/custom.scss'), 'utf8')
    const expectedMaxHeight = 'calc(100dvh - min(10vh, 88px) - 18px - 48px)'

    expect(customStyles).toContain('@media (min-width: 1024px) and (max-height: 960px)')
    expect(customStyles).toContain(`height: min(770px, ${expectedMaxHeight});`)
    expect(customStyles).toContain(`max-height: ${expectedMaxHeight};`)
    expect(customStyles).not.toContain('padding: min(8vh, 72px) 18px 32px;')
  })
})
