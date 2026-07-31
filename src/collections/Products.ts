import { ValidationError, type CollectionConfig, type Where } from 'payload'

import { publishedProductsOrAuthenticated, siteEditors } from '../access/roles'
import {
  getOptionDefinitionIssues,
  getProductReadiness,
  getVariantIssues,
  type ProductReadinessInput,
} from '../businessRules/products/readiness'
import { seoField, slugify } from '../fields/common'

type GalleryItem = {
  mediaKey?: string | null
  role?: string | null
}

type OptionDefinition = {
  code?: string | null
  values?: Array<{ value?: string | null }> | null
}

type VariantItem = {
  sku?: string | null
  selection?: Array<{ option?: string | null; value?: string | null }> | null
  mediaKeys?: Array<{ key?: string | null }> | null
}

type ProductSiblingData = {
  catalogStatus?: string
  optionDefinitions?: OptionDefinition[]
  gallery?: GalleryItem[]
  priceMode?: string
  basePriceCents?: number | null
  variants?: VariantItem[]
}

function validateGallery(value: unknown, { siblingData }: { siblingData?: ProductSiblingData }) {
  const items = (Array.isArray(value) ? value : []) as GalleryItem[]
  if (siblingData?.catalogStatus === 'active' && items.length === 0) return 'Um produto ativo precisa ter pelo menos uma imagem.'
  const keys = items.map((item) => item.mediaKey).filter(Boolean)
  if (new Set(keys).size !== keys.length) return 'As chaves de mídia não podem se repetir.'
  if (items.filter((item) => item.role === 'cover').length > 1) return 'Defina no máximo uma imagem como capa.'
  return true
}

function validateOptionDefinitions(value: unknown) {
  return getOptionDefinitionIssues(value)[0] || true
}

function validateVariants(value: unknown, { siblingData }: { siblingData?: ProductSiblingData }) {
  return getVariantIssues({ ...(siblingData || {}), variants: Array.isArray(value) ? value as VariantItem[] : [] })[0] || true
}

export const Products: CollectionConfig = {
  slug: 'products',
  trash: true,
  labels: {
    singular: 'Produto',
    plural: 'Produtos',
  },
  admin: {
    group: 'Site',
    useAsTitle: 'title',
    defaultColumns: ['title', 'code', 'catalogStatus', 'availability', '_status', 'updatedAt'],
    listSearchableFields: ['title', 'subtitle', 'code', 'material'],
  },
  access: {
    admin: siteEditors,
    read: publishedProductsOrAuthenticated,
    create: siteEditors,
    update: siteEditors,
    delete: siteEditors,
    readVersions: siteEditors,
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const id = originalDoc?.id as number | string | undefined
        if (data?.title && !data.slug) data.slug = slugify(String(data.title))
        if (data?.code) data.code = String(data.code).trim().toUpperCase()
        if (Array.isArray(data.gallery)) {
          data.gallery = data.gallery.map((item: GalleryItem) => ({
            ...item,
            mediaKey: item.mediaKey ? slugify(String(item.mediaKey)) : item.mediaKey,
          }))
        }
        if (Array.isArray(data.optionDefinitions)) {
          data.optionDefinitions = data.optionDefinitions.map((definition: OptionDefinition) => ({
            ...definition,
            code: definition.code ? slugify(String(definition.code)) : definition.code,
            values: definition.values?.map((item) => ({
              ...item,
              value: item.value ? slugify(String(item.value)) : item.value,
            })),
          }))
        }
        if (Array.isArray(data.variants)) {
          data.variants = data.variants.map((variant: VariantItem) => ({
            ...variant,
            sku: variant.sku ? String(variant.sku).trim().toUpperCase() : variant.sku,
            selection: variant.selection?.map((item) => ({
              ...item,
              option: item.option ? slugify(String(item.option)) : item.option,
              value: item.value ? slugify(String(item.value)) : item.value,
            })),
            mediaKeys: variant.mediaKeys?.map((item) => ({
              ...item,
              key: item.key ? slugify(String(item.key)) : item.key,
            })),
          }))
        }

        const product = { ...(originalDoc || {}), ...data } as ProductReadinessInput
        const readiness = getProductReadiness(product)
        data.publicationReady = readiness.ready
        data.publicationIssues = readiness.issues.map((message) => ({ message }))

        const skus = (product.variants || []).map((variant) => variant.sku).filter(Boolean) as string[]
        if (skus.length) {
          const conditions: Where[] = [{ 'variants.sku': { in: skus } }]
          if (id !== undefined && id !== null) conditions.push({ id: { not_equals: id } })
          const duplicate = await req.payload.find({
            collection: 'products',
            depth: 0,
            limit: 1,
            pagination: false,
            overrideAccess: true,
            req,
            where: { and: conditions },
          })
          if (duplicate.docs.length) {
            throw new ValidationError({
              collection: 'products',
              id: id ?? undefined,
              req,
              errors: [{ path: 'variants', message: 'Cada SKU deve ser único em todo o catálogo.' }],
            })
          }
        }

        if (product._status === 'published' && !readiness.ready) {
          throw new ValidationError({
            collection: 'products',
            id: id ?? undefined,
            req,
            errors: readiness.issues.map((message) => ({ path: 'publicationIssues', message })),
          })
        }
        return data
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Identidade',
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Título',
              required: true,
              unique: true,
            },
            {
              name: 'subtitle',
              type: 'text',
              label: 'Subtítulo',
            },
            {
              name: 'slug',
              type: 'text',
              label: 'Slug',
              required: true,
              unique: true,
              index: true,
              validate: (value: unknown) =>
                /^[a-z0-9-]+$/.test(String(value || '')) || 'Use letras minúsculas, números e hífens.',
            },
            {
              name: 'code',
              type: 'text',
              label: 'Código',
              required: true,
              unique: true,
              index: true,
              admin: { description: 'Identificador interno, como OBJ-021.' },
            },
            {
              name: 'catalogStatus',
              type: 'select',
              label: 'Status de catálogo',
              required: true,
              defaultValue: 'active',
              options: [
                { label: 'Ativo', value: 'active' },
                { label: 'Arquivado', value: 'archived' },
              ],
              admin: {
                description: 'Rascunho/publicação é controlado separadamente pelo workflow do Payload.',
              },
            },
            {
              name: 'categories',
              type: 'relationship',
              relationTo: 'categories',
              hasMany: true,
              label: 'Categorias',
              validate: (value: unknown, { siblingData }: { siblingData?: { catalogStatus?: string } }) => {
                const values = Array.isArray(value) ? value : []
                return siblingData?.catalogStatus !== 'active' || values.length > 0 || 'Um produto ativo precisa ter categoria.'
              },
            },
            {
              name: 'material',
              type: 'text',
              label: 'Material',
            },
            {
              name: 'description',
              type: 'richText',
              label: 'Descrição editorial',
            },
            {
              name: 'edition',
              type: 'text',
              label: 'Edição',
              admin: { description: 'Exemplo: peça única, edição de 8 ou numerada.' },
            },
            {
              name: 'attributes',
              type: 'array',
              label: 'Ficha técnica',
              fields: [
                { name: 'label', type: 'text', label: 'Nome', required: true },
                { name: 'value', type: 'text', label: 'Valor', required: true },
              ],
            },
          ],
        },
        {
          label: 'Galeria',
          fields: [
            {
              name: 'gallery',
              type: 'array',
              label: 'Galeria',
              maxRows: 12,
              validate: validateGallery,
              admin: { description: 'A imagem marcada como Capa é a principal.' },
              fields: [
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Imagem',
                  required: true,
                },
                {
                  name: 'mediaKey',
                  type: 'text',
                  label: 'Chave da mídia',
                  required: true,
                  admin: { description: 'Exemplo: verde-frente. Usada por variantes.' },
                  validate: (value: unknown) =>
                    /^[a-z0-9-]+$/.test(String(value || '')) || 'Use letras minúsculas, números e hífens.',
                },
                {
                  name: 'role',
                  type: 'select',
                  label: 'Uso principal',
                  required: true,
                  options: [
                    { label: 'Capa', value: 'cover' },
                    { label: 'Detalhe', value: 'detail' },
                    { label: 'Contexto', value: 'context' },
                    { label: 'Escala', value: 'scale' },
                  ],
                },
                {
                  name: 'alt',
                  type: 'text',
                  label: 'Texto alternativo',
                  required: true,
                  maxLength: 180,
                },
              ],
            },
          ],
        },
        {
          label: 'Comercial',
          fields: [
            {
              name: 'availability',
              type: 'select',
              label: 'Disponibilidade',
              required: true,
              defaultValue: 'available',
              options: [
                { label: 'Peça única', value: 'unique' },
                { label: 'Disponível', value: 'available' },
                { label: 'Sob encomenda', value: 'made_to_order' },
                { label: 'Edição limitada', value: 'limited' },
              ],
            },
            {
              name: 'priceMode',
              type: 'select',
              label: 'Modo de preço',
              required: true,
              defaultValue: 'inquiry',
              options: [
                { label: 'Preço fixo', value: 'fixed' },
                { label: 'Sob consulta', value: 'inquiry' },
              ],
            },
            {
              name: 'basePriceCents',
              type: 'number',
              label: 'Preço base em centavos',
              min: 0,
              admin: {
                condition: (_, siblingData) => siblingData?.priceMode === 'fixed',
                description: 'Exemplo: R$ 14.900,00 = 1490000.',
              },
              validate: (value: unknown, { siblingData }: { siblingData?: { priceMode?: string; variants?: Array<{ status?: string; priceMode?: string; priceCents?: number }> } }) => {
                if (siblingData?.priceMode !== 'fixed') return true
                if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return true
                const hasVariantPrice = (siblingData?.variants || []).some((variant) =>
                  variant.status !== 'disabled' && variant.priceMode === 'fixed' && typeof variant.priceCents === 'number',
                )
                return hasVariantPrice || 'Informe o preço base ou um preço próprio em uma variante ativa.'
              },
            },
          ],
        },
        {
          label: 'Variantes',
          fields: [
            {
              name: 'optionDefinitions',
              type: 'array',
              label: 'Opções',
              admin: { description: 'Cadastre Tamanho, Cor, Kit e seus valores antes das combinações.' },
              validate: validateOptionDefinitions,
              fields: [
                {
                  name: 'code',
                  type: 'text',
                  label: 'Código',
                  required: true,
                  validate: (value: unknown) =>
                    /^[a-z0-9-]+$/.test(String(value || '')) || 'Use um código como tamanho ou cor.',
                },
                { name: 'label', type: 'text', label: 'Nome', required: true },
                {
                  name: 'values',
                  type: 'array',
                  label: 'Valores disponíveis',
                  minRows: 1,
                  required: true,
                  fields: [
                    {
                      name: 'value',
                      type: 'text',
                      label: 'Código',
                      required: true,
                      validate: (value: unknown) =>
                        /^[a-z0-9-]+$/.test(String(value || '')) || 'Use letras minúsculas, números e hífens.',
                    },
                    { name: 'label', type: 'text', label: 'Nome visível', required: true },
                    {
                      name: 'swatch',
                      type: 'text',
                      label: 'Amostra de cor',
                      validate: (value: unknown) =>
                        !value || /^#[0-9a-fA-F]{6}$/.test(String(value)) || 'Use uma cor hexadecimal, como #324F46.',
                    },
                  ],
                },
              ],
            },
            {
              name: 'variants',
              type: 'array',
              label: 'Combinações',
              validate: validateVariants,
              fields: [
                { name: 'sku', type: 'text', label: 'Código da variante', required: true },
                {
                  name: 'selection',
                  type: 'array',
                  label: 'Combinação',
                  minRows: 1,
                  fields: [
                    { name: 'option', type: 'text', label: 'Código da opção', required: true },
                    { name: 'value', type: 'text', label: 'Código do valor', required: true },
                  ],
                },
                {
                  name: 'priceMode',
                  type: 'select',
                  label: 'Preço',
                  required: true,
                  defaultValue: 'inherit',
                  options: [
                    { label: 'Herdar do produto', value: 'inherit' },
                    { label: 'Preço próprio', value: 'fixed' },
                    { label: 'Sob consulta', value: 'inquiry' },
                  ],
                },
                {
                  name: 'priceCents',
                  type: 'number',
                  label: 'Preço em centavos',
                  min: 0,
                  admin: { condition: (_, siblingData) => siblingData?.priceMode === 'fixed' },
                  validate: (value: unknown, { siblingData }: { siblingData?: { priceMode?: string } }) =>
                    siblingData?.priceMode !== 'fixed' || (typeof value === 'number' && Number.isInteger(value) && value >= 0) || 'Informe o preço da variante em centavos inteiros.',
                },
                {
                  name: 'status',
                  type: 'select',
                  label: 'Status',
                  required: true,
                  defaultValue: 'enabled',
                  options: [
                    { label: 'Ativa', value: 'enabled' },
                    { label: 'Desabilitada', value: 'disabled' },
                  ],
                },
                {
                  name: 'mediaKeys',
                  type: 'array',
                  label: 'Fotos priorizadas',
                  fields: [{ name: 'key', type: 'text', label: 'Chave da mídia', required: true }],
                },
              ],
            },
          ],
        },
        {
          label: 'Busca e SEO',
          fields: [
            {
              name: 'searchTerms',
              type: 'array',
              label: 'Termos e sinônimos',
              fields: [{ name: 'term', type: 'text', label: 'Termo', required: true }],
            },
            {
              name: 'tags',
              type: 'array',
              label: 'Tags editoriais',
              fields: [{ name: 'tag', type: 'text', label: 'Tag', required: true }],
            },
            seoField(),
          ],
        },
      ],
    },
    {
      name: 'publicationReady',
      type: 'checkbox',
      label: 'Pronto para publicação',
      defaultValue: false,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'publicationIssues',
      type: 'array',
      label: 'Pendências de publicação',
      admin: { readOnly: true, position: 'sidebar' },
      fields: [{ name: 'message', type: 'text', required: true }],
    },
  ],
}
