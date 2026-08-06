'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useRouter } from 'next/navigation'
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import { useNavigationFeedback } from '../navigation/NavigationFeedbackProvider'
import { expectAdminResponse } from '../state/asyncState'
import { clearRecentAdminItems, recentAdminItems, savedAdminViews } from '../state/continuity'
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
  auxiliary?: string
}

type SearchResponse = {
  results?: CommandResult[]
  error?: string
}

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error'
type CommandFilter = 'all' | 'records' | 'actions' | 'reports' | 'sections' | 'settings'
type ResultSurface = 'desktop' | 'mobile'

const commandFilters: Array<{ value: CommandFilter; label: string }> = [
  { value: 'all', label: 'Tudo' },
  { value: 'records', label: 'Registros' },
  { value: 'actions', label: 'Ações' },
  { value: 'reports', label: 'Relatórios' },
  { value: 'sections', label: 'Seções' },
  { value: 'settings', label: 'Configurações' },
]

function technicalHref(selection: CommandSelection) {
  const aliases: Record<string, string> = {
    product: 'products', products: 'products', category: 'categories', categories: 'categories', customer: 'customers', customers: 'customers',
    sale: 'sales', sales: 'sales', opportunity: 'opportunities', opportunities: 'opportunities', lead: 'leads', leads: 'leads', task: 'tasks', tasks: 'tasks',
    shipment: 'shipments', shipments: 'shipments', occurrence: 'occurrences', occurrences: 'occurrences', 'after-sale': 'after-sales', 'after-sales': 'after-sales',
  }
  const collection = aliases[selection.kind]
  return collection ? `/admin/collections/${collection}/${selection.id}` : null
}

function relativeVisitTime(visitedAt: number) {
  const elapsed = Math.max(0, Date.now() - visitedAt)
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  return `há ${days} d`
}

function localCommands(selection: CommandSelection | null, currentHref: string): CommandResult[] {
  const results: CommandResult[] = []

  if (selection?.href) {
    results.push({ id: `selection-open:${selection.kind}:${selection.id}`, group: 'Seleção atual', label: `Abrir ${selection.label || selection.kind}`, meta: 'Continuar no registro em foco', href: selection.href, icon: 'arrow', local: true })
    const technical = technicalHref(selection)
    if (technical && technical !== selection.href) results.push({ id: `selection-edit:${selection.kind}:${selection.id}`, group: 'Seleção atual', label: 'Editar no Admin técnico', meta: selection.label || `${selection.kind} ${selection.id}`, href: technical, icon: 'database', local: true })
  }

  for (const item of recentAdminItems()) {
    if (item.href === currentHref) continue
    results.push({ id: `recent:${item.href}`, group: 'Recentes', label: item.label, meta: item.meta || 'Aberto recentemente neste navegador', auxiliary: relativeVisitTime(item.visitedAt), href: item.href, icon: 'clock', local: true })
  }

  for (const view of savedAdminViews()) {
    results.push({ id: `saved:${view.id}`, group: 'Filtros salvos', label: view.label, meta: view.kind === 'reports' ? 'Recorte compartilhável de Relatórios' : 'Workspace salvo', href: view.href, icon: view.kind === 'reports' ? 'chart' : 'filter', local: true })
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

function matchesQuery(result: CommandResult, needle: string) {
  return `${result.label} ${result.meta || ''} ${result.group}`.toLocaleLowerCase('pt-BR').includes(needle)
}

function matchesFilter(result: CommandResult, filter: CommandFilter) {
  if (filter === 'all') return true
  const group = result.group.toLocaleLowerCase('pt-BR')
  const href = result.href.toLocaleLowerCase('pt-BR')
  const label = result.label.toLocaleLowerCase('pt-BR')

  if (filter === 'records') return /produt|categor|cliente|oportunidade|lead|venda/.test(group)
  if (filter === 'actions') return /nesta tela|criar|ações|navegação|seleção atual/.test(group)
  if (filter === 'reports') return href.startsWith('/admin/reports') || group.includes('relatórios')
  if (filter === 'sections') return group === 'seções de relatórios'
  return href.includes('/settings') || href.includes('/technical') || href.includes('/collections/users') || label.includes('configura') || label.includes('admin técnico')
}

function isQuickAction(result: CommandResult) {
  const group = result.group.toLocaleLowerCase('pt-BR')
  return group === 'criar' || group === 'nesta tela' || group === 'ações' || group === 'ações contextuais'
}

function quickActionPriority(result: CommandResult) {
  const label = result.label.toLocaleLowerCase('pt-BR')
  if (label.includes('novo produto')) return 0
  if (label.includes('novo cliente')) return 1
  if (label.includes('nova oportunidade')) return 2
  if (label.includes('importar')) return 3
  if (label.includes('pedido')) return 4
  return 10
}

function resultShortcut(result: CommandResult) {
  const label = result.label.toLocaleLowerCase('pt-BR')
  if (label.includes('produto')) return 'N'
  if (label.includes('cliente')) return 'C'
  if (label.includes('oportunidade')) return 'O'
  if (label.includes('importar')) return 'I'
  if (label.includes('pedido')) return 'P'
  return result.label.trim().slice(0, 1).toLocaleUpperCase('pt-BR')
}

export function CommandPalette({ open, onOpenChange, selection, currentHref }: { open: boolean; onOpenChange: (open: boolean) => void; selection: CommandSelection | null; currentHref: string }) {
  const router = useRouter()
  const { beginNavigation } = useNavigationFeedback()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const keyboardNavigationRef = useRef(false)
  const [query, setQuery] = useState('')
  const [serverResults, setServerResults] = useState<CommandResult[]>([])
  const [serverResultQuery, setServerResultQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [retryTick, setRetryTick] = useState(0)
  const [filter, setFilter] = useState<CommandFilter>('all')
  const [showAll, setShowAll] = useState(false)
  const [compactViewport, setCompactViewport] = useState(false)
  const [continuityVersion, setContinuityVersion] = useState(0)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 620px)')
    const update = () => setCompactViewport(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const currentQuery = query.trim()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/admin-search?q=${encodeURIComponent(currentQuery)}&context=${encodeURIComponent(currentHref)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: controller.signal })
        const body = await expectAdminResponse<SearchResponse>(response, 'Não foi possível pesquisar.')
        setServerResults(body.results || [])
        setServerResultQuery(currentQuery)
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Não foi possível pesquisar.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, currentQuery ? 140 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [currentHref, open, query, retryTick])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const results = useMemo(() => {
    const local = open ? localCommands(selection, currentHref) : []
    const needle = query.trim().toLocaleLowerCase('pt-BR')
    const filteredLocal = needle ? local.filter((item) => matchesQuery(item, needle)) : local
    const previousQuery = serverResultQuery.toLocaleLowerCase('pt-BR')
    // Durante o debounce/refetch, conserva somente resultados anteriores que
    // ainda fazem sentido para a consulta atual. Quando a resposta dessa mesma
    // consulta chega, mantém todos os resultados do servidor, inclusive fuzzy.
    const visibleServerResults = needle && previousQuery !== needle
      ? serverResults.filter((item) => matchesQuery(item, needle))
      : serverResults
    return uniqueResults([...filteredLocal, ...visibleServerResults]).slice(0, 40)
  }, [continuityVersion, currentHref, open, query, selection, serverResultQuery, serverResults])

  const recentResults = useMemo(() => results.filter((result) => result.group === 'Recentes').slice(0, 5), [results])
  const quickActions = useMemo(() => results.filter(isQuickAction).sort((left, right) => quickActionPriority(left) - quickActionPriority(right)).slice(0, 5), [results])
  const reportSections = useMemo(() => results.filter((result) => result.group === 'Seções de Relatórios').slice(0, 5), [results])
  const filteredResults = useMemo(() => results.filter((result) => matchesFilter(result, filter)), [filter, results])
  const desktopHomeResults = useMemo(() => uniqueResults([...recentResults, ...quickActions, ...reportSections]), [quickActions, recentResults, reportSections])
  const desktopShowsResults = Boolean(query.trim()) || filter !== 'all' || showAll
  const desktopResults = desktopShowsResults ? filteredResults : desktopHomeResults
  const navigableResults = compactViewport ? results : desktopResults

  // Clamped at read time instead of resynced via effect: activeIndex can point
  // past the end right after results shrink (e.g. a fresh server response),
  // and this is the only thing that needs to know about that.
  const safeActiveIndex = navigableResults.length ? Math.min(activeIndex, navigableResults.length - 1) : 0
  const activeSurface: ResultSurface = compactViewport ? 'mobile' : 'desktop'
  const activeResultId = navigableResults[safeActiveIndex] ? `${inputId}-${activeSurface}-result-${safeActiveIndex}` : undefined

  useEffect(() => {
    keyboardNavigationRef.current = false
    setActiveIndex(0)
  }, [compactViewport, filter, showAll])

  useEffect(() => {
    if (!open || !keyboardNavigationRef.current || !navigableResults.length || !activeResultId) return
    document.getElementById(activeResultId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeResultId, navigableResults.length, open, safeActiveIndex])

  const grouped = useMemo(() => {
    const order = ['Seleção atual', 'Recentes', 'Filtros salvos', 'Nesta tela', 'Ações contextuais', 'Ações', 'Criar', 'Navegação', 'Seções de Relatórios', 'Produtos', 'Produtos recentes', 'Categorias', 'Categorias recentes', 'Clientes', 'Clientes recentes', 'Oportunidades', 'Leads', 'Leads recentes', 'Vendas', 'Vendas recentes']
    const groups = new Map<string, CommandResult[]>()
    for (const result of navigableResults) groups.set(result.group, [...(groups.get(result.group) || []), result])
    return Array.from(groups.entries()).sort(([left], [right]) => (order.indexOf(left) === -1 ? 999 : order.indexOf(left)) - (order.indexOf(right) === -1 ? 999 : order.indexOf(right)))
  }, [navigableResults])

  const searchState: SearchState = error ? 'error' : loading && !results.length ? 'loading' : results.length ? 'results' : query.trim() ? 'empty' : 'idle'
  const stateLabel = loading && results.length ? `Atualizando · ${results.length} resultado${results.length === 1 ? '' : 's'}` : searchState === 'loading' ? 'Pesquisando registros…' : searchState === 'results' ? `${results.length} resultado${results.length === 1 ? '' : 's'}` : searchState === 'empty' ? 'Nenhum resultado' : searchState === 'error' ? 'Busca indisponível' : 'Atalhos e busca global'

  const reset = () => {
    keyboardNavigationRef.current = false
    setQuery('')
    setServerResults([])
    setServerResultQuery('')
    setLoading(false)
    setError(null)
    setActiveIndex(0)
    setRetryTick(0)
    setFilter('all')
    setShowAll(false)
  }
  const handleOpenChange = (nextOpen: boolean) => { if (!nextOpen) reset(); onOpenChange(nextOpen) }
  const goTo = (result: CommandResult | undefined) => { if (!result) return; handleOpenChange(false); beginNavigation(result.href); router.push(result.href) }
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); keyboardNavigationRef.current = true; setActiveIndex((index) => navigableResults.length ? (index + 1) % navigableResults.length : 0) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); keyboardNavigationRef.current = true; setActiveIndex((index) => navigableResults.length ? (index - 1 + navigableResults.length) % navigableResults.length : 0) }
    else if (event.key === 'Home') { event.preventDefault(); keyboardNavigationRef.current = true; setActiveIndex(0) }
    else if (event.key === 'End') { event.preventDefault(); keyboardNavigationRef.current = true; setActiveIndex(navigableResults.length ? navigableResults.length - 1 : 0) }
    else if (event.key === 'Enter') { event.preventDefault(); goTo(navigableResults[safeActiveIndex]) }
  }

  const renderResult = (result: CommandResult, surface: ResultSurface, variant: 'standard' | 'recent' | 'shortcut' = 'standard') => {
    const index = navigableResults.indexOf(result)
    if (index < 0) return null
    const isActive = safeActiveIndex === index
    return (
      <button
        type="button"
        role="option"
        aria-selected={isActive}
        className={`esmera-command-result esmera-command-result--${variant}${isActive ? ' is-active' : ''}${result.local ? ' is-local' : ''}`}
        id={`${inputId}-${surface}-result-${index}`}
        key={result.id}
        onMouseEnter={() => { keyboardNavigationRef.current = false; setActiveIndex(index) }}
        onClick={() => goTo(result)}
      >
        <span className="esmera-command-result-icon"><ShellIcon name={result.icon || 'arrow'} /></span>
        <span className="esmera-command-result-copy"><strong>{result.label}</strong>{result.meta ? <small>{result.meta}</small> : null}</span>
        {variant === 'recent' && result.auxiliary ? <span className="esmera-command-result-meta">{result.auxiliary}</span> : null}
        {variant === 'shortcut' ? <kbd className="esmera-command-shortcut">{resultShortcut(result)}</kbd> : <ShellIcon name="arrow" className="esmera-command-arrow" />}
      </button>
    )
  }

  const renderStates = () => (
    <>
      {loading && !navigableResults.length ? <div className="esmera-command-state is-loading"><span aria-hidden="true" />Pesquisando registros e ações…</div> : null}
      {error ? <div className="esmera-command-state esmera-command-state--error" role="alert"><strong>Não foi possível pesquisar</strong><span>{error}</span><button type="button" className="esmera-command-retry" onClick={() => setRetryTick((tick) => tick + 1)}>Tentar novamente</button></div> : null}
      {!loading && !error && !navigableResults.length && query.trim() ? <div className="esmera-command-state"><strong>Nenhum resultado</strong><span>Tente nome, código, cliente, venda, filtro salvo ou uma ação diferente.</span></div> : null}
      {!loading && !error && !navigableResults.length && !query.trim() ? <div className="esmera-command-state"><strong>Nenhum item nesta categoria</strong><span>Escolha outro filtro ou veja todos os resultados disponíveis.</span></div> : null}
    </>
  )

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="esmera-command-backdrop" />
        <Dialog.Viewport className="esmera-command-viewport">
          <Dialog.Popup className="esmera-command" data-testid="esmera-command-palette" data-search-state={searchState} aria-busy={loading || undefined}>
            <Dialog.Title className="esmera-command-sr-title">Buscar no Esméra CMS</Dialog.Title>
            <div className="esmera-command-head">
              <div className="esmera-command-search">
                <ShellIcon name="search" />
                <label className="esmera-command-label" htmlFor={inputId}>Buscar no CMS</label>
                <input
                  ref={inputRef}
                  id={inputId}
                  value={query}
                  onChange={(event) => { keyboardNavigationRef.current = false; setQuery(event.target.value); setActiveIndex(0) }}
                  onKeyDown={onKeyDown}
                  placeholder={compactViewport ? 'Registro, ação, filtro salvo ou seção…' : 'Busque por registros, ações, relatórios ou seções…'}
                  autoComplete="off"
                  aria-controls={`${inputId}-${activeSurface}-results`}
                  aria-activedescendant={activeResultId}
                />
                {compactViewport ? <span className={`esmera-command-indicator is-${searchState}`} role="status" aria-live="polite">{stateLabel}</span> : <kbd className="esmera-command-key">⌘ K</kbd>}
              </div>
              <span className="esmera-command-status" role="status" aria-live="polite">{stateLabel}</span>
              <Dialog.Close className="esmera-command-close" aria-label="Fechar busca">{compactViewport ? 'Esc' : <ShellIcon name="close" />}</Dialog.Close>
            </div>

            {!compactViewport ? (
              <>
                <div className="esmera-command-toolbar">
                  <div className="esmera-command-filters" aria-label="Filtrar resultados">
                    {commandFilters.map((item) => (
                      <button
                        type="button"
                        className={`esmera-command-filter${filter === item.value ? ' is-active' : ''}`}
                        aria-pressed={filter === item.value}
                        key={item.value}
                        onClick={() => { setFilter(item.value); setShowAll(item.value !== 'all'); setActiveIndex(0) }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="esmera-command-view-all" onClick={() => { setFilter('all'); setShowAll(true); setActiveIndex(0) }}>
                    Ver todos os resultados <ShellIcon name="arrow" />
                  </button>
                </div>

                {!desktopShowsResults ? (
                  <div className="esmera-command-home" id={`${inputId}-desktop-results`} role="listbox" aria-label="Atalhos e resultados da busca">
                    <div className="esmera-command-home-group esmera-command-home-group--recent" role="group" aria-label="Recentes">
                      <div className="esmera-command-section-head"><strong>Recentes</strong>{recentResults.length ? <button type="button" className="esmera-command-clear-recents" onClick={() => { clearRecentAdminItems(); setContinuityVersion((version) => version + 1); setActiveIndex(0) }}>Limpar recentes</button> : null}</div>
                      <div className="esmera-command-recent-list">
                        {recentResults.length ? recentResults.map((result) => renderResult(result, 'desktop', 'recent')) : <div className="esmera-command-empty-inline">Seus registros e áreas visitados recentemente aparecerão aqui.</div>}
                      </div>
                    </div>
                    <div className="esmera-command-home-group esmera-command-home-group--quick" role="group" aria-label="Ações rápidas">
                      <div className="esmera-command-section-head"><strong>Ações rápidas</strong></div>
                      <div className="esmera-command-compact-list">
                        {quickActions.length ? quickActions.map((result) => renderResult(result, 'desktop', 'shortcut')) : <div className="esmera-command-empty-inline">Nenhuma ação rápida disponível para seu perfil.</div>}
                      </div>
                    </div>
                    <div className="esmera-command-home-group esmera-command-home-group--reports" role="group" aria-label="Seções de Relatórios">
                      <div className="esmera-command-section-head"><strong>Seções de Relatórios</strong></div>
                      <div className="esmera-command-compact-list">
                        {reportSections.map((result) => renderResult(result, 'desktop'))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="esmera-command-results esmera-command-results--desktop" id={`${inputId}-desktop-results`} role="listbox" aria-label="Resultados da busca">
                    {renderStates()}
                    {grouped.map(([group, items]) => <div className="esmera-command-group" key={group} role="group" aria-label={group}><div className="esmera-command-group-label">{group}</div>{items.map((result) => renderResult(result, 'desktop'))}</div>)}
                  </div>
                )}
              </>
            ) : (
              <div className="esmera-command-results esmera-command-results--mobile" id={`${inputId}-mobile-results`} role="listbox" aria-label="Resultados da busca">
                {renderStates()}
                {/* role="listbox" só aceita option/group como filho direto — <section> não é um papel compatível (axe: aria-required-children). */}
                {grouped.map(([group, items]) => <div className="esmera-command-group" key={group} role="group" aria-label={group}><div className="esmera-command-group-label">{group}</div>{items.map((result) => renderResult(result, 'mobile'))}</div>)}
              </div>
            )}

            <div className="esmera-command-footer"><span aria-hidden="true">✦</span><strong>Dica:</strong><span>Use <kbd>↑</kbd><kbd>↓</kbd> para navegar, <kbd>Enter</kbd> para abrir e <kbd>Esc</kbd> para fechar</span></div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
