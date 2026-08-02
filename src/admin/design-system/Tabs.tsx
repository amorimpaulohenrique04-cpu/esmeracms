'use client'

import { Tabs } from '@base-ui/react/tabs'
import React from 'react'

export type TabItem = { value: string; label: string; content: React.ReactNode; disabled?: boolean }

export function TabsControl({ items, defaultValue, value, onValueChange, ariaLabel }: { items: TabItem[]; defaultValue?: string; value?: string; onValueChange?: (value: string) => void; ariaLabel?: string }) {
  return (
    <Tabs.Root defaultValue={defaultValue || items[0]?.value} value={value} onValueChange={onValueChange}>
      <Tabs.List className="esmera-tabs-list" aria-label={ariaLabel}>
        {items.map((item) => <Tabs.Tab className="esmera-tab" key={item.value} value={item.value} disabled={item.disabled}>{item.label}</Tabs.Tab>)}
      </Tabs.List>
      {items.map((item) => <Tabs.Panel className="esmera-tab-panel" key={item.value} value={item.value}>{item.content}</Tabs.Panel>)}
    </Tabs.Root>
  )
}
