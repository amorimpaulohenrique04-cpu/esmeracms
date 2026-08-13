/**
 * PR-10 — Overlays sobre Base UI.
 *
 * O projeto só possui as classes e a pintura: portal, foco, Escape, setas,
 * posicionamento e retorno de foco continuam sendo do Base UI.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { DialogPanel, DrawerPanel, MenuButton, PopoverPanel, TooltipHint } from '../../src/admin/design-system/Overlays'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

const overlays = source('src/admin/design-system/Overlays.tsx')
const designSystem = source('src/admin/design-system/design-system.scss')
const tokens = source('src/admin/design-system/tokens.scss')

function rule(selector: string) {
  const index = designSystem.indexOf(selector)
  if (index < 0) return ''
  const open = designSystem.indexOf('{', index)
  const close = designSystem.indexOf('}', open)
  return designSystem.slice(index, close + 1)
}

afterEach(cleanup)

describe('PR-10 — overlays continuam no Base UI', () => {
  it('importa os primitives do Base UI instalado', () => {
    for (const moduleName of ['dialog', 'drawer', 'menu', 'popover', 'tooltip']) {
      expect(overlays).toContain(`@base-ui/react/${moduleName}`)
    }
    expect(overlays).toContain('Dialog.Portal')
    expect(overlays).toContain('Drawer.Portal')
    expect(overlays).toContain('Menu.Positioner')
    expect(overlays).toContain('Popover.Positioner')
    expect(overlays).toContain('Tooltip.Positioner')
  })

  it('não reimplementa foco, Escape, setas nem posicionamento à mão', () => {
    for (const forbidden of ['focus-trap', 'focusTrap', "key === 'Escape'", 'ArrowDown', 'ArrowUp', 'createPortal', 'getBoundingClientRect']) {
      expect(overlays).not.toContain(forbidden)
    }
  })

  it('não usa timeout nem transitionend para controlar semântica', () => {
    expect(overlays).not.toContain('setTimeout')
    expect(overlays).not.toContain('transitionend')
    expect(overlays).not.toContain('animationend')
  })

  it('preserva as classes públicas controladas pelo projeto', () => {
    // Arquivo .ts sem JSX: os componentes abaixo exigem `children` no tipo das
    // props, e o overload de createElement que aceita filhos como argumento à
    // parte não tipa contra props com `children` obrigatório. `children` via
    // props é a forma correta aqui — só o eslint-plugin-react não sabe disso.
    /* eslint-disable react/no-children-prop */
    const triggers: Array<[React.ReactElement, string[]]> = [
      [React.createElement(DialogPanel, { trigger: 'Abrir', title: 'Título', children: 'corpo' }), ['esmera-button']],
      [React.createElement(DrawerPanel, { trigger: 'Abrir', title: 'Título', children: 'corpo' }), ['esmera-button']],
      [React.createElement(MenuButton, { label: 'Ações', items: [{ label: 'Editar' }] }), ['esmera-button', 'esmera-menu-trigger']],
      [React.createElement(PopoverPanel, { trigger: 'Detalhes', children: 'corpo' }), ['esmera-button']],
    ]
    for (const [element, classNames] of triggers) {
      const view = render(element)
      const trigger = screen.getByRole('button')
      for (const className of classNames) expect(trigger.className).toContain(className)
      view.unmount()
    }

    render(React.createElement(TooltipHint, { content: 'dica', children: 'alvo' }))
    /* eslint-enable react/no-children-prop */
    expect(screen.getByText('alvo')).toBeTruthy()

    for (const className of ['esmera-overlay-backdrop', 'esmera-dialog', 'esmera-drawer', 'esmera-menu-popup', 'esmera-popover-popup', 'esmera-tooltip-popup']) {
      expect(overlays.includes(className) || designSystem.includes(`.${className}`)).toBe(true)
    }
  })

  it('oferece a variante wide e conteúdo com close controlado', () => {
    // Conteúdo do diálogo pode ser função e receber `close` para se encerrar após
    // uma ação assíncrona (ex.: publicar produto e fechar), sem controlar o overlay.
    expect(overlays).toContain("typeof children === 'function'")
    expect(overlays).toContain("size === 'wide'")
    expect(overlays).toContain('esmera-dialog--wide')
    expect(designSystem).toContain('.esmera-dialog--wide')
  })

  it('reage aos atributos reais de transição emitidos pelo Base UI', () => {
    expect(designSystem).toContain('[data-starting-style]')
    expect(designSystem).toContain('[data-ending-style]')
    for (const selector of ['.esmera-overlay-backdrop', '.esmera-dialog', '.esmera-drawer']) {
      expect(designSystem).toMatch(new RegExp(`\\${selector}\\[data-starting-style\\]`))
      expect(designSystem).toMatch(new RegExp(`\\${selector}\\[data-ending-style\\]`))
    }
  })

  it('consome a escala canônica de motion nos overlays', () => {
    expect(rule('.esmera-overlay-backdrop {')).toContain('var(--esmera-motion-panel)')
    expect(rule('.esmera-dialog { transition:')).toContain('var(--esmera-motion-panel)')
    expect(rule('.esmera-drawer { transition:')).toContain('var(--esmera-motion-panel)')
    expect(rule('.esmera-menu-popup,')).toContain('var(--esmera-motion-component)')
    expect(rule('.esmera-tooltip-popup {')).toContain('var(--esmera-motion-fast)')
    expect(designSystem).not.toMatch(/transition:[^;]*\d+ms/)
  })

  it('usa backdrop, blur e sombra canônicos', () => {
    const backdrop = rule('.esmera-overlay-backdrop {')
    expect(backdrop).toContain('var(--esmera-backdrop-strong)')
    expect(backdrop).toContain('blur(var(--esmera-blur-overlay))')
    expect(rule('.esmera-dialog,')).toContain('var(--esmera-shadow-floating)')
    expect(rule('.esmera-menu-popup,')).toContain('var(--esmera-shadow-interactive)')
    expect(rule('.esmera-tooltip-popup {')).toContain('var(--esmera-shadow-interactive)')
    expect(designSystem).not.toContain('var(--esmera-shadow-overlay)')
    expect(designSystem).not.toContain('var(--esmera-shadow-raised)')
    expect(designSystem).not.toContain('var(--esmera-backdrop)')
  })

  it('não anima largura estrutural nos overlays', () => {
    for (const selector of ['.esmera-drawer { transition:', '.esmera-dialog { transition:']) {
      expect(rule(selector)).not.toContain('width')
    }
    expect(designSystem).not.toMatch(/transition:[^;]*\bwidth\b/)
    expect(designSystem).not.toMatch(/transition:[^;]*\bmax-width\b/)
  })

  it('mantém overlays operacionais em reduced motion', () => {
    const policy = tokens.slice(tokens.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const selector of ['.esmera-overlay-backdrop', '.esmera-dialog', '.esmera-drawer', '.esmera-menu-popup', '.esmera-tooltip-popup']) {
      expect(policy).toContain(selector)
    }
    expect(policy).not.toContain('display: none')
    expect(policy).not.toContain('visibility: hidden')
    expect(policy).not.toContain('opacity: 0')
    // O backdrop continua pintado: reduced motion remove movimento, não o overlay.
    expect(policy).not.toContain('background: none')
  })
})
