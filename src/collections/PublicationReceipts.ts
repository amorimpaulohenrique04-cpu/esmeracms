import type { CollectionConfig } from 'payload'

import { admins, siteEditors } from '../access/roles'

const statusValues = new Set([
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

const verificationValues = new Set([
  'compatible',
  'incompatible',
  'revision_mismatch',
  'unavailable',
  'not_run',
])

function oneOf(values: Set<string>, label: string) {
  return (value: unknown) => !value || values.has(String(value)) || `${label} inválido.`
}

export const PublicationReceipts: CollectionConfig = {
  slug: 'publication-receipts',
  labels: {
    singular: 'Comprovante de publicação',
    plural: 'Comprovantes de publicação',
  },
  admin: {
    group: 'Admin técnico',
    hidden: true,
    useAsTitle: 'traceId',
    defaultColumns: ['traceId', 'entity', 'documentId', 'status', 'verificationStatus', 'completedAt'],
  },
  access: {
    read: siteEditors,
    create: () => false,
    update: () => false,
    delete: admins,
  },
  fields: [
    { name: 'traceId', type: 'text', required: true, unique: true, index: true },
    { name: 'parentTraceId', type: 'text', index: true },
    { name: 'operation', type: 'text', required: true },
    { name: 'source', type: 'text', required: true },
    { name: 'entity', type: 'text', required: true, index: true },
    { name: 'documentId', type: 'text', required: true, index: true },
    { name: 'actorId', type: 'text', required: true },
    { name: 'expectedRevision', type: 'text' },
    { name: 'savedRevision', type: 'text' },
    { name: 'publishedRevision', type: 'text', index: true },
    { name: 'previousPublishedRevision', type: 'text' },
    { name: 'previousEditorialRevision', type: 'text' },
    { name: 'observedRevision', type: 'text' },
    { name: 'previousVersionId', type: 'text' },
    {
      name: 'status',
      type: 'text',
      required: true,
      index: true,
      validate: oneOf(statusValues, 'Status operacional'),
    },
    {
      name: 'verificationStatus',
      type: 'text',
      validate: oneOf(verificationValues, 'Status de verificação'),
    },
    { name: 'contractVersion', type: 'text' },
    { name: 'retryable', type: 'checkbox', required: true, defaultValue: false },
    { name: 'verificationAttempts', type: 'json', required: true, defaultValue: [] },
    { name: 'rollback', type: 'json' },
    { name: 'issues', type: 'json', defaultValue: [] },
    { name: 'startedAt', type: 'date', required: true },
    { name: 'completedAt', type: 'date', required: true },
    { name: 'durationMs', type: 'number', required: true, min: 0 },
  ],
}
