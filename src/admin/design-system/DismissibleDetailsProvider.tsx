'use client'

import React from 'react'

const LEGACY_DETAILS_SELECTOR = 'details.esmera-report-filter-advanced'

function closeDetails(details: HTMLDetailsElement) {
  if (details.open) details.open = false
}

function closeLegacyDetailsWithin(root: ParentNode) {
  if (root instanceof HTMLDetailsElement && root.matches(LEGACY_DETAILS_SELECTOR)) {
    closeDetails(root)
  }
  root.querySelectorAll<HTMLDetailsElement>(LEGACY_DETAILS_SELECTOR).forEach(closeDetails)
}

export function DismissibleDetailsProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    closeLegacyDetailsWithin(document)

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) closeLegacyDetailsWithin(node)
        })
      })
    })

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return

      document.querySelectorAll<HTMLDetailsElement>(`${LEGACY_DETAILS_SELECTOR}[open]`).forEach((details) => {
        if (!details.contains(target)) closeDetails(details)
      })
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return
      form.querySelectorAll<HTMLDetailsElement>(LEGACY_DETAILS_SELECTOR).forEach(closeDetails)
    }

    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('submit', handleSubmit, { capture: true })

    return () => {
      observer.disconnect()
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('submit', handleSubmit, { capture: true })
    }
  }, [])

  return <>{children}</>
}
