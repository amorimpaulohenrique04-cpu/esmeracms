'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { Button, InlineFeedback } from '../../design-system'

type Props = {
  categoryId: string | number
  publicationRevision?: string | null
  contractVersion?: string | null
  parentTraceId?: string | null
  operationalStatus?: string | null
}

export function CategoryPublicationRecheck({
  categoryId,
  publicationRevision,
  contractVersion,
  parentTraceId,
  operationalStatus,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'danger'; message: string } | null>(null)

  const canRecheck = Boolean(publicationRevision) && (
    operationalStatus === 'pending_verification' ||
    operationalStatus === 'published_but_unverified'
  )
  if (!canRecheck) return null

  async function recheck() {
    if (!publicationRevision || busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin-publication-recheck', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          entity: 'category',
          id: categoryId,
          expectedPublicationRevision: publicationRevision,
          contractVersion: contractVersion || '1',
          parentTraceId,
        }),
      })
      const body = await response.json() as {
        result?: { status?: string; message?: string }
        error?: { summary?: string } | string
      }
      if (!response.ok) {
        const message = typeof body.error === 'string' ? body.error : body.error?.summary
        throw new Error(message || 'Não foi possível verificar novamente.')
      }
      const status = body.result?.status
      setFeedback({
        tone: status === 'published' || status === 'publish_reverted'
          ? 'success'
          : status === 'published_but_incompatible'
          ? 'danger'
          : 'warning',
        message: body.result?.message || 'A verificação foi processada.',
      })
      router.refresh()
    } catch (error) {
      setFeedback({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Não foi possível verificar novamente.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="esmera-actions">
      <Button disabled={busy} onClick={() => void recheck()}>
        {busy ? 'Verificando…' : 'Tentar verificar novamente'}
      </Button>
      {feedback ? <InlineFeedback tone={feedback.tone}>{feedback.message}</InlineFeedback> : null}
    </div>
  )
}
