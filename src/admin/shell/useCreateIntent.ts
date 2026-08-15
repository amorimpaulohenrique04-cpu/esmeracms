'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { CREATE_INTENT_PARAM, type CreateIntent } from './createIntent'

/**
 * Abre o popup de criação assim que a URL carrega com `?novo=<intent>` — usado
 * pelas páginas de destino do menu de criação global e dos atalhos do
 * Dashboard, que navegam até a página certa e sinalizam qual popup abrir, em
 * vez de levar ao formulário técnico da Collection.
 *
 * `open` reage ao parâmetro durante a renderização (não num efeito) para
 * evitar um set-state em cascata — o efeito só cuida do side effect real:
 * limpar o parâmetro da URL depois que o popup abriu.
 */
export function useCreateIntent(intent: CreateIntent) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const paramValue = searchParams.get(CREATE_INTENT_PARAM)

  const [open, setOpen] = useState(false)
  const [seenParamValue, setSeenParamValue] = useState(paramValue)
  if (paramValue !== seenParamValue) {
    setSeenParamValue(paramValue)
    if (paramValue === intent) setOpen(true)
  }

  useEffect(() => {
    if (paramValue !== intent) return
    const next = new URLSearchParams(searchParams)
    next.delete(CREATE_INTENT_PARAM)
    router.replace(next.size ? `${pathname}?${next.toString()}` : pathname, { scroll: false })
  }, [intent, paramValue, pathname, router, searchParams])

  return [open, setOpen] as const
}
