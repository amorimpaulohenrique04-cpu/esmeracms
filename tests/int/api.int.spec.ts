import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import type { User } from '@/payload-types'

let payload: Payload
let editorUser: User
let commercialUser: User

const stamp = Date.now().toString(36)

async function createUser(role: 'admin' | 'editor' | 'commercial') {
  return payload.create({
    collection: 'users',
    overrideAccess: true,
    data: {
      email: `ci-${role}-${stamp}@esmera.test`,
      password: 'test-password-123',
      name: `CI ${role}`,
      role,
    },
  })
}

describe('Esméra access and data contract', () => {
  beforeAll(
    async () => {
      payload = await getPayload({ config: await config })
      editorUser = await createUser('editor')
      commercialUser = await createUser('commercial')
    },
    30_000,
  )

  it('keeps Business private from unauthenticated and editorial users', async () => {
    await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        name: `Lead privado ${stamp}`,
        email: `lead-${stamp}@example.com`,
        source: 'site',
        stage: 'new',
      },
    })

    const publicResult = await payload.find({
      collection: 'leads',
      overrideAccess: false,
      user: undefined,
      where: { name: { equals: `Lead privado ${stamp}` } },
    })

    const editorResult = await payload.find({
      collection: 'leads',
      overrideAccess: false,
      user: editorUser,
      where: { name: { equals: `Lead privado ${stamp}` } },
    })

    const commercialResult = await payload.find({
      collection: 'leads',
      overrideAccess: false,
      user: commercialUser,
      where: { name: { equals: `Lead privado ${stamp}` } },
    })

    expect(publicResult.totalDocs).toBe(0)
    expect(editorResult.totalDocs).toBe(0)
    expect(commercialResult.totalDocs).toBe(1)
  })

  it('exposes only active and published categories publicly', async () => {
    await payload.create({
      collection: 'categories',
      overrideAccess: true,
      data: {
        title: `Ativa ${stamp}`,
        slug: `ativa-${stamp}`,
        status: 'active',
        _status: 'published',
      },
    })

    await payload.create({
      collection: 'categories',
      overrideAccess: true,
      data: {
        title: `Arquivada ${stamp}`,
        slug: `arquivada-${stamp}`,
        status: 'archive',
        _status: 'published',
      },
    })

    await payload.create({
      collection: 'categories',
      overrideAccess: true,
      draft: true,
      data: {
        title: `Rascunho ${stamp}`,
        slug: `rascunho-${stamp}`,
        status: 'active',
        _status: 'draft',
      },
    })

    const publicResult = await payload.find({
      collection: 'categories',
      overrideAccess: false,
      user: undefined,
      where: { slug: { contains: stamp } },
    })

    const commercialResult = await payload.find({
      collection: 'categories',
      overrideAccess: false,
      user: commercialUser,
      where: { slug: { contains: stamp } },
    })

    const editorResult = await payload.find({
      collection: 'categories',
      overrideAccess: false,
      user: editorUser,
      draft: true,
      where: { slug: { contains: stamp } },
    })

    expect(publicResult.docs.map((doc) => doc.slug)).toEqual([`ativa-${stamp}`])
    expect(commercialResult.docs.map((doc) => doc.slug).sort()).toEqual([
      `arquivada-${stamp}`,
      `ativa-${stamp}`,
    ].sort())
    expect(editorResult.totalDocs).toBe(3)
  })
})
