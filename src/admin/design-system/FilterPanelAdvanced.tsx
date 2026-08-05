'use client'

import React from 'react'

export function FilterPanelAdvanced({
  children,
  label,
  active = false,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
}) {
  const detailsRef = React.useRef<HTMLDetailsElement>(null)

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current
      const target = event.target

      if (!details?.open || !(target instanceof Node) || details.contains(target)) return
      details.open = false
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <details ref={detailsRef} className="esmera-filter-panel__advanced" open={active || undefined}>
      <summary>{label}{active ? ' · ativos' : ''}</summary>
      <div className="esmera-filter-panel__advanced-panel">{children}</div>
    </details>
  )
}
