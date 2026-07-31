'use client'

import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'
import React from 'react'

export function Field({ label, hint, children, className = '' }: { label?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`esmera-field${className ? ` ${className}` : ''}`}>
      {label ? <span className="esmera-field-label">{label}</span> : null}
      {children}
      {hint ? <span className="esmera-field-hint">{hint}</span> : null}
    </label>
  )
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`esmera-input${className ? ` ${className}` : ''}`} {...props} />
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
