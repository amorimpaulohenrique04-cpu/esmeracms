'use client'

import { Dialog } from '@base-ui/react/dialog'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button, InlineFeedback, QuickActionMenu } from '../../design-system'
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
  const [confirmAnonymize, setConfirmAnonymize] = useState(false)

  async function run(action: Action, extra: Record<string, unknown> = {}) {
    if (busy) return
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
              ? 'Análise LGPD concluída sem anonimização.'
              : 'Cliente anonimizado com vínculos transacionais preservados.'
      setFeedback(message)
      setConfirmAnonymize(false)
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
    <div className="esmera-privacy-action-cell">
      <QuickActionMenu label="Operar" className="esmera-privacy-actions">
        <section className="esmera-privacy-action-group">
          <strong>Dados e consentimento</strong>
          <a className="esmera-privacy-action" href={`/api/admin-privacy?customer=${encodeURIComponent(String(customerId))}`}>Exportar dados do titular</a>
          <button className="esmera-privacy-action" type="button" disabled={Boolean(busy)} onClick={() => void run('set-consent', { consent: !consent })}>
            {busy === 'set-consent' ? 'Registrando…' : consent ? 'Registrar retirada do consentimento' : 'Registrar consentimento'}
          </button>
        </section>

        <section className="esmera-privacy-action-group">
          <strong>Solicitação LGPD</strong>
          {requestStatus === 'none' ? <button className="esmera-privacy-action" type="button" disabled={Boolean(busy)} onClick={() => void run('request-deletion')}>{busy === 'request-deletion' ? 'Registrando…' : 'Registrar solicitação de exclusão'}</button> : null}
          {isAdmin && requestStatus === 'requested' ? <button className="esmera-privacy-action" type="button" disabled={Boolean(busy)} onClick={() => void run('start-review')}>Iniciar análise</button> : null}
          {isAdmin && requestStatus === 'reviewing' ? <button className="esmera-privacy-action" type="button" disabled={Boolean(busy)} onClick={() => void run('complete-review')}>Concluir análise sem anonimizar</button> : null}
          {requestStatus !== 'none' && !(isAdmin && ['requested', 'reviewing'].includes(requestStatus)) ? <span className="esmera-privacy-action-group__note">Nenhuma transição rotineira disponível neste estado.</span> : null}
        </section>

        {isAdmin && ['reviewing', 'blocked'].includes(requestStatus) ? (
          <section className="esmera-privacy-action-group is-critical">
            <strong>Zona crítica</strong>
            <button className="esmera-privacy-action is-danger" type="button" disabled={Boolean(busy)} onClick={() => setConfirmAnonymize(true)}>Anonimizar cliente…</button>
          </section>
        ) : null}
      </QuickActionMenu>

      {feedback ? <InlineFeedback tone={feedback.includes('Não') ? 'danger' : 'success'}>{feedback}</InlineFeedback> : null}

      <Dialog.Root open={confirmAnonymize} onOpenChange={setConfirmAnonymize}>
        <Dialog.Portal>
          <Dialog.Backdrop className="esmera-overlay-backdrop" />
          <Dialog.Viewport className="esmera-dialog-viewport">
            <Dialog.Popup className="esmera-dialog esmera-privacy-critical-dialog">
              <div className="esmera-overlay-header">
                <div>
                  <Dialog.Title>Confirmar anonimização</Dialog.Title>
                  <Dialog.Description>Dados identificáveis serão removidos. Vínculos transacionais e a trilha técnica serão preservados.</Dialog.Description>
                </div>
                <Dialog.Close className="esmera-icon-button" aria-label="Fechar">×</Dialog.Close>
              </div>
              <div className="esmera-overlay-body">
                <div className="esmera-privacy-critical-summary">
                  <strong>Ação irreversível</strong>
                  <p>O servidor ainda verificará obrigações operacionais, solicitações bloqueadas e permissões antes de executar. A confirmação não ignora esses bloqueios.</p>
                </div>
                <div className="esmera-actions">
                  <Dialog.Close className="esmera-button" type="button">Cancelar</Dialog.Close>
                  <Button tone="danger" type="button" disabled={Boolean(busy)} onClick={() => void run('anonymize')}>{busy === 'anonymize' ? 'Verificando bloqueios…' : 'Confirmar anonimização'}</Button>
                </div>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
