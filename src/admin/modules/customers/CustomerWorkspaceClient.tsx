'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { Button, DialogPanel, EmptyState, Field, Status } from '../../design-system'
import {
  customerOriginLabels,
  customerStatusLabels,
  interestStatusLabels,
  relationId,
  relationLabel,
  type CategoryRef,
  type ClientInterestSummary,
  type CustomerDetail,
  type CustomerFilters,
  type CustomerListItem,
  type ProductRef,
  type UserRef,
} from './types'

type ApiBody = { error?: string; id?: string | number; targetId?: string | number; candidates?: Array<{ id: string | number; name?: string | null; company?: string | null; phone?: string | null; email?: string | null }> }

async function customerRequest(body: Record<string, unknown>) {
  const response = await fetch('/api/admin-customers', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json() as ApiBody
  if (!response.ok) {
    const error = new Error(payload.error || 'Não foi possível concluir a operação.') as Error & { body?: ApiBody; status?: number }
    error.body = payload
    error.status = response.status
    throw error
  }
  return payload
}

function customerHref(filters: CustomerFilters, id: string | number) {
  const params = new URLSearchParams()
  params.set('customer', String(id))
  params.set('tab', 'overview')
  if (filters.q) params.set('q', filters.q)
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.origin) params.set('origin', filters.origin)
  if (filters.owner) params.set('owner', filters.owner)
  return `/admin/customers?${params.toString()}`
}

export function CustomerCreateDialog() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<ApiBody['candidates']>([])
  const [draft, setDraft] = useState({ name: '', company: '', phone: '', email: '', origin: 'whatsapp' })

  async function submit(force = false) {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const body = await customerRequest({ action: 'create', force, data: draft })
      if (body.id !== undefined) router.push(`/admin/customers?customer=${body.id}&tab=overview`)
    } catch (error) {
      const typed = error as Error & { body?: ApiBody; status?: number }
      if (typed.status === 409 && typed.body?.candidates?.length) setCandidates(typed.body.candidates)
      setFeedback(typed.message)
    } finally {
      setBusy(false)
    }
  }

  return <DialogPanel trigger="Novo cliente" title="Novo cliente" description="O CMS normaliza telefone e e-mail e procura possíveis duplicados antes da criação.">
    <form className="esmera-customer-dialog-form" onSubmit={(event) => { event.preventDefault(); void submit(false) }}>
      <Field label="Nome"><input className="esmera-input" required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
      <Field label="Empresa"><input className="esmera-input" value={draft.company} onChange={(event) => setDraft({ ...draft, company: event.target.value })} /></Field>
      <Field label="Telefone" hint="Pode ser digitado com máscara; será persistido em E.164."><input className="esmera-input" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
      <Field label="E-mail"><input className="esmera-input" type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
      <Field label="Origem"><select className="esmera-input" value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })}>{Object.entries(customerOriginLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      {feedback ? <div className="esmera-products-feedback" role="status">{feedback}</div> : null}
      {candidates?.length ? <div className="esmera-customer-duplicates"><strong>Possíveis registros existentes</strong>{candidates.map((candidate) => <Link key={String(candidate.id)} href={`/admin/customers?customer=${candidate.id}&tab=overview`}>{candidate.name || 'Cliente'}{candidate.company ? ` · ${candidate.company}` : ''}<small>{candidate.phone || candidate.email || 'Sem contato'}</small></Link>)}<Button type="button" disabled={busy} onClick={() => void submit(true)}>Criar mesmo assim</Button></div> : null}
      <div className="esmera-customer-dialog-actions"><Button tone="primary" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Verificar e criar'}</Button></div>
    </form>
  </DialogPanel>
}

export function CustomerMasterList({ customers, filters, selectedId, users }: { customers: CustomerListItem[]; filters: CustomerFilters; selectedId?: string; users: UserRef[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const node = listRef.current
    if (!node) return
    const key = 'esmera-customers-scroll'
    const stored = Number(sessionStorage.getItem(key) || 0)
    if (stored) node.scrollTop = stored
    const persist = () => sessionStorage.setItem(key, String(node.scrollTop))
    node.addEventListener('scroll', persist, { passive: true })
    return () => { persist(); node.removeEventListener('scroll', persist) }
  }, [])

  return <section className="esmera-customer-master" aria-label="Lista de clientes">
    <form className="esmera-customer-filters" action="/admin/customers" method="get">
      <label className="esmera-customer-search"><span className="esmera-sr-only">Buscar clientes</span><input className="esmera-input" type="search" name="q" defaultValue={filters.q} placeholder="Nome, contato, empresa, produto ou venda" /></label>
      <select className="esmera-input" name="status" defaultValue={filters.status} aria-label="Status do cliente"><option value="all">Todos os status</option>{Object.entries(customerStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select className="esmera-input" name="origin" defaultValue={filters.origin} aria-label="Origem"><option value="">Todas as origens</option>{Object.entries(customerOriginLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select className="esmera-input" name="owner" defaultValue={filters.owner} aria-label="Responsável"><option value="">Todos os responsáveis</option>{users.map((user) => <option key={String(user.id)} value={String(user.id)}>{user.name || user.email || user.id}</option>)}</select>
      <Button type="submit">Aplicar</Button>
      {(filters.q || filters.status !== 'all' || filters.origin || filters.owner) ? <Link className="esmera-button esmera-button--quiet" href="/admin/customers">Limpar</Link> : null}
    </form>

    {!customers.length ? <EmptyState title="Nenhum cliente encontrado" copy="Ajuste os filtros ou crie um novo cliente." /> : <ol ref={listRef} className="esmera-customer-list">
      {customers.map((customer) => <li key={String(customer.id)} className={`esmera-customer-row${String(customer.id) === String(selectedId || '') ? ' is-selected' : ''}`}>
        <Link href={customerHref(filters, customer.id)} scroll={false}>
          <span className="esmera-customer-row__head"><strong>{customer.name || 'Cliente sem nome'}</strong><Status tone={customer.status === 'active' ? 'success' : customer.status === 'follow_up' ? 'warning' : 'neutral'}>{customerStatusLabels[customer.status || ''] || '—'}</Status></span>
          <span className="esmera-customer-row__meta">{customer.company || customer.phone || customer.email || 'Sem identificação complementar'}</span>
          <span className="esmera-customer-row__signals"><span>{customerOriginLabels[customer.origin || ''] || 'Origem não informada'}</span><span>{customer.purchaseCount} compra{customer.purchaseCount === 1 ? '' : 's'}</span></span>
        </Link>
      </li>)}
    </ol>}
    <footer className="esmera-customer-master__footer">{customers.length} cliente{customers.length === 1 ? '' : 's'} nesta consulta</footer>
  </section>
}

export function CustomerProfileEditor({ customer, users, categories }: { customer: CustomerDetail; users: UserRef[]; categories: CategoryRef[] }) {
  const router = useRouter()
  const profile = customer.interestProfile || {}
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: customer.name || '', company: customer.company || '', phone: customer.phone || '', email: customer.email || '', city: customer.city || '', state: customer.state || '',
    status: customer.status || 'active', origin: customer.origin || '', owner: String(relationId(customer.owner) ?? ''),
    categories: (profile.categories || []).map(relationId).filter((id): id is string | number => id !== null).map(String),
    materials: (profile.materials || []).map((item) => item.value || '').filter(Boolean).join(', '),
    investmentMin: profile.investmentMinCents ? String(profile.investmentMinCents / 100) : '', investmentMax: profile.investmentMaxCents ? String(profile.investmentMaxCents / 100) : '',
    tags: (customer.tags || []).map((item) => item.value || '').filter(Boolean).join(', '), relationshipNotes: customer.relationshipNotes || '',
  })

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true); setFeedback(null)
    try {
      await customerRequest({ action: 'save-profile', id: customer.id, data: {
        name: form.name, company: form.company, phone: form.phone, email: form.email, city: form.city, state: form.state,
        status: form.status, origin: form.origin || null, owner: form.owner || null, tags: form.tags.split(',').map((value) => value.trim()).filter(Boolean), relationshipNotes: form.relationshipNotes,
        interestProfile: {
          categories: form.categories,
          materials: form.materials.split(',').map((value) => value.trim()).filter(Boolean),
          investmentMinCents: form.investmentMin ? Math.round(Number(form.investmentMin.replace(',', '.')) * 100) : null,
          investmentMaxCents: form.investmentMax ? Math.round(Number(form.investmentMax.replace(',', '.')) * 100) : null,
        },
      } })
      setFeedback('Perfil atualizado.'); router.refresh()
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar.') }
    finally { setBusy(false) }
  }

  return <form className="esmera-customer-profile-form" onSubmit={save}>
    <Field label="Nome"><input className="esmera-input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
    <Field label="Empresa"><input className="esmera-input" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></Field>
    <Field label="Telefone"><input className="esmera-input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
    <Field label="E-mail"><input className="esmera-input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
    <Field label="Cidade"><input className="esmera-input" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></Field>
    <Field label="Estado"><input className="esmera-input" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></Field>
    <Field label="Status do cliente" hint="Independente da etapa de uma oportunidade."><select className="esmera-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CustomerDetail['status'] })}>{Object.entries(customerStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Origem"><select className="esmera-input" value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })}><option value="">Não informada</option>{Object.entries(customerOriginLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Responsável"><select className="esmera-input" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })}><option value="">Sem responsável</option>{users.map((user) => <option key={String(user.id)} value={String(user.id)}>{user.name || user.email || user.id}</option>)}</select></Field>
    <Field label="Categorias de interesse" className="esmera-customer-field--wide"><select className="esmera-input esmera-customer-multiselect" multiple value={form.categories} onChange={(event) => setForm({ ...form, categories: Array.from(event.target.selectedOptions).map((option) => option.value) })}>{categories.map((category) => <option key={String(category.id)} value={String(category.id)}>{category.title || category.slug || category.id}</option>)}</select></Field>
    <Field label="Materiais" hint="Separe por vírgulas."><input className="esmera-input" value={form.materials} onChange={(event) => setForm({ ...form, materials: event.target.value })} /></Field>
    <Field label="Tags" hint="Separe por vírgulas."><input className="esmera-input" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></Field>
    <Field label="Investimento mínimo (R$)"><input className="esmera-input" inputMode="decimal" value={form.investmentMin} onChange={(event) => setForm({ ...form, investmentMin: event.target.value })} /></Field>
    <Field label="Investimento máximo (R$)"><input className="esmera-input" inputMode="decimal" value={form.investmentMax} onChange={(event) => setForm({ ...form, investmentMax: event.target.value })} /></Field>
    <Field label="Notas do relacionamento" className="esmera-customer-field--wide"><textarea className="esmera-input esmera-customer-textarea" rows={4} value={form.relationshipNotes} onChange={(event) => setForm({ ...form, relationshipNotes: event.target.value })} /></Field>
    <div className="esmera-customer-form-actions"><Button tone="primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar perfil'}</Button>{feedback ? <span role="status">{feedback}</span> : null}</div>
  </form>
}

export function CustomerInterestComposer({ customerId, products, interests }: { customerId: string | number; products: ProductRef[]; interests: ClientInterestSummary[] }) {
  const router = useRouter()
  const [productId, setProductId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  async function add(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setFeedback(null)
    try { await customerRequest({ action: 'add-interest', id: customerId, productId, note }); setProductId(''); setNote(''); setFeedback('Interesse adicionado.'); router.refresh() }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível adicionar.') }
    finally { setBusy(false) }
  }

  async function changeStatus(interestId: string | number, status: string) {
    setBusy(true); setFeedback(null)
    try { await customerRequest({ action: 'set-interest-status', interestId, status }); setFeedback('Status atualizado.'); router.refresh() }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível atualizar.') }
    finally { setBusy(false) }
  }

  return <div className="esmera-customer-interests">
    <form className="esmera-customer-interest-add" onSubmit={add}>
      <Field label="Adicionar interesse"><select className="esmera-input" required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione um produto</option>{products.map((product) => <option key={String(product.id)} value={String(product.id)}>{product.title || product.code || product.id}</option>)}</select></Field>
      <Field label="Contexto"><input className="esmera-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Motivo, ambiente ou ocasião" /></Field>
      <Button tone="primary" type="submit" disabled={busy || !productId}>Adicionar interesse</Button>
    </form>
    {feedback ? <div className="esmera-products-feedback" role="status">{feedback}</div> : null}
    {!interests.length ? <EmptyState title="Nenhum interesse explícito" copy="Associe produtos somente quando houver interesse real registrado." /> : <ul className="esmera-customer-interest-list">{interests.map((interest) => <li key={String(interest.id)}><div><strong>{relationLabel(interest.product as never, 'Produto indisponível')}</strong><span>{interest.notes || 'Sem contexto adicional'} · responsável {relationLabel(interest.owner as never, 'não definido')}</span></div><select className="esmera-input" aria-label={`Status do interesse em ${relationLabel(interest.product as never, 'produto')}`} disabled={busy} value={interest.status || 'active'} onChange={(event) => void changeStatus(interest.id, event.target.value)}>{Object.entries(interestStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></li>)}</ul>}
  </div>
}

export function CustomerNoteComposer({ customerId }: { customerId: string | number }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  return <form className="esmera-customer-note-form" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setFeedback(null)
    try { await customerRequest({ action: 'add-note', id: customerId, note }); setNote(''); setFeedback('Nota registrada na timeline.'); router.refresh() }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível registrar a nota.') }
    finally { setBusy(false) }
  }}><Field label="Nova nota"><textarea className="esmera-input esmera-customer-textarea" required rows={4} value={note} onChange={(event) => setNote(event.target.value)} /></Field><div className="esmera-customer-form-actions"><Button tone="primary" type="submit" disabled={busy}>{busy ? 'Registrando…' : 'Registrar nota'}</Button>{feedback ? <span role="status">{feedback}</span> : null}</div></form>
}

export function CustomerMergeDialog({ source, customers }: { source: CustomerDetail; customers: CustomerListItem[] }) {
  const router = useRouter()
  const [targetId, setTargetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const available = customers.filter((customer) => String(customer.id) !== String(source.id) && customer.status !== 'archived')
  return <DialogPanel trigger="Mesclar cliente" title="Mesclar clientes" description="Operação administrativa: transfere relações, arquiva o duplicado e registra auditoria.">
    <div className="esmera-customer-merge"><p>Registro de origem: <strong>{source.name}</strong></p><Field label="Registro principal"><select className="esmera-input" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Selecione o destino</option>{available.map((customer) => <option key={String(customer.id)} value={String(customer.id)}>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}</select></Field>{feedback ? <div className="esmera-products-feedback" role="status">{feedback}</div> : null}<Button tone="danger" disabled={busy || !targetId} onClick={async () => { setBusy(true); setFeedback(null); try { const result = await customerRequest({ action: 'merge', sourceId: source.id, targetId }); router.push(`/admin/customers?customer=${result.targetId || targetId}&tab=history`) } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível mesclar.') } finally { setBusy(false) } }}>{busy ? 'Mesclando…' : 'Confirmar mesclagem'}</Button></div>
  </DialogPanel>
}
