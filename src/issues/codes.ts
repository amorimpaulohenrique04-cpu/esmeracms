/**
 * Catálogo estável de códigos de issue.
 *
 * Um código é um identificador de máquina: nunca é derivado de mensagem, nunca
 * depende da posição no array e nunca muda quando a copy editorial muda. É ele
 * que consumidores (UI, testes, bulk, contrato do storefront) usam para decidir.
 */

export const ISSUE_CODES = {
  // --- Produto: readiness editorial -------------------------------------------
  productTitleMissing: 'product.title.missing',
  productSlugMissing: 'product.slug.missing',
  productCodeMissing: 'product.code.missing',
  productCategoriesMissing: 'product.categories.missing',
  productCategoriesInactive: 'product.categories.inactive',
  productCatalogStatusInvalid: 'product.catalog_status.invalid',
  productAvailabilityMissing: 'product.availability.missing',
  productGalleryEmpty: 'product.gallery.empty',
  productGalleryMediaInvalid: 'product.gallery.media_invalid',
  productGalleryAltRequired: 'product.gallery.alt_required',
  productGalleryCoverCount: 'product.gallery.cover_count',
  productPriceModeMissing: 'product.price_mode.missing',
  productBasePriceMissing: 'product.base_price.missing',

  // --- Produto: definições de opção -------------------------------------------
  productOptionCodeMissing: 'product.option.code_missing',
  productOptionCodeDuplicated: 'product.option.code_duplicated',
  productOptionValuesMissing: 'product.option.values_missing',
  productOptionValueCodeMissing: 'product.option.value_code_missing',
  productOptionValueDuplicated: 'product.option.value_duplicated',

  // --- Produto: variantes ------------------------------------------------------
  productVariantsMissing: 'product.variants.missing',
  productVariantsOptionsMissing: 'product.variants.options_missing',
  productVariantSkuMissing: 'product.variant.sku_missing',
  productVariantSkuDuplicated: 'product.variant.sku_duplicated',
  productVariantSelectionDuplicated: 'product.variant.selection_duplicated',
  productVariantSelectionIncomplete: 'product.variant.selection_incomplete',
  productVariantOptionUnknown: 'product.variant.option_unknown',
  productVariantValueUnknown: 'product.variant.value_unknown',
  productVariantCombinationDuplicated: 'product.variant.combination_duplicated',
  productVariantMediaUnknown: 'product.variant.media_unknown',
  productVariantPriceMissing: 'product.variant.price_missing',
  productVariantInheritedPriceMissing: 'product.variant.inherited_price_missing',

  // --- Categoria: readiness e hierarquia ---------------------------------------
  categoryTitleMissing: 'category.title.missing',
  categorySlugMissing: 'category.slug.missing',
  categoryParentSelfReference: 'category.parent.self_reference',
  categoryParentCycle: 'category.parent.cycle',
  categoryParentNotFound: 'category.parent.not_found',
  categoryHierarchyExistingCycle: 'category.hierarchy.existing_cycle',
  categoryHierarchyDepthExceeded: 'category.hierarchy.depth_exceeded',
  categoryUsedByPublishedProducts: 'category.used_by_published_products',

  // --- Mídia (contrato do storefront) ------------------------------------------
  storefrontMediaUrlMissing: 'storefront.media.url_missing',
  storefrontMediaUnpublished: 'storefront.media.unpublished',
  storefrontMediaAltMissing: 'storefront.media.alt_missing',

  // --- Contrato do storefront: produto -----------------------------------------
  storefrontProductIdMissing: 'storefront.product.id_missing',
  storefrontProductSlugMissing: 'storefront.product.slug_missing',
  storefrontProductCodeMissing: 'storefront.product.code_missing',
  storefrontProductTitleMissing: 'storefront.product.title_missing',
  storefrontProductNotActive: 'storefront.product.not_active',
  storefrontProductCategoryMissing: 'storefront.product.category_missing',
  storefrontProductCategoryInvalid: 'storefront.product.category_invalid',
  storefrontProductCategoryUnpublished: 'storefront.product.category_unpublished',
  storefrontProductAvailabilityInvalid: 'storefront.product.availability_invalid',
  storefrontProductGalleryEmpty: 'storefront.product.gallery_empty',
  storefrontProductGalleryItemInvalid: 'storefront.product.gallery_item_invalid',
  storefrontProductCoverCount: 'storefront.product.cover_count',
  storefrontProductPriceModeInvalid: 'storefront.product.price_mode_invalid',
  storefrontProductPriceMissing: 'storefront.product.price_missing',
  storefrontProductInvalidDocument: 'storefront.product.invalid_document',

  // --- Contrato do storefront: categoria ---------------------------------------
  storefrontCategoryTitleMissing: 'storefront.category.title_missing',
  storefrontCategorySlugMissing: 'storefront.category.slug_missing',
  storefrontCategoryNotActive: 'storefront.category.not_active',
  storefrontCategorySelfParent: 'storefront.category.self_parent',
  storefrontCategoryInvalidDocument: 'storefront.category.invalid_document',

  // --- Contrato do storefront: home --------------------------------------------
  storefrontHomeCtaInvalid: 'storefront.home.cta_invalid',
  storefrontHomeInvalidDocument: 'storefront.home.invalid_document',

  // --- Contrato do storefront: demais tipos ------------------------------------
  storefrontNavigationInvalidDocument: 'storefront.navigation.invalid_document',
  storefrontSiteSettingsInvalidDocument: 'storefront.site-settings.invalid_document',

  // --- Concorrência -------------------------------------------------------------
  revisionConflict: 'revision_conflict',

  // --- Validação vinda do Payload ------------------------------------------------
  // Path arbitrário: o label cai no fallback de nível 2 (ver registry.ts).
  payloadFieldInvalid: 'payload.field_invalid',
} as const

export type IssueCodeKey = keyof typeof ISSUE_CODES
export type IssueCode = (typeof ISSUE_CODES)[IssueCodeKey]

export const allIssueCodes: readonly IssueCode[] = Object.values(ISSUE_CODES)

/** Códigos de documento inválido, por tipo de conteúdo do storefront. */
export const storefrontInvalidDocumentCodes = {
  product: ISSUE_CODES.storefrontProductInvalidDocument,
  category: ISSUE_CODES.storefrontCategoryInvalidDocument,
  home: ISSUE_CODES.storefrontHomeInvalidDocument,
  navigation: ISSUE_CODES.storefrontNavigationInvalidDocument,
  'site-settings': ISSUE_CODES.storefrontSiteSettingsInvalidDocument,
} as const
