/**
 * Lógica pura (sem DOM) do feedback de navegação do Admin. Mantida à parte de
 * NavigationFeedbackProvider.tsx para ser testável em Vitest sem browser —
 * ver tests/unit/navigation-feedback.unit.spec.ts.
 */

export type SkeletonVariant = 'dashboard' | 'list' | 'form'

export type ClickModifiers = {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}

export type AnchorMeta = {
  href: string
  target: string | null
  hasDownload: boolean
  ariaDisabled: boolean
  localNav: boolean
}

/**
 * Compara duas URLs absolutas do mesmo formato `window.location.href` e
 * decide se `next` representa uma rota diferente de `/admin` — mesma origem,
 * caminho `/admin*`, e pathname+search diferentes (uma âncora de mesma
 * página, com apenas hash diferente, não conta como navegação de rota).
 */
export function isDifferentAdminRoute(nextHref: string, currentHref: string): boolean {
  let next: URL
  let current: URL
  try {
    next = new URL(nextHref)
    current = new URL(currentHref)
  } catch {
    return false
  }
  if (next.origin !== current.origin) return false
  if (!next.pathname.startsWith('/admin')) return false
  if (next.pathname === current.pathname && next.search === current.search) return false
  return true
}

/** Ignora exatamente os casos listados na especificação do feedback de `intent`. */
export function shouldTrackAnchorClick(modifiers: ClickModifiers, anchor: AnchorMeta, currentHref: string): boolean {
  if (modifiers.defaultPrevented) return false
  if (modifiers.button !== 0) return false
  if (modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey || modifiers.altKey) return false
  if (anchor.target === '_blank') return false
  if (anchor.hasDownload) return false
  if (anchor.ariaDisabled) return false
  if (anchor.localNav) return false
  return isDifferentAdminRoute(anchor.href, currentHref)
}

const LIST_SECTIONS = [
  '/admin/products',
  '/admin/categories',
  '/admin/customers',
  '/admin/privacy',
  '/admin/sales',
  '/admin/pipeline',
  '/admin/after-sales',
  '/admin/reports',
  '/admin/settings',
  '/admin/technical',
]

function normalizePathname(pathname: string) {
  const bare = pathname.split('?')[0]?.split('#')[0] || '/admin'
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1)
  return bare || '/admin'
}

/**
 * Mapeia o pathname de destino para a variante estrutural do skeleton.
 * `/admin/collections/{slug}` (sem segmento final) é a listagem técnica;
 * `/admin/collections/{slug}/{id|create}` é o formulário de documento.
 * Qualquer rota não reconhecida cai no fallback `list`.
 */
export function resolveSkeletonVariant(pathname: string): SkeletonVariant {
  const path = normalizePathname(pathname)
  if (path === '/admin') return 'dashboard'

  const collectionDocument = path.match(/^\/admin\/collections\/[^/]+\/[^/]+$/)
  if (collectionDocument) return 'form'

  const collectionList = path.match(/^\/admin\/collections\/[^/]+$/)
  if (collectionList) return 'list'

  if (LIST_SECTIONS.some((section) => path === section || path.startsWith(`${section}/`))) return 'list'

  return 'list'
}
