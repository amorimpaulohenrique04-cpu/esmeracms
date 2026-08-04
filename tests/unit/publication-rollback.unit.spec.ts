import { describe, expect, it, vi } from 'vitest'

import { attemptConditionalPublicationRollback } from '../../src/server/publication/conditionalRollback'

const previous = {
  versionId: 10,
  document: { publicationRevision: 'old', editorial: 'old' },
  publicationRevision: 'old',
  editorialRevision: 'editorial-old',
}

function input(overrides: Record<string, unknown> = {}) {
  const current = { publicationRevision: 'new', editorial: 'new' }
  const restored = { publicationRevision: 'old', editorial: 'old' }
  return {
    enabled: true,
    previous,
    currentDocument: current,
    currentPublicationRevision: 'new',
    currentEditorialRevision: 'editorial-new',
    readCurrent: vi.fn(async () => current),
    restorePrevious: vi.fn(async () => restored),
    readRestored: vi.fn(async () => restored),
    extractPublicRevision: (document: { publicationRevision: string }) => document.publicationRevision,
    createEditorialRevision: (document: { editorial: string }) => `editorial-${document.editorial}`,
    ...overrides,
  }
}

describe('attemptConditionalPublicationRollback', () => {
  it('rollback desabilitado falha fechado', async () => {
    const subject = input({ enabled: false })
    const result = await attemptConditionalPublicationRollback(subject)
    expect(result).toEqual({ status: 'skipped', attempted: false, reason: 'rollback_disabled' })
    expect(subject.restorePrevious).not.toHaveBeenCalled()
  })

  it('sem versão anterior não restaura', async () => {
    const subject = input({ previous: null })
    const result = await attemptConditionalPublicationRollback(subject)
    expect(result.status).toBe('skipped')
    expect(subject.restorePrevious).not.toHaveBeenCalled()
  })

  it('mudança pública concorrente bloqueia restore', async () => {
    const subject = input({ readCurrent: vi.fn(async () => ({ publicationRevision: 'other', editorial: 'new' })) })
    const result = await attemptConditionalPublicationRollback(subject)
    expect(result).toEqual({ status: 'skipped', attempted: false, reason: 'current_revision_changed' })
    expect(subject.restorePrevious).not.toHaveBeenCalled()
  })

  it('mudança editorial concorrente bloqueia restore', async () => {
    const subject = input({ readCurrent: vi.fn(async () => ({ publicationRevision: 'new', editorial: 'changed' })) })
    const result = await attemptConditionalPublicationRollback(subject)
    expect(result).toEqual({ status: 'skipped', attempted: false, reason: 'current_editorial_revision_changed' })
    expect(subject.restorePrevious).not.toHaveBeenCalled()
  })

  it('restore correto produz reverted', async () => {
    const subject = input()
    const result = await attemptConditionalPublicationRollback(subject)
    expect(result.status).toBe('reverted')
    expect(subject.restorePrevious).toHaveBeenCalledWith(10)
  })

  it('restore divergente é failed', async () => {
    const subject = input({ readRestored: vi.fn(async () => ({ publicationRevision: 'wrong', editorial: 'old' })) })
    const result = await attemptConditionalPublicationRollback(subject)
    expect(result.status).toBe('failed')
  })
})
