export function normalizeCustomerEmail(value: unknown) {
  const email = String(value || '').trim().toLocaleLowerCase('pt-BR')
  return email || null
}

export function normalizeCustomerPhone(value: unknown) {
  const source = String(value || '').trim()
  if (!source) return null

  const hasPlus = source.startsWith('+')
  const digits = source.replace(/\D/g, '')
  if (!digits) return null

  if (hasPlus) return `+${digits}`
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits}`
  return `+${digits}`
}

export function isE164Phone(value: unknown) {
  const normalized = normalizeCustomerPhone(value)
  return normalized === null || /^\+[1-9]\d{7,14}$/.test(normalized)
}
