import type { CollectionConfig, PayloadRequest } from 'payload'

import { publishedProductsOrAuthenticated, siteEditors } from '../access/roles'
import { seoField, slugify } from '../fields/common'

type RelationValue = string | number | { id?: string | number | null; alt?: string | null } | null | undefined

type GalleryItem = {
  image?: RelationValue
  mediaKey?: string | null
  role?: string | null
  alt?: string | null
  altOverride?: string | null
}

type OptionDefinition = {
  code?: string | null
  values?: Array<{ value?: string | null }> | null
}

type VariantItem = {
  sku?: string | null
  status?: string | null
  priceMode?: string | null
  priceCents?: number | null
  selection?: Array<{ option?: string | null; value?: string | null }> | null
  mediaKeys?: Array<{ key?: string | null }> | null
}

type ProductSiblingData = {
  _status?: string | null
  title?: string | null
  slug?: string | null
  code?: string | null
  catalogStatus?: string | null
  categories?: unknown[] | null
  gallery?: GalleryItem[] | null
  availability?: string | null
  priceMode?: string | null
  basePriceCents?: number | null
  optionDefinitions?: OptionDefinition[] | null
  variants?: VariantItem[] | null
}

function relationId(value: RelationValue) {
  if (value && typeof value === 'object') return value.id ?? null
  return value ?? null
}

function validateGallery(value: unknown) {
  const items = (Array.isArray(value) ? value : []) as GalleryItem[]
  const keys = items.map((item) => item.mediaKey).filter(Boolean)
  if (new Set(keys).size !== keys.length) return 'As chaves de mídia não podem se repetir.'
  if (items.filter((item) => item.role === 'cover').length > 1) return 'Defina no máximo uma imagem como capa.'
  return true
}

function validateOptionDefinitions(value: unknown) {
  const definitions = (Array.isArray(value) ? value : []) as OptionDefinition[]
  const codes = definitions.map((item) => item.code).filter(Boolean)
  if (new Set(codes).size !== codes.length) return 'Os códigos das opções não podem se repetir.'
  for (const definition of definitions) {
    const values = (definition.values || []).map((item) => item.value).filter(Boolean)
    if (new Set(values).size !== values.length) return `Não repita valores na opção ${definition.code || ''}.`
  }
  return true
}

function validateVariants(value: unknown, { siblingData }: { siblingData?: ProductSiblingData }) {
  const variants = (Array.isArray(value) ? value : []) as VariantItem[]
  const skus = new Set<string>()
  const combinations = new Set<string>()
  const definitions = new Map((siblingData?.optionDefinitions || []).map((option) => [option.code, new Set((option.values || []).map((item) => item.value))]))
  const mediaKeys = new Set((siblingData?.gallery || []).map((item) => item.mediaKey))

  for (const variant of variants) {
    if (variant.sku) {
      if (skus.has(variant.sku)) return `O código de variante ${variant.sku} está repetido.`
      skus.add(variant.sku)
    }

    const optionCodes = (variant.selection || []).map((item) => item.option).filter(Boolean)
    if (new Set(optionCodes).size !== optionCodes.length) return `A variante ${variant.sku || ''} repete uma opção na combinação.`

    for (const item of variant.selection || []) {
      const allowed = definitions.get(item.option)
      if (!allowed) return `A variante ${variant.sku || ''} usa a opção inexistente ${item.option || ''}.`
      if (!allowed.has(item.value)) return `A variante ${variant.sku || ''} usa o valor inexistente ${item.value || ''}.`
    }

    const combination = (variant.selection || []).map((item) => `${item.option || ''}:${item.value || ''}`).sort().join('|')
    if (combination) {
      if (combinations.has(combination)) return `A combinação ${combination} está duplicada.`
      combinations.add(combination)
    }

    for (const media of variant.mediaKeys || []) {
      if (media.key && !mediaKeys.has(media.key)) return `A variante ${variant.sku || ''} aponta para a mídia inexistente ${media.key}.`
    }
  }

  return true
}

async function hasResolvedAlt(item: GalleryItem, req: PayloadRequest) {
  if (String(item.altOverride || item.alt || '').trim()) return true
  if (item.image && typeof item.image === 'object' && String(item.image.alt || '').trim()) return true
  const id = relationId(item.image)
  if (!id) return false
  try {
    const media = await req.payload.findByID({
      collection: 'media',
      id,
      depth: 0,
      overrideAccess: false,
      req,
    })
    return Boolean(String(media?.alt || '').trim())
  } catch {
    return false
  }
}

async function getPublishReadinessIssues(product: ProductSiblingData, req: PayloadRequest) {
  const issues: string[] = []
  const gallery = product.gallery || []
  const activeVariants = (product.variants || []).filter((variant) => variant.status !== 'disabled')

  if (!String(product.title || '').trim()) issues.push('título')
  if (!String(product.slug || '').trim() || !/^[a-z0-9-]+$/.test(String(product.slug))) issues.push('slug válido')
  if (!String(product.code || '').trim()) issues.push('código')
  if (!product.availability || product.availability === 'archive') issues.push('disponibilidade')

  if (product.catalogStatus === 'active') {
    if (!product.categories?.length) issues.push('pelo menos uma categoria')
    if (!gallery.length) issues.push('pelo menos uma imagem')
    if (gallery.length && gallery.filter((item) => item.role === 'cover').length !== 1) issues.push('uma imagem definida como capa')
  }

  if (product.priceMode === 'fixed') {
    const hasBasePrice = typeof product.basePriceCents === 'number'
    const hasVariantPrice = activeVariants.some((variant) => variant.priceMode === 'fixed' && typeof variant.priceCents === 'number')
    if (!hasBasePrice && !hasVariantPrice) issues.push('preço base ou preço de variante')
  }

  if (gallery.length) {
    const altChecks = await Promise.all(gallery.map((item) => hasResolvedAlt(item, req)))
    if (altChecks.some((valid) => !valid)) issues.push('texto alternativo nas imagens')
  }

  return issues
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
    read: publishedProductsOrAuthenticated,
    create: siteEditors,
    update: siteEditors,
    delete: siteEditors,
    readVersions: siteEditors,
  },
  versions: {
    drafts: {
      validate: false,
    },
    maxPerDoc: 50,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.title && !data.slug) data.slug = slugify(String(data.title))
        if (data?.code) data.code = String(data.code).trim().toUpperCase()
        if (data?.availability === 'archive') {
          data.catalogStatus = 'archive'
          data.availability = 'available'
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        const next = { ...(originalDoc || {}), ...(data || {}) } as ProductSiblingData
        if (next._status !== 'published') return data
        const issues = await getPublishReadinessIssues(next, req)
        if (issues.length) {
          throw new Error(`Produto não está pronto para publicar: ${issues.join(', ')}.`)
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
                { label: 'Arquivado', value: 'archive' },
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
              admin: {
                description: 'Pode ficar vazio durante o rascunho; produto ativo precisa de categoria para publicar.',
              },
            },
            {
              name: 'material',
              type: 'text',
              label: 'Material',
              admin: {
                description: 'Mantido como texto até existir uma taxonomia de materiais aprovada; não é usado como facet crítico.',
              },
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
              admin: { description: 'A imagem marcada como Capa é a principal. Em rascunho a galeria pode permanecer incompleta.' },
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
                  name: 'altOverride',
                  type: 'text',
                  label: 'Texto alternativo contextual',
                  maxLength: 180,
                  admin: { description: 'Opcional. Quando vazio, o frontend deve usar o alt padrão da Mídia.' },
                },
                {
                  name: 'alt',
                  type: 'text',
                  label: 'Texto alternativo legado',
                  maxLength: 180,
                  admin: {
                    hidden: true,
                    description: 'Compatibilidade temporária para registros existentes; será removido após migração de dados.',
                  },
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
              admin: { description: 'Arquivamento pertence exclusivamente ao Status de catálogo.' },
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
                description: 'Storage em centavos. A UI monetária dedicada será a camada de apresentação deste valor.',
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
                  admin: {
                    condition: (_, siblingData) => siblingData?.priceMode === 'fixed',
                    description: 'A completude de preço é verificada no publish, não durante o trabalho em draft.',
                  },
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
  ],
}
