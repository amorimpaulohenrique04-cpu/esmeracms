'use client'

import React, { useEffect, useRef } from 'react'

import { ShellIcon } from '../shell/ShellIcon'

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

const FUNNEL_STEPS = [
  { step: 1 as const, label: 'Captação', href: '/admin/leads' },
  { step: 2 as const, label: 'Oportunidades', href: '/admin/opportunities' },
  { step: 3 as const, label: 'Vendas', href: '/admin/sales' },
  { step: 4 as const, label: 'Pós-venda', href: '/admin/after-sales' },
]

export function FunnelStepper({ current, className = '' }: { current: 1 | 2 | 3 | 4; className?: string }) {
  const currentRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [current])

  return (
    <nav className={classes('esmera-funnel-stepper', className)} aria-label="Etapas do funil comercial">
      <ol>
        {FUNNEL_STEPS.map((item, index) => {
          const state = item.step === current ? 'is-current' : item.step < current ? 'is-done' : 'is-upcoming'
          return (
            <li
              key={item.step}
              className={classes('esmera-funnel-stepper__step', state)}
              ref={item.step === current ? currentRef : undefined}
            >
              {index > 0 ? <span className="esmera-funnel-stepper__connector" aria-hidden="true" /> : null}
              <a href={item.href} aria-current={item.step === current ? 'step' : undefined}>
                <span className="esmera-funnel-stepper__index" aria-hidden="true">
                  {state === 'is-done' ? <ShellIcon name="check" className="esmera-funnel-stepper__check" /> : item.step}
                </span>
                <span className="esmera-funnel-stepper__label">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
