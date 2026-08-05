import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { FormShell } from '../../src/admin/design-system/FormSystem'
import { FieldV2, type FieldControlProps } from '../../src/admin/design-system/Forms'

const repositoryRoot = process.cwd()

function input(control: FieldControlProps) {
  return React.createElement('input', { ...control, defaultValue: '' })
}

afterEach(cleanup)

describe('F2 — estilos compartilhados do editor de Categoria', () => {
  it('entrega uma classe visual estável para links de aba e preserva o estado ativo', () => {
    render(React.createElement(FormShell, {
      title: 'Edição da categoria',
      tabs: [
        { id: 'content', label: 'Geral', href: '/admin/categories?tab=general' },
        { id: 'media', label: 'Mídia & SEO', href: '/admin/categories?tab=media' },
        { id: 'related', label: 'Produtos relacionados', href: '/admin/categories?tab=products' },
      ],
      activeTab: 'content',
      onTabChange: () => undefined,
      children: React.createElement('p', null, 'Conteúdo'),
    }))

    const navigation = screen.getByRole('navigation', { name: 'Seções de Edição da categoria' })
    const tabs = within(navigation).getAllByRole('link')

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Geral',
      'Mídia & SEO',
      'Produtos relacionados',
    ])
    expect(tabs.every((tab) => tab.classList.contains('esmera-form-shell__tab'))).toBe(true)
    expect(tabs[0].classList.contains('is-active')).toBe(true)
    expect(tabs[0].getAttribute('aria-current')).toBe('page')
    expect(tabs[1].getAttribute('aria-current')).toBeNull()
  })

  it('renderiza obrigatório como asterisco visual com texto acessível separado', () => {
    const { container } = render(React.createElement(FieldV2, {
      id: 'category-title',
      label: 'Nome',
      required: true,
      children: input,
    }))

    const marker = container.querySelector('.esmera-field-v2__required')
    const accessibleText = screen.getByText('Obrigatório')

    expect(marker?.textContent).toBe('*')
    expect(marker?.getAttribute('aria-hidden')).toBe('true')
    expect(accessibleText.classList.contains('esmera-sr-only')).toBe(true)
    expect(screen.getByLabelText('Nome').hasAttribute('required')).toBe(true)
  })

  it('mantém Opcional como metadado separado do rótulo', () => {
    const { container } = render(React.createElement(FieldV2, {
      id: 'category-description',
      label: 'Descrição',
      optional: true,
      children: input,
    }))

    const row = container.querySelector('.esmera-field-v2__label-row')
    const optional = container.querySelector('.esmera-field-v2__optional')

    expect(row?.children).toHaveLength(2)
    expect(optional?.textContent).toBe('Opcional')
    expect(screen.getByLabelText('Descrição')).toBeTruthy()
  })

  it('carrega a base do Design System e o contrato visual do FormSystem no Admin', () => {
    const entrypoint = readFileSync(resolve(repositoryRoot, 'src/app/(payload)/custom.scss'), 'utf8')
    const styles = readFileSync(resolve(repositoryRoot, 'src/admin/design-system/form-system.scss'), 'utf8')

    expect(entrypoint).toContain("@use '../../admin/design-system/design-system';")
    expect(entrypoint).toContain("@use '../../admin/design-system/form-system';")
    expect(entrypoint.indexOf("design-system';")).toBeLessThan(entrypoint.indexOf("states';"))

    expect(styles).toContain('.esmera-form-shell__tabs')
    expect(styles).toContain('.esmera-form-shell__tab')
    expect(styles).toMatch(/text-decoration:\s*none/)
    expect(styles).toContain('.esmera-field-v2__label-row')
    expect(styles).toContain('.esmera-field-v2__required')
    expect(styles).toContain('color: var(--esmera-danger)')
  })
})
