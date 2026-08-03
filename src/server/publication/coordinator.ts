import { createHash } from 'node:crypto'

import { assertExpectedDocumentRevision, createDocumentRevision } from './revision'
import {
  PublicationBlockedError,
  RevisionConflictError,
  type PublicationAssessment,
  type PublicationEntity,
} from './types'

export type PublicationVerification = {
  status: 'compatible' | 'incompatible' | 'unavailable' | 'not_run'
  diagnostics?: Array<Record<string, unknown>>
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
}

export type PublicationCoordinatorResult<TDocument> = {
  status: 'published' | 'published_but_unverified' | 'requires_confirmation'
  entityId: string | number
  revision: string
  document?: TDocument
  assessment: PublicationAssessment
  confirmationToken?: string
  verification?: PublicationVerification
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

  const published = await input.publish(savedSnapshot, savedRevision)
  const verification = input.verify
    ? await input.verify(published, savedRevision).catch((): PublicationVerification => ({ status: 'unavailable' }))
    : { status: 'not_run' as const }

  return {
    status: verification.status === 'unavailable' ? 'published_but_unverified' : 'published',
    entityId: input.entityId,
    revision: savedRevision,
    document: published,
    assessment,
    verification,
  }
}
