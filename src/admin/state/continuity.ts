'use client'

export type AdminRecentItem = {
  href: string
  label: string
  meta?: string
  visitedAt: number
}

export type SavedAdminView = {
  id: string
  href: string
  label: string
  kind: 'reports' | 'products' | 'customers' | 'sales' | 'after-sales' | 'other'
  savedAt: number
}

const RECENT_KEY = 'esmera:recent-admin-items'
const SAVED_VIEWS_KEY = 'esmera:saved-admin-views'

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

function writeArray<T>(key: string, value: T[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Local continuity is optional and must never block the CMS.
  }
}

export function recentAdminItems() {
  return readArray<AdminRecentItem>(RECENT_KEY)
    .filter((item) => item && typeof item.href === 'string' && typeof item.label === 'string')
    .sort((left, right) => right.visitedAt - left.visitedAt)
    .slice(0, 10)
}

export function rememberAdminItem(item: Omit<AdminRecentItem, 'visitedAt'>) {
  const next: AdminRecentItem = { ...item, visitedAt: Date.now() }
  const items = recentAdminItems().filter((candidate) => candidate.href !== next.href)
  writeArray(RECENT_KEY, [next, ...items].slice(0, 10))
}

export function savedAdminViews() {
  return readArray<SavedAdminView>(SAVED_VIEWS_KEY)
    .filter((item) => item && typeof item.id === 'string' && typeof item.href === 'string')
    .sort((left, right) => right.savedAt - left.savedAt)
    .slice(0, 20)
}

export function saveAdminView(input: Omit<SavedAdminView, 'id' | 'savedAt'>) {
  const id = `${input.kind}:${input.href}`
  const next: SavedAdminView = { ...input, id, savedAt: Date.now() }
  const items = savedAdminViews().filter((candidate) => candidate.id !== id)
  writeArray(SAVED_VIEWS_KEY, [next, ...items].slice(0, 20))
  return next
}

export function removeSavedAdminView(id: string) {
  writeArray(SAVED_VIEWS_KEY, savedAdminViews().filter((item) => item.id !== id))
}

export function inferAdminViewKind(pathname: string): SavedAdminView['kind'] {
  if (pathname.startsWith('/admin/reports')) return 'reports'
  if (pathname.startsWith('/admin/products')) return 'products'
  if (pathname.startsWith('/admin/customers')) return 'customers'
  if (pathname.startsWith('/admin/sales')) return 'sales'
  if (pathname.startsWith('/admin/after-sales')) return 'after-sales'
  return 'other'
}
