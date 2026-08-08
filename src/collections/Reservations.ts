import type { CollectionConfig } from 'payload'

import { siteEditors } from '../access/roles'

/**
 * Livro-razão de reservas do fluxo transacional (plano §16).
 *
 * Criada exclusivamente pelo endpoint público de reserva (overrideAccess);
 * no admin é somente leitura/gestão para editores. Sem versões — cada reserva
 * é um evento imutável de estado, não um documento editorial.
 *
 * A atomicidade em peça única vem do índice único PARCIAL sobre
 * (product_id) WHERE unique_piece AND status IN ('held','confirmed'),
 * criado na migração 20260808_140000_reservations.
 */
export const Reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: 'Reserva', plural: 'Reservas' },
  admin: {
    group: 'Vendas',
    useAsTitle: 'idempotencyKey',
    defaultColumns: ['productSlug', 'status', 'reservedUntil', 'updatedAt'],
  },
  access: {
    read: siteEditors,
    create: siteEditors,
    update: siteEditors,
    delete: siteEditors,
  },
  fields: [
    { name: 'productId', type: 'number', required: true, index: true, admin: { readOnly: true } },
    { name: 'productSlug', type: 'text', required: true, index: true, admin: { readOnly: true } },
    { name: 'variantSku', type: 'text', admin: { readOnly: true } },
    {
      name: 'uniquePiece',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { readOnly: true, description: 'Peça única: no máximo uma reserva ativa.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'held',
      index: true,
      options: [
        { label: 'Em espera', value: 'held' },
        { label: 'Confirmada', value: 'confirmed' },
        { label: 'Liberada', value: 'released' },
        { label: 'Expirada', value: 'expired' },
      ],
    },
    {
      name: 'idempotencyKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
    },
    { name: 'reservedUntil', type: 'date', admin: { readOnly: true } },
    { name: 'priceCents', type: 'number', min: 0, admin: { readOnly: true } },
    { name: 'buyerRef', type: 'text', admin: { readOnly: true, description: 'Referência do comprador (sessão/e-mail).' } },
  ],
}
