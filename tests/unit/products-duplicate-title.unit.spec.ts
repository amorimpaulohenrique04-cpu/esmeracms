import { describe, expect, it, vi } from 'vitest'

import { Products } from '../../src/collections/Products'

describe('duplicate product titles', () => {
  it('does not mark the product title as unique', () => {
    const tabs = Products.fields.find((field) => field.type === 'tabs')
    expect(tabs?.type).toBe('tabs')
    if (!tabs || tabs.type !== 'tabs') return

    const titleField = tabs.tabs
      .flatMap((tab) => tab.fields)
      .find((field) => 'name' in field && field.name === 'title')

    expect(titleField).toBeDefined()
    expect(titleField && 'unique' in titleField ? titleField.unique : undefined).not.toBe(true)
  })

  it('keeps the slug unique when two products use the same title', async () => {
    const hook = Products.hooks?.beforeValidate?.[0]
    expect(hook).toBeTypeOf('function')
    if (typeof hook !== 'function') return

    const find = vi.fn()
      .mockResolvedValueOnce({ docs: [{ id: 1 }] })
      .mockResolvedValueOnce({ docs: [] })

    const result = await hook({
      data: { title: 'Bandeja Orgânica', _status: 'draft' },
      originalDoc: undefined,
      req: { payload: { find } },
    } as never)

    expect(result?.slug).toBe('bandeja-organica-2')
    expect(find).toHaveBeenCalledTimes(2)
  })
})
