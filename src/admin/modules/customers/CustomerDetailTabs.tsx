'use client'

import React, { useEffect, useRef, useState } from 'react'

import { LoadingState, SectionNav, SectionNavLink } from '../../design-system'
import { customerTabLabels, type CustomerTab } from './types'

const PENDING_SAFETY_MS = 8000

type TabItem = {
  id: CustomerTab
  href: string
}

function isModifiedClick(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

export function CustomerDetailTabs({
  activeTab,
  tabs,
  children,
}: {
  activeTab: CustomerTab
  tabs: TabItem[]
  children: React.ReactNode
}) {
  const [pendingTab, setPendingTab] = useState<CustomerTab | null>(null)
  const safetyTimerRef = useRef<number | null>(null)
  const pending = pendingTab !== null && pendingTab !== activeTab

  useEffect(() => () => {
    if (safetyTimerRef.current !== null) window.clearTimeout(safetyTimerRef.current)
  }, [])

  const beginLocalNavigation = (event: React.MouseEvent<HTMLAnchorElement>, tab: CustomerTab) => {
    if (tab === activeTab || isModifiedClick(event)) return
    setPendingTab(tab)
    if (safetyTimerRef.current !== null) window.clearTimeout(safetyTimerRef.current)
    safetyTimerRef.current = window.setTimeout(() => {
      safetyTimerRef.current = null
      setPendingTab(null)
    }, PENDING_SAFETY_MS)
  }

  return (
    <>
      <SectionNav className="esmera-customer-tabs" label="Seções do cliente">
        {tabs.map((item) => (
          <SectionNavLink
            key={item.id}
            active={activeTab === item.id}
            href={item.href}
            onClick={(event) => beginLocalNavigation(event, item.id)}
          >
            {customerTabLabels[item.id]}
          </SectionNavLink>
        ))}
      </SectionNav>
      <div className="esmera-customer-tab-body" aria-busy={pending || undefined}>
        {pending ? <LoadingState compact label="Carregando seção do cliente…" /> : children}
      </div>
    </>
  )
}
