'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import type { EsmeraRole } from '../../access/roles'
import { useNavigationFeedback } from '../navigation/NavigationFeedbackProvider'
import { acquisitionChannelOptions as leadSourceOptions } from '../../businessRules/shared/acquisitionChannels'
import { ADMIN_CREATE_EVENT } from '../state/AdminStateProvider'
import { createIntentHref } from './createIntent'
import { ShellIcon } from './ShellIcon'

type CreateAction = {
  label: string
  shortLabel: string
  description: string
  area: 'site' | 'business'
  icon: string
  contexts: string[]
  step?: 1 | 2 | 3 | 4
} & (
  | { kind: 'link'; href: string }
  | { kind: 'popup'; open: () => void }
  | { kind: 'disabled'; disabledReason: string }
)

function canUse(role: EsmeraRole | null, area: CreateAction['area']) {
  if (role === 'admin') return true
  if (area === 'site') return role === 'editor'
  return role === 'commercial'
}

function matchesContext(pathname: string, action: CreateAction) {
  return action.contexts.some((context) => pathname === context || pathname.startsWith(`${context}/`))
}

function LeadQuickCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState<string>(leadSourceOptions[0].value)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="esmera-overlay-backdrop" />
      <Dialog.Viewport className="esmera-dialog-viewport">
        <Dialog.Popup className="esmera-dialog">
          <div className="esmera-overlay-header"><div><Dialog.Title>Novo lead</Dialog.Title><Dialog.Description>Passo 1 do funil — registrar entrada e qualificação.</Dialog.Description></div><Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close></div>
          <form className="esmera-overlay-body esmera-quick-create-form" onSubmit={(event) => {
            event.preventDefault()
            setFeedback(null)
            setBusy(true)
            void fetch('/api/admin-leads', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ action: 'create-lead', name, phone: phone || null, email: email || null, source, notes: notes || null }),
            }).then(async (response) => {
              const result = await response.json() as { error?: string }
              if (!response.ok) throw new Error(result.error || 'Não foi possível registrar o lead.')
              setName(''); setPhone(''); setEmail(''); setNotes('')
              onOpenChange(false)
              onCreated()
            }).catch((error) => setFeedback(error instanceof Error ? error.message : 'Não foi possível registrar o lead.')).finally(() => setBusy(false))
          }}>
            <label><span>Nome</span><input className="esmera-input" required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <div className="esmera-quick-create-form__grid">
              <label><span>Telefone</span><input className="esmera-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+5511999990000" /></label>
              <label><span>E-mail</span><input className="esmera-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label><span>Origem</span><select className="esmera-input" value={source} onChange={(event) => setSource(event.target.value)}>{leadSourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <label><span>Notas (opcional)</span><textarea className="esmera-input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="O que a pessoa está procurando" /></label>
            {feedback ? <p className="esmera-quick-create-feedback" role="alert">{feedback}</p> : null}
            <div className="esmera-actions"><Dialog.Close className="esmera-button" type="button">Cancelar</Dialog.Close><button className="esmera-button esmera-button--primary" type="submit" disabled={busy || !name.trim() || (!phone.trim() && !email.trim())}>{busy ? 'Registrando…' : 'Registrar lead'}</button></div>
          </form>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}

export function GlobalCreateMenu({ role }: { role: EsmeraRole | null }) {
  const router = useRouter()
  const { beginNavigation } = useNavigationFeedback()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [leadDialogOpen, setLeadDialogOpen] = useState(false)

  const actions = useMemo<CreateAction[]>(() => [
    { label: 'Novo lead', shortLabel: 'Lead', description: 'Passo 1 — registrar entrada e qualificação', area: 'business', icon: 'person', contexts: ['/admin/collections/leads', '/admin/leads'], step: 1, kind: 'popup', open: () => setLeadDialogOpen(true) },
    { label: 'Nova oportunidade', shortLabel: 'Oportunidade', description: 'Passo 2 — iniciar negociação comercial', area: 'business', icon: 'receipt', contexts: ['/admin/sales', '/admin/opportunities', '/admin/reports'], step: 2, kind: 'link', href: createIntentHref('/admin/opportunities', 'oportunidade') },
    { label: 'Nova venda', shortLabel: 'Venda', description: 'Vendas nascem de uma oportunidade ganha — feche a negociação no Passo 2', area: 'business', icon: 'receipt', contexts: [], step: 3, kind: 'disabled', disabledReason: 'Vendas nascem de uma oportunidade ganha' },
    { label: 'Novo cliente', shortLabel: 'Cliente', description: 'Cadastrar relacionamento comercial', area: 'business', icon: 'users', contexts: ['/admin/customers', '/admin/privacy'], kind: 'link', href: createIntentHref('/admin/customers', 'cliente') },
    { label: 'Novo produto', shortLabel: 'Produto', description: 'Criar um item do catálogo', area: 'site', icon: 'box', contexts: ['/admin/products', '/admin/categories'], kind: 'link', href: createIntentHref('/admin/products', 'produto') },
  ], [])

  const visible = useMemo(() => {
    const allowed = actions.filter((action) => canUse(role, action.area))
    return [...allowed].sort((left, right) => Number(matchesContext(pathname, right)) - Number(matchesContext(pathname, left)))
  }, [actions, pathname, role])
  const contextual = visible.find((action) => action.kind !== 'disabled' && matchesContext(pathname, action)) || null

  useEffect(() => {
    const openMenu = () => setOpen(true)
    window.addEventListener(ADMIN_CREATE_EVENT, openMenu)
    return () => window.removeEventListener(ADMIN_CREATE_EVENT, openMenu)
  }, [])

  if (!visible.length) return null

  return (
    <>
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
                  className={`esmera-shell-menu-item${action === contextual ? ' is-contextual' : ''}${action.kind === 'disabled' ? ' is-disabled' : ''}`}
                  key={action.label}
                  disabled={action.kind === 'disabled'}
                  onClick={() => {
                    if (action.kind === 'disabled') return
                    setOpen(false)
                    if (action.kind === 'popup') { action.open(); return }
                    beginNavigation(action.href)
                    router.push(action.href)
                  }}
                >
                  <span className="esmera-shell-menu-icon"><ShellIcon name={action.icon} /></span>
                  <span><strong>{action.label}</strong><small>{action.kind === 'disabled' ? action.disabledReason : action.description}</small></span>
                  {action === contextual ? <span className="esmera-shell-menu-context">Contextual</span> : null}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <LeadQuickCreateDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} onCreated={() => router.refresh()} />
    </>
  )
}
