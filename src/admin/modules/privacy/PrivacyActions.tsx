'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button } from '../../design-system'
import { announceAdmin } from '../../state/AdminStateProvider'
import { expectAdminResponse, normalizeAdminError } from '../../state/asyncState'

type Props = {
  customerId: string | number
  consent: boolean
  requestStatus: string
  isAdmin: boolean
}

type Action = 'set-consent' | 'request-deletion' | 'start-review' | 'complete-review' | 'anonymize'

async function privacyMutation(body: Record<string, unknown>) {
  const response = await fetch('/api/admin-privacy', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  return expectAdminResponse<Record<string, unknown>>(response, 'Não foi possível concluir a operação de privacidade.')
}

export function PrivacyActions({ customerId, consent, requestStatus, isAdmin }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action | null>(null)
  const [feedback, setFeedback] = useState('')

  async function run(action: Action, extra: Record<string, unknown> = {}) {
    if (busy) return
    if (action === 'anonymize' && !window.confirm('Anonimizar este cliente? Dados identificáveis serão removidos e vínculos transacionais serão preservados.')) return

    setBusy(action)
    setFeedback('')
    try {
      await privacyMutation({ action, customerId, ...extra })
      const message = action === 'set-consent'
        ? extra.consent ? 'Consentimento registrado.' : 'Retirada de consentimento registrada.'
        : action === 'request-deletion'
          ? 'Solicitação LGPD registrada.'
          : action === 'start-review'
            ? 'Análise LGPD iniciada.'
            : action === 'complete-review'
              ? 'Análise LGPD concluída.'
              : 'Cliente anonimizado.'
      setFeedback(message)
      announceAdmin(message)
      router.refresh()
    } catch (error) {
      const normalized = normalizeAdminError(error, 'Não foi possível concluir a operação.')
      setFeedback(normalized.message)
      announceAdmin(normalized.message, true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="esmera-privacy-actions">
      <a className="esmera-button" href={`/api/admin-privacy?customer=${encodeURIComponent(String(customerId))}`}>Exportar dados</a>
      <Button type="button" disabled={Boolean(busy)} onClick={() => void run('set-consent', { consent: !consent })}>
        {busy === 'set-consent' ? 'Registrando…' : consent ? 'Retirar consentimento' : 'Registrar consentimento'}
      </Button>
      {requestStatus === 'none' ? <Button type="button" disabled={Boolean(busy)} onClick={() => void run('request-deletion')}>{busy === 'request-deletion' ? 'Registrando…' : 'Solicitar exclusão'}</Button> : null}
      {isAdmin && requestStatus === 'requested' ? <Button type="button" disabled={Boolean(busy)} onClick={() => void run('start-review')}>Iniciar análise</Button> : null}
      {isAdmin && ['reviewing', 'blocked'].includes(requestStatus) ? <Button type="button" disabled={Boolean(busy)} onClick={() => void run('anonymize')}>{busy === 'anonymize' ? 'Verificando…' : 'Anonimizar'}</Button> : null}
      {isAdmin && requestStatus === 'reviewing' ? <Button type="button" disabled={Boolean(busy)} onClick={() => void run('complete-review')}>Concluir sem anonimizar</Button> : null}
      <span role="status" aria-live="polite">{feedback}</span>
    </div>
  )
}
