import { describe, expect, it } from 'vitest'
import type { CollectionConfig, GlobalConfig } from 'payload'

import { Activities } from '@/collections/Activities'
import { AfterSales } from '@/collections/AfterSales'
import { Categories } from '@/collections/Categories'
import { ClientInterests } from '@/collections/ClientInterests'
import { Customers } from '@/collections/Customers'
import { Leads } from '@/collections/Leads'
import { Media } from '@/collections/Media'
import { Occurrences } from '@/collections/Occurrences'
import { Opportunities } from '@/collections/Opportunities'
import { Products } from '@/collections/Products'
import { ReportExportFiles } from '@/collections/ReportExportFiles'
import { ReportExports } from '@/collections/ReportExports'
import { Sales } from '@/collections/Sales'
import { Shipments } from '@/collections/Shipments'
import { Tasks } from '@/collections/Tasks'
import { Users } from '@/collections/Users'
import { About } from '@/globals/About'
import { AfterSalesAutomation } from '@/globals/AfterSalesAutomation'
import { CollectionPage } from '@/globals/CollectionPage'
import { Contact } from '@/globals/Contact'
import { Home } from '@/globals/Home'
import { Navigation } from '@/globals/Navigation'
import { SiteSettings } from '@/globals/SiteSettings'

async function anonymousRead(config: CollectionConfig | GlobalConfig) {
  const read = config.access?.read
  return typeof read === 'function' ? read({ req: { user: undefined } } as never) : read
}

describe('public content access policy', () => {
  it('exposes only published public collections and keeps every write authenticated', async () => {
    const publicCollections = [Products, Categories, Media]

    for (const collection of publicCollections) {
      const result = await anonymousRead(collection)
      expect(result).toBeTypeOf('object')
      expect(JSON.stringify(result)).toContain('published')
      expect(collection.access?.create).not.toBe(true)
      expect(collection.access?.update).not.toBe(true)
      expect(collection.access?.delete).not.toBe(true)
    }

    expect(Media.versions).toMatchObject({ drafts: true })
  })

  it('keeps all business, identity, reporting and operational collections private', async () => {
    const privateCollections = [
      Users,
      Leads,
      Customers,
      ClientInterests,
      Opportunities,
      Sales,
      AfterSales,
      Tasks,
      Shipments,
      Occurrences,
      Activities,
      ReportExports,
      ReportExportFiles,
    ]

    for (const collection of privateCollections) {
      expect(await anonymousRead(collection), collection.slug).toBe(false)
    }
  })

  it('exposes only published institutional globals and keeps internal automation private', async () => {
    const publicGlobals = [Home, About, Contact, CollectionPage, Navigation, SiteSettings]

    for (const global of publicGlobals) {
      const result = await anonymousRead(global)
      expect(result, global.slug).toEqual({ _status: { equals: 'published' } })
      expect(global.access?.update).not.toBe(true)
    }

    expect(SiteSettings.versions).toMatchObject({ drafts: true })
    expect(await anonymousRead(AfterSalesAutomation)).toBe(false)
  })
})
