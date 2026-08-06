import type { EsmeraRole } from '../../access/roles'

export type ShellArea = 'all' | 'site' | 'business' | 'admin'

/**
 * 'funil' groups the 4 lead-to-post-sale steps in their business order (see `step`);
 * other groups are organizational, not sequential.
 */
export type ShellNavGroup = 'dashboard' | 'funil' | 'relacionamento' | 'catalogo' | 'outros'

export type ShellNavItem = {
  href: string
  label: string
  icon: string
  area: ShellArea
  group: ShellNavGroup
  step?: 1 | 2 | 3 | 4
  exact?: boolean
  /** Overrides the default pathname match when a group shares one route via query string (e.g. Oportunidades/Vendas on /admin/sales before Fase 3 gives them separate routes). */
  isActive?: (pathname: string, search: string) => boolean
}

export const operationalLinks: ShellNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'grid', area: 'all', group: 'dashboard', exact: true },
  { href: '/admin/leads', label: 'Captação', icon: 'users', area: 'business', group: 'funil', step: 1 },
  { href: '/admin/opportunities', label: 'Oportunidades', icon: 'chart', area: 'business', group: 'funil', step: 2 },
  { href: '/admin/sales', label: 'Vendas', icon: 'receipt', area: 'business', group: 'funil', step: 3 },
  { href: '/admin/after-sales', label: 'Pós-venda', icon: 'heart', area: 'business', group: 'funil', step: 4 },
  { href: '/admin/customers', label: 'Clientes', icon: 'users', area: 'business', group: 'relacionamento' },
  { href: '/admin/privacy', label: 'Privacidade', icon: 'shield', area: 'business', group: 'relacionamento' },
  { href: '/admin/products', label: 'Produtos', icon: 'box', area: 'site', group: 'catalogo' },
  { href: '/admin/categories', label: 'Categorias', icon: 'tag', area: 'site', group: 'catalogo' },
  { href: '/admin/reports', label: 'Relatórios', icon: 'chart', area: 'business', group: 'outros' },
  { href: '/admin/settings', label: 'Configurações', icon: 'settings', area: 'site', group: 'outros' },
]

export const technicalLinks: ShellNavItem[] = [
  { href: '/admin/technical', label: 'Configurações avançadas', icon: 'database', area: 'admin', group: 'outros' },
  { href: '/admin/collections/users', label: 'Usuários', icon: 'shield', area: 'admin', group: 'outros' },
]

export function roleAllows(role: EsmeraRole | null, area: ShellArea) {
  if (area === 'all') return true
  if (role === 'admin') return true
  if (area === 'site') return role === 'editor'
  if (area === 'business') return role === 'commercial'
  return false
}

export function visibleOperationalLinks(role: EsmeraRole | null) {
  return operationalLinks.filter((item) => roleAllows(role, item.area))
}

export function visibleTechnicalLinks(role: EsmeraRole | null) {
  return technicalLinks.filter((item) => roleAllows(role, item.area))
}

export function isShellLinkActive(pathname: string, search: string, item: ShellNavItem) {
  if (item.isActive) return item.isActive(pathname, search)
  const [itemPath] = item.href.split('?')
  if (item.exact) return pathname === itemPath
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}
