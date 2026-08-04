import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { APIError, Forbidden, NotFound, ValidationError } from 'payload'
import { describe, expect, it } from 'vitest'

import { ISSUE_CODES } from '../../src/issues/codes'
import {
  adminErrorCodeFromStatus,
  classifyAdminError,
  httpStatusByCode,
  issuesFromPayloadValidation,
  normalizeAdminServerError,
} from '../../src/server/admin/errors/serialize'
import { adminErrorCodes } from '../../src/server/admin/errors/types'
import {
  PublicationBlockedError,
  PublicationVerificationFailedError,
  RevisionConflictError,
  type PublicationAssessment,
} from '../../src/server/publication/types'

const req = undefined as never

function assessment(issues: PublicationAssessment['issues']): PublicationAssessment {
  return {
    version: '1',
    entity: 'product',
    entityId: 7,
    revision: 'rev-1',
    ready: issues.every((issue) => issue.severity !== 'blocker'),
    issues,
    storefront: { contractVersion: '1', compatible: true, issues: [], probeStatus: 'not_run' },
    assessedAt: '2026-08-04T10:00:00.000Z',
  }
}

describe('tabela exclusiva de status', () => {
  it('cobre exatamente os status exigidos pelo §4.3', () => {
    expect(new Set(Object.values(httpStatusByCode))).toEqual(
      new Set([400, 401, 403, 404, 409, 422, 500, 503]),
    )
  })

  it('403 só pode vir de forbidden e 401 só de unauthenticated', () => {
    const at = (status: number) => adminErrorCodes.filter((code) => httpStatusByCode[code] === status)
    expect(at(403)).toEqual(['forbidden'])
    expect(at(401)).toEqual(['unauthenticated'])
    expect(at(409)).toEqual(['revision_conflict'])
    // 422 é o único status compartilhado, exatamente como o plano define.
    expect(at(422).sort()).toEqual(['publication_blocked', 'validation_error'])
  })

  it('todo código tem status e o mapa reverso é coerente', () => {
    for (const code of adminErrorCodes) {
      const status = httpStatusByCode[code]
      expect(status).toBeGreaterThanOrEqual(400)
      if (code !== 'publication_blocked') {
        expect(adminErrorCodeFromStatus(status)).toBe(code)
      }
    }
  })
})

describe('classificação por instanceof, nunca por texto', () => {
  it('classes do Payload são reconhecidas como si mesmas, não como APIError', () => {
    expect(classifyAdminError(new ValidationError({ collection: 'products', errors: [], req }))).toBe('validation_error')
    expect(classifyAdminError(new Forbidden())).toBe('forbidden')
    expect(classifyAdminError(new NotFound())).toBe('not_found')
    expect(classifyAdminError(new APIError('qualquer', 400))).toBe('invalid_request')
  })

  it('erros de publicação são reconhecidos pela classe', () => {
    expect(classifyAdminError(new RevisionConflictError())).toBe('revision_conflict')
    expect(classifyAdminError(new PublicationBlockedError(assessment([])))).toBe('publication_blocked')
    expect(classifyAdminError(new PublicationVerificationFailedError())).toBe('verification_failed')
  })

  it('a mensagem não influencia a classificação', () => {
    // Antes, `inferCode` devolvia 'duplicate' para qualquer mensagem contendo
    // "unique" ou "duplic" — inclusive copy editorial legítima.
    const comCopySuspeita = new Error('O SKU está duplicado e o índice unique falhou')
    expect(classifyAdminError(comCopySuspeita)).toBe('internal_error')
  })
})

describe('erros de validação aninhados do Payload', () => {
  const nested = new ValidationError({
    collection: 'products',
    req,
    errors: [
      { path: 'variants.0.sku', message: 'Cada SKU deve ser único em todo o catálogo.' },
      { path: 'gallery.1.alt', message: 'Adicione um texto alternativo à imagem 2.' },
    ],
  })

  it('sai como 422 e não como o 400 nativo do Payload', () => {
    const normalized = normalizeAdminServerError(nested, { entity: 'product' })
    expect(normalized.code).toBe('validation_error')
    expect(normalized.status).toBe(422)
    // O erro do Payload continua sendo 400 nativamente: a tradução vale só aqui.
    expect((nested as unknown as { status: number }).status).toBe(400)
  })

  it('preserva o path aninhado e resolve aba, rótulo e âncora pelo registry', () => {
    const normalized = normalizeAdminServerError(nested, { entity: 'product' })

    expect(normalized.fieldErrors).toHaveLength(2)
    expect(normalized.fieldErrors[0]).toMatchObject({
      path: 'variants.0.sku',
      tab: 'variants',
      label: 'SKU da variante 1',
      anchor: 'product-variant-1-sku',
      source: 'payload',
      code: ISSUE_CODES.payloadFieldInvalid,
      severity: 'blocker',
    })
    expect(normalized.fieldErrors[1]).toMatchObject({
      path: 'gallery.1.alt',
      tab: 'gallery',
      label: 'Texto alternativo da imagem 2',
      anchor: 'product-gallery-item-2-alt',
      source: 'payload',
    })
  })

  it('um path desconhecido do Payload ainda produz aba e rótulo', () => {
    const normalized = normalizeAdminServerError(new ValidationError({
      collection: 'products',
      req,
      errors: [{ path: 'campoDesconhecido.3.sub', message: 'Revise.' }],
    }), { entity: 'product' })

    expect(normalized.fieldErrors[0].tab).toBe('review')
    expect(normalized.fieldErrors[0].label).toBe('campoDesconhecido.3.sub')
  })

  it('deduplica por code|path, não por mensagem', () => {
    const issues = issuesFromPayloadValidation([
      { path: 'variants.0.sku', message: 'Primeira redação.' },
      { path: 'variants.0.sku', message: 'Segunda redação do mesmo problema.' },
      { path: 'variants.1.sku', message: 'Primeira redação.' },
    ], { entity: 'product' })

    expect(issues.map((issue) => issue.path)).toEqual(['variants.0.sku', 'variants.1.sku'])
  })
})

describe('conflito de revisão → HTTP 409', () => {
  it('preserva os campos hoje consumidos pela UI', () => {
    const normalized = normalizeAdminServerError(new RevisionConflictError())

    expect(normalized.status).toBe(409)
    expect(normalized.code).toBe('revision_conflict')
    expect(normalized.retryable).toBe(false)
    expect(normalized.fieldErrors).toEqual([])
    expect(normalized.entityErrors).toHaveLength(1)
    expect(normalized.entityErrors[0]).toMatchObject({
      code: ISSUE_CODES.revisionConflict,
      message: 'Este conteúdo foi alterado em outra sessão.',
      suggestion: 'Recarregue a versão mais recente, revise as diferenças e tente novamente.',
    })
  })

  it('a issue de concorrência é de escopo de documento, não de campo', () => {
    const error = new RevisionConflictError()
    expect(error.issues).toHaveLength(1)
    expect(error.issues[0]).toMatchObject({
      code: ISSUE_CODES.revisionConflict,
      path: '$revision',
      source: 'concurrency',
      label: 'Versão do conteúdo',
    })
  })

  it('uma mensagem customizada continua vencendo a do catálogo', () => {
    const error = new RevisionConflictError('Mensagem própria da rota.')
    expect(error.issues[0].message).toBe('Mensagem própria da rota.')
    expect(error.entityErrors[0].message).toBe('Mensagem própria da rota.')
  })
})

describe('blocker editorial → HTTP 422', () => {
  const blockers = [
    {
      code: ISSUE_CODES.productTitleMissing,
      severity: 'blocker' as const,
      path: 'title',
      tab: 'identity',
      label: 'Título',
      message: 'Título não definido.',
      source: 'readiness' as const,
    },
    {
      code: ISSUE_CODES.storefrontProductInvalidDocument,
      severity: 'blocker' as const,
      path: '$document',
      tab: 'review',
      label: 'Documento',
      message: 'O documento público não possui um formato reconhecido.',
      source: 'storefront' as const,
    },
  ]

  it('serializa como 422 publication_blocked', () => {
    const normalized = normalizeAdminServerError(new PublicationBlockedError(assessment(blockers)))
    expect(normalized.status).toBe(422)
    expect(normalized.code).toBe('publication_blocked')
    expect(normalized.retryable).toBe(false)
  })

  it('divide por escopo de path e não perde nem duplica nenhum blocker', () => {
    const error = new PublicationBlockedError(assessment(blockers))

    expect(error.fieldErrors).toHaveLength(1)
    expect(error.fieldErrors[0].path).toBe('title')
    expect(error.entityErrors).toHaveLength(1)
    expect(error.entityErrors[0].code).toBe(ISSUE_CODES.storefrontProductInvalidDocument)
    expect(error.fieldErrors.length + error.entityErrors.length).toBe(blockers.length)

    const fieldPaths = new Set(error.fieldErrors.map((issue) => issue.code))
    const entityCodes = new Set(error.entityErrors.map((issue) => issue.code))
    expect([...fieldPaths].some((code) => entityCodes.has(code))).toBe(false)
  })

  it('fieldErrors já é PublicationIssue completo, sem projeção com perda', () => {
    const error = new PublicationBlockedError(assessment(blockers))
    expect(error.fieldErrors[0]).toMatchObject({
      code: ISSUE_CODES.productTitleMissing,
      label: 'Título',
      source: 'readiness',
      tab: 'identity',
    })
  })
})

describe('verificação indisponível → HTTP 503', () => {
  it('serializa com retryable true', () => {
    // Sem produtor em `main`: quem vai lançar isto é o probe do storefront (PR-05).
    const normalized = normalizeAdminServerError(new PublicationVerificationFailedError())
    expect(normalized.status).toBe(503)
    expect(normalized.code).toBe('verification_failed')
    expect(normalized.retryable).toBe(true)
  })
})

describe('erro interno → HTTP 500 sem vazar nada', () => {
  const leaky = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), {
    stack: 'Error: segredo-no-stack\n    at Object.<anonymous> (/srv/app/db.ts:1:1)',
    sql: 'select * from users where token = $1',
    query: 'select * from users',
    detail: 'password authentication failed for user "postgres"',
    meta: { token: 'tok_supersecreto' },
  })

  it('classifica como internal_error e responde 500', () => {
    const normalized = normalizeAdminServerError(leaky, { entity: 'product' })
    expect(normalized.code).toBe('internal_error')
    expect(normalized.status).toBe(500)
    expect(normalized.retryable).toBe(true)
  })

  it('não expõe stack, SQL, host, detail nem meta na resposta', () => {
    const normalized = normalizeAdminServerError(leaky, { entity: 'product' })
    const serialized = JSON.stringify(normalized)

    expect(normalized.detail).toBeNull()
    expect(normalized.meta).toBeUndefined()
    for (const secret of [
      'segredo-no-stack',
      'select * from users',
      '10.0.0.1',
      'ECONNREFUSED',
      'tok_supersecreto',
      'password authentication failed',
      '/srv/app/db.ts',
    ]) {
      expect(serialized, `vazou "${secret}"`).not.toContain(secret)
    }
  })

  it('usa copy fixa em vez da mensagem do driver', () => {
    const normalized = normalizeAdminServerError(leaky)
    expect(normalized.summary).toBe('Não foi possível concluir a operação.')
    expect(normalized.message).toContain('código de suporte')
  })
})

describe('limite de escopo — a conversão 400→422 não vaza para o Payload nativo', () => {
  const sourceFiles = async (): Promise<Array<{ file: string; text: string }>> => {
    const roots = ['src']
    const found: Array<{ file: string; text: string }> = []

    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue
          await walk(full)
        } else if (/\.tsx?$/.test(entry.name)) {
          found.push({ file: full.replace(/\\/g, '/'), text: await readFile(full, 'utf8') })
        }
      }
    }

    for (const root of roots) await walk(join(process.cwd(), root))
    return found
  }

  it('só as rotas administrativas do Esméra chamam o serializer', async () => {
    const callers = (await sourceFiles())
      .filter(({ file, text }) => !file.includes('/server/admin/errors/')
        && /\b(adminErrorResponse|adminCodedError|normalizeAdminServerError)\s*\(/.test(text))
      .map(({ file }) => file.slice(file.indexOf('src/')))
      .sort()

    // Nenhum hook, collection, global ou rota legada pode estar nesta lista:
    // um ValidationError lançado por eles continua saindo como 400 nativo.
    expect(callers).toEqual([
      'src/app/(payload)/api/admin-categories/route.ts',
      'src/app/(payload)/api/admin-products/route.ts',
    ])
  })

  it('os hooks fora de escopo continuam lançando ValidationError comum', async () => {
    const untouched = [
      'src/hooks/sales/applySaleRules.ts',
      'src/hooks/opportunities/applyOpportunityRules.ts',
      'src/hooks/afterSales/applyAfterSalesRules.ts',
      'src/hooks/afterSales/applyOccurrenceRules.ts',
      'src/hooks/users/ensureUserRole.ts',
    ]

    for (const relative of untouched) {
      const text = await readFile(join(process.cwd(), relative), 'utf8')
      expect(text, `${relative} não deve importar o serializer`).not.toContain('admin/errors')
      expect(text).toContain('ValidationError')
    }
  })
})

describe('separação entre copy e decisão no serializer', () => {
  it('trocar o catálogo de copy não altera código, status nem retryable', () => {
    const stub = Object.fromEntries(
      adminErrorCodes.map((code) => [code, { summary: 'AAA', message: 'BBB' }]),
    )
    const real = normalizeAdminServerError(new PublicationVerificationFailedError())
    const stubbed = normalizeAdminServerError(new PublicationVerificationFailedError(), {}, stub)

    expect(stubbed.code).toBe(real.code)
    expect(stubbed.status).toBe(real.status)
    expect(stubbed.retryable).toBe(real.retryable)
  })
})
