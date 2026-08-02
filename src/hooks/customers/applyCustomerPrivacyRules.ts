import type { CollectionBeforeValidateHook } from 'payload'

const privacyRequestStatuses = new Set(['none', 'requested', 'reviewing', 'blocked', 'completed'])

export const applyCustomerPrivacyRules: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data

  const now = new Date().toISOString()
  const previousConsent = originalDoc?.marketingConsent === true
  const nextConsent = data.marketingConsent ?? originalDoc?.marketingConsent ?? false

  if (nextConsent === true && !previousConsent) {
    data.consentRecordedAt = now
    data.consentWithdrawnAt = null
  }

  if (nextConsent === false && previousConsent) {
    data.consentWithdrawnAt = now
  }

  const previousRequestStatus = privacyRequestStatuses.has(String(originalDoc?.privacyRequestStatus))
    ? String(originalDoc?.privacyRequestStatus)
    : 'none'
  const requestedStatus = data.privacyRequestStatus ?? previousRequestStatus
  const nextRequestStatus = privacyRequestStatuses.has(String(requestedStatus)) ? String(requestedStatus) : 'none'
  data.privacyRequestStatus = nextRequestStatus

  if (nextRequestStatus !== 'none' && previousRequestStatus === 'none') {
    data.privacyRequestAt = now
  }

  if (nextRequestStatus === 'completed' && previousRequestStatus !== 'completed') {
    data.privacyRequestCompletedAt = now
  }

  if (nextRequestStatus === 'none') {
    data.privacyRequestAt = null
    data.privacyRequestCompletedAt = null
  }

  return data
}
