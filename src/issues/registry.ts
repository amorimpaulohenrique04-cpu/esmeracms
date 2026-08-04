/**
 * Registry determinístico de localização editorial: path → aba, rótulo e âncora.
 *
 * É a única fonte de verdade sobre onde um campo mora no editor. A resolução é
 * puramente estrutural — parte do path, nunca da mensagem — e suporta paths
 * indexados (`gallery.1.alt`) interpolando o índice em rótulos e âncoras.
 *
 * `suggestion` NÃO mora aqui: é copy editorial e vive em `copy.ts`, para ficar
 * dentro do raio de teste do ERR-U02.
 */

export type EditorialFieldLocation = {
  tab: string
  label: string
  anchor?: string
}

/** Aba usada quando um path arbitrário do Payload não casa com nenhuma entrada. */
export const defaultEntityTabs: Record<string, string> = {
  product: 'review',
  category: 'content',
  home: 'overview',
}

export const DEFAULT_FALLBACK_TAB = 'review'

/**
 * Chaves são paths com os índices removidos (`gallery.1.alt` → `gallery.alt`).
 * `{1}`, `{2}`… em `label`/`anchor` são substituídos pelos índices capturados,
 * convertidos para base 1 — `gallery.1.alt` exibe "imagem 2".
 */
export const editorialFieldRegistries: Record<string, Record<string, EditorialFieldLocation>> = {
  product: {
    id: { tab: 'identity', label: 'Identificador', anchor: 'product-code' },
    title: { tab: 'identity', label: 'Título', anchor: 'product-title' },
    slug: { tab: 'identity', label: 'Endereço da peça', anchor: 'product-slug' },
    code: { tab: 'identity', label: 'Código', anchor: 'product-code' },
    categories: { tab: 'identity', label: 'Categorias', anchor: 'product-categories' },
    catalogStatus: { tab: 'identity', label: 'Status de catálogo', anchor: 'product-catalog-status' },

    availability: { tab: 'commercial', label: 'Disponibilidade', anchor: 'product-availability' },
    priceMode: { tab: 'commercial', label: 'Modo de preço', anchor: 'product-price-mode' },
    basePriceCents: { tab: 'commercial', label: 'Preço base', anchor: 'product-base-price' },

    gallery: { tab: 'gallery', label: 'Galeria', anchor: 'product-gallery' },
    'gallery.image': { tab: 'gallery', label: 'Imagem {1}', anchor: 'product-gallery-item-{1}' },
    'gallery.alt': { tab: 'gallery', label: 'Texto alternativo da imagem {1}', anchor: 'product-gallery-item-{1}-alt' },
    'gallery.image.alt': { tab: 'gallery', label: 'Texto alternativo da imagem {1}', anchor: 'product-gallery-item-{1}-alt' },

    optionDefinitions: { tab: 'variants', label: 'Opções', anchor: 'product-options' },
    'optionDefinitions.code': { tab: 'variants', label: 'Código da opção {1}', anchor: 'product-option-{1}-code' },
    'optionDefinitions.values': { tab: 'variants', label: 'Valores da opção {1}', anchor: 'product-option-{1}-values' },
    'optionDefinitions.values.value': { tab: 'variants', label: 'Valor {2} da opção {1}', anchor: 'product-option-{1}-value-{2}' },

    variants: { tab: 'variants', label: 'Variantes', anchor: 'product-variants' },
    'variants.sku': { tab: 'variants', label: 'SKU da variante {1}', anchor: 'product-variant-{1}-sku' },
    'variants.selection': { tab: 'variants', label: 'Seleção da variante {1}', anchor: 'product-variant-{1}-selection' },
    'variants.selection.option': { tab: 'variants', label: 'Opção {2} da variante {1}', anchor: 'product-variant-{1}-selection-{2}-option' },
    'variants.selection.value': { tab: 'variants', label: 'Valor {2} da variante {1}', anchor: 'product-variant-{1}-selection-{2}-value' },
    'variants.mediaKeys.key': { tab: 'variants', label: 'Mídia {2} da variante {1}', anchor: 'product-variant-{1}-media-{2}' },
    'variants.priceCents': { tab: 'variants', label: 'Preço da variante {1}', anchor: 'product-variant-{1}-price' },
    'variants.priceMode': { tab: 'variants', label: 'Modo de preço da variante {1}', anchor: 'product-variant-{1}-price-mode' },

    publicationIssues: { tab: 'review', label: 'Checklist de publicação', anchor: 'product-publication-checklist' },
    $document: { tab: 'review', label: 'Documento', anchor: 'product-publication-checklist' },
    $revision: { tab: 'review', label: 'Versão do conteúdo', anchor: 'product-publication-checklist' },
  },

  category: {
    title: { tab: 'content', label: 'Nome', anchor: 'category-title' },
    slug: { tab: 'content', label: 'Endereço da categoria', anchor: 'category-slug' },
    parent: { tab: 'content', label: 'Categoria principal', anchor: 'category-parent' },
    status: { tab: 'content', label: 'Status', anchor: 'category-status' },
    image: { tab: 'media', label: 'Imagem', anchor: 'category-image' },
    'image.alt': { tab: 'media', label: 'Texto alternativo da imagem', anchor: 'category-image' },
    seo: { tab: 'seo', label: 'SEO', anchor: 'category-seo' },
    order: { tab: 'advanced', label: 'Ordem editorial', anchor: 'category-order' },

    $document: { tab: 'content', label: 'Documento', anchor: 'category-title' },
    $revision: { tab: 'content', label: 'Versão do conteúdo', anchor: 'category-title' },
  },

  home: {
    heroSlides: { tab: 'hero', label: 'Slides do hero', anchor: 'home-hero' },
    'heroSlides.desktopImage': { tab: 'hero', label: 'Imagem desktop do slide {1}', anchor: 'home-hero-slide-{1}-desktop' },
    'heroSlides.desktopImage.alt': { tab: 'hero', label: 'Texto alternativo do slide {1} (desktop)', anchor: 'home-hero-slide-{1}-desktop' },
    'heroSlides.mobileImage': { tab: 'hero', label: 'Imagem mobile do slide {1}', anchor: 'home-hero-slide-{1}-mobile' },
    'heroSlides.mobileImage.alt': { tab: 'hero', label: 'Texto alternativo do slide {1} (mobile)', anchor: 'home-hero-slide-{1}-mobile' },
    selectedProducts: { tab: 'selected-objects', label: 'Objetos selecionados', anchor: 'home-selected-products' },
    matterPanels: { tab: 'matter', label: 'Painéis de matéria', anchor: 'home-matter' },
    signatureSlides: { tab: 'signature', label: 'Assinatura', anchor: 'home-signature' },
    provenanceSteps: { tab: 'provenance', label: 'Proveniência', anchor: 'home-provenance' },
    'provenanceCallToAction.href': { tab: 'provenance', label: 'Destino do botão de proveniência', anchor: 'home-provenance' },
    disabledSections: { tab: 'overview', label: 'Seções ativas', anchor: 'home-section-status' },

    $document: { tab: 'overview', label: 'Documento', anchor: 'home-section-status' },
  },
}

/**
 * Localizações válidas para qualquer entidade. Só são consultadas quando a
 * entidade é desconhecida no ponto do erro — é o caso do conflito de revisão,
 * que é detectado antes de sabermos qual coleção está sendo gravada. Entradas
 * específicas da entidade sempre vencem, porque trazem aba e âncora melhores.
 */
export const sharedEditorialFields: Record<string, EditorialFieldLocation> = {
  $document: { tab: DEFAULT_FALLBACK_TAB, label: 'Documento' },
  $revision: { tab: DEFAULT_FALLBACK_TAB, label: 'Versão do conteúdo' },
}

/**
 * Separa um path indexado na chave de registry e nos índices encontrados.
 * `variants.0.selection.2.option` → `{ key: 'variants.selection.option', indices: [0, 2] }`
 */
export function splitArrayPath(path: string): { key: string; indices: number[] } {
  const indices: number[] = []
  const key = path.replace(/\.(\d+)(?=\.|$)/g, (_match, digits: string) => {
    indices.push(Number(digits))
    return ''
  })
  return { key, indices }
}

/** Substitui `{n}` pelo n-ésimo índice capturado, em base 1. */
export function interpolateIndices(template: string, indices: number[]): string {
  return template.replace(/\{(\d+)\}/g, (_match, position: string) => {
    const index = indices[Number(position) - 1]
    return String((index ?? 0) + 1)
  })
}

export function resolveEditorialFieldLocation(
  entity: string | undefined,
  path: string,
  customRegistry?: Record<string, EditorialFieldLocation>,
): EditorialFieldLocation {
  const { key, indices } = splitArrayPath(path)
  const registry = customRegistry || (entity ? editorialFieldRegistries[entity] : undefined) || {}

  // Nível 1: entrada exata, depois normalizada, depois o prefixo mais longo.
  let entry = registry[path] || registry[key]
  if (!entry) {
    const candidates = Object.keys(registry).sort((a, b) => b.length - a.length)
    const matching = candidates.find((candidate) => key === candidate || key.startsWith(`${candidate}.`))
    if (matching) entry = registry[matching]
  }
  if (!entry) entry = sharedEditorialFields[key]

  if (entry) {
    return {
      tab: entry.tab,
      label: interpolateIndices(entry.label, indices),
      ...(entry.anchor ? { anchor: interpolateIndices(entry.anchor, indices) } : {}),
    }
  }

  // Nível 2: path arbitrário (só chega aqui vindo do Payload). Sem heurística de
  // humanização — o próprio path é o rótulo, e a aba é a padrão da entidade.
  return {
    tab: (entity && defaultEntityTabs[entity]) || DEFAULT_FALLBACK_TAB,
    label: path,
  }
}
