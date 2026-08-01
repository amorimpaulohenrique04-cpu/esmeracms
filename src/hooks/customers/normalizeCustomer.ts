import type { CollectionBeforeValidateHook } from 'payload'

import { isE164Phone, normalizeCustomerEmail, normalizeCustomerPhone } from '../../businessRules/customers/normalization'

export const normalizeCustomer: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data

  const email = normalizeCustomerEmail(data.email ?? originalDoc?.email)
  const phone = normalizeCustomerPhone(data.phone ?? originalDoc?.phone)

  if (phone && !isE164Phone(phone)) {
    throw new Error('Telefone inválido. Use um número com DDD; o CMS normaliza para E.164.')
  }

  data.email = email
  data.phone = phone
  data.normalizedEmail = email
  data.normalizedPhone = phone
  return data
}
