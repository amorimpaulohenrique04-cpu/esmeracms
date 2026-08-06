/**
 * Guarda estática da política de motion do Admin (ver
 * .agents/skills/esmera-motion-system/SKILL.md). Escreva aqui apenas
 * verificações determinísticas nos arquivos-fonte — sem DOM, sem browser.
 * Nasceu da correção da regressão em que a navegação de rota misturava
 * snapshots da tela antiga e da nova (fix/post-pr12-motion-stability).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

const tokens = source('src/admin/design-system/tokens.scss')
const advanced = source('src/admin/design-system/advanced-interactions.scss')
const reconciled = source('src/admin/design-system/reconciled-interactions.scss')
const shell = source('src/admin/shell/shell.scss')
const nav = source('src/admin/components/nav.scss')
const adminStateProvider = source('src/admin/state/AdminStateProvider.tsx')
const packageJSON = source('package.json')

const centralSheets = [tokens, advanced, reconciled]

describe('Política de motion — guarda estática', () => {
  it('não reintroduz o opt-in global de View Transitions para navegação', () => {
    expect(advanced).not.toContain('@view-transition')
    expect(advanced).not.toContain('navigation: auto')
    for (const sheet of centralSheets) expect(sheet).not.toContain('navigation: auto')
  })

  it('não anima ::view-transition-old/new(root) globalmente', () => {
    for (const sheet of centralSheets) {
      expect(sheet).not.toMatch(/::view-transition-(old|new)\(root\)/)
    }
  })

  it('não vincula view-transition-name: esmera-workspace a um contêiner reaproveitado entre rotas', () => {
    for (const sheet of centralSheets) {
      expect(sheet).not.toContain('view-transition-name: esmera-workspace')
    }
  })

  it('não chama document.startViewTransition() para navegação de rota', () => {
    expect(adminStateProvider).not.toContain('startViewTransition')
    expect(adminStateProvider).not.toContain('startAdminViewTransition')
    expect(adminStateProvider).toContain('router.push(destination)')
  })

  it('não anima grid-template-columns em nenhum arquivo do design system', () => {
    for (const sheet of centralSheets) {
      expect(sheet).not.toMatch(/transition:[^;]*grid-template-columns/)
    }
    const afterSales = source('src/admin/modules/after-sales/after-sales.scss')
    expect(afterSales).not.toMatch(/transition:[^;]*grid-template-columns/)
  })

  it('documenta a exceção de width do rail por hit-testing sem liberar outras propriedades de layout', () => {
    expect(nav).toContain('getBoundingClientRect() ignora clip-path')
    expect(nav).toContain('transition: width var(--esmera-motion-fast) var(--esmera-ease-exit)')
    expect(nav).toContain('transition: width var(--esmera-motion-fast) var(--esmera-ease-enter)')
    const withoutApprovedRailWidth = nav
      .replaceAll('transition: width var(--esmera-motion-fast) var(--esmera-ease-exit);', '')
      .replaceAll('transition: width var(--esmera-motion-fast) var(--esmera-ease-enter);', '')
    expect(withoutApprovedRailWidth).not.toMatch(/transition:[^;]*(?:width|height|grid-template-columns)/)
  })

  it('não reintroduz os aliases de transição legados --esmera-transition-fast/--esmera-transition-panel', () => {
    for (const sheet of centralSheets) {
      expect(sheet).not.toContain('--esmera-transition-fast')
      expect(sheet).not.toContain('--esmera-transition-panel')
      expect(sheet).not.toMatch(/var\(--esmera-transition-(fast|panel)\)/)
    }
  })

  it('mantém nenhuma transição operacional acima do teto de 220ms (--esmera-motion-panel)', () => {
    for (const sheet of centralSheets) {
      expect(sheet).not.toMatch(/transition:[^;]*var\(--esmera-motion-navigation\)/)
      expect(sheet).not.toMatch(/transition:[^;]*var\(--esmera-motion-data\)/)
    }
    expect(shell).not.toMatch(/transition:[^;]*var\(--esmera-motion-navigation\)/)
    expect(shell).not.toMatch(/transition:[^;]*var\(--esmera-motion-data\)/)
  })

  it('anima a command palette apenas com tokens operacionais e saída mais rápida', () => {
    expect(shell).toContain('.esmera-command-backdrop[data-starting-style]')
    expect(shell).toContain('.esmera-command-backdrop[data-ending-style]')
    expect(shell).toContain('transition: opacity var(--esmera-motion-panel) var(--esmera-ease-enter)')
    expect(shell).toContain('.esmera-command[data-starting-style]')
    expect(shell).toContain('opacity var(--esmera-motion-panel) var(--esmera-ease-enter)')
    expect(shell).toContain('transform var(--esmera-motion-panel) var(--esmera-ease-enter)')
    expect(shell).toContain('transition-duration: var(--esmera-motion-fast)')
    expect(shell).toContain('transition-timing-function: var(--esmera-ease-exit)')
    expect(shell).toMatch(/@media \(max-width: 620px\)[\s\S]*\.esmera-command\[data-starting-style\][\s\S]*translateY\(100%\)/)
    expect(shell).not.toMatch(/transition:[^;]*\b\d+(?:\.\d+)?m?s\b/)
  })

  it('mantém reduced motion da command palette centralizado em tokens.scss', () => {
    for (const selector of [
      '.esmera-command-trigger',
      '.esmera-command-backdrop',
      '.esmera-command',
      '.esmera-command-search > svg',
      '.esmera-command-result',
      '.esmera-command-result-icon',
      '.esmera-command-indicator.is-loading::before',
      '.esmera-command-state.is-loading > span:first-child',
    ]) expect(tokens).toContain(selector)
  })

  it('centraliza durações de loop contínuo em tokens dedicados', () => {
    expect(tokens).toContain('--esmera-motion-loop-spinner:')
    expect(tokens).toContain('--esmera-motion-loop-skeleton:')
    const designSystem = source('src/admin/design-system/design-system.scss')
    const states = source('src/admin/design-system/states.scss')
    for (const sheet of [designSystem, states, shell]) {
      expect(sheet).not.toMatch(/animation:[^;]*\d+(\.\d+)?s linear infinite/)
    }
  })

  it('a skill esmera-motion-system existe e cobre os pontos exigidos', () => {
    expect(existsSync(resolve(root, '.agents/skills/esmera-motion-system/SKILL.md'))).toBe(true)
    const skill = source('.agents/skills/esmera-motion-system/SKILL.md')
    for (const heading of [
      'Missão e escopo',
      'Fontes de verdade',
      'Escala oficial de duração',
      'Uso obrigatório de tokens',
      'Propriedades permitidas',
      'route navigation',
      'inspectors, drawers',
      'View Transitions',
      'nomes únicos',
      'Progressive enhancement',
      'reduced-motion',
      'Foco, teclado',
      'Framer Motion',
      'spinner e skeleton',
      'Testes mínimos',
      'Checklist obrigatório',
    ]) {
      expect(skill).toContain(heading)
    }
  })

  it('não adiciona Framer Motion, GSAP ou o ViewTransition experimental', () => {
    expect(packageJSON).not.toContain('"framer-motion"')
    expect(packageJSON).not.toContain('"motion"')
    expect(packageJSON).not.toContain('"gsap"')
    for (const sheet of centralSheets) {
      expect(sheet).not.toContain('experimental.viewTransition')
    }
  })

  it('mantém a política de prefers-reduced-motion centralizada em tokens.scss', () => {
    expect(tokens).toContain('@media (prefers-reduced-motion: reduce)')
    expect(advanced).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
