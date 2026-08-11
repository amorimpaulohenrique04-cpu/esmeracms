import { describe, expect, it } from 'vitest'

import { Media } from '../../src/collections/Media'

describe('Media territory image size', () => {
  it('keeps the Matter/Territory storefront crop aligned to 5:9', () => {
    const upload = typeof Media.upload === 'object' && Media.upload ? Media.upload : null
    const territory = upload?.imageSizes?.find((size) => size.name === 'territory')

    expect(territory).toMatchObject({
      name: 'territory',
      width: 1200,
      height: 2160,
      position: 'centre',
    })
  })
})
