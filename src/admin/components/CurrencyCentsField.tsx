'use client'

import { FieldDescription, FieldError, FieldLabel, useField } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'
import React from 'react'

function formatCents(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const CurrencyCentsField: NumberFieldClientComponent = ({ field, path: potentiallyStalePath, readOnly }) => {
  const { disabled, path, setValue, showError, value } = useField<number | null>({ potentiallyStalePath })

  return <div className={`field-type number${showError ? ' error' : ''}${readOnly || disabled ? ' read-only' : ''}`}>
    <FieldLabel label={field.label} path={path} required={field.required} />
    <div className="field-type__wrap">
      <FieldError path={path} showError={showError} />
      <div>
        <input
          disabled={readOnly || disabled}
          id={`field-${path.replace(/\./g, '__')}`}
          inputMode="numeric"
          name={path}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '')
            const cents = digits ? Number(digits) : null
            setValue(cents)
          }}
          placeholder="R$ 0,00"
          type="text"
          value={formatCents(value)}
        />
      </div>
      <FieldDescription description={field.admin?.description} path={path} />
    </div>
  </div>
}
