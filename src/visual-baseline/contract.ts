export const VISUAL_FIXED_TIME = '2026-08-03T15:00:00.000Z'

export const baselineViewports = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'notebook-1280x800', width: 1280, height: 800 },
  { name: 'tablet-landscape-1024x768', width: 1024, height: 768 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const

export const adminBaselineRouteNames = [
  'dashboard',
  'products-list',
  'products-grid',
  'product-overview',
  'product-media',
  'categories-list',
  'category-general',
  'category-media-seo',
  'category-products',
  'customers-list',
  'customer-overview',
  'customer-history',
  'customer-interests',
  'customer-sales',
  'customer-after-sales',
  'customer-notes',
  'opportunity-document',
  'sales-list',
  'sales-pipeline',
  'after-sales',
  'after-sales-occurrences',
  'reports',
  'settings',
  'technical',
] as const

export const privacyBaselineRouteNames = ['privacy'] as const
export const interactionBaseScreenshotNames = ['shell-keyboard-focus', 'command-palette'] as const
export const interactionMobileScreenshotNames = ['mobile-navigation-drawer'] as const

export function interactionScreenshotNames(width: number) {
  return width <= 768
    ? [...interactionBaseScreenshotNames, ...interactionMobileScreenshotNames]
    : [...interactionBaseScreenshotNames]
}

export const expectedAdminPngs = adminBaselineRouteNames.length * baselineViewports.length
export const expectedPrivacyPngs = privacyBaselineRouteNames.length * baselineViewports.length
export const expectedInteractionPngs = baselineViewports.reduce(
  (total, viewport) => total + interactionScreenshotNames(viewport.width).length,
  0,
)
export const expectedTotalPngs = expectedAdminPngs + expectedPrivacyPngs + expectedInteractionPngs

export type BaselineFixtureMap = {
  datasetVersion: string
  generatedAt: string
  adminUserId: string | number
  categoryId: string | number
  productId: string | number
  customerId: string | number
  privacyCustomerId: string | number
  opportunityId: string | number
  saleId: string | number
  afterSaleId: string | number
  taskId: string | number
  shipmentId: string | number
  occurrenceId: string | number
  interestId: string | number
}

export type VisualBaselineManifest = {
  schemaVersion: 2
  datasetVersion: string
  source: 'prepare-visual-baseline' | 'finalize-visual-baseline'
  complete: boolean
  expectedPngs: number
  actualPngs: number
  preparedAt: string
  capturedAt?: string
  commitSha: string | null
  fixedTime: string
  platform: string
  nodeVersion: string
  playwrightVersion?: string
  viewports: Array<{ name: string; width: number; height: number }>
  scenarios: {
    admin: string[]
    privacy: string[]
    interaction: Record<string, string[]>
  }
  files: Array<{ path: string; sha256: string; bytes: number }>
}
