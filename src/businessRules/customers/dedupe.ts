import { normalizeCustomerEmail, normalizeCustomerPhone } from './normalization'

export type CustomerIdentityInput = {
  id?: string | number | null
  email?: unknown
  phone?: unknown
  name?: unknown
  company?: unknown
}

export type CustomerDuplicateMatch = {
  id: string | number | null
  reasons: Array<'email' | 'phone' | 'name-company'>
}

function normalizedText(value: unknown) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function customerIdentityKeys(input: CustomerIdentityInput) {
  const email = normalizeCustomerEmail(input.email)
  const phone = normalizeCustomerPhone(input.phone)
  const name = normalizedText(input.name)
  const company = normalizedText(input.company)

  return {
    email,
    phone,
    nameCompany: name && company ? `${name}::${company}` : null,
  }
}

export function findCustomerDuplicateMatches(
  candidate: CustomerIdentityInput,
  existing: CustomerIdentityInput[],
): CustomerDuplicateMatch[] {
  const candidateKeys = customerIdentityKeys(candidate)

  return existing.flatMap((record) => {
    if (candidate.id !== undefined && candidate.id !== null && String(candidate.id) === String(record.id)) return []
    const keys = customerIdentityKeys(record)
    const reasons: CustomerDuplicateMatch['reasons'] = []

    if (candidateKeys.email && keys.email === candidateKeys.email) reasons.push('email')
    if (candidateKeys.phone && keys.phone === candidateKeys.phone) reasons.push('phone')
    if (candidateKeys.nameCompany && keys.nameCompany === candidateKeys.nameCompany) reasons.push('name-company')

    return reasons.length ? [{ id: record.id ?? null, reasons }] : []
  })
}
