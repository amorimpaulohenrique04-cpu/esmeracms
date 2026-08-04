import type { Field } from 'payload'

const operationalStatuses = new Set([
  'draft',
  'ready',
  'publishing',
  'pending_verification',
  'published',
  'published_but_unverified',
  'published_but_incompatible',
  'publish_reverted',
  'blocked',
  'conflict',
  'failed',
])

const verificationStatuses = new Set([
  'compatible',
  'incompatible',
  'revision_mismatch',
  'unavailable',
  'not_run',
])

const protectedField = {
  admin: {
    readOnly: true,
    position: 'sidebar' as const,
  },
  access: {
    create: () => false,
    update: () => false,
  },
}

export function publicationMetadataFields(): Field[] {
  return [
    {
      name: 'publicationRevision',
      type: 'text',
      index: true,
      ...protectedField,
    },
    {
      name: 'publicationContractVersion',
      type: 'text',
      ...protectedField,
    },
    {
      name: 'publicationOperationalStatus',
      type: 'text',
      index: true,
      validate: (value: unknown) =>
        !value || operationalStatuses.has(String(value)) || 'Status operacional inválido.',
      ...protectedField,
    },
    {
      name: 'publicationVerificationStatus',
      type: 'text',
      validate: (value: unknown) =>
        !value || verificationStatuses.has(String(value)) || 'Status de verificação inválido.',
      ...protectedField,
    },
    {
      name: 'publicationVerifiedAt',
      type: 'date',
      ...protectedField,
    },
    {
      name: 'publicationTraceId',
      type: 'text',
      index: true,
      ...protectedField,
    },
  ]
}
