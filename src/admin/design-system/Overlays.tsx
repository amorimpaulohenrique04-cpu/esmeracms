'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Drawer } from '@base-ui/react/drawer'
import { Menu } from '@base-ui/react/menu'
import { Popover } from '@base-ui/react/popover'
import { Tooltip } from '@base-ui/react/tooltip'
import React, { useId, useRef, useState } from 'react'

function useOverlayContext() {
  const [open, setOpen] = useState(false)
  const scroll = useRef({ x: 0, y: 0 })

  const onOpenChange = (nextOpen: boolean) => {
    if (nextOpen) scroll.current = { x: window.scrollX, y: window.scrollY }
    setOpen(nextOpen)
    if (!nextOpen) {
      window.requestAnimationFrame(() => window.scrollTo(scroll.current.x, scroll.current.y))
    }
  }

  return { open, onOpenChange }
}

export function DialogPanel({ trigger, triggerClassName = '', title, description, children }: { trigger: React.ReactNode; triggerClassName?: string; title: string; description?: string; children: React.ReactNode }) {
  const context = useOverlayContext()
  const contextKey = `dialog-${useId()}`
  return (
    <Dialog.Root open={context.open} onOpenChange={context.onOpenChange}>
      <Dialog.Trigger className={`esmera-button${triggerClassName ? ` ${triggerClassName}` : ''}`} data-esmera-context-key={contextKey}>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="esmera-overlay-backdrop" />
        <Dialog.Viewport className="esmera-dialog-viewport">
          <Dialog.Popup className="esmera-dialog">
            <div className="esmera-overlay-header">
              <div>
                <Dialog.Title>{title}</Dialog.Title>
                {description ? <Dialog.Description>{description}</Dialog.Description> : null}
              </div>
              <Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close>
            </div>
            <div className="esmera-overlay-body">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function DrawerPanel({ trigger, title, description, children }: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  const context = useOverlayContext()
  const contextKey = `drawer-${useId()}`
  return (
    <Drawer.Root open={context.open} onOpenChange={context.onOpenChange} swipeDirection="right">
      <Drawer.Trigger className="esmera-button" data-esmera-context-key={contextKey}>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className="esmera-overlay-backdrop" />
        <Drawer.Viewport className="esmera-drawer-viewport">
          <Drawer.Popup className="esmera-drawer">
            <Drawer.Content>
              <div className="esmera-overlay-header">
                <div>
                  <Drawer.Title>{title}</Drawer.Title>
                  {description ? <Drawer.Description>{description}</Drawer.Description> : null}
                </div>
                <Drawer.Close className="esmera-icon-button" aria-label="Fechar">×</Drawer.Close>
              </div>
              <div className="esmera-overlay-body">{children}</div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export type MenuAction = { label: string; onClick?: () => void; disabled?: boolean }

export function MenuButton({ label, items }: { label: React.ReactNode; items: MenuAction[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="esmera-button esmera-menu-trigger">{label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="esmera-menu-positioner" sideOffset={6} align="end">
          <Menu.Popup className="esmera-menu-popup">
            {items.map((item) => (
              <Menu.Item className="esmera-menu-item" key={item.label} disabled={item.disabled} onClick={item.onClick}>{item.label}</Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function PopoverPanel({ trigger, title, children }: { trigger: React.ReactNode; title?: string; children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="esmera-button">{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="esmera-popover-positioner" sideOffset={6} align="end">
          <Popover.Popup className="esmera-popover-popup">
            {title ? <Popover.Title>{title}</Popover.Title> : null}
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function TooltipHint({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger render={<span />}>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner className="esmera-tooltip-positioner" sideOffset={8}>
            <Tooltip.Popup className="esmera-tooltip-popup">{content}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
