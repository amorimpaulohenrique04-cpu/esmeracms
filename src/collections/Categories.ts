import {
  ValidationError,
  type Block,
  type CollectionConfig,
  type Field,
  type Where,
} from 'payload'

import { activeCategoriesOrAuthenticated, siteEditors } from '../access/roles'
import { getCategoryHierarchyIssues } from '../businessRules/categories/hierarchy'
import { seoField, slugify } from '../fields/common'
import { publicationMetadataFields } from '../server/publication/publicationMetadataFields'

const NODE_TYPES = ['collection', 'editorial', 'external', 'group'] as const
const TAXONOMY_AXES = ['navigation', 'piece_type', 'collection', 'environment', 'campaign', 'service'] as const
const LISTING_MODES = ['assigned', 'descendants', 'rules', 'hybrid'] as const
const PUBLIC_SORTS = ['editorial', 'newest', 'price_asc', 'price_desc', 'name_asc'] as const
const PUBLIC_FILTERS = ['category', 'collection', 'environment', 'piece_type', 'material', 'availability', 'price'] as const
const PRODUCT_AVAILABILITY = ['unique', 'available', 'made_to_order', 'limited'] as const
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:'])

type UnknownRecord = Record<string, unknown>

type CategoryState = UnknownRecord & {
  id?: string | number
  title?: string | null
  slug?: string | null
  status?: string | null
  parent?: unknown
  nodeType?: string | null
  listingMode?: string | null
  externalURL?: string | null
  hubPath?: string | null
  contentBlocks?: unknown[] | null
  collectionPage?: UnknownRecord | null
  listingRules?: UnknownRecord | null
  _status?: string | null
}

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function relationshipID(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  const relation = record(value)
  return typeof relation?.id === 'string' || typeof relation?.id === 'number' ? relation.id : null
}

function validExternalURL(value: unknown) {
  const candidate = text(value)
  if (!candidate) return false
  try {
    const url = new URL(candidate)
    return ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol) && url.protocol !== 'javascript:'
  } catch {
    return false
  }
}

function validHubPath(value: unknown) {
  const candidate = text(value)
  return candidate === '' || /^\/(?:[a-z0-9-]+\/?)*$/.test(candidate)
}

function placementField(): Field {
  return {
    name: 'placement',
    type: 'select',
    label: 'Posição',
    required: true,
    defaultValue: 'before',
    options: [
      { label: 'Antes dos produtos', value: 'before' },
      { label: 'Depois dos produtos', value: 'after' },
    ],
  }
}

const contentBlocks: Block[] = [
  {
    slug: 'richText',
    labels: { singular: 'Texto', plural: 'Textos' },
    fields: [placementField(), { name: 'content', type: 'richText', label: 'Conteúdo', required: true }],
  },
  {
    slug: 'image',
    labels: { singular: 'Imagem', plural: 'Imagens' },
    fields: [
      placementField(),
      { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem', required: true },
      { name: 'alt', type: 'text', label: 'Texto alternativo', required: true },
      { name: 'caption', type: 'text', label: 'Legenda' },
    ],
  },
  {
    slug: 'imageText',
    labels: { singular: 'Imagem com texto', plural: 'Imagens com texto' },
    fields: [
      placementField(),
      { name: 'eyebrow', type: 'text', label: 'Sobretítulo' },
      { name: 'title', type: 'text', label: 'Título', required: true },
      { name: 'copy', type: 'textarea', label: 'Texto', required: true },
      { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem', required: true },
      {
        name: 'imagePosition',
        type: 'select',
        label: 'Posição da imagem',
        defaultValue: 'left',
        options: [
          { label: 'Esquerda', value: 'left' },
          { label: 'Direita', value: 'right' },
        ],
      },
    ],
  },
  {
    slug: 'manifesto',
    labels: { singular: 'Manifesto', plural: 'Manifestos' },
    fields: [
      placementField(),
      { name: 'eyebrow', type: 'text', label: 'Sobretítulo' },
      { name: 'title', type: 'text', label: 'Título', required: true },
      { name: 'copy', type: 'textarea', label: 'Manifesto', required: true },
    ],
  },
  {
    slug: 'materialHighlight',
    labels: { singular: 'Destaque de material', plural: 'Destaques de material' },
    fields: [
      placementField(),
      { name: 'material', type: 'text', label: 'Material', required: true },
      { name: 'title', type: 'text', label: 'Título', required: true },
      { name: 'copy', type: 'textarea', label: 'Texto' },
      { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem' },
    ],
  },
  {
    slug: 'cta',
    labels: { singular: 'Chamada para ação', plural: 'Chamadas para ação' },
    fields: [
      placementField(),
      { name: 'title', type: 'text', label: 'Título' },
      { name: 'copy', type: 'textarea', label: 'Texto' },
      { name: 'label', type: 'text', label: 'Rótulo do botão', required: true },
      { name: 'destination', type: 'relationship', relationTo: 'categories', label: 'Destino interno' },
      {
        name: 'externalURL',
        type: 'text',
        label: 'Destino externo',
        validate: (value: unknown) => !text(value) || validExternalURL(value) || 'Informe uma URL absoluta segura.',
      },
    ],
  },
  {
    slug: 'gallery',
    labels: { singular: 'Galeria', plural: 'Galerias' },
    fields: [
      placementField(),
      {
        name: 'items',
        type: 'array',
        label: 'Imagens',
        required: true,
        minRows: 2,
        maxRows: 8,
        fields: [
          { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem', required: true },
          { name: 'alt', type: 'text', label: 'Texto alternativo', required: true },
        ],
      },
    ],
  },
  {
    slug: 'divider',
    labels: { singular: 'Divisor editorial', plural: 'Divisores editoriais' },
    fields: [placementField(), { name: 'label', type: 'text', label: 'Rótulo acessível' }],
  },
]

function publicationErrors(category: CategoryState, childCount: number) {
  const errors: Array<{ path: string; message: string; label: string }> = []
  const nodeType = text(category.nodeType) || 'collection'
  const listingMode = text(category.listingMode) || 'assigned'
  const collectionPage = record(category.collectionPage)
  const listingRules = record(category.listingRules)

  if (!NODE_TYPES.includes(nodeType as typeof NODE_TYPES[number])) {
    errors.push({ path: 'nodeType', message: 'Selecione um tipo de nó válido.', label: 'Selecione um tipo de nó válido.' })
  }

  if (nodeType === 'external' && !validExternalURL(category.externalURL)) {
    errors.push({ path: 'externalURL', message: 'Links externos publicados precisam de uma URL absoluta segura.', label: 'Links externos publicados precisam de uma URL absoluta segura.' })
  }

  if (nodeType === 'editorial' && !(category.contentBlocks || []).length && !text(category.description)) {
    errors.push({ path: 'contentBlocks', message: 'Uma página editorial publicada precisa de descrição ou conteúdo editorial.', label: 'Uma página editorial publicada precisa de descrição ou conteúdo editorial.' })
  }

  if (nodeType === 'group' && childCount === 0 && !text(category.hubPath)) {
    errors.push({ path: 'hubPath', message: 'Um agrupador publicado precisa de filhos ativos ou de uma rota de hub.', label: 'Um agrupador publicado precisa de filhos ativos ou de uma rota de hub.' })
  }

  if (nodeType === 'collection' && !LISTING_MODES.includes(listingMode as typeof LISTING_MODES[number])) {
    errors.push({ path: 'listingMode', message: 'A coleção precisa de um modo de listagem válido.', label: 'A coleção precisa de um modo de listagem válido.' })
  }

  if ((listingMode === 'rules' || listingMode === 'hybrid') && !listingRules) {
    errors.push({ path: 'listingRules', message: 'Configure ao menos uma regra para esta coleção automática.', label: 'Configure ao menos uma regra para esta coleção automática.' })
  }

  const productsPerPage = collectionPage?.productsPerPage
  if (productsPerPage !== undefined && productsPerPage !== null && (
    typeof productsPerPage !== 'number' || !Number.isInteger(productsPerPage) || productsPerPage < 1 || productsPerPage > 48
  )) {
    errors.push({ path: 'collectionPage.productsPerPage', message: 'Use entre 1 e 48 produtos por página.', label: 'Use entre 1 e 48 produtos por página.' })
  }

  const defaultSort = text(collectionPage?.defaultSort)
  if (defaultSort && !PUBLIC_SORTS.includes(defaultSort as typeof PUBLIC_SORTS[number])) {
    errors.push({ path: 'collectionPage.defaultSort', message: 'Selecione uma ordenação pública suportada.', label: 'Selecione uma ordenação pública suportada.' })
  }

  return errors
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  trash: true,
  labels: {
    singular: 'Categoria',
    plural: 'Categorias',
  },
  admin: {
    group: 'Site',
    useAsTitle: 'title',
    defaultColumns: ['title', 'nodeType', 'taxonomyAxis', 'status', 'parent', 'order', 'updatedAt'],
    listSearchableFields: ['title', 'slug'],
  },
  access: {
    admin: siteEditors,
    read: activeCategoriesOrAuthenticated,
    create: siteEditors,
    update: siteEditors,
    delete: siteEditors,
    readVersions: siteEditors,
  },
  versions: {
    drafts: true,
    maxPerDoc: 30,
  },
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        if (data.title && !data.slug) data.slug = slugify(String(data.title))

        const id = originalDoc?.id as string | number | undefined
        const parent = data.parent !== undefined ? data.parent : originalDoc?.parent
        const hierarchyIssues = await getCategoryHierarchyIssues(req, id, parent)
        if (hierarchyIssues.length) {
          throw new ValidationError({
            collection: 'categories',
            id,
            req,
            errors: hierarchyIssues.map((issue) => ({ path: issue.path, message: issue.message, label: issue.message })),
          })
        }

        const merged = { ...(originalDoc || {}), ...data } as CategoryState
        data.nodeType = text(merged.nodeType) || 'collection'
        data.taxonomyAxis = text(merged.taxonomyAxis) || 'navigation'
        data.listingMode = text(merged.listingMode) || 'assigned'

        if (!TAXONOMY_AXES.includes(String(data.taxonomyAxis) as typeof TAXONOMY_AXES[number])) {
          throw new ValidationError({
            collection: 'categories',
            id,
            req,
            errors: [{ path: 'taxonomyAxis', message: 'Selecione um eixo taxonômico válido.', label: 'Selecione um eixo taxonômico válido.' }],
          })
        }

        if (!validHubPath(merged.hubPath)) {
          throw new ValidationError({
            collection: 'categories',
            id,
            req,
            errors: [{ path: 'hubPath', message: 'Use uma rota interna como /colecao/pecas.', label: 'Use uma rota interna como /colecao/pecas.' }],
          })
        }

        if (text(merged.externalURL) && !validExternalURL(merged.externalURL)) {
          throw new ValidationError({
            collection: 'categories',
            id,
            req,
            errors: [{ path: 'externalURL', message: 'Informe uma URL absoluta com protocolo permitido.', label: 'Informe uma URL absoluta com protocolo permitido.' }],
          })
        }

        const rules = record(merged.listingRules)
        const minPrice = rules?.minPrice
        const maxPrice = rules?.maxPrice
        if (typeof minPrice === 'number' && typeof maxPrice === 'number' && minPrice > maxPrice) {
          throw new ValidationError({
            collection: 'categories',
            id,
            req,
            errors: [{ path: 'listingRules.maxPrice', message: 'O preço máximo precisa ser maior ou igual ao mínimo.', label: 'O preço máximo precisa ser maior ou igual ao mínimo.' }],
          })
        }

        const nextStatus = data.status ?? originalDoc?.status
        if (id !== undefined && nextStatus === 'archive') {
          const where: Where = {
            and: [
              { categories: { contains: id } },
              { catalogStatus: { equals: 'active' } },
              { _status: { equals: 'published' } },
            ],
          }
          const linked = await req.payload.count({
            collection: 'products',
            where,
            overrideAccess: true,
            req,
          })
          if (linked.totalDocs > 0) {
            throw new ValidationError({
              collection: 'categories',
              id,
              req,
              errors: [{
                path: 'status',
                message: `Arquive ou mova ${linked.totalDocs} produto(s) ativo(s) e publicado(s) antes de arquivar esta categoria.`,
                label: `Arquive ou mova ${linked.totalDocs} produto(s) ativo(s) e publicado(s) antes de arquivar esta categoria.`,
              }],
            })
          }
        }

        const publishing = (data._status ?? originalDoc?._status) === 'published'
        if (publishing) {
          const categoryID = id ?? relationshipID(merged.id)
          const childCount = categoryID === null || categoryID === undefined
            ? 0
            : (await req.payload.count({
              collection: 'categories',
              where: {
                and: [
                  { parent: { equals: categoryID } },
                  { status: { equals: 'active' } },
                  { _status: { equals: 'published' } },
                ],
              },
              overrideAccess: true,
              req,
            })).totalDocs
          const errors = publicationErrors({ ...merged, ...data }, childCount)
          if (errors.length) {
            throw new ValidationError({ collection: 'categories', id, req, errors })
          }
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
          label: 'Categoria',
          fields: [
            {
              name: 'title',
              type: 'text',
              label: 'Nome',
              required: true,
              unique: true,
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
              name: 'status',
              type: 'select',
              dbName: 'category_state',
              label: 'Status',
              required: true,
              defaultValue: 'active',
              options: [
                { label: 'Ativa', value: 'active' },
                { label: 'Arquivada', value: 'archive' },
              ],
              admin: {
                description: 'Status controla participação no catálogo. Publicação é controlada separadamente pelo workflow do Payload.',
              },
            },
            {
              name: 'nodeType',
              type: 'select',
              label: 'Tipo do nó',
              required: true,
              defaultValue: 'collection',
              index: true,
              options: [
                { label: 'Coleção com produtos', value: 'collection' },
                { label: 'Página editorial', value: 'editorial' },
                { label: 'Link externo', value: 'external' },
                { label: 'Agrupador de navegação', value: 'group' },
              ],
            },
            {
              name: 'taxonomyAxis',
              type: 'select',
              label: 'Eixo taxonômico',
              required: true,
              defaultValue: 'navigation',
              index: true,
              options: [
                { label: 'Navegação', value: 'navigation' },
                { label: 'Tipo de peça', value: 'piece_type' },
                { label: 'Coleção', value: 'collection' },
                { label: 'Ambiente', value: 'environment' },
                { label: 'Campanha', value: 'campaign' },
                { label: 'Serviço', value: 'service' },
              ],
            },
            {
              name: 'parent',
              type: 'relationship',
              relationTo: 'categories',
              label: 'Categoria principal',
              admin: {
                description: 'A hierarquia é validada no servidor; relações cíclicas são rejeitadas.',
              },
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Descrição',
            },
            {
              name: 'order',
              type: 'number',
              label: 'Ordem editorial',
              defaultValue: 100,
              min: 0,
              index: true,
              admin: { step: 1 },
              validate: (value: unknown) =>
                value === null || value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= 0) || 'Use um número inteiro maior ou igual a zero.',
            },
            {
              name: 'menu',
              type: 'group',
              label: 'Configuração do menu',
              fields: [
                { name: 'showInMenu', type: 'checkbox', label: 'Exibir no menu', defaultValue: false },
                { name: 'label', type: 'text', label: 'Rótulo no menu', maxLength: 48 },
                {
                  name: 'visibility',
                  type: 'select',
                  label: 'Visibilidade',
                  defaultValue: 'all',
                  options: [
                    { label: 'Desktop e mobile', value: 'all' },
                    { label: 'Somente desktop', value: 'desktop' },
                    { label: 'Somente mobile', value: 'mobile' },
                  ],
                },
                { name: 'icon', type: 'text', label: 'Ícone opcional', maxLength: 40 },
              ],
            },
            {
              name: 'listingMode',
              type: 'select',
              label: 'Modo de listagem',
              required: true,
              defaultValue: 'assigned',
              options: [
                { label: 'Produtos atribuídos', value: 'assigned' },
                { label: 'Categoria e descendentes', value: 'descendants' },
                { label: 'Regras automáticas', value: 'rules' },
                { label: 'Atribuídos + regras', value: 'hybrid' },
              ],
            },
            {
              name: 'listingRules',
              type: 'group',
              label: 'Regras de listagem',
              admin: {
                condition: (_, siblingData) => siblingData?.listingMode === 'rules' || siblingData?.listingMode === 'hybrid',
              },
              fields: [
                {
                  name: 'availability',
                  type: 'select',
                  hasMany: true,
                  label: 'Disponibilidade',
                  options: PRODUCT_AVAILABILITY.map((value) => ({ label: value.replaceAll('_', ' '), value })),
                },
                {
                  name: 'materials',
                  type: 'array',
                  label: 'Materiais',
                  maxRows: 20,
                  fields: [{ name: 'value', type: 'text', label: 'Material', required: true }],
                },
                {
                  name: 'productStatus',
                  type: 'select',
                  hasMany: true,
                  label: 'Status do catálogo',
                  defaultValue: ['active'],
                  options: [
                    { label: 'Ativo', value: 'active' },
                    { label: 'Arquivado', value: 'archived' },
                  ],
                },
                { name: 'minPrice', type: 'number', label: 'Preço mínimo (centavos)', min: 0 },
                { name: 'maxPrice', type: 'number', label: 'Preço máximo (centavos)', min: 0 },
                { name: 'publishedAfter', type: 'date', label: 'Publicado depois de' },
                { name: 'publishedBefore', type: 'date', label: 'Publicado antes de' },
                {
                  name: 'sort',
                  type: 'select',
                  label: 'Ordenação da regra',
                  options: PUBLIC_SORTS.map((value) => ({ label: value.replaceAll('_', ' '), value })),
                },
              ],
            },
            {
              name: 'collectionPage',
              type: 'group',
              label: 'Página da coleção',
              fields: [
                { name: 'eyebrow', type: 'text', label: 'Sobretítulo', maxLength: 80 },
                { name: 'shortDescription', type: 'textarea', label: 'Descrição curta', maxLength: 320 },
                {
                  name: 'visibleFilters',
                  type: 'select',
                  hasMany: true,
                  label: 'Filtros visíveis',
                  defaultValue: ['category', 'material', 'availability', 'price'],
                  options: PUBLIC_FILTERS.map((value) => ({ label: value.replaceAll('_', ' '), value })),
                },
                {
                  name: 'defaultSort',
                  type: 'select',
                  label: 'Ordenação padrão',
                  defaultValue: 'editorial',
                  options: PUBLIC_SORTS.map((value) => ({ label: value.replaceAll('_', ' '), value })),
                },
                { name: 'productsPerPage', type: 'number', label: 'Produtos por página', defaultValue: 24, min: 1, max: 48 },
                { name: 'showProductCount', type: 'checkbox', label: 'Exibir contagem de produtos', defaultValue: true },
                {
                  name: 'layout',
                  type: 'select',
                  label: 'Layout',
                  defaultValue: 'grid',
                  options: [
                    { label: 'Grade regular', value: 'grid' },
                    { label: 'Grade com inserções editoriais', value: 'editorial' },
                  ],
                },
              ],
            },
            {
              name: 'externalURL',
              type: 'text',
              label: 'URL externa',
              admin: { condition: (_, siblingData) => siblingData?.nodeType === 'external' },
              validate: (value: unknown) => !text(value) || validExternalURL(value) || 'Informe uma URL absoluta segura.',
            },
            {
              name: 'hubPath',
              type: 'text',
              label: 'Rota do hub',
              admin: { condition: (_, siblingData) => siblingData?.nodeType === 'group' },
              validate: (value: unknown) => validHubPath(value) || 'Use uma rota interna como /colecao/pecas.',
            },
          ],
        },
        {
          label: 'Descoberta',
          fields: [
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              label: 'Imagem',
            },
            {
              name: 'searchTerms',
              type: 'array',
              label: 'Sinônimos de busca',
              fields: [{ name: 'term', type: 'text', label: 'Termo', required: true }],
            },
            {
              name: 'contentBlocks',
              type: 'blocks',
              label: 'Conteúdo editorial',
              maxRows: 20,
              blocks: contentBlocks,
            },
            {
              name: 'menuHighlights',
              type: 'array',
              label: 'Destaques do menu',
              maxRows: 4,
              fields: [
                { name: 'title', type: 'text', label: 'Título' },
                { name: 'eyebrow', type: 'text', label: 'Sobretítulo' },
                { name: 'description', type: 'textarea', label: 'Descrição', maxLength: 240 },
                { name: 'image', type: 'upload', relationTo: 'media', label: 'Imagem' },
                { name: 'linkLabel', type: 'text', label: 'Rótulo do link' },
                { name: 'destination', type: 'relationship', relationTo: 'categories', label: 'Destino interno' },
                {
                  name: 'externalURL',
                  type: 'text',
                  label: 'Destino externo',
                  validate: (value: unknown) => !text(value) || validExternalURL(value) || 'Informe uma URL absoluta segura.',
                },
              ],
            },
            seoField(),
          ],
        },
      ],
    },
    ...publicationMetadataFields(),
  ],
}
