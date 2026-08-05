/**
 * Cobertura determinística (sem DOM/browser) da lógica pura de
 * src/admin/navigation/navigation-intent.ts — consumida por
 * NavigationFeedbackProvider.tsx. Ver
 * .agents/skills/esmera-motion-system/SKILL.md para a política de motion
 * que este módulo aplica durante navegação de rota.
 */
import { describe, expect, it } from 'vitest'

import {
  isDifferentAdminRoute,
  resolveSkeletonVariant,
  shouldTrackAnchorClick,
} from '../../src/admin/navigation/navigation-intent'

const noModifiers = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
}

const plainAnchor = { href: '', target: null, hasDownload: false, ariaDisabled: false }

describe('resolveSkeletonVariant', () => {
  it('mapeia /admin para dashboard', () => {
    expect(resolveSkeletonVariant('/admin')).toBe('dashboard')
    expect(resolveSkeletonVariant('/admin/')).toBe('dashboard')
  })

  it('mapeia as seções operacionais para list', () => {
    for (const path of ['/admin/products', '/admin/categories', '/admin/customers', '/admin/sales', '/admin/after-sales', '/admin/reports', '/admin/privacy', '/admin/settings', '/admin/technical']) {
      expect(resolveSkeletonVariant(path)).toBe('list')
    }
  })

  it('mapeia listagem de collection (sem id) para list', () => {
    expect(resolveSkeletonVariant('/admin/collections/users')).toBe('list')
  })

  it('mapeia criação/edição de documento de collection para form', () => {
    expect(resolveSkeletonVariant('/admin/collections/products/create')).toBe('form')
    expect(resolveSkeletonVariant('/admin/collections/products/507')).toBe('form')
  })

  it('ignora querystring e hash ao decidir a variante', () => {
    expect(resolveSkeletonVariant('/admin/products?view=grid&page=2')).toBe('list')
    expect(resolveSkeletonVariant('/admin/reports#evolution')).toBe('list')
  })

  it('cai no fallback list para rota desconhecida', () => {
    expect(resolveSkeletonVariant('/admin/some-unmapped-section')).toBe('list')
  })
})

describe('isDifferentAdminRoute', () => {
  const current = 'https://cms.esmera.test/admin/products?view=list'

  it('rejeita a mesma rota (mesmo pathname e search)', () => {
    expect(isDifferentAdminRoute('https://cms.esmera.test/admin/products?view=list', current)).toBe(false)
  })

  it('rejeita âncora de mesma página (só o hash muda)', () => {
    expect(isDifferentAdminRoute('https://cms.esmera.test/admin/products?view=list#section', current)).toBe(false)
  })

  it('aceita mudança de pathname', () => {
    expect(isDifferentAdminRoute('https://cms.esmera.test/admin/categories', current)).toBe(true)
  })

  it('aceita mudança de apenas searchParams na mesma rota', () => {
    expect(isDifferentAdminRoute('https://cms.esmera.test/admin/products?view=grid', current)).toBe(true)
  })

  it('rejeita origem externa', () => {
    expect(isDifferentAdminRoute('https://outro-dominio.test/admin/products', current)).toBe(false)
  })

  it('rejeita rota fora de /admin', () => {
    expect(isDifferentAdminRoute('https://cms.esmera.test/api/admin-products', current)).toBe(false)
  })

  it('rejeita URL inválida sem lançar', () => {
    expect(isDifferentAdminRoute('not a url', current)).toBe(false)
  })
})

describe('shouldTrackAnchorClick', () => {
  const current = 'https://cms.esmera.test/admin'

  it('rastreia um clique simples para uma rota interna diferente', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products' }
    expect(shouldTrackAnchorClick(noModifiers, anchor, current)).toBe(true)
  })

  it('ignora clique na rota atual', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin' }
    expect(shouldTrackAnchorClick(noModifiers, anchor, current)).toBe(false)
  })

  it('ignora link externo', () => {
    const anchor = { ...plainAnchor, href: 'https://outro-dominio.test/admin' }
    expect(shouldTrackAnchorClick(noModifiers, anchor, current)).toBe(false)
  })

  it('ignora download', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products', hasDownload: true }
    expect(shouldTrackAnchorClick(noModifiers, anchor, current)).toBe(false)
  })

  it('ignora target=_blank', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products', target: '_blank' }
    expect(shouldTrackAnchorClick(noModifiers, anchor, current)).toBe(false)
  })

  it('ignora elemento aria-disabled', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products', ariaDisabled: true }
    expect(shouldTrackAnchorClick(noModifiers, anchor, current)).toBe(false)
  })

  it('ignora Ctrl/Cmd + clique', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products' }
    expect(shouldTrackAnchorClick({ ...noModifiers, ctrlKey: true }, anchor, current)).toBe(false)
    expect(shouldTrackAnchorClick({ ...noModifiers, metaKey: true }, anchor, current)).toBe(false)
  })

  it('ignora Shift/Alt + clique', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products' }
    expect(shouldTrackAnchorClick({ ...noModifiers, shiftKey: true }, anchor, current)).toBe(false)
    expect(shouldTrackAnchorClick({ ...noModifiers, altKey: true }, anchor, current)).toBe(false)
  })

  it('ignora botão direito (button !== 0)', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products' }
    expect(shouldTrackAnchorClick({ ...noModifiers, button: 2 }, anchor, current)).toBe(false)
  })

  it('ignora clique já cancelado (defaultPrevented)', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin/products' }
    expect(shouldTrackAnchorClick({ ...noModifiers, defaultPrevented: true }, anchor, current)).toBe(false)
  })

  it('ignora âncora de mesma página (hash apenas)', () => {
    const anchor = { ...plainAnchor, href: 'https://cms.esmera.test/admin#section' }
    expect(shouldTrackAnchorClick(noModifiers, anchor, current)).toBe(false)
  })
})
