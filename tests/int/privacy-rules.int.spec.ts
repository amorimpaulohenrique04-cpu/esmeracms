import { describe, expect, it } from 'vitest'

import { applyCustomerPrivacyRules } from '../../src/hooks/customers/applyCustomerPrivacyRules'

type PrivacyData = Record<string, unknown>
type PrivacyHook = (args: { data: PrivacyData; originalDoc?: PrivacyData }) => PrivacyData

const run = applyCustomerPrivacyRules as unknown as PrivacyHook

describe('customer privacy rules', () => {
  it('timestamps consent grant and withdrawal without relying on the client', () => {
    const granted = run({ data: { marketingConsent: true }, originalDoc: { marketingConsent: false } })
    expect(granted.consentRecordedAt).toEqual(expect.any(String))
    expect(granted.consentWithdrawnAt).toBeNull()

    const withdrawn = run({ data: { marketingConsent: false }, originalDoc: { marketingConsent: true } })
    expect(withdrawn.consentWithdrawnAt).toEqual(expect.any(String))
  })

  it('timestamps a privacy request and its completion', () => {
    const requested = run({ data: { privacyRequestStatus: 'requested' }, originalDoc: { privacyRequestStatus: 'none' } })
    expect(requested.privacyRequestAt).toEqual(expect.any(String))

    const completed = run({ data: { privacyRequestStatus: 'completed' }, originalDoc: { privacyRequestStatus: 'reviewing' } })
    expect(completed.privacyRequestCompletedAt).toEqual(expect.any(String))
  })

  it('normalizes unsupported request states to none', () => {
    const result = run({ data: { privacyRequestStatus: 'invented' }, originalDoc: {} })
    expect(result.privacyRequestStatus).toBe('none')
    expect(result.privacyRequestAt).toBeNull()
    expect(result.privacyRequestCompletedAt).toBeNull()
  })
})
