'use client'

import React from 'react'

const LEGACY_DETAILS_SELECTOR = 'details.esmera-report-filter-advanced[open]'

export function DismissibleDetailsProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return

      document.querySelectorAll<HTMLDetailsElement>(LEGACY_DETAILS_SELECTOR).forEach((details) => {
        if (!details.contains(target)) details.open = false
      })
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return <>{children}</>
}
