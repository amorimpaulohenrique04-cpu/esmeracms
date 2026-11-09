import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown>,
  after: vi.fn(),
  revalidateTag: vi.fn(),
  dangerouslyDeleteByTag: vi.fn(async () => undefined),
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }))
vi.mock('@vercel/functions', () => ({ dangerouslyDeleteByTag: mocks.dangerouslyDeleteByTag }))

const {
  affectsPublicContent,
  invalidateStorefrontAfterChange,
  invalidateStorefrontAfterDelete,
  invalidateStorefrontAfterGlobalChange,
  scheduleStorefrontInvalidation,
  SKIP_STOREFRONT_INVALIDATION,
} = await import('../../src/server/storefront-v2/invalidation')

const req = () => ({}) as PayloadRequest
const runAfter = async () => {
  for (const callback of mocks.afterCallbacks.splice(0)) await callback()
}
const invalidatedTags = () => mocks.revalidateTag.mock.calls.map(([tag]) => tag)

function changeArgs(doc: Record<string, unknown>, previousDoc: Record<string, unknown>, context: Record<string, unknown> = {}) {
  return { doc, previousDoc, req: req(), context } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.afterCallbacks.length = 0
  mocks.after.mockImplementation((callback: () => unknown) => {
    mocks.afterCallbacks.push(callback)
  })
})

describe('invalidação do site ao publicar', () => {
  it('publicar uma categoria limpa menu, bootstrap, coleções, produtos e páginas', async () => {
    invalidateStorefrontAfterChange('category')(changeArgs({ _status: 'published' }, { _status: 'draft' }))
    await runAfter()
    expect(invalidatedTags().sort()).toEqual([
      'storefront-bootstrap', 'storefront-collections', 'storefront-navigation', 'storefront-pages', 'storefront-products',
    ])
    expect(mocks.revalidateTag).toHaveBeenCalledWith('storefront-navigation', { expire: 0 })
    expect(mocks.dangerouslyDeleteByTag).toHaveBeenCalledTimes(1)
  })

  it('não limpa nada antes do fim da requisição (depois do commit)', () => {
    invalidateStorefrontAfterChange('category')(changeArgs({ _status: 'published' }, {}))
    expect(mocks.after).toHaveBeenCalledTimes(1)
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
  })

  it('despublicar também limpa, para o item sair do site', async () => {
    invalidateStorefrontAfterChange('category')(changeArgs({ _status: 'draft' }, { _status: 'published' }))
    await runAfter()
    expect(invalidatedTags()).toContain('storefront-navigation')
  })

  it('rascunho que nunca foi público não limpa', () => {
    invalidateStorefrontAfterChange('category')(changeArgs({ _status: 'draft' }, { _status: 'draft' }))
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('associar produto limpa coleções e produtos, mas não o menu', async () => {
    invalidateStorefrontAfterChange('product')(changeArgs({ _status: 'published' }, { _status: 'published' }))
    await runAfter()
    expect(invalidatedTags()).toEqual(expect.arrayContaining(['storefront-collections', 'storefront-products', 'storefront-bootstrap']))
    expect(invalidatedTags()).not.toContain('storefront-navigation')
  })

  it('excluir limpa sempre', async () => {
    invalidateStorefrontAfterDelete('category')({ doc: { _status: 'draft' }, req: req(), context: {} } as never)
    await runAfter()
    expect(invalidatedTags()).toContain('storefront-navigation')
  })

  it('globais do site invalidam suas leituras', async () => {
    invalidateStorefrontAfterGlobalChange('navigation')({ doc: { _status: 'published' }, previousDoc: {}, req: req(), context: {} } as never)
    await runAfter()
    expect(invalidatedTags().sort()).toEqual(['storefront-bootstrap', 'storefront-navigation'])
  })

  it('agrupa várias alterações da mesma requisição', async () => {
    const shared = req()
    scheduleStorefrontInvalidation('category', shared)
    scheduleStorefrontInvalidation('product', shared)
    scheduleStorefrontInvalidation('category', shared)
    expect(mocks.after).toHaveBeenCalledTimes(1)
    await runAfter()
    expect(mocks.dangerouslyDeleteByTag).toHaveBeenCalledTimes(1)
    expect(new Set(invalidatedTags()).size).toBe(invalidatedTags().length)
  })

  it('lotes podem pedir uma invalidação única no final', () => {
    invalidateStorefrontAfterChange('category')(changeArgs({ _status: 'published' }, {}, { [SKIP_STOREFRONT_INVALIDATION]: true }))
    expect(mocks.after).not.toHaveBeenCalled()
  })

  it('fora de requisição só registra aviso, sem derrubar a gravação', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mocks.after.mockImplementation(() => {
      throw new Error('after outside request scope')
    })
    expect(() => scheduleStorefrontInvalidation('category')).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'storefront.invalidation.skipped' }))
  })

  it('falha ao limpar fica registrada', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.dangerouslyDeleteByTag.mockRejectedValueOnce(new Error('purge indisponível'))
    scheduleStorefrontInvalidation('home')
    await runAfter()
    expect(error).toHaveBeenCalledWith(expect.objectContaining({
      event: 'storefront.invalidation.failed',
      failures: ['purge indisponível'],
    }))
  })

  it('classifica o que afeta o site', () => {
    expect(affectsPublicContent({ _status: 'published' })).toBe(true)
    expect(affectsPublicContent({ _status: 'draft' }, { _status: 'published' })).toBe(true)
    expect(affectsPublicContent({ _status: 'draft' }, { _status: 'draft' })).toBe(false)
    expect(affectsPublicContent({})).toBe(true)
  })
})
