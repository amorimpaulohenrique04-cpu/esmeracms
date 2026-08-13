import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationName = '20260813_020000_gallery_media_size'
const migrationSource = readFileSync(
  new URL(`../../src/migrations/${migrationName}.ts`, import.meta.url),
  'utf8',
)
const migrationIndex = readFileSync(new URL('../../src/migrations/index.ts', import.meta.url), 'utf8')

describe('gallery media database migration', () => {
  it('registers the gallery migration in the production migration index', () => {
    expect(migrationIndex).toContain(`./${migrationName}`)
    expect(migrationIndex).toContain(`name: '${migrationName}'`)
  })

  it('creates gallery metadata columns for media and media versions', () => {
    for (const suffix of ['url', 'width', 'height', 'mime_type', 'filesize', 'filename']) {
      expect(migrationSource).toContain(`"sizes_gallery_${suffix}"`)
      expect(migrationSource).toContain(`"version_sizes_gallery_${suffix}"`)
    }

    expect(migrationSource).toContain('ALTER TABLE "media" ADD COLUMN IF NOT EXISTS')
    expect(migrationSource).toContain('ALTER TABLE "_media_v" ADD COLUMN IF NOT EXISTS')
  })
})
