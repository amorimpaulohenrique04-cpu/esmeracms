import { describe, expect, it } from 'vitest'

import { HOME_DISABLED_SECTIONS, Home } from '@/globals/Home'
import { SiteSettings } from '@/globals/SiteSettings'

type FieldLike = {
  name?: string
  type?: string
  required?: boolean
  minRows?: number
  maxRows?: number
  hasMany?: boolean
  options?: Array<string | { value?: string }>
  fields?: FieldLike[]
  tabs?: Array<{ fields?: FieldLike[] }>
  validate?: (value: unknown, options: { siblingData?: Record<string, unknown> }) => unknown
}

function nestedFields(field: FieldLike): FieldLike[] {
  const direct = Array.isArray(field.fields) ? field.fields : []
  const tabs = Array.isArray(field.tabs) ? field.tabs.flatMap((tab) => tab.fields ?? []) : []
  return [...direct, ...tabs]
}

function searchField(fields: FieldLike[], name: string): FieldLike | undefined {
  for (const field of fields) {
    if (field.name === name) return field
    const nested = searchField(nestedFields(field), name)
    if (nested) return nested
  }

  return undefined
}

function getField(fields: FieldLike[], name: string): FieldLike {
  const field = searchField(fields, name)
  if (!field) throw new Error(`Field ${name} not found`)
  return field
}

const homeFields = Home.fields as unknown as FieldLike[]
const siteSettingsFields = SiteSettings.fields as unknown as FieldLike[]

describe('Home global schema', () => {
  it('allows publishing without Hero while preserving validation for existing slides', () => {
    const heroSlides = getField(homeFields, 'heroSlides')

    expect(heroSlides.required).toBe(false)
    expect(heroSlides.minRows).toBe(0)
    expect(heroSlides.maxRows).toBe(5)
    expect(heroSlides.validate?.([], { siblingData: { heroMode: 'single' } })).toBe(true)
    expect(heroSlides.validate?.([{ active: true }], { siblingData: { heroMode: 'single' } })).toBe(true)
    expect(
      heroSlides.validate?.([{ active: true }, { active: true }], { siblingData: { heroMode: 'single' } }),
    ).toBeTypeOf('string')
  })

  it('allows zero to four selected products without an all-or-nothing validator', () => {
    const selectedProducts = getField(homeFields, 'selectedProducts')

    expect(selectedProducts.required).toBe(false)
    expect(selectedProducts.minRows).toBe(0)
    expect(selectedProducts.maxRows).toBe(4)
    expect(selectedProducts.validate).toBeUndefined()
  })

  it('allows Matter with zero to three rows and validates fields inside existing rows', () => {
    const matterPanels = getField(homeFields, 'matterPanels')
    const matterFields = matterPanels.fields ?? []
    const imageGroup = getField(matterFields, 'image')
    const imageFields = imageGroup.fields ?? []

    expect(matterPanels.minRows).toBe(0)
    expect(matterPanels.maxRows).toBe(3)
    expect(getField(matterFields, 'category').required).toBe(true)
    expect(getField(imageFields, 'image').required).toBe(true)
    expect(getField(imageFields, 'alt').required).toBe(true)
    expect(getField(matterFields, 'headline').required).toBe(true)
  })

  it('allows Signature to be empty and caps it at six slides', () => {
    const signatureSlides = getField(homeFields, 'signatureSlides')

    expect(signatureSlides.minRows).toBe(0)
    expect(signatureSlides.maxRows).toBe(6)
  })

  it('keeps Manifesto and Provenance editorial fields optional', () => {
    expect(getField(homeFields, 'manifestoTitle').required).not.toBe(true)
    expect(getField(homeFields, 'provenanceTitle').required).not.toBe(true)
    expect(getField(homeFields, 'provenanceCopy').required).not.toBe(true)
    expect(getField(homeFields, 'provenanceSteps').required).not.toBe(true)
  })

  it('accepts only the supported disabled section identifiers', () => {
    const disabledSections = getField(homeFields, 'disabledSections')
    const optionValues = disabledSections.options?.map((option) =>
      typeof option === 'string' ? option : option.value,
    )

    expect(disabledSections.type).toBe('select')
    expect(disabledSections.hasMany).toBe(true)
    expect(optionValues).toEqual([...HOME_DISABLED_SECTIONS])
  })
})

describe('public Site Settings schema', () => {
  it('contains the explicit storefront footer fields required by the contract', () => {
    const names = siteSettingsFields.map((field) => field.name)

    expect(names).toEqual(
      expect.arrayContaining([
        'footerStatement',
        'locationLabel',
        'privacyLabel',
        'privacyHref',
        'termsLabel',
        'termsHref',
      ]),
    )
  })
})
