import type {
  ConditionalRollbackInput,
  ConditionalRollbackResult,
} from './types'

export async function attemptConditionalPublicationRollback<TDocument>(
  input: ConditionalRollbackInput<TDocument>,
): Promise<ConditionalRollbackResult<TDocument>> {
  if (!input.enabled) {
    return { status: 'skipped', attempted: false, reason: 'rollback_disabled' }
  }
  if (!input.previous) {
    return { status: 'skipped', attempted: false, reason: 'no_previous_version' }
  }

  const current = await input.readCurrent()
  const currentPublicRevision = input.extractPublicRevision(current)
  if (currentPublicRevision !== input.currentPublicationRevision) {
    return { status: 'skipped', attempted: false, reason: 'current_revision_changed' }
  }
  if (input.createEditorialRevision(current) !== input.currentEditorialRevision) {
    return { status: 'skipped', attempted: false, reason: 'current_editorial_revision_changed' }
  }

  try {
    await input.restorePrevious(input.previous.versionId)
    const restored = await input.readRestored()
    const restoredPublicRevision = input.extractPublicRevision(restored)
    if (restoredPublicRevision !== input.previous.publicationRevision) {
      return {
        status: 'failed',
        attempted: true,
        reason: 'A versão restaurada não corresponde à revisão pública anterior.',
      }
    }
    if (input.createEditorialRevision(restored) !== input.previous.editorialRevision) {
      return {
        status: 'failed',
        attempted: true,
        reason: 'A versão restaurada não corresponde à revisão editorial anterior.',
      }
    }

    const verification = input.verifyRestored
      ? await input.verifyRestored(restored, input.previous.publicationRevision)
      : undefined

    return {
      status: 'reverted',
      attempted: true,
      restoredRevision: input.previous.publicationRevision,
      document: restored,
      verification,
    }
  } catch (error) {
    return {
      status: 'failed',
      attempted: true,
      reason: error instanceof Error ? error.message : 'Não foi possível restaurar a versão anterior.',
    }
  }
}
