/**
 * PR-10 — Tokens Premium Tech Quiet.
 *
 * Contrato de tokens lido direto da folha: a escala canônica é única, os nomes
 * legados são apenas alias e nenhuma regra reintroduz movimento proibido.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

const tokens = source('src/admin/design-system/tokens.scss')
const designSystem = source('src/admin/design-system/design-system.scss')
const states = source('src/admin/design-system/states.scss')
const advanced = source('src/admin/design-system/advanced-interactions.scss')
const reconciled = source('src/admin/design-system/reconciled-interactions.scss')

const sheets = [tokens, designSystem, states, advanced, reconciled]

function declaration(name: string) {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`))
  return match ? match[1].trim().replace(/\s+/g, ' ') : null
}

/** Todas as declarações de um token: prova que não existe uma segunda escala. */
function declarationCount(name: string) {
  return tokens.match(new RegExp(`--${name}:`, 'g'))?.length ?? 0
}

function channel(value: number) {
  const ratio = value / 255
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string) {
  const clean = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((offset) => channel(parseInt(clean.slice(offset, offset + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

describe('PR-10 — tokens canônicos', () => {
  it('mantém uma única escala de motion 80/120/180/220/280/420', () => {
    expect(declaration('esmera-motion-instant')).toBe('80ms')
    expect(declaration('esmera-motion-fast')).toBe('120ms')
    expect(declaration('esmera-motion-component')).toBe('180ms')
    expect(declaration('esmera-motion-panel')).toBe('220ms')
    expect(declaration('esmera-motion-navigation')).toBe('280ms')
    expect(declaration('esmera-motion-data')).toBe('420ms')
    for (const step of ['instant', 'fast', 'component', 'panel', 'navigation', 'data']) {
      expect(declarationCount(`esmera-motion-${step}`)).toBe(1)
    }
  })

  it('expõe os easings canônicos', () => {
    expect(declaration('esmera-ease-standard')).toBe('cubic-bezier(.2, 0, 0, 1)')
    expect(declaration('esmera-ease-enter')).toBe('cubic-bezier(.16, 1, .3, 1)')
    expect(declaration('esmera-ease-exit')).toBe('cubic-bezier(.4, 0, 1, 1)')
    expect(declaration('esmera-ease-emphasized')).toBe('cubic-bezier(.16, 1, .3, 1)')
  })

  it('expõe as sombras min, interactive e floating', () => {
    expect(declaration('esmera-shadow-min')).toBe('0 1px 2px rgba(20, 33, 29, .025)')
    expect(declaration('esmera-shadow-interactive')).toBe('0 8px 22px rgba(20, 33, 29, .07), 0 1px 2px rgba(20, 33, 29, .03)')
    expect(declaration('esmera-shadow-floating')).toBe('0 20px 48px rgba(20, 33, 29, .12)')
  })

  it('define backdrop .28 e os dois níveis de blur', () => {
    expect(declaration('esmera-backdrop-strong')).toBe('rgba(15, 24, 20, .28)')
    expect(declaration('esmera-blur-header')).toBe('14px')
    expect(declaration('esmera-blur-overlay')).toBe('8px')
    expect(declaration('esmera-hover-lift')).toBe('-1px')
    expect(declaration('esmera-press-scale')).toBe('.99')
  })

  it('converte os nomes antigos em alias, sem valores concorrentes', () => {
    const aliases: Array<[string, string]> = [
      ['esmera-motion-standard', 'var(--esmera-motion-component)'],
      ['esmera-motion-slow', 'var(--esmera-motion-panel)'],
      ['esmera-ease', 'var(--esmera-ease-standard)'],
      ['esmera-shadow-raised', 'var(--esmera-shadow-interactive)'],
      ['esmera-shadow-overlay', 'var(--esmera-shadow-floating)'],
      ['esmera-backdrop', 'var(--esmera-backdrop-strong)'],
    ]
    for (const [name, target] of aliases) {
      expect(declaration(name)).toBe(target)
      expect(declarationCount(name)).toBe(1)
    }
    expect(tokens).not.toContain('--esmera-motion-standard: 160ms')
    expect(tokens).not.toContain('--esmera-motion-slow: 220ms')
  })

  it('mantém Inter como única família da UI customizada', () => {
    expect(declaration('esmera-font-sans')?.startsWith('Inter,')).toBe(true)
    expect(declarationCount('esmera-font-sans')).toBe(1)
  })

  it('garante 4.5:1 do texto sutil sobre canvas, panel e raised', () => {
    const subtle = declaration('esmera-text-subtle')
    expect(subtle).toMatch(/^#[0-9a-f]{6}$/)
    for (const surface of ['esmera-surface-canvas', 'esmera-surface-panel', 'esmera-surface-raised']) {
      const background = declaration(surface)
      expect(background).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrast(subtle as string, background as string)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('mantém o radius dentro da escala declarada', () => {
    expect(declaration('esmera-radius-6')).toBe('6px')
    expect(declaration('esmera-radius-8')).toBe('8px')
    expect(declaration('esmera-radius-round')).toBe('999px')
    expect(declaration('esmera-panel-radius')).toBe('var(--esmera-radius-8)')
    expect(declaration('esmera-control-radius')).toBe('var(--esmera-radius-6)')
  })

  it('não usa transition: all em nenhuma folha do design system', () => {
    for (const sheet of sheets) expect(sheet).not.toMatch(/transition:\s*all/)
  })

  it('não introduz glow nem dark mode', () => {
    for (const sheet of sheets) {
      expect(sheet).not.toMatch(/prefers-color-scheme/)
      expect(sheet).not.toMatch(/color-scheme:\s*dark/)
      expect(sheet.toLowerCase()).not.toContain('glow')
    }
    expect(declaration('color-scheme')).toBeNull()
    expect(tokens).toContain('color-scheme: light')
  })

  it('não anima grid-template-columns, width, left nem padding', () => {
    for (const sheet of sheets) {
      expect(sheet).not.toMatch(/transition:[^;]*grid-template-columns/)
      expect(sheet).not.toMatch(/transition:\s*width/)
      expect(sheet).not.toMatch(/transition:[^;]*\bleft\b/)
      expect(sheet).not.toMatch(/transition:[^;]*\bpadding\b/)
    }
  })

  it('mantém o rollback sem translateX e com feedback persistente', () => {
    const keyframes = reconciled.match(/@keyframes esmera-rollback\s*\{[^}]*\{[^}]*\}[^}]*\}/)?.[0] ?? ''
    expect(keyframes).not.toContain('translateX')
    expect(keyframes).toContain('opacity')
    expect(reconciled).not.toMatch(/@keyframes esmera-rollback[\s\S]*?translateX/)
    expect(states).toContain('.esmera-state-panel.is-rollback')
    expect(reconciled).toMatch(/is-rollback[\s\S]{0,200}border-left-color/)
  })

  it('restringe hover lift a ponteiro fino', () => {
    expect(designSystem).toContain('@media (hover: hover) and (pointer: fine)')
    const lift = designSystem.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(lift).toContain('var(--esmera-hover-lift)')
    expect(lift).toContain('var(--esmera-shadow-interactive)')
    const outsideLift = designSystem.replace(lift, '')
    expect(outsideLift).not.toContain('var(--esmera-hover-lift)')
  })

  it('preserva focus-visible com outline de 2px e anel de 3px sem mudar geometria', () => {
    const focus = designSystem.match(/:focus-visible\s*\{[\s\S]*?\}/)?.[0] ?? ''
    expect(focus).toContain('outline: 2px solid var(--esmera-focus)')
    expect(focus).toContain('outline-offset: 2px')
    expect(focus).toContain('box-shadow: var(--esmera-focus-ring)')
    expect(declaration('esmera-focus-ring')).toBe('var(--esmera-selection-ring)')
    expect(declaration('esmera-selection-ring')).toContain('0 0 0 3px')
  })

  it('compartilha a política de reduced motion em um único módulo', () => {
    expect(tokens).toContain('@media (prefers-reduced-motion: reduce)')
    expect(tokens).toContain('scroll-behavior: auto !important')
    for (const selector of [
      '.esmera-button',
      '.is-interactive-surface',
      '.esmera-dialog',
      '.esmera-drawer',
      '.esmera-menu-popup',
      '.esmera-popover-popup',
      '.esmera-select-popup',
      '.esmera-combobox-popup',
      '.esmera-tooltip-popup',
      '.esmera-skeleton',
      '.esmera-inline-feedback.is-rollback',
    ]) {
      expect(tokens).toContain(selector)
    }
    expect(designSystem).not.toContain('@media (prefers-reduced-motion: reduce)')
    expect(states).not.toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('não desliga movimento escondendo conteúdo', () => {
    const policy = tokens.slice(tokens.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(policy).not.toContain('display: none')
    expect(policy).not.toContain('visibility: hidden')
  })

  it('remove a escala local de View Transitions e consome os tokens canônicos', () => {
    expect(advanced).not.toContain('--esmera-transition-fast:')
    expect(advanced).not.toContain('--esmera-transition-panel:')
    expect(advanced).toContain('var(--esmera-motion-fast')
    expect(advanced).toContain('var(--esmera-motion-panel')
    expect(advanced).toContain('@view-transition')
    expect(advanced).not.toMatch(/transition:[^;]*grid-template-columns/)
    for (const sheet of sheets) expect(sheet).not.toMatch(/var\(--esmera-transition-(fast|panel)\)/)
  })
})
