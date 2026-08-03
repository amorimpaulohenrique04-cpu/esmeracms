export type EditorialFieldLocation = {
  tab?: string
  anchor?: string
  suggestion?: string
}

export const editorialFieldRegistries: Record<string, Record<string, EditorialFieldLocation>> = {
  product: {
    title: { tab: 'identity', anchor: 'product-title', suggestion: 'Informe um título provisório para continuar.' },
    slug: { tab: 'identity', anchor: 'product-slug', suggestion: 'Revise o endereço gerado ou informe um slug válido.' },
    code: { tab: 'identity', anchor: 'product-code', suggestion: 'Informe um código único para a peça.' },
    categories: { tab: 'identity', anchor: 'product-categories', suggestion: 'Escolha ao menos uma categoria publicada.' },
    catalogStatus: { tab: 'identity', anchor: 'product-catalog-status' },
    gallery: { tab: 'gallery', anchor: 'product-gallery', suggestion: 'Adicione uma imagem válida e marque exatamente uma capa.' },
    'gallery.alt': { tab: 'gallery', anchor: 'product-gallery', suggestion: 'Descreva brevemente o que aparece na imagem.' },
    availability: { tab: 'commercial', anchor: 'product-availability' },
    priceMode: { tab: 'commercial', anchor: 'product-price-mode' },
    basePriceCents: { tab: 'commercial', anchor: 'product-base-price', suggestion: 'Informe um preço em reais ou marque a peça como sob consulta.' },
    optionDefinitions: { tab: 'variants', anchor: 'product-options' },
    variants: { tab: 'variants', anchor: 'product-variants' },
    publicationIssues: { tab: 'review', anchor: 'product-publication-checklist' },
  },
  category: {
    title: { tab: 'content', anchor: 'category-title', suggestion: 'Informe o nome exibido no catálogo.' },
    slug: { tab: 'content', anchor: 'category-slug', suggestion: 'Revise o endereço gerado para a categoria.' },
    parent: { tab: 'content', anchor: 'category-parent', suggestion: 'Escolha uma categoria principal que não gere ciclo.' },
    image: { tab: 'media', anchor: 'category-image' },
    seo: { tab: 'seo', anchor: 'category-seo' },
    order: { tab: 'advanced', anchor: 'category-order' },
  },
  home: {
    heroSlides: { tab: 'hero', anchor: 'home-hero', suggestion: 'Adicione imagens válidas ou mantenha a seção usando o conteúdo padrão do site.' },
    selectedProducts: { tab: 'selected-objects', anchor: 'home-selected-products' },
    matterPanels: { tab: 'matter', anchor: 'home-matter' },
    signatureSlides: { tab: 'signature', anchor: 'home-signature' },
    provenanceSteps: { tab: 'provenance', anchor: 'home-provenance' },
    disabledSections: { tab: 'overview', anchor: 'home-section-status' },
  },
}

function normalizeArrayPath(path: string): string {
  return path.replace(/\.\d+(?=\.|$)/g, '')
}

export function resolveEditorialFieldLocation(
  entity: string | undefined,
  path: string,
  customRegistry?: Record<string, EditorialFieldLocation>,
): EditorialFieldLocation {
  const normalizedPath = normalizeArrayPath(path)
  const registry = customRegistry || (entity ? editorialFieldRegistries[entity] : undefined) || {}
  const direct = registry[path] || registry[normalizedPath]
  if (direct) return direct

  const candidates = Object.keys(registry).sort((a, b) => b.length - a.length)
  const matching = candidates.find((candidate) =>
    normalizedPath === candidate || normalizedPath.startsWith(`${candidate}.`)
  )
  return matching ? registry[matching] : {}
}
