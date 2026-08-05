import { createHash } from 'node:crypto'

import { assertExpectedDocumentRevision, createDocumentRevision } from './revision'
import {
  PublicationBlockedError,
  RevisionConflictError,
  type PublicationAssessment,
  type PublicationEntity,
} from './types'

// Entidades cuja publicação é consumida pela vitrine e portanto exigem
// verificação (probe) conectada. Ver Fase 3/PR-05 em docs/cms-implementation-plan.md.
// Home ainda não passa pelo coordinator nesta linha de integração — fica de
// fora até que a publicação de Home seja migrada para cá.
const PUBLICLY_VERIFIED_ENTITIES = new Set<PublicationEntity>(['product', 'category'])

const MAX_VERIFY_ATTEMPTS = 3
const MAX_VERIFY_RETRY_DELAY_MS = 2_000

export type PublicationVerification = {
  status: 'compatible' | 'incompatible' | 'unavailable' | 'not_run' | 'revision_mismatch'
  observedRevision?: string
  retryAfterMs?: number
  diagnostics?: Array<Record<string, unknown>>
}

export class PublicationVerificationRequiredError extends Error {
  status = 500
  code = 'verification_not_configured'

  constructor(entity: PublicationEntity) {
    super(`A entidade "${entity}" é pública e exige verificação de vitrine, mas nenhuma foi configurada.`)
    this.name = 'PublicationVerificationRequiredError'
  }
}

export type PublicationCoordinatorInput<TDocument, TData> = {
  entity: PublicationEntity
  entityId: string | number
  data: TData
  expectedRevision?: string | null
  expectedUpdatedAt?: string | null
  confirmationToken?: string | null
  readCurrent: () => Promise<TDocument>
  saveDraft: (data: TData) => Promise<TDocument>
  readDraft: () => Promise<TDocument>
  assess: (document: TDocument) => PublicationAssessment | Promise<PublicationAssessment>
  publish: (snapshot: TDocument, revision: string) => Promise<TDocument>
  verify?: (published: TDocument, revision: string) => Promise<PublicationVerification>
  // Reverte a publicação (ex.: volta o documento para draft) quando o probe
  // reporta incompatibilidade. Só é chamado quando a revisão do rascunho
  // ainda é idêntica à que acabou de ser publicada (PUB-U05).
  revertPublish?: (revision: string) => Promise<TDocument>
}

export type PublicationCoordinatorResult<TDocument> = {
  status:
    | 'published'
    | 'published_but_unverified'
    | 'published_but_incompatible'
    | 'publish_reverted'
    | 'requires_confirmation'
  entityId: string | number
  revision: string
  document?: TDocument
  assessment: PublicationAssessment
  confirmationToken?: string
  verification?: PublicationVerification
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function verifyWithRetries<TDocument>(
  verify: NonNullable<PublicationCoordinatorInput<TDocument, unknown>['verify']>,
  published: TDocument,
  revision: string,
): Promise<PublicationVerification> {
  let attempt = 0
  let result: PublicationVerification = { status: 'unavailable' }

  while (attempt < MAX_VERIFY_ATTEMPTS) {
    attempt += 1
    result = await verify(published, revision).catch((): PublicationVerification => ({ status: 'unavailable' }))

    if (result.status !== 'revision_mismatch') return result
    if (attempt >= MAX_VERIFY_ATTEMPTS) break

    const delay = Math.min(result.retryAfterMs ?? 250, MAX_VERIFY_RETRY_DELAY_MS)
    if (delay > 0) await sleep(delay)
  }

  // Propagação não convergiu dentro do orçamento de tentativas: trata como
  // indisponível em vez de reportar uma revisão antiga como incompatível.
  return { ...result, status: 'unavailable' }
}

function buildConfirmationToken(
  entity: PublicationEntity,
  entityId: string | number,
  assessment: PublicationAssessment,
): string {
  const warningIDs = assessment.issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.id)
    .sort()
    .join('|')
  return createHash('sha256')
    .update(`${entity}:${String(entityId)}:${assessment.revision}:${warningIDs}`)
    .digest('hex')
    .slice(0, 24)
}

export async function coordinatePublication<TDocument, TData>(
  input: PublicationCoordinatorInput<TDocument, TData>,
): Promise<PublicationCoordinatorResult<TDocument>> {
  const current = await input.readCurrent()
  assertExpectedDocumentRevision(current, {
    expectedRevision: input.expectedRevision,
    expectedUpdatedAt: input.expectedUpdatedAt,
  })

  await input.saveDraft(input.data)
  const savedSnapshot = await input.readDraft()
  const savedRevision = createDocumentRevision(savedSnapshot)
  const assessment = await input.assess(savedSnapshot)

  if (assessment.revision !== savedRevision) {
    throw new RevisionConflictError('O rascunho mudou durante a avaliação. Tente publicar novamente.')
  }

  if (!assessment.ready || assessment.issues.some((issue) => issue.severity === 'blocker')) {
    throw new PublicationBlockedError(assessment, true)
  }

  const warnings = assessment.issues.filter((issue) => issue.severity === 'warning')
  if (warnings.length) {
    const expectedToken = buildConfirmationToken(input.entity, input.entityId, assessment)
    if (!input.confirmationToken) {
      return {
        status: 'requires_confirmation',
        entityId: input.entityId,
        revision: savedRevision,
        assessment,
        confirmationToken: expectedToken,
      }
    }
    if (input.confirmationToken !== expectedToken) {
      throw new RevisionConflictError('As pendências foram alteradas desde a confirmação. Revise o conteúdo novamente.')
    }
  }

  const latestSnapshot = await input.readDraft()
  if (createDocumentRevision(latestSnapshot) !== savedRevision) {
    throw new RevisionConflictError('O rascunho mudou antes da publicação. Revise a versão mais recente.')
  }

  if (PUBLICLY_VERIFIED_ENTITIES.has(input.entity) && !input.verify) {
    throw new PublicationVerificationRequiredError(input.entity)
  }

  const published = await input.publish(savedSnapshot, savedRevision)
  const verification: PublicationVerification = input.verify
    ? await verifyWithRetries(input.verify, published, savedRevision)
    : { status: 'not_run' }

  if (verification.status === 'incompatible') {
    if (input.revertPublish) {
      const stillCurrent = createDocumentRevision(await input.readDraft()) === savedRevision
      if (stillCurrent) {
        const reverted = await input.revertPublish(savedRevision)
        return {
          status: 'publish_reverted',
          entityId: input.entityId,
          revision: savedRevision,
          document: reverted,
          assessment,
          verification,
        }
      }
    }
    return {
      status: 'published_but_incompatible',
      entityId: input.entityId,
      revision: savedRevision,
      document: published,
      assessment,
      verification,
    }
  }

  const unverified = verification.status === 'unavailable' || verification.status === 'revision_mismatch'

  return {
    status: unverified ? 'published_but_unverified' : 'published',
    entityId: input.entityId,
    revision: savedRevision,
    document: published,
    assessment,
    verification,
  }
}
