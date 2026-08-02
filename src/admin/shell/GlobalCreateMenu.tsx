'use client'

import { Menu } from '@base-ui/react/menu'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import type { EsmeraRole } from '../../access/roles'
import { ADMIN_CREATE_EVENT } from '../state/AdminStateProvider'
import { ShellIcon } from './ShellIcon'

type CreateAction = {
  label: string
  shortLabel: string
  description: string
  href: string
  area: 'site' | 'business'
  icon: string
  contexts: string[]
}

const actions: CreateAction[] = [
  { label: 'Novo produto', shortLabel: 'Produto', description: 'Criar um item do catálogo', href: '/admin/collections/products/create', area: 'site', icon: 'box', contexts: ['/admin/products', '/admin/categories'] },
  { label: 'Novo cliente', shortLabel: 'Cliente', description: 'Cadastrar relacionamento comercial', href: '/admin/collections/customers/create', area: 'business', icon: 'users', contexts: ['/admin/customers', '/admin/privacy'] },
  { label: 'Novo lead', shortLabel: 'Lead', description: 'Registrar entrada e qualificação', href: '/admin/collections/leads/create', area: 'business', icon: 'person', contexts: ['/admin/collections/leads'] },
  { label: 'Nova oportunidade', shortLabel: 'Oportunidade', description: 'Iniciar negociação comercial', href: '/admin/collections/opportunities/create', area: 'business', icon: 'receipt', contexts: ['/admin/sales', '/admin/reports'] },
]

function canUse(role: EsmeraRole | null, area: CreateAction['area']) {
  if (role === 'admin') return true
  if (area === 'site') return role === 'editor'
  return role === 'commercial'
}

function matchesContext(pathname: string, action: CreateAction) {
  return action.contexts.some((context) => pathname === context || pathname.startsWith(`${context}/`))
}

export function GlobalCreateMenu({ role }: { role: EsmeraRole | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const visible = useMemo(() => {
    const allowed = actions.filter((action) => canUse(role, action.area))
    return [...allowed].sort((left, right) => Number(matchesContext(pathname, right)) - Number(matchesContext(pathname, left)))
  }, [pathname, role])
  const contextual = visible.find((action) => matchesContext(pathname, action)) || null

  useEffect(() => {
    const openMenu = () => setOpen(true)
    window.addEventListener(ADMIN_CREATE_EVENT, openMenu)
    return () => window.removeEventListener(ADMIN_CREATE_EVENT, openMenu)
  }, [])

  if (!visible.length) return null

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger className="esmera-shell-create" data-testid="esmera-global-create" aria-label={contextual ? `Criar ${contextual.shortLabel.toLocaleLowerCase('pt-BR')} ou outro registro` : 'Criar novo registro'}>
        <ShellIcon name="plus" />
        <span>Novo{contextual ? <em>{contextual.shortLabel}</em> : null}</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="esmera-shell-menu-positioner" sideOffset={7} align="end">
          <Menu.Popup className="esmera-shell-menu-popup">
            <div className="esmera-shell-menu-label">Criar</div>
            {visible.map((action) => (
              <Menu.Item
                className={`esmera-shell-menu-item${action === contextual ? ' is-contextual' : ''}`}
                key={action.href}
                onClick={() => {
                  setOpen(false)
                  router.push(action.href)
                }}
              >
                <span className="esmera-shell-menu-icon"><ShellIcon name={action.icon} /></span>
                <span><strong>{action.label}</strong><small>{action.description}</small></span>
                {action === contextual ? <span className="esmera-shell-menu-context">Contextual</span> : null}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
