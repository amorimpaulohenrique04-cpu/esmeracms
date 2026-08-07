import { createHash } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 10 * 1024 * 1024
const TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 3
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export type RemoteImage = {
  buffer: Buffer
  mime: string
  name: string
  sha256: string
}

function blockedIPv4(value: string) {
  const parts = value.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true
  const [a, b] = parts
  return a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
}

export function isBlockedRemoteAddress(address: string) {
  const normalized = address.toLowerCase().split('%')[0]
  if (normalized.startsWith('::ffff:')) return blockedIPv4(normalized.slice(7))
  const version = isIP(normalized)
  if (version === 4) return blockedIPv4(normalized)
  if (version !== 6) return true
  if (normalized === '::' || normalized === '::1') return true
  if (/^f[cd]/.test(normalized)) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (/^ff/.test(normalized)) return true
  return false
}

function allowedHost(hostname: string) {
  const configured = process.env.IMPORT_IMAGE_HOST_ALLOWLIST?.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
  if (!configured?.length) return true
  const host = hostname.toLowerCase()
  return configured.some((entry) => entry.startsWith('*.')
    ? host === entry.slice(2) || host.endsWith(`.${entry.slice(2)}`)
    : host === entry)
}

async function validateTarget(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('A imagem precisa usar HTTP ou HTTPS.')
  if (url.username || url.password) throw new Error('URL de imagem não pode conter credenciais.')
  const defaultPort = !url.port || (url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')
  if (!defaultPort) throw new Error('URL de imagem usa uma porta não permitida.')
  if (!allowedHost(url.hostname)) throw new Error('Host da imagem não está autorizado para importação.')

  if (isIP(url.hostname)) {
    if (isBlockedRemoteAddress(url.hostname)) throw new Error('URL de imagem aponta para uma rede privada ou reservada.')
    return
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => isBlockedRemoteAddress(address))) {
    throw new Error('URL de imagem resolve para uma rede privada ou reservada.')
  }
}

function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii')
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  return null
}

function safeFilename(url: URL, mime: string) {
  const candidate = decodeURIComponent(url.pathname.split('/').pop() || '').replace(/[^a-zA-Z0-9._-]+/g, '-')
  if (candidate) return candidate.slice(0, 180)
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/avif' ? 'avif' : 'jpg'
  return `imagem.${extension}`
}

async function readLimited(response: Response) {
  if (!response.body) throw new Error('A imagem retornou uma resposta vazia.')
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      size += value.byteLength
      if (size > MAX_BYTES) throw new Error('Imagem maior que 10MB.')
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  return Buffer.concat(chunks, size)
}

async function fetchWithSafeRedirects(initial: URL): Promise<{ response: Response; finalURL: URL }> {
  let current = initial
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await validateTarget(current)
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg' },
    })

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount === MAX_REDIRECTS) throw new Error('A imagem excedeu o limite de redirecionamentos.')
      const location = response.headers.get('location')
      if (!location) throw new Error('Redirecionamento de imagem sem destino.')
      current = new URL(location, current)
      continue
    }
    return { response, finalURL: current }
  }
  throw new Error('Falha ao resolver redirecionamento da imagem.')
}

export async function fetchRemoteImage(rawURL: string): Promise<RemoteImage> {
  let url: URL
  try { url = new URL(rawURL) } catch { throw new Error('URL de imagem inválida.') }

  const { response, finalURL } = await fetchWithSafeRedirects(url)
  if (!response.ok) throw new Error(`Não foi possível baixar a imagem (${response.status}).`)

  const length = Number(response.headers.get('content-length') || 0)
  if (Number.isFinite(length) && length > MAX_BYTES) throw new Error('Imagem maior que 10MB.')

  const buffer = await readLimited(response)
  const mime = sniffMime(buffer)
  if (!mime || !ALLOWED_MIME.has(mime)) throw new Error('O link não aponta para uma imagem JPEG, PNG, WebP ou AVIF válida.')

  return {
    buffer,
    mime,
    name: safeFilename(finalURL, mime),
    sha256: createHash('sha256').update(buffer).digest('hex'),
  }
}
