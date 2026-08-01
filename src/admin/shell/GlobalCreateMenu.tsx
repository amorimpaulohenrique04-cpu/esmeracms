'use client'

import { Menu } from '@base-ui/react/menu'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { EsmeraRole } from '../../access/roles'
import { ADMIN_CREATE_EVENT } from '../state/AdminStateProvider'
import { ShellIcon } from './ShellIcon'

type CreateAction = {
  label: string
  description: string
  href: string
  area: 'site' | 'business'
  icon: string
}

const actions: CreateAction[] = [
  { label: 'Novo produto', description: 'Criar um item do catálogo', href: '/admin/collections/products/create', area: 'site', icon: 'box' },
  { label: 'Novo cliente', description: 'Cadastrar relacionamento comercial', href: '/admin/collections/customers/create', area: 'business', icon: 'users' },
  { label: 'Novo lead', description: 'Registrar entrada e qualificação', href: '/admin/collections/leads/create', area: 'business', icon: 'person' },
  { label: 'Nova oportunidade', description: 'Iniciar negociação comercial', href: '/admin/collections/opportunities/create', area: 'business', icon: 'receipt' },
]

function canUse(role: EsmeraRole | null, area: CreateAction['area']) {
  if (role === 'admin') return true
  if (area === 'site') return role === 'editor'
  return role === 'commercial'
}

export function GlobalCreateMenu({ role }: { role: EsmeraRole | null }) {
  const router = useRouter()
  const visible = actions.filter((action) => canUse(role, action.area))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openMenu = () => setOpen(true)
    window.addEventListener(ADMIN_CREATE_EVENT, openMenu)
    return () => window.removeEventListener(ADMIN_CREATE_EVENT, openMenu)
  }, [])

  if (!visible.length) return null

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger className="esmera-shell-create" data-testid="esmera-global-create" aria-label="Criar novo registro">
        <ShellIcon name="plus" />
        <span>Novo</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="esmera-shell-menu-positioner" sideOffset={7} align="end">
          <Menu.Popup className="esmera-shell-menu-popup">
            <div className="esmera-shell-menu-label">Criar</div>
            {visible.map((action) => (
              <Menu.Item
                className="esmera-shell-menu-item"
                key={action.href}
                onClick={() => {
                  setOpen(false)
                  router.push(action.href)
                }}
              >
                <span className="esmera-shell-menu-icon"><ShellIcon name={action.icon} /></span>
                <span><strong>{action.label}</strong><small>{action.description}</small></span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
