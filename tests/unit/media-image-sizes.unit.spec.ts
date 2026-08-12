import { describe, expect, it } from 'vitest'

import { Media } from '../../src/collections/Media'

describe('Media image sizes', () => {
  it('keeps gallery proportional while preserving wide as a fixed crop', () => {
    const upload = Media.upload
    if (!upload || typeof upload === 'boolean') {
      throw new Error('Media upload configuration is required')
    }

    const gallery = upload.imageSizes?.find((size) => size.name === 'gallery')
    const wide = upload.imageSizes?.find((size) => size.name === 'wide')

    expect(gallery).toMatchObject({ name: 'gallery', width: 1800 })
    expect(gallery).not.toHaveProperty('height')
    expect(gallery).not.toHaveProperty('position')

    expect(wide).toMatchObject({
      name: 'wide',
      width: 1800,
      height: 1200,
      position: 'centre',
    })
  })
})
