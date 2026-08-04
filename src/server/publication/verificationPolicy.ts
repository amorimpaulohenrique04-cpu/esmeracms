import type {
  PublicationIssue,
  StorefrontVerification,
  VerificationAttempt,
} from './types'

const DEFAULT_DELAYS = [500, 1_500, 3_000] as const
const NON_RETRYABLE_UNAVAILABLE_CODES = new Set([
  'probe.not_configured',
  'probe.auth_failed',
  'probe.invalid_request',
  'probe.invalid_response',
  'probe.contract_version_incompatible',
])

export type VerificationPolicyInput = {
  verify: () => Promise<StorefrontVerification>
  sleep?: (milliseconds: number) => Promise<void>
  delays?: readonly number[]
  now?: () => Date
}

export type VerificationPolicyResult = {
  verification: StorefrontVerification
  attempts: VerificationAttempt[]
  retryable: boolean
  cause?: 'revision_mismatch' | 'unavailable'
}

function toIssues(verification: StorefrontVerification): PublicationIssue[] | undefined {
  const issues = (verification.issues || []).map((entry) => ({
    id: entry.code,
    severity: 'blocker' as const,
    path: entry.path || null,
    message: entry.message,
    suggestion: null,
    source: entry.code.startsWith('probe.') ? 'integration' as const : 'storefront_contract' as const,
  }))
  return issues.length ? issues : undefined
}

function unavailableIsRetryable(verification: StorefrontVerification) {
  if (verification.status !== 'unavailable') return false
  const codes = (verification.issues || []).map((issue) => issue.code)
  return codes.length === 0 || codes.every((code) => !NON_RETRYABLE_UNAVAILABLE_CODES.has(code))
}

function shouldRetry(verification: StorefrontVerification) {
  return verification.status === 'revision_mismatch' || unavailableIsRetryable(verification)
}

export async function verifyPublicationWithRetry(
  input: VerificationPolicyInput,
): Promise<VerificationPolicyResult> {
  const sleep = input.sleep || ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
  const now = input.now || (() => new Date())
  const delays = input.delays || DEFAULT_DELAYS
  const attempts: VerificationAttempt[] = []
  let verification: StorefrontVerification = {
    status: 'not_run',
    expectedRevision: '',
    contractVersion: '',
    checkedAt: now().toISOString(),
  }

  for (let index = 0; index <= delays.length; index += 1) {
    if (index > 0) await sleep(delays[index - 1])

    const started = now()
    try {
      verification = await input.verify()
    } catch (error) {
      verification = {
        status: 'unavailable',
        expectedRevision: verification.expectedRevision,
        contractVersion: verification.contractVersion,
        checkedAt: now().toISOString(),
        issues: [{
          code: 'probe.transport_error',
          message: error instanceof Error ? error.message : 'A vitrine não pôde ser consultada agora.',
        }],
      }
    }
    const completed = now()
    attempts.push({
      attempt: index + 1,
      startedAt: started.toISOString(),
      completedAt: completed.toISOString(),
      durationMs: Math.max(0, completed.getTime() - started.getTime()),
      status: verification.status,
      observedRevision: verification.observedRevision,
      issues: toIssues(verification),
    })

    if (!shouldRetry(verification) || index === delays.length) break
  }

  const retryable = shouldRetry(verification)
  return {
    verification,
    attempts,
    retryable,
    cause: verification.status === 'revision_mismatch'
      ? 'revision_mismatch'
      : verification.status === 'unavailable' && retryable
      ? 'unavailable'
      : undefined,
  }
}
