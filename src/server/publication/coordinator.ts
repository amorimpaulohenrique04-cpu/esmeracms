import { createHash, randomUUID } from 'node:crypto'

import { assertExpectedDocumentRevision, createDocumentRevision } from './revision'
import {
  assertPublicationVerificationConfigured,
  type PublicationVerificationConfig,
} from './verificationConfig'
import { verifyPublicationWithRetry } from './verificationPolicy'
import {
  PublicationBlockedError,
  PublicationVerificationRequiredError,
  RevisionConflictError,
  type ConditionalRollbackResult,
  type OperationalPublicationStatus,
  type PersistedPublicationState,
  type PublicationAssessment,
  type PublicationCoordinatorStatus,
  type PublicationEntity,
  type PublicationIssue,
  type PublicationReceipt,
  type PublicationReceiptSource,
  type PublicationRecheckInput,
  type PublishedVersionSnapshot,
  type StorefrontVerification,
  type VerificationAttempt,
  type VerifiablePublicationEntity,
} from './types'

export type PublicationCoordinatorInput<TDocument, TData> = {
  entity: PublicationEntity
  entityId: string | number
  actorId: string | number
  source: PublicationReceiptSource
  data: TData
  expectedRevision?: string | null
  expectedUpdatedAt?: string | null
  confirmationToken?: string | null
  verificationConfig?: PublicationVerificationConfig
  readCurrent: () => Promise<TDocument>
  readPublishedBefore?: () => Promise<PublishedVersionSnapshot<TDocument> | null>
  saveDraft: (data: TData) => Promise<TDocument>
  readDraft: () => Promise<TDocument>
  assess: (document: TDocument) => PublicationAssessment | Promise<PublicationAssessment>
  publish: (snapshot: TDocument, revision: string, traceId: string) => Promise<TDocument>
  extractPublicMetadata?: (document: TDocument) => {
    publicationRevision: string
    publicationContractVersion: string
  }
  verify?: (
    document: TDocument,
    metadata: {
      publicationRevision: string
      publicationContractVersion: string
      traceId: string
    },
  ) => Promise<StorefrontVerification>
  persistOperationalState?: (state: PersistedPublicationState) => Promise<void>
  attemptRollback?: (input: {
    enabled: boolean
    previous: PublishedVersionSnapshot<TDocument> | null
    currentDocument: TDocument
    currentPublicationRevision: string
    currentEditorialRevision: string
  }) => Promise<ConditionalRollbackResult<TDocument>>
  createReceipt?: (receipt: PublicationReceipt) => Promise<void>
  scheduleRecheck?: (input: PublicationRecheckInput) => Promise<void>
  sleep?: (milliseconds: number) => Promise<void>
  now?: () => Date
  traceId?: string
}

export type PublicationCoordinatorResult<TDocument> = {
  status: PublicationCoordinatorStatus
  entityId: string | number
  revision: string
  publicationRevision?: string
  document?: TDocument
  assessment: PublicationAssessment
  verification?: StorefrontVerification
  retryable: boolean
  traceId: string
  confirmationToken?: string
  rollback?: ConditionalRollbackResult<TDocument>
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

function isVerifiableEntity(entity: PublicationEntity): entity is VerifiablePublicationEntity {
  return entity === 'product' || entity === 'category' || entity === 'home'
}

function verificationIssues(verification: StorefrontVerification | undefined): PublicationIssue[] {
  return (verification?.issues || []).map((issue) => ({
    id: issue.code,
    severity: 'blocker',
    path: issue.path || null,
    message: issue.message,
    suggestion: null,
    source: issue.code.startsWith('probe.') ? 'integration' : 'storefront_contract',
  }))
}

function errorStatus(error: unknown): OperationalPublicationStatus {
  if (error instanceof RevisionConflictError) return 'conflict'
  if (error instanceof PublicationBlockedError) return 'blocked'
  return 'failed'
}

function errorIssues(error: unknown): PublicationIssue[] {
  if (error instanceof PublicationBlockedError) return error.assessment.issues
  const code = error instanceof RevisionConflictError
    ? error.code
    : error instanceof PublicationVerificationRequiredError
    ? error.code
    : 'publication.failed'
  return [{
    id: code,
    severity: 'blocker',
    message: error instanceof Error ? error.message : 'A operação de publicação não foi concluída.',
    suggestion: null,
    source: error instanceof PublicationVerificationRequiredError ? 'integration' : 'business_rule',
  }]
}

function rollbackReceipt<TDocument>(rollback: ConditionalRollbackResult<TDocument> | undefined) {
  if (!rollback) return { attempted: false, status: 'not_needed' as const }
  return {
    attempted: rollback.attempted,
    status: rollback.status,
    reason: rollback.status === 'skipped' || rollback.status === 'failed' ? rollback.reason : undefined,
    restoredRevision: rollback.status === 'reverted' ? rollback.restoredRevision : undefined,
  }
}

function verifiedAt(verification: StorefrontVerification | undefined) {
  return verification?.responseReceived ? verification.checkedAt : null
}

function singleVerificationAttempt(
  verification: StorefrontVerification | undefined,
  startedAt: Date,
  completedAt: Date,
): VerificationAttempt[] {
  if (!verification) return []
  return [{
    attempt: 1,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    status: verification.status,
    observedRevision: verification.observedRevision,
    issues: verificationIssues(verification),
  }]
}

function requireVerificationCallbacks<TDocument, TData>(
  input: PublicationCoordinatorInput<TDocument, TData>,
): asserts input is PublicationCoordinatorInput<TDocument, TData> & {
  verificationConfig: PublicationVerificationConfig
  extractPublicMetadata: NonNullable<PublicationCoordinatorInput<TDocument, TData>['extractPublicMetadata']>
  verify: NonNullable<PublicationCoordinatorInput<TDocument, TData>['verify']>
  persistOperationalState: NonNullable<PublicationCoordinatorInput<TDocument, TData>['persistOperationalState']>
  createReceipt: NonNullable<PublicationCoordinatorInput<TDocument, TData>['createReceipt']>
} {
  if (
    !input.verificationConfig ||
    !input.extractPublicMetadata ||
    !input.verify ||
    !input.persistOperationalState ||
    !input.createReceipt
  ) {
    throw new PublicationVerificationRequiredError()
  }
  assertPublicationVerificationConfigured(input.verificationConfig)
}

export async function coordinatePublication<TDocument, TData>(
  input: PublicationCoordinatorInput<TDocument, TData>,
): Promise<PublicationCoordinatorResult<TDocument>> {
  const now = input.now || (() => new Date())
  const startedAt = now()
  const traceId = input.traceId || randomUUID()

  let previous: PublishedVersionSnapshot<TDocument> | null = null
  let savedRevision: string | undefined
  let assessment: PublicationAssessment | undefined
  let metadata: { publicationRevision: string; publicationContractVersion: string } | undefined
  let finalVerification: StorefrontVerification | undefined
  let mainReceiptCreated = false

  const createMainReceipt = async (receipt: Omit<PublicationReceipt,
    | 'traceId'
    | 'operation'
    | 'source'
    | 'entity'
    | 'documentId'
    | 'actorId'
    | 'startedAt'
    | 'completedAt'
    | 'durationMs'
  >) => {
    if (!isVerifiableEntity(input.entity) || !input.createReceipt) return
    const completedAt = now()
    await input.createReceipt({
      traceId,
      operation: 'publish',
      source: input.source,
      entity: input.entity,
      documentId: input.entityId,
      actorId: input.actorId,
      ...receipt,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    })
    mainReceiptCreated = true
  }

  try {
    if (isVerifiableEntity(input.entity)) requireVerificationCallbacks(input)

    const current = await input.readCurrent()
    assertExpectedDocumentRevision(current, {
      expectedRevision: input.expectedRevision,
      expectedUpdatedAt: input.expectedUpdatedAt,
    })

    previous = input.readPublishedBefore ? await input.readPublishedBefore() : null

    await input.saveDraft(input.data)
    const savedSnapshot = await input.readDraft()
    savedRevision = createDocumentRevision(savedSnapshot)
    assessment = await input.assess(savedSnapshot)

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
        await createMainReceipt({
          expectedRevision: input.expectedRevision,
          savedRevision,
          previousPublishedRevision: previous?.publicationRevision,
          previousEditorialRevision: previous?.editorialRevision,
          previousVersionId: previous?.versionId,
          status: 'ready',
          verificationStatus: 'not_run',
          retryable: false,
          verificationAttempts: [],
          rollback: { attempted: false, status: 'not_needed' },
          issues: warnings,
        })
        return {
          status: 'requires_confirmation',
          entityId: input.entityId,
          revision: savedRevision,
          assessment,
          retryable: false,
          traceId,
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

    const published = await input.publish(savedSnapshot, savedRevision, traceId)
    const publishedEditorialRevision = createDocumentRevision(published)

    if (!isVerifiableEntity(input.entity)) {
      return {
        status: 'published',
        entityId: input.entityId,
        revision: savedRevision,
        document: published,
        assessment,
        retryable: false,
        traceId,
      }
    }

    requireVerificationCallbacks(input)
    metadata = input.extractPublicMetadata(published)

    await input.persistOperationalState({
      operationalStatus: 'pending_verification',
      verificationStatus: 'not_run',
      verifiedAt: null,
      traceId,
    })

    const policy = await verifyPublicationWithRetry({
      verify: () => input.verify(published, {
        publicationRevision: metadata!.publicationRevision,
        publicationContractVersion: metadata!.publicationContractVersion,
        traceId,
      }),
      sleep: input.sleep,
      now,
    })

    const initialVerification = policy.verification
    let status: OperationalPublicationStatus
    let retryable = policy.retryable
    let rollback: ConditionalRollbackResult<TDocument> | undefined
    let finalDocument: TDocument = published as TDocument
    let finalPublicationRevision = metadata.publicationRevision
    finalVerification = initialVerification

    if (initialVerification.status === 'compatible') {
      status = 'published'
      retryable = false
    } else if (initialVerification.status === 'incompatible') {
      status = 'published_but_incompatible'
      retryable = false

      if (input.attemptRollback) {
        const rollbackStartedAt = now()
        rollback = await input.attemptRollback({
          enabled: input.verificationConfig.rollbackEnabled,
          previous,
          currentDocument: published,
          currentPublicationRevision: metadata.publicationRevision,
          currentEditorialRevision: publishedEditorialRevision,
        })
        const rollbackCompletedAt = now()

        if (rollback.status === 'reverted') {
          finalDocument = (rollback.document ?? published) as TDocument
          finalPublicationRevision = rollback.restoredRevision
          finalVerification = rollback.verification || initialVerification

          if (rollback.verification?.status === 'compatible') {
            status = 'publish_reverted'
            retryable = false
          } else if (
            rollback.verification?.status === 'unavailable' ||
            rollback.verification?.status === 'revision_mismatch' ||
            !rollback.verification
          ) {
            status = 'published_but_unverified'
            retryable = true
          } else {
            status = 'published_but_incompatible'
            retryable = false
          }
        }

        const rollbackTraceId = randomUUID()
        await input.createReceipt({
          traceId: rollbackTraceId,
          parentTraceId: traceId,
          operation: 'rollback',
          source: input.source,
          entity: input.entity,
          documentId: input.entityId,
          actorId: input.actorId,
          expectedRevision: input.expectedRevision,
          savedRevision,
          publishedRevision: metadata.publicationRevision,
          previousPublishedRevision: previous?.publicationRevision,
          previousEditorialRevision: previous?.editorialRevision,
          observedRevision: rollback.status === 'reverted'
            ? rollback.verification?.observedRevision
            : initialVerification.observedRevision,
          previousVersionId: previous?.versionId,
          status,
          verificationStatus: rollback.status === 'reverted'
            ? rollback.verification?.status
            : initialVerification.status,
          contractVersion: metadata.publicationContractVersion,
          retryable,
          verificationAttempts: rollback.status === 'reverted'
            ? singleVerificationAttempt(rollback.verification, rollbackStartedAt, rollbackCompletedAt)
            : [],
          rollback: rollbackReceipt(rollback),
          issues: verificationIssues(
            rollback.status === 'reverted' ? rollback.verification : initialVerification,
          ),
          startedAt: rollbackStartedAt.toISOString(),
          completedAt: rollbackCompletedAt.toISOString(),
          durationMs: Math.max(0, rollbackCompletedAt.getTime() - rollbackStartedAt.getTime()),
        })
      }
    } else if (
      initialVerification.status === 'revision_mismatch' ||
      initialVerification.status === 'unavailable'
    ) {
      status = 'published_but_unverified'
      retryable = true
    } else {
      status = 'failed'
      retryable = false
    }

    await input.persistOperationalState({
      operationalStatus: status,
      verificationStatus: finalVerification.status,
      verifiedAt: verifiedAt(finalVerification),
      traceId,
    })

    await createMainReceipt({
      expectedRevision: input.expectedRevision,
      savedRevision,
      publishedRevision: metadata.publicationRevision,
      previousPublishedRevision: previous?.publicationRevision,
      previousEditorialRevision: previous?.editorialRevision,
      observedRevision: finalVerification.observedRevision,
      previousVersionId: previous?.versionId,
      status,
      verificationStatus: finalVerification.status,
      contractVersion: metadata.publicationContractVersion,
      retryable,
      verificationAttempts: policy.attempts,
      rollback: rollbackReceipt(rollback),
      issues: [
        ...assessment.issues,
        ...verificationIssues(finalVerification),
      ],
    })

    if (status === 'published_but_unverified' && retryable && input.scheduleRecheck) {
      await input.scheduleRecheck({
        entity: input.entity,
        documentId: input.entityId,
        expectedPublicationRevision: finalPublicationRevision,
        contractVersion: metadata.publicationContractVersion,
        parentTraceId: traceId,
        stage: 1,
      })
    }

    return {
      status,
      entityId: input.entityId,
      revision: savedRevision,
      publicationRevision: finalPublicationRevision,
      document: finalDocument,
      assessment,
      verification: finalVerification,
      retryable,
      traceId,
      rollback,
    }
  } catch (error) {
    if (isVerifiableEntity(input.entity) && input.createReceipt && !mainReceiptCreated) {
      await createMainReceipt({
        expectedRevision: input.expectedRevision,
        savedRevision,
        publishedRevision: metadata?.publicationRevision,
        previousPublishedRevision: previous?.publicationRevision,
        previousEditorialRevision: previous?.editorialRevision,
        observedRevision: finalVerification?.observedRevision,
        previousVersionId: previous?.versionId,
        status: errorStatus(error),
        verificationStatus: finalVerification?.status || 'not_run',
        contractVersion: metadata?.publicationContractVersion,
        retryable: false,
        verificationAttempts: [],
        rollback: { attempted: false, status: 'not_needed' },
        issues: assessment?.issues?.length ? assessment.issues : errorIssues(error),
      }).catch(() => undefined)
    }
    throw error
  }
}
