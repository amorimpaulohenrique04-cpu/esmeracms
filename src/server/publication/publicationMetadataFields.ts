import type { Field } from 'payload'

export function publicationMetadataFields(): Field[] {
  return [
    {
      name: 'publicationRevision',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'publicationContractVersion',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
  ]
}
