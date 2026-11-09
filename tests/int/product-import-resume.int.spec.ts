// @vitest-environment node

import config from '@payload-config'
import { createHash, randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET, POST } from '../../src/app/(payload)/api/admin-products-import/route'
import { importColumnLabels, importColumns } from '../../src/businessRules/products/importSchema'
import { emptyImportValues } from '../../src/businessRules/products/importValidation'
import { toCsv } from '../../src/server/domain/products/csv'
import type { ImportCommitInput, ImportRowResult } from '../../src/server/domain/products/importOperations'
import * as remoteImages from '../../src/server/domain/products/mediaFetch'

const endpoint = 'http://localhost:3000/api/admin-products-import'
const prefix = 'RESUME-' + randomUUID().slice(0, 8).toUpperCase()
const sharedUrl = 'https://images.example.com/shared.png'
const badUrl = 'https://images.example.com/missing.png'

type Status = {
  importId: string
  status: string
  processedRows: number
  totalRows: number
  created: number
  errored: number
  results: ImportRowResult[]
}

function makeRows(group: string, count: number): ImportCommitInput[] {
  return Array.from({ length: count }, (_, index) => ({
    rowIndex: index,
    sourceLine: index + 17,
    onConflict: 'skip',
    values: {
      ...emptyImportValues(),
      code: [prefix, group, index + 1].join('-'),
      title: [prefix, group, index + 1].join(' '),
      catalogStatus: 'archived',
    },
  }))
}

describe('importação retomável de produtos', () => {
  let payload: Payload
  let userId: number
  let headers: Record<string, string>
  let image: remoteImages.RemoteImage

  beforeAll(async () => {
    payload = await getPayload({ config })
    const email = prefix.toLowerCase() + '@example.com'
    const password = 'Import-Test-123!'
    const user = await payload.create({
      collection: 'users',
      data: { name: prefix, email, password, role: 'editor' },
    })
    userId = user.id
    const { token } = await payload.login({ collection: 'users', data: { email, password } })
    expect(token).toBeTruthy()
    headers = { Authorization: 'JWT ' + token, 'Content-Type': 'application/json' }
    const buffer = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#' + randomUUID().slice(0, 6) },
    }).png().toBuffer()
    image = { buffer, mime: 'image/png', name: prefix + '.png', sha256: createHash('sha256').update(buffer).digest('hex') }
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    if (!payload || !userId) return
    await payload.delete({ collection: 'products', where: { code: { like: prefix } }, overrideAccess: true })
    if (image) await payload.delete({ collection: 'media', where: { sourceSha256: { equals: image.sha256 } }, overrideAccess: true })
    await payload.delete({ collection: 'product-imports', where: { requestedBy: { equals: userId } }, overrideAccess: true })
    await payload.delete({ collection: 'users', id: userId, overrideAccess: true })
  })

  async function post<T = Status>(body: Record<string, unknown>, expected = 200): Promise<T> {
    const response = await POST(new Request(endpoint, { headers, method: 'POST', body: JSON.stringify(body) }))
    const data = await response.json()
    expect(response.status, JSON.stringify(data).slice(0, 600)).toBe(expected)
    return data as T
  }

  async function get<T = Status>(params: Record<string, string>, csv = false): Promise<T> {
    const response = await GET(new Request(endpoint + '?' + new URLSearchParams(params), { headers }))
    expect(response.status).toBe(200)
    return (csv ? await response.text() : await response.json()) as T
  }

  it('preserva progresso após resposta perdida, bloqueia duas abas e recupera só as linhas com erro', async () => {
    const rows = makeRows('RESUME', 26)
    rows[0].values.imageUrls = sharedUrl
    rows[24].values.imageUrls = badUrl
    rows[25].values.imageUrls = sharedUrl
    const fetchImage = vi.spyOn(remoteImages, 'fetchRemoteImage').mockImplementation(async (url) => {
      if (url === badUrl) throw new Error('Imagem indisponível (404).')
      return image
    })

    const idempotencyKey = randomUUID()
    const [{ importId }, otherStart] = await Promise.all([
      post({ action: 'start', rows, idempotencyKey }, 202),
      post({ action: 'start', rows, idempotencyKey }, 202),
    ])
    expect(otherStart.importId).toBe(importId)
    expect(await post({ action: 'start', rows, idempotencyKey }, 202)).toMatchObject({ importId })
    await post({ action: 'start', rows, idempotencyKey: randomUUID() }, 409)
    await Promise.all([
      post({ action: 'advance', importId, cursor: 0 }),
      post({ action: 'advance', importId, cursor: 0 }),
    ])
    expect(await get({ latest: '1' })).toMatchObject({ importId, processedRows: 24, created: 24 })
    expect(await post({ action: 'advance', importId, cursor: 0 })).toMatchObject({ processedRows: 24 })
    expect(await post({ action: 'advance', importId, cursor: 24 })).toMatchObject({
      status: 'completed_with_errors', processedRows: 26, created: 25, errored: 1,
    })

    const final = await get({ importId })
    expect(final.results).toHaveLength(26)
    expect(final.results.filter((row) => row.status === 'error')).toMatchObject([
      { rowIndex: 24, sourceLine: 41, error: 'Imagem indisponível (404).' },
    ])
    expect(fetchImage.mock.calls.map(([url]) => url)).toEqual([sharedUrl, badUrl])
    const retry = await get<{ rows: ImportCommitInput[] }>({ importId, format: 'retry' })
    expect(retry.rows).toMatchObject([{ rowIndex: 24, sourceLine: 41, values: { imageUrls: badUrl } }])
    const revalidated = await post<{ rows: ImportCommitInput[] }>({ action: 'preview', rows: retry.rows })
    expect(revalidated.rows).toMatchObject([{ rowIndex: 24, sourceLine: 41 }])
    expect(await get<string>({ importId, format: 'csv' }, true)).toContain('41,Imagem indisponível (404).')
    fetchImage.mockRestore()
  }, 90_000)

  it('cancela as linhas restantes e preserva o que foi salvo', async () => {
    const rows = makeRows('CANCEL', 25)
    const { importId } = await post({ action: 'start', rows, idempotencyKey: randomUUID() }, 202)
    await post({ action: 'advance', importId, cursor: 0 })
    expect(await post({ action: 'cancel', importId })).toMatchObject({
      status: 'cancelled', processedRows: 24, created: 24,
    })
    expect(await post({ action: 'advance', importId, cursor: 24 })).toMatchObject({
      status: 'cancelled', processedRows: 24, created: 24,
    })
  }, 90_000)

  it.runIf(process.env.ESMERA_IMPORT_BENCHMARK === '1').each([[100, true], [500, false]] as const)(
    'compara lotes legados de dois e etapas retomáveis com %i produtos', async (count, withImages) => {
    const logger = vi.spyOn(payload.logger, 'info').mockImplementation(() => undefined)
    const download = vi.spyOn(remoteImages, 'fetchRemoteImage').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 75))
      return image
    })
    async function measure(count: number, withImages: boolean, resumable: boolean) {
      const rows = makeRows([count, resumable ? 'NEW' : 'OLD'].join('-'), count)
      if (withImages) {
        rows.forEach((row, i) => { row.values.imageUrls = 'https://images.example.com/photo-' + (i % 10) + '.png' })
      }
      const text = toCsv([
        importColumns.map((column) => importColumnLabels[column]),
        ...rows.map((row) => importColumns.map((column) => row.values[column])),
      ])
      const started = performance.now()
      await post({ action: 'preview', text })
      const previewMs = Math.round(performance.now() - started)
      let requests = 0
      if (resumable) {
        let state = await post({ action: 'start', rows, idempotencyKey: randomUUID() }, 202)
        requests += 1
        while (state.processedRows < count && requests <= count) {
          state = await post({ action: 'advance', importId: state.importId, cursor: state.processedRows })
          requests += 1
        }
        expect(state).toMatchObject({ status: 'completed', processedRows: count, created: count })
      } else {
        for (let cursor = 0; cursor < rows.length; cursor += 2) {
          const batch = rows.slice(cursor, cursor + 2)
          expect(await post({ action: 'commit', rows: batch })).toMatchObject({ created: batch.length, errored: 0 })
          requests += 1
        }
      }
      return { requests, previewMs, totalMs: Math.round(performance.now() - started) }
    }
    try {
      const baseline = await measure(count, withImages, false)
      const resumable = await measure(count, withImages, true)
      process.stdout.write('IMPORT_BENCHMARK ' + JSON.stringify({ count, withImages, baseline, resumable }) + '\n')
      expect(resumable.requests).toBeLessThan(baseline.requests)
      if (withImages) expect(resumable.totalMs).toBeLessThan(baseline.totalMs)
    } finally {
      download.mockRestore()
      logger.mockRestore()
    }
  }, 360_000)
})
