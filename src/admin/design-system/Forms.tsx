'use client'

import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'
import React from 'react'

type FieldProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
  label?: string
  hint?: string
  children: React.ReactNode
}

export function Field({ label, hint, children, className = '', ...props }: FieldProps) {
  return (
    <label {...props} className={`esmera-field${className ? ` ${className}` : ''}`}>
      {label ? <span className="esmera-field-label">{label}</span> : null}
      {children}
      {hint ? <span className="esmera-field-hint">{hint}</span> : null}
    </label>
  )
}

/** Props que o `FieldV2` entrega ao controle real — nada aqui é opcional por acaso. */
export type FieldControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-errormessage'?: string
  required?: boolean
}

/**
 * Render prop em vez de `cloneElement`: o controle real recebe os atributos
 * tipados e o campo deixa de depender de o consumidor repetir o `id` à mão —
 * era essa a falha do componente anterior, que rotulava um `htmlFor` sem par.
 *
 * `announceError` fica com o consumidor: só quem sabe se a falha veio de uma
 * submissão explícita pode ligar o `role="alert"`. No carregamento inicial o
 * erro permanece num elemento persistente, sem anúncio, e quem anuncia é o
 * `ErrorSummary`.
 */
export function FieldV2({
  id,
  path,
  label,
  description,
  hint,
  error,
  required,
  optional,
  describedBy,
  announceError = false,
  children,
  className = '',
}: {
  id?: string
  path?: string
  label: string
  description?: string
  hint?: string
  error?: string | null
  required?: boolean
  optional?: boolean
  describedBy?: string
  announceError?: boolean
  children: (control: FieldControlProps) => React.ReactNode
  className?: string
}) {
  const generatedID = React.useId()
  const fieldID = id || `esmera-field-${generatedID.replace(/:/g, '')}`
  const descriptionID = description ? `${fieldID}-description` : undefined
  const hintID = hint ? `${fieldID}-hint` : undefined
  const errorID = error ? `${fieldID}-error` : undefined

  // Só entram IDs de elementos que este render realmente produz, mais os
  // externos recebidos. `Set` remove repetições e o `undefined` final evita
  // `aria-describedby=""`.
  const describedByIDs = [...new Set([
    descriptionID,
    hintID,
    errorID,
    ...(describedBy ? describedBy.split(/\s+/) : []),
  ].filter((value): value is string => Boolean(value)))]

  const control: FieldControlProps = {
    id: fieldID,
    'aria-describedby': describedByIDs.length ? describedByIDs.join(' ') : undefined,
    'aria-invalid': error ? true : undefined,
    'aria-errormessage': errorID,
    required: required || undefined,
  }

  return (
    <div
      className={`esmera-field esmera-field-v2${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}
      data-field-path={path}
    >
      <div className="esmera-field-v2__label-row">
        <label className="esmera-field-label" htmlFor={fieldID}>{label}</label>
        {required ? <span className="esmera-field-v2__required">Obrigatório</span> : null}
        {optional ? <span className="esmera-field-v2__optional">Opcional</span> : null}
      </div>
      {description ? <p className="esmera-field-v2__description" id={descriptionID}>{description}</p> : null}
      <div className="esmera-field-v2__control">{children(control)}</div>
      {hint ? <span className="esmera-field-hint" id={hintID}>{hint}</span> : null}
      {error ? (
        <span className="esmera-field-error" id={errorID} role={announceError ? 'alert' : undefined}>{error}</span>
      ) : null}
    </div>
  )
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`esmera-input${className ? ` ${className}` : ''}`} {...props} />
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`esmera-input esmera-textarea${className ? ` ${className}` : ''}`} {...props} />
}

export function SearchInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={`esmera-search${className ? ` ${className}` : ''}`}>
      <svg className="esmera-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <input className="esmera-input" type="search" {...props} />
    </span>
  )
}

export function parseBRLCurrencyInput(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const cents = Number(digits)
  return Number.isSafeInteger(cents) ? cents : null
}

export function formatBRLCurrencyInput(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents) || cents < 0) return ''
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export { Select as SelectPrimitive, Combobox as ComboboxPrimitive }

export const selectClasses = {
  trigger: 'esmera-select-trigger',
  positioner: 'esmera-select-positioner',
  popup: 'esmera-select-popup',
  item: 'esmera-select-item',
} as const

export const comboboxClasses = {
  trigger: 'esmera-combobox-trigger',
  input: 'esmera-combobox-input',
  positioner: 'esmera-combobox-positioner',
  popup: 'esmera-combobox-popup',
  item: 'esmera-combobox-item',
} as const
