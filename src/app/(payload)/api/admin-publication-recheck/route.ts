import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { canManageSite } from '../../../../access/roles'
import { adminActionResponse, adminErrorResponse, adminInputError } from '../../../../server/admin/errors'
import { recheckPublication } from '../../../../server/publication/recheckPublication'
import type { VerifiablePublicationEntity } from '../../../../server/publication/types'

export const dynamic = 'force-dynamic'

type RecheckPublicationRequest = {
  entity?: VerifiablePublicationEntity
  id?: string | number
  expectedPublicationRevision?: string
  contractVersion?: string
  parentTraceId?: string
}

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!canManageSite(user)) return NextResponse.json({ error: 'Sem permissão para verificar publicações.' }, { status: 403 })

  let body: RecheckPublicationRequest
  try {
    body = await request.json() as RecheckPublicationRequest
  } catch {
    return adminInputError('Corpo da requisição inválido.')
  }

  if (!body.entity || !['product', 'category', 'home'].includes(body.entity)) {
    return adminInputError('Entidade de publicação inválida.')
  }
  if (body.id === undefined || body.id === null || body.id === '') {
    return adminInputError('Documento não informado.')
  }
  if (!body.expectedPublicationRevision?.trim()) {
    return adminInputError('A revisão pública esperada é obrigatória.')
  }

  try {
    const result = await recheckPublication(payload, {
      entity: body.entity,
      documentId: body.id,
      expectedPublicationRevision: body.expectedPublicationRevision.trim(),
      contractVersion: body.contractVersion?.trim() || '1',
      parentTraceId: body.parentTraceId?.trim() || `manual:${body.entity}:${String(body.id)}`,
      stage: 3,
      source: 'manual-recheck',
      user,
    })

    if (result.status === 'obsolete') {
      return adminInputError(
        'A revisão pública mudou desde a abertura desta tela. Recarregue a versão atual.',
        { code: 'revision_conflict', meta: { traceId: result.traceId } },
        409,
      )
    }

    return adminActionResponse(result.status, {
      entityId: body.id,
      message: result.status === 'published'
        ? 'Visível no site.'
        : result.status === 'published_but_unverified'
        ? 'Publicado; confirmação do site pendente.'
        : result.status === 'published_but_incompatible'
        ? 'Publicado com problema de compatibilidade.'
        : result.status === 'publish_reverted'
        ? 'Publicação desfeita; versão anterior preservada.'
        : 'A verificação não foi concluída.',
      meta: {
        traceId: result.traceId,
        verification: result.verification,
        retryable: result.retryable,
        rollback: result.rollback,
      },
    })
  } catch (error) {
    return adminErrorResponse(error, {
      entity: body.entity,
      operation: 'publication-recheck',
      logger: payload.logger,
      meta: { entityId: body.id },
    })
  }
}
