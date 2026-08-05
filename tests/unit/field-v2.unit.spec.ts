/**
 * PR-08 — `FieldV2` associa programaticamente label, hint e erro ao controle real.
 *
 * Arquivo em `.ts` com `React.createElement`: o `include` do vitest.config.mts
 * coleta apenas `tests/unit/**\/*.unit.spec.ts`, e a config está fora do escopo
 * de alteração deste PR.
 */
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { FieldV2, type FieldControlProps } from '../../src/admin/design-system/Forms'

type FieldProps = Omit<React.ComponentProps<typeof FieldV2>, 'children'>

function input(control: FieldControlProps) {
  return React.createElement('input', { ...control, defaultValue: '' })
}

function fieldElement(props: Partial<FieldProps> = {}) {
  // Arquivo .ts sem JSX: FieldV2 exige `children` no tipo das props, e o
  // overload de createElement com filho à parte não tipa contra props com
  // `children` obrigatório. `children` via props é a forma correta aqui.
  // eslint-disable-next-line react/no-children-prop
  return React.createElement(FieldV2, { label: 'Título', ...props, children: input })
}

function renderField(props: Partial<FieldProps> = {}) {
  return render(fieldElement(props))
}

function control() {
  return screen.getByRole('textbox')
}

function describedByIDs() {
  return (control().getAttribute('aria-describedby') || '').split(' ').filter(Boolean)
}

afterEach(cleanup)

describe('FieldV2', () => {
  it('o label aponta para o controle real', () => {
    renderField({ id: 'product-title' })
    const label = screen.getByText('Título')
    expect(label.getAttribute('for')).toBe('product-title')
    expect(control().id).toBe('product-title')
    // Nome acessível vem do label, não de placeholder.
    expect(screen.getByLabelText('Título')).toBe(control())
  })

  it('o hint compõe aria-describedby', () => {
    renderField({ id: 'campo', hint: 'Use vírgula para os centavos.' })
    expect(describedByIDs()).toContain('campo-hint')
    expect(document.getElementById('campo-hint')?.textContent).toBe('Use vírgula para os centavos.')
  })

  it('o erro compõe aria-describedby junto com a descrição', () => {
    renderField({ id: 'campo', description: 'Aparece na vitrine.', error: 'Informe o título.' })
    expect(describedByIDs()).toEqual(['campo-description', 'campo-error'])
    expect(document.getElementById('campo-error')?.textContent).toBe('Informe o título.')
  })

  it('preserva IDs externos recebidos', () => {
    renderField({ id: 'campo', hint: 'Dica.', describedBy: 'ajuda-global contador' })
    expect(describedByIDs()).toEqual(['campo-hint', 'ajuda-global', 'contador'])
  })

  it('remove IDs duplicados', () => {
    renderField({ id: 'campo', hint: 'Dica.', error: 'Erro.', describedBy: 'campo-hint campo-error campo-hint' })
    expect(describedByIDs()).toEqual(['campo-hint', 'campo-error'])
  })

  it('aria-invalid e aria-errormessage existem apenas com erro', () => {
    const { rerender } = renderField({ id: 'campo', hint: 'Dica.' })
    expect(control().getAttribute('aria-invalid')).toBeNull()
    expect(control().getAttribute('aria-errormessage')).toBeNull()

    rerender(fieldElement({ id: 'campo', hint: 'Dica.', error: 'Informe o título.' }))
    expect(control().getAttribute('aria-invalid')).toBe('true')
    expect(control().getAttribute('aria-errormessage')).toBe('campo-error')
    // O alvo do aria-errormessage existe e carrega a mensagem.
    expect(document.getElementById('campo-error')?.textContent).toBe('Informe o título.')
  })

  it('encaminha required ao controle', () => {
    renderField({ id: 'campo', required: true })
    expect(control().hasAttribute('required')).toBe(true)
  })

  it('erro presente no carregamento não é anunciado', () => {
    renderField({ id: 'campo', error: 'Informe o título.' })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.getElementById('campo-error')).toBeTruthy()
  })

  it('erro após submissão explícita usa role="alert"', () => {
    renderField({ id: 'campo', error: 'Informe o título.', announceError: true })
    expect(screen.getByRole('alert').textContent).toBe('Informe o título.')
  })

  it('controle sem hint, descrição ou erro não recebe atributos ARIA vazios', () => {
    renderField({ id: 'campo' })
    expect(control().hasAttribute('aria-describedby')).toBe(false)
    expect(control().hasAttribute('aria-invalid')).toBe(false)
    expect(control().hasAttribute('aria-errormessage')).toBe(false)
    expect(control().hasAttribute('required')).toBe(false)
  })

  it('mantém o path do campo para navegação a partir do resumo de erros', () => {
    const { container } = renderField({ id: 'campo', path: 'basePriceCents' })
    expect(container.querySelector('[data-field-path="basePriceCents"]')).toBeTruthy()
  })
})
