'use client'

import { Popover } from '@base-ui/react/popover'
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

const REPORTS_TIME_ZONE = 'America/Recife'
const DATE_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const dateDisplayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

const dayLabelFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
  const sunday = new Date(2024, 0, 7 + index, 12)
  return weekdayFormatter.format(sunday).replace('.', '').slice(0, 3)
})

export type DateFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

function atNoon(year: number, month: number, day: number) {
  return new Date(year, month, day, 12, 0, 0, 0)
}

function parseDateValue(value: string) {
  const match = DATE_VALUE_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = atNoon(year, month, day)

  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  return date
}

function formatDateValue(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayInReportsTimeZone() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: REPORTS_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date())

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value) - 1
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  return atNoon(year, month, day)
}

function startOfMonth(date: Date) {
  return atNoon(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, amount: number) {
  return atNoon(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function moveByMonths(date: Date, amount: number) {
  const targetMonth = atNoon(date.getFullYear(), date.getMonth() + amount, 1)
  const lastDay = atNoon(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
  return atNoon(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(date.getDate(), lastDay))
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function capitalize(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}

export function DateField({ label, value, onChange, required = false }: DateFieldProps) {
  const generatedID = useId().replace(/:/g, '')
  const labelID = `esmera-datefield-${generatedID}-label`
  const valueID = `esmera-datefield-${generatedID}-value`
  const requiredID = `esmera-datefield-${generatedID}-required`
  const monthLabelID = `esmera-datefield-${generatedID}-month`
  const today = useMemo(() => getTodayInReportsTimeZone(), [])
  const selectedDate = parseDateValue(value)
  const initialDate = selectedDate || today
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(initialDate))
  const [focusedValue, setFocusedValue] = useState(() => formatDateValue(initialDate))
  const dayRefs = useRef(new Map<string, HTMLButtonElement>())

  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(visibleMonth)
    const gridStart = addDays(firstDay, -firstDay.getDay())
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [visibleMonth])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => dayRefs.current.get(focusedValue)?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [focusedValue, open, visibleMonth])

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const nextDate = parseDateValue(value) || today
      setVisibleMonth(startOfMonth(nextDate))
      setFocusedValue(formatDateValue(nextDate))
    }
    setOpen(nextOpen)
  }

  function focusDate(date: Date) {
    setVisibleMonth(startOfMonth(date))
    setFocusedValue(formatDateValue(date))
  }

  function selectDate(date: Date) {
    onChange(formatDateValue(date))
    setOpen(false)
  }

  function moveMonth(amount: number) {
    const focusedDate = parseDateValue(focusedValue) || selectedDate || today
    focusDate(moveByMonths(focusedDate, amount))
  }

  function handleDayKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, date: Date) {
    let nextDate: Date | null = null

    switch (event.key) {
      case 'ArrowLeft':
        nextDate = addDays(date, -1)
        break
      case 'ArrowRight':
        nextDate = addDays(date, 1)
        break
      case 'ArrowUp':
        nextDate = addDays(date, -7)
        break
      case 'ArrowDown':
        nextDate = addDays(date, 7)
        break
      case 'Home':
        nextDate = addDays(date, -date.getDay())
        break
      case 'End':
        nextDate = addDays(date, 6 - date.getDay())
        break
      case 'PageUp':
        nextDate = moveByMonths(date, event.shiftKey ? -12 : -1)
        break
      case 'PageDown':
        nextDate = moveByMonths(date, event.shiftKey ? 12 : 1)
        break
      default:
        return
    }

    event.preventDefault()
    focusDate(nextDate)
  }

  function renderDay(date: Date) {
    const dateValue = formatDateValue(date)
    const isSelected = selectedDate ? sameDay(date, selectedDate) : false
    const isToday = sameDay(date, today)
    const isOutside = date.getMonth() !== visibleMonth.getMonth()
    const className = [
      'esmera-datepicker-day',
      isSelected ? 'is-selected' : '',
      isToday ? 'is-today' : '',
      isOutside ? 'is-outside' : '',
    ].filter(Boolean).join(' ')

    return (
      <button
        key={dateValue}
        ref={(node) => {
          if (node) dayRefs.current.set(dateValue, node)
          else dayRefs.current.delete(dateValue)
        }}
        className={className}
        type="button"
        role="gridcell"
        tabIndex={focusedValue === dateValue ? 0 : -1}
        aria-label={capitalize(dayLabelFormatter.format(date))}
        aria-selected={isSelected}
        aria-current={isToday ? 'date' : undefined}
        onClick={() => selectDate(date)}
        onFocus={() => setFocusedValue(dateValue)}
        onKeyDown={(event) => handleDayKeyDown(event, date)}
      >
        {date.getDate()}
      </button>
    )
  }

  return (
    <div className="esmera-field esmera-datefield">
      <span className="esmera-field-label" id={labelID}>
        {label}
        {required ? <span className="esmera-datefield-required" aria-hidden="true"> *</span> : null}
      </span>
      {required ? <span className="esmera-sr-only" id={requiredID}>Campo obrigatório</span> : null}
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger
          type="button"
          className="esmera-input esmera-datefield-trigger"
          aria-labelledby={`${labelID} ${valueID}`}
          aria-describedby={required ? requiredID : undefined}
        >
          <span id={valueID}>{selectedDate ? dateDisplayFormatter.format(selectedDate) : 'dd/mm/aaaa'}</span>
          <svg className="esmera-datefield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
            <path d="M8 3.5v4M16 3.5v4M3.5 10h17" />
          </svg>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className="esmera-datepicker-positioner" sideOffset={6} align="start">
            <Popover.Popup className="esmera-datepicker-popup">
              <Popover.Title className="esmera-sr-only">Selecionar data para {label}</Popover.Title>
              <div className="esmera-datepicker-header">
                <button className="esmera-datepicker-nav" type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m12.5 4.5-5 5 5 5" /></svg>
                </button>
                <strong id={monthLabelID} aria-live="polite">{capitalize(monthFormatter.format(visibleMonth))}</strong>
                <button className="esmera-datepicker-nav" type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m7.5 4.5 5 5-5 5" /></svg>
                </button>
              </div>
              <div className="esmera-datepicker-weekdays" role="row" aria-hidden="true">
                {weekdayLabels.map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="esmera-datepicker-grid" role="grid" aria-labelledby={monthLabelID}>
                {Array.from({ length: 6 }, (_, rowIndex) => {
                  const row = calendarDays.slice(rowIndex * 7, rowIndex * 7 + 7)
                  return <div className="esmera-datepicker-row" role="row" key={formatDateValue(row[0])}>{row.map(renderDay)}</div>
                })}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
