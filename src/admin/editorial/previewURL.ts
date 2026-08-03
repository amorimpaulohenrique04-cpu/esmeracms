type PreviewDocument = {
  collection: 'products' | 'categories'
  id: string | number
  slug?: string | null
}

function replaceToken(template: string, token: string, value: string) {
  return template.split(`{${token}}`).join(encodeURIComponent(value))
}

export function editorialPreviewURL(document: PreviewDocument) {
  const template = process.env.NEXT_PUBLIC_EDITORIAL_PREVIEW_URL?.trim()

  if (!template) {
    const kind = document.collection === 'products' ? 'product' : 'category'
    return `/preview/editorial/${kind}/${encodeURIComponent(String(document.id))}`
  }

  let url = template
  url = replaceToken(url, 'collection', document.collection)
  url = replaceToken(url, 'id', String(document.id))
  url = replaceToken(url, 'slug', document.slug || '')

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}draft=true&source=esmera-cms`
}
