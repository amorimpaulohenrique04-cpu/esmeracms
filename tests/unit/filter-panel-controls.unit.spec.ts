import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { DismissibleDetailsProvider } from '../../src/admin/design-system/DismissibleDetailsProvider'
import { FilterPanel } from '../../src/admin/design-system/Primitives'

afterEach(cleanup)

function renderFilterPanel() {
  return render(
    React.createElement(
      'div',
      null,
      React.createElement(FilterPanel, {
        primary: React.createElement('input', { 'aria-label': 'Buscar' }),
        advanced: React.createElement('button', null, 'Aplicar recorte'),
      }),
      React.createElement('button', null, 'Fora do painel'),
    ),
  )
}

describe('FilterPanel advanced filters', () => {
  it('closes an open advanced panel when pointer down happens outside', () => {
    const { container } = renderFilterPanel()
    const details = container.querySelector<HTMLDetailsElement>('.esmera-filter-panel__advanced')

    expect(details).not.toBeNull()
    if (!details) throw new Error('Advanced filter details was not rendered')

    details.open = true
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fora do painel' }))

    expect(details.open).toBe(false)
  })

  it('keeps the advanced panel open for interactions inside it', () => {
    const { container } = renderFilterPanel()
    const details = container.querySelector<HTMLDetailsElement>('.esmera-filter-panel__advanced')

    expect(details).not.toBeNull()
    if (!details) throw new Error('Advanced filter details was not rendered')

    details.open = true
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Aplicar recorte' }))

    expect(details.open).toBe(true)
  })

  it('shows active filters open until an outside interaction dismisses them', () => {
    const { container } = render(
      React.createElement(
        'div',
        null,
        React.createElement(FilterPanel, {
          primary: React.createElement('input', { 'aria-label': 'Buscar' }),
          advanced: React.createElement('button', null, 'Aplicar recorte'),
          advancedActive: true,
        }),
        React.createElement('button', null, 'Fora do filtro ativo'),
      ),
    )
    const details = container.querySelector<HTMLDetailsElement>('.esmera-filter-panel__advanced')

    expect(details).not.toBeNull()
    if (!details) throw new Error('Advanced filter details was not rendered')

    expect(details.open).toBe(true)
    expect(screen.getByText('Mais filtros · ativos')).toBeTruthy()

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fora do filtro ativo' }))
    expect(details.open).toBe(false)
  })

  it('keeps browser-only hooks behind a dedicated client boundary', () => {
    const primitives = readFileSync(
      resolve(process.cwd(), 'src/admin/design-system/Primitives.tsx'),
      'utf8',
    )
    const advanced = readFileSync(
      resolve(process.cwd(), 'src/admin/design-system/FilterPanelAdvanced.tsx'),
      'utf8',
    )

    expect(primitives).not.toContain('React.useRef')
    expect(primitives).not.toContain('React.useEffect')
    expect(advanced.startsWith("'use client'")).toBe(true)
    expect(advanced).toContain("document.addEventListener('pointerdown'")
    expect(advanced).toContain('open={active || undefined}')
    expect(advanced).not.toContain('onSubmitCapture')
  })
})

describe('legacy report advanced filters', () => {
  function renderLegacyDetails() {
    return render(
      React.createElement(
        DismissibleDetailsProvider,
        null,
        React.createElement(
          'form',
          null,
          React.createElement(
            'details',
            { className: 'esmera-report-filter-advanced', open: true },
            React.createElement('summary', null, 'Dimensões e ações · filtros ativos'),
            React.createElement('button', { type: 'submit' }, 'Aplicar recorte'),
            React.createElement('button', { type: 'button' }, 'Compartilhar'),
          ),
        ),
        React.createElement('button', null, 'Fora do relatório'),
      ),
    )
  }

  it('preserves active report actions until the user clicks outside', () => {
    const { container } = renderLegacyDetails()
    const details = container.querySelector<HTMLDetailsElement>('.esmera-report-filter-advanced')

    expect(details).not.toBeNull()
    if (!details) throw new Error('Legacy report details was not rendered')

    expect(details.open).toBe(true)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Aplicar recorte' }))
    expect(details.open).toBe(true)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Compartilhar' }))
    expect(details.open).toBe(true)
  })

  it('closes the legacy report panel on outside pointer down', () => {
    const { container } = renderLegacyDetails()
    const details = container.querySelector<HTMLDetailsElement>('.esmera-report-filter-advanced')

    expect(details).not.toBeNull()
    if (!details) throw new Error('Legacy report details was not rendered')

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Fora do relatório' }))
    expect(details.open).toBe(false)
  })

  it('registers the provider in the Payload admin configuration', () => {
    const config = readFileSync(resolve(process.cwd(), 'src/payload.config.ts'), 'utf8')

    expect(config).toContain(
      '/admin/design-system/DismissibleDetailsProvider#DismissibleDetailsProvider',
    )
  })
})

describe('shared filter-control styles', () => {
  it('normalizes native selects and the Products filter grid', () => {
    const styles = readFileSync(
      resolve(process.cwd(), 'src/admin/design-system/filter-controls.scss'),
      'utf8',
    )
    const customStyles = readFileSync(resolve(process.cwd(), 'src/app/(payload)/custom.scss'), 'utf8')

    expect(styles).toContain('select.esmera-input')
    expect(styles).toContain('height: var(--esmera-control-standard)')
    expect(styles).toContain('appearance: none')
    expect(styles).toContain('.esmera-products-filter-panel .esmera-filter-panel__primary')
    expect(styles).toContain('align-items: end')
    expect(customStyles).toContain("@use '../../admin/design-system/filter-controls';")
  })

  it('does not override the native hidden state of a closed details panel', () => {
    const styles = readFileSync(
      resolve(process.cwd(), 'src/admin/design-system/filter-controls.scss'),
      'utf8',
    )

    expect(styles).toContain(
      '.esmera-filter-panel__advanced[open] .esmera-filter-panel__advanced-panel',
    )
    expect(styles).not.toContain(
      '\n.esmera-filter-panel__advanced-panel {\n  display: grid;',
    )
  })
})
