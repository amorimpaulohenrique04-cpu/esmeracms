import type { EsmeraRole } from '../../access/roles'

export type ShellArea = 'all' | 'site' | 'business' | 'admin'

export type ShellNavItem = {
  href: string
  label: string
  icon: string
  area: ShellArea
  exact?: boolean
}

export const operationalLinks: ShellNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'grid', area: 'all', exact: true },
  { href: '/admin/products', label: 'Produtos', icon: 'box', area: 'site' },
  { href: '/admin/categories', label: 'Categorias', icon: 'tag', area: 'site' },
  { href: '/admin/customers', label: 'Clientes', icon: 'users', area: 'business' },
  { href: '/admin/privacy', label: 'Privacidade', icon: 'shield', area: 'business' },
  { href: '/admin/sales', label: 'Vendas', icon: 'receipt', area: 'business' },
  { href: '/admin/after-sales', label: 'Pós-venda', icon: 'heart', area: 'business' },
  { href: '/admin/reports', label: 'Relatórios', icon: 'chart', area: 'business' },
  { href: '/admin/settings', label: 'Configurações', icon: 'settings', area: 'site' },
]

export const technicalLinks: ShellNavItem[] = [
  { href: '/admin/technical', label: 'Admin técnico', icon: 'database', area: 'all' },
  { href: '/admin/collections/users', label: 'Usuários', icon: 'shield', area: 'admin' },
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

export function isShellLinkActive(pathname: string, item: ShellNavItem) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
