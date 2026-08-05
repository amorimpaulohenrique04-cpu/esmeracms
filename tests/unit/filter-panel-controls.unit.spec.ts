import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

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
})
