'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useRouter } from 'next/navigation'
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'

import { ShellIcon } from './ShellIcon'

export type CommandResult = {
  id: string
  group: string
  label: string
  meta?: string
  href: string
  icon?: string
}

type SearchResponse = {
  results?: CommandResult[]
  error?: string
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CommandResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setError(null)
      setActiveIndex(0)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/admin-search?q=${encodeURIComponent(query.trim())}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        const body = await response.json() as SearchResponse
        if (!response.ok) throw new Error(body.error || 'Não foi possível pesquisar.')
        setResults(body.results || [])
        setActiveIndex(0)
      } catch (cause) {
        if (controller.signal.aborted) return
        setResults([])
        setError(cause instanceof Error ? cause.message : 'Não foi possível pesquisar.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, query.trim() ? 140 : 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, query])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  const grouped = useMemo(() => {
    const groups = new Map<string, CommandResult[]>()
    for (const result of results) {
      const current = groups.get(result.group) || []
      current.push(result)
      groups.set(result.group, current)
    }
    return Array.from(groups.entries())
  }, [results])

  const goTo = (result: CommandResult | undefined) => {
    if (!result) return
    onOpenChange(false)
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="esmera-command-backdrop" />
        <Dialog.Viewport className="esmera-command-viewport">
          <Dialog.Popup className="esmera-command" data-testid="esmera-command-palette">
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
                placeholder="Produto, cliente, venda ou ação…"
                autoComplete="off"
                aria-controls={`${inputId}-results`}
                aria-activedescendant={results[activeIndex] ? `${inputId}-result-${activeIndex}` : undefined}
              />
              <Dialog.Close className="esmera-command-close" aria-label="Fechar busca">Esc</Dialog.Close>
            </div>

            <div className="esmera-command-results" id={`${inputId}-results`} role="listbox" aria-label="Resultados da busca">
              {loading && !results.length ? <div className="esmera-command-state">Pesquisando…</div> : null}
              {error ? <div className="esmera-command-state esmera-command-state--error" role="alert">{error}</div> : null}
              {!loading && !error && !results.length ? <div className="esmera-command-state">Nenhum resultado. Tente outro termo.</div> : null}
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
                        className={`esmera-command-result${activeIndex === index ? ' is-active' : ''}`}
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
            <div className="esmera-command-footer"><span>↑↓ navegar</span><span>Enter abrir</span><span>Esc fechar</span></div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
