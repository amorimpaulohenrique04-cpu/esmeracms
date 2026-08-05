/**
 * PR-10 — Primitives Premium Tech Quiet.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts` e a config está fora do escopo.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Button, ButtonLink } from '../../src/admin/design-system/Button'
import { ErrorState, SavingState, StatePanel } from '../../src/admin/design-system/Feedback'
import { InlineFeedback, MetricStripItem } from '../../src/admin/design-system/Primitives'

afterEach(cleanup)

function button(props: React.ComponentProps<typeof Button> = {}) {
  render(React.createElement(Button, { children: 'Publicar', ...props }))
  return screen.getByRole('button')
}

describe('PR-10 — Button assíncrono', () => {
  it('preserva a API do botão normal', () => {
    const element = button({ tone: 'primary', className: 'extra', 'aria-label': 'Publicar produto' })
    expect(element.getAttribute('type')).toBe('button')
    expect(element.className).toContain('esmera-button--primary')
    expect(element.className).toContain('extra')
    expect(element.getAttribute('aria-busy')).toBeNull()
    expect(element.hasAttribute('disabled')).toBe(false)
    expect(element.textContent).toContain('Publicar')
  })

  it('marca aria-busy quando busy', () => {
    const element = button({ busy: true, busyLabel: 'Publicando…' })
    expect(element.getAttribute('aria-busy')).toBe('true')
  })

  it('impede uma segunda ativação durante o busy', () => {
    const onClick = vi.fn()
    const element = button({ busy: true, onClick })
    expect(element.hasAttribute('disabled')).toBe(true)
    fireEvent.click(element)
    fireEvent.click(element)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('mantém o conteúdo original no DOM para estabilizar a geometria', () => {
    const element = button({ busy: true, busyLabel: 'Publicando…' })
    const content = element.querySelector('.esmera-button__content')
    expect(content).not.toBeNull()
    expect(content?.textContent).toBe('Publicar')
    expect(content?.getAttribute('aria-hidden')).toBe('true')
  })

  it('mantém o spinner decorativo e fora da árvore acessível', () => {
    const element = button({ busy: true, busyLabel: 'Publicando…' })
    const spinner = element.querySelector('.esmera-button__spinner')
    expect(spinner).not.toBeNull()
    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
    expect(spinner?.textContent).toBe('')
  })

  it('anuncia exatamente um busyLabel, sem duplicar o rótulo original', () => {
    const element = button({ busy: true, busyLabel: 'Publicando…' })
    const occurrences = (element.textContent?.match(/Publicando…/g) ?? []).length
    expect(occurrences).toBe(1)
    expect(screen.getByRole('button', { name: 'Publicando…' })).toBe(element)
  })

  it('não aplica a API busy ao ButtonLink', () => {
    render(React.createElement(ButtonLink, { href: '/admin', children: 'Abrir' }))
    const link = screen.getByRole('link')
    expect(link.getAttribute('aria-busy')).toBeNull()
    expect(link.querySelector('.esmera-button__spinner')).toBeNull()
    expect(link.textContent).toBe('Abrir')
  })

  it('mantém disabled não acionável', () => {
    const onClick = vi.fn()
    const element = button({ disabled: true, onClick })
    expect(element.hasAttribute('disabled')).toBe(true)
    fireEvent.click(element)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('PR-10 — política de alert e status', () => {
  it('StatePanel comum é silencioso', () => {
    render(React.createElement(StatePanel, { kind: 'empty-result', title: 'Sem resultados' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('polite usa role status com aria-live polite', () => {
    render(React.createElement(StatePanel, { kind: 'saving', title: 'Salvando…', announcement: 'polite' }))
    const panel = screen.getByRole('status')
    expect(panel.getAttribute('aria-live')).toBe('polite')
  })

  it('assertive usa role alert com aria-live assertive', () => {
    render(React.createElement(StatePanel, { kind: 'destructive-error', title: 'Falha crítica', announcement: 'assertive' }))
    const panel = screen.getByRole('alert')
    expect(panel.getAttribute('aria-live')).toBe('assertive')
  })

  it('danger sem announcement não vira alert automaticamente', () => {
    render(React.createElement(StatePanel, { kind: 'destructive-error', title: 'Falha' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ErrorState permanece silencioso por padrão', () => {
    render(React.createElement(ErrorState, { title: 'Não foi possível salvar' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('preserva a prop legada live como polite', () => {
    render(React.createElement(StatePanel, { kind: 'saved', title: 'Salvo', live: true }))
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('SavingState usa anúncio polite sem duplicar live region', () => {
    render(React.createElement(SavingState, { state: 'saving' }))
    const panels = screen.getAllByRole('status')
    expect(panels).toHaveLength(1)
    expect(panels[0].getAttribute('aria-live')).toBe('polite')
    expect(panels[0].getAttribute('aria-busy')).toBe('true')
  })

  it('InlineFeedback suporta os três modos', () => {
    const { unmount } = render(React.createElement(InlineFeedback, { announcement: 'none', children: 'silencioso' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    unmount()

    const polite = render(React.createElement(InlineFeedback, { children: 'padrão polite' }))
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    polite.unmount()

    render(React.createElement(InlineFeedback, { announcement: 'assertive', children: 'urgente' }))
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
  })
})

describe('PR-10 — superfícies interativas', () => {
  it('métrica com link é uma superfície interativa', () => {
    render(React.createElement(MetricStripItem, { label: 'Pedidos', value: '128', href: '/admin/sales' }))
    const link = screen.getByRole('link')
    expect(link.className).toContain('is-interactive-surface')
  })

  it('métrica sem link permanece article e não é interativa', () => {
    const { container } = render(React.createElement(MetricStripItem, { label: 'Pedidos', value: '128' }))
    const item = container.querySelector('.esmera-metric-strip__item')
    expect(item?.tagName).toBe('ARTICLE')
    expect(item?.className).not.toContain('is-interactive-surface')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('item ativo com link preserva a semântica de página atual', () => {
    render(React.createElement(MetricStripItem, { label: 'Pedidos', value: '128', href: '/admin/sales', active: true }))
    const link = screen.getByRole('link')
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(link.className).toContain('is-active')
  })

  it('item ativo sem link não anuncia página atual', () => {
    const { container } = render(React.createElement(MetricStripItem, { label: 'Pedidos', value: '128', active: true }))
    const item = container.querySelector('.esmera-metric-strip__item')
    expect(item?.getAttribute('aria-current')).toBeNull()
  })
})
