type CustomAdminView = {
  Component?: unknown
  exact?: boolean
  path?: string
}

type SearchParams = Record<string, string | string[] | undefined>

function adminPath(segments: string[] | undefined, adminRoute: string) {
  if (!segments?.length) return adminRoute
  return `${adminRoute}/${segments.map(encodeURIComponent).join('/')}`
}

/**
 * Payload intentionally skips its built-in auth redirect for custom admin
 * views. Esmera's custom views are private, so they must be guarded before
 * React starts streaming their server components.
 */
export function isPrivateCustomAdminView(
  segments: string[] | undefined,
  views: Record<string, CustomAdminView> | undefined,
) {
  const currentPath = segments?.length ? `/${segments.join('/')}` : '/'

  return Object.entries(views || {}).some(([key, view]) => {
    if (key === 'dashboard' && !view.path) return currentPath === '/'
    if (!view.path) return false
    if (view.exact) return currentPath === view.path
    return currentPath === view.path || currentPath.startsWith(`${view.path}/`)
  })
}

export function customAdminLoginURL({
  adminRoute,
  loginRoute,
  searchParams,
  segments,
}: {
  adminRoute: string
  loginRoute: string
  searchParams: SearchParams
  segments: string[] | undefined
}) {
  const loginPath = `${adminRoute}${loginRoute}`
  const currentPath = adminPath(segments, adminRoute)
  if (currentPath === adminRoute) return loginPath

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    else if (typeof value === 'string') query.set(key, value)
  }

  const returnTo = `${currentPath}${query.size ? `?${query}` : ''}`
  return `${loginPath}?redirect=${encodeURIComponent(returnTo)}`
}
