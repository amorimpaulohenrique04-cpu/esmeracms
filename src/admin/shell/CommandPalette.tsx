'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useRouter } from 'next/navigation'
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import { expectAdminResponse } from '../state/asyncState'
import { recentAdminItems, savedAdminViews } from '../state/continuity'
import { ShellIcon } from './ShellIcon'

export type CommandSelection = {
  kind: string
  id: string | number
  label?: string
  href?: string
}

export type CommandResult = {
  id: string
  group: string
  label: string
  meta?: string
  href: string
  icon?: string
  local?: boolean
}

type SearchResponse = {
  results?: CommandResult[]
  error?: string
}

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error'

function technicalHref(selection: CommandSelection) {
  const aliases: Record<string, string> = {
    product: 'products',
    products: 'products',
    category: 'categories',
    categories: 'categories',
    customer: 'customers',
    customers: 'customers',
    sale: 'sales',
    sales: 'sales',
    opportunity: 'opportunities',
    opportunities: 'opportunities',
    lead: 'leads',
    leads: 'leads',
    task: 'tasks',
    tasks: 'tasks',
    shipment: 'shipments',
    shipments: 'shipments',
    occurrence: 'occurrences',
    occurrences: 'occurrences',
    'after-sale': 'after-sales',
    'after-sales': 'after-sales',
  }
  const collection = aliases[selection.kind]
  return collection ? `/admin/collections/${collection}/${selection.id}` : null
}

function localCommands(selection: CommandSelection | null, currentHref: string): CommandResult[] {
  const results: CommandResult[] = []

  if (selection?.href) {
    results.push({
      id: `selection-open:${selection.kind}:${selection.id}`,
      group: 'Seleção atual',
      label: `Abrir ${selection.label || selection.kind}`,
      meta: 'Continuar no registro em foco',
      href: selection.href,
      icon: 'arrow',
      local: true,
    })
    const technical = technicalHref(selection)
    if (technical && technical !== selection.href) {
      results.push({
        id: `selection-edit:${selection.kind}:${selection.id}`,
        group: 'Seleção atual',
        label: 'Editar no Admin técnico',
        meta: selection.label || `${selection.kind} ${selection.id}`,
        href: technical,
        icon: 'database',
        local: true,
      })
    }
  }

  for (const item of recentAdminItems()) {
    if (item.href === currentHref) continue
    results.push({
      id: `recent:${item.href}`,
      group: 'Recentes',
      label: item.label,
      meta: item.meta || 'Aberto recentemente neste navegador',
      href: item.href,
      icon: 'clock',
      local: true,
    })
  }

  for (const view of savedAdminViews()) {
    results.push({
      id: `saved:${view.id}`,
      group: 'Filtros salvos',
      label: view.label,
      meta: view.kind === 'reports' ? 'Recorte compartilhável de Relatórios' : 'Workspace salvo',
      href: view.href,
      icon: view.kind === 'reports' ? 'chart' : 'filter',
      local: true,
    })
  }

  results.push(
    { id: 'report-evolution', group: 'Seções de Relatórios', label: 'Evolução comercial', meta: 'Abrir movimento no período', href: '/admin/reports#evolution', icon: 'chart', local: true },
    { id: 'report-funnel', group: 'Seções de Relatórios', label: 'Funil comercial', meta: 'Abrir progressão por etapa', href: '/admin/reports#funnel', icon: 'chart', local: true },
    { id: 'report-catalog', group: 'Seções de Relatórios', label: 'Performance do catálogo', meta: 'Produtos e categorias', href: '/admin/reports#catalog', icon: 'box', local: true },
    { id: 'report-team', group: 'Seções de Relatórios', label: 'Performance da equipe', meta: 'Responsáveis e resultados', href: '/admin/reports#team', icon: 'users', local: true },
  )

  return results
}

function uniqueResults(results: CommandResult[]) {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = `${result.href}|${result.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function CommandPalette({
  open,
  onOpenChange,
  selection,
  currentHref,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selection: CommandSelection | null
  currentHref: string
}) {
  const router = useRouter()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [serverResults, setServerResults] = useState<CommandResult[]>([])
  const [localRevision, setLocalRevision] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setLocalRevision((revision) => revision + 1)

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/admin-search?q=${encodeURIComponent(query.trim())}&context=${encodeURIComponent(currentHref)}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const body = await expectAdminResponse<SearchResponse>(response, 'Não foi possível pesquisar.')
        setServerResults(body.results || [])
        setActiveIndex(0)
      } catch (cause) {
        if (controller.signal.aborted) return
        setServerResults([])
        setError(cause instanceof Error ? cause.message : 'Não foi possível pesquisar.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, query.trim() ? 140 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [currentHref, open, query])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const local = useMemo(() => localCommands(selection, currentHref), [currentHref, localRevision, selection])
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR')
    const filteredLocal = needle
      ? local.filter((item) => `${item.label} ${item.meta || ''} ${item.group}`.toLocaleLowerCase('pt-BR').includes(needle))
      : local
    return uniqueResults([...filteredLocal, ...serverResults]).slice(0, 40)
  }, [local, query, serverResults])

  const grouped = useMemo(() => {
    const order = ['Seleção atual', 'Recentes', 'Filtros salvos', 'Ações contextuais', 'Ações', 'Seções de Relatórios', 'Produtos', 'Categorias', 'Clientes', 'Oportunidades', 'Leads', 'Vendas']
    const groups = new Map<string, CommandResult[]>()
    for (const result of results) {
      const current = groups.get(result.group) || []
      current.push(result)
      groups.set(result.group, current)
    }
    return Array.from(groups.entries()).sort(([left], [right]) => {
      const leftIndex = order.indexOf(left)
      const rightIndex = order.indexOf(right)
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
    })
  }, [results])

  const searchState: SearchState = error
    ? 'error'
    : loading && !results.length
      ? 'loading'
      : results.length
        ? 'results'
        : query.trim()
          ? 'empty'
          : 'idle'

  const stateLabel = loading && results.length
    ? `Atualizando · ${results.length} resultado${results.length === 1 ? '' : 's'}`
    : searchState === 'loading'
      ? 'Pesquisando registros…'
      : searchState === 'results'
        ? `${results.length} resultado${results.length === 1 ? '' : 's'}`
        : searchState === 'empty'
          ? 'Nenhum resultado'
          : searchState === 'error'
            ? 'Busca indisponível'
            : 'Atalhos e busca global'

  const reset = () => {
    setQuery('')
    setServerResults([])
    setLoading(false)
    setError(null)
    setActiveIndex(0)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  const goTo = (result: CommandResult | undefined) => {
    if (!result) return
    handleOpenChange(false)
    router.push(result.href)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => results.length ? (index + 1) % results.length : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => results.length ? (index - 1 + results.length) % results.length : 0)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      goTo(results[activeIndex])
    }
  }

  let flatIndex = -1

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="esmera-command-backdrop" />
        <Dialog.Viewport className="esmera-command-viewport">
          <Dialog.Popup className="esmera-command" data-testid="esmera-command-palette" data-search-state={searchState} aria-busy={loading || undefined}>
            <Dialog.Title className="esmera-command-sr-title">Buscar no Esméra CMS</Dialog.Title>
            <div className="esmera-command-search">
              <ShellIcon name="search" />
              <label className="esmera-command-label" htmlFor={inputId}>Buscar no CMS</label>
              <input
                ref={inputRef}
                id={inputId}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Registro, ação, filtro salvo ou seção…"
                autoComplete="off"
                aria-controls={`${inputId}-results`}
                aria-activedescendant={results[activeIndex] ? `${inputId}-result-${activeIndex}` : undefined}
              />
              <span className={`esmera-command-indicator is-${searchState}`} role="status" aria-live="polite">{stateLabel}</span>
              <Dialog.Close className="esmera-command-close" aria-label="Fechar busca">Esc</Dialog.Close>
            </div>

            <div className="esmera-command-results" id={`${inputId}-results`} role="listbox" aria-label="Resultados da busca">
              {loading && !results.length ? <div className="esmera-command-state is-loading"><span aria-hidden="true" />Pesquisando registros e ações…</div> : null}
              {error ? <div className="esmera-command-state esmera-command-state--error" role="alert"><strong>Não foi possível pesquisar</strong><span>{error}</span></div> : null}
              {!loading && !error && !results.length && query.trim() ? <div className="esmera-command-state"><strong>Nenhum resultado</strong><span>Tente nome, código, cliente, venda, filtro salvo ou uma ação diferente.</span></div> : null}
              {!loading && !error && !results.length && !query.trim() ? <div className="esmera-command-state"><strong>Busca global</strong><span>Digite para localizar registros ou use os atalhos, recentes e recortes salvos.</span></div> : null}
              {grouped.map(([group, items]) => (
                <section className="esmera-command-group" key={group} aria-label={group}>
                  <div className="esmera-command-group-label">{group}</div>
                  {items.map((result) => {
                    flatIndex += 1
                    const index = flatIndex
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={activeIndex === index}
                        className={`esmera-command-result${activeIndex === index ? ' is-active' : ''}${result.local ? ' is-local' : ''}`}
                        id={`${inputId}-result-${index}`}
                        key={result.id}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => goTo(result)}
                      >
                        <span className="esmera-command-result-icon"><ShellIcon name={result.icon || 'arrow'} /></span>
                        <span className="esmera-command-result-copy"><strong>{result.label}</strong>{result.meta ? <small>{result.meta}</small> : null}</span>
                        <ShellIcon name="arrow" className="esmera-command-arrow" />
                      </button>
                    )
                  })}
                </section>
              ))}
            </div>
            <div className="esmera-command-footer"><span>↑↓ navegar</span><span>Enter abrir</span><span>Esc fechar</span><span>N criar</span></div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
