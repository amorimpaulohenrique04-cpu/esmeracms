import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { Home } from '../../src/globals/Home'

const editViewSource = readFileSync(
  fileURLToPath(new URL('../../src/admin/modules/home/HomeEditView.tsx', import.meta.url)),
  'utf8',
)

type HomeAdminComponents = {
  views?: {
    edit?: {
      default?: {
        Component?: string
      }
    }
  }
}

describe('Home custom edit view registration', () => {
  it('registra a view pelo mecanismo oficial do global', () => {
    const components = Home.admin?.components as HomeAdminComponents | undefined
    expect(components?.views?.edit?.default?.Component).toBe(
      '/admin/modules/home/HomeEditView#HomeEditView',
    )
  })

  it('preserva drafts e o schema existente', () => {
    expect(Home.versions).toEqual({ drafts: true, max: 50 })
    expect(Home.fields.some((field) => 'name' in field && field.name === 'disabledSections')).toBe(true)
  })

  it('reutiliza o DefaultEditView e o formulário oficial do Payload', () => {
    expect(editViewSource).toContain('DefaultEditView')
    expect(editViewSource).toContain('Description={HomeEditorialOverview}')
    expect(editViewSource).not.toContain('fetch(')
  })

  it('não sintetiza confirmação de visibilidade no site', () => {
    expect(editViewSource).toContain('não apresenta “Visível no site”')
  })
})
