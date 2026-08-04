import { describe, expect, it } from 'vitest'

import {
  getHomeSectionEditorialState,
  hasMeaningfulHomeValue,
  type HomeEditorialValues,
} from '../../src/admin/modules/home/homeEditorialState'

describe('Home editorial state', () => {
  it('usa o padrão do site quando não há override e o fallback é permitido', () => {
    expect(getHomeSectionEditorialState('hero', { heroSlides: [] })).toBe('site_default')
  })

  it('reconhece override explícito como personalizado', () => {
    expect(getHomeSectionEditorialState('hero', {
      heroSlides: [{ statement: 'Nova coleção', active: true }],
    })).toBe('customized')
  })

  it('prioriza a desativação explícita', () => {
    expect(getHomeSectionEditorialState('hero', {
      disabledSections: ['hero'],
      heroSlides: [{ statement: 'Nova coleção' }],
    })).toBe('hidden')
  })

  it('não trata objeto vazio como personalizado', () => {
    expect(hasMeaningfulHomeValue({})).toBe(false)
    expect(getHomeSectionEditorialState('provenance', {
      provenanceCallToAction: {},
    })).toBe('site_default')
  })

  it('não interpreta conteúdo vazio como oculto', () => {
    expect(getHomeSectionEditorialState('matter', { matterPanels: [] })).toBe('site_default')
  })

  it('ignora erro de preview na determinação editorial', () => {
    expect(getHomeSectionEditorialState('signature', {
      previewError: 'timeout',
      signatureSlides: [],
    })).toBe('site_default')
  })

  it('não depende de parsing de mensagens humanas', () => {
    expect(getHomeSectionEditorialState('manifesto', {
      message: 'Personalizado e oculto',
    })).toBe('site_default')
  })

  it('não altera os dados recebidos', () => {
    const values: HomeEditorialValues = {
      disabledSections: [],
      selectedProducts: [12],
    }
    const before = structuredClone(values)

    expect(getHomeSectionEditorialState('selectedObjects', values)).toBe('customized')
    expect(values).toEqual(before)
  })
})
