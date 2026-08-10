import type { Payload, Where } from 'payload'

const MATERIAL_ALIASES: Record<string, string[]> = {
  esmeralda: ['esmeralda'],
  'bege-bahia': ['Bege Bahia'],
  calcario: ['calcário', 'calcario'],
  marmore: ['mármore', 'marmore'],
  granito: ['granito'],
  quartzo: ['quartzo'],
  onix: ['ônix', 'onix'],
  travertino: ['travertino'],
  vidro: ['vidro'],
  cristal: ['cristal'],
  resina: ['resina'],
  metal: ['metal', 'metálica', 'metalica', 'metálico', 'metalico'],
  latao: ['latão', 'latao'],
  bronze: ['bronze'],
  aco: ['aço', 'aco'],
  madeira: ['madeira'],
}

type UnknownRecord = Record<string, unknown>
type FindArgs = UnknownRecord & { where?: Where }

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

export function readCanonicalMaterialFilters(searchParams: URLSearchParams): string[] {
  return unique(
    searchParams.getAll('material')
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean),
  ).slice(0, 20)
}

function materialAliases(value: string): string[] {
  return MATERIAL_ALIASES[value] || [value]
}

function requestedMaterialWhere(values: string[]): Where {
  const clauses = unique(values.flatMap(materialAliases)).map((value) => ({
    material: { like: value },
  })) as Where[]

  if (clauses.length === 1) return clauses[0]
  return { or: clauses }
}

function sameValues(candidate: unknown, requested: string[]) {
  if (!Array.isArray(candidate)) return false
  const values = candidate
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
  if (values.length !== requested.length) return false
  const left = [...new Set(values)].sort()
  const right = [...new Set(requested)].sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Rewrites only the material condition produced from the public request.
 * Collection listing rules can also contain `material.in`; those are left
 * untouched unless their value set is exactly the requested public filter.
 */
export function rewriteRequestedMaterialWhere(
  where: Where | undefined,
  requested: string[],
): Where | undefined {
  if (!where || !requested.length) return where

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit)
    const object = record(value)
    if (!object) return value

    const material = record(object.material)
    if (material && sameValues(material.in, requested)) {
      const rest = Object.fromEntries(
        Object.entries(object).filter(([key]) => key !== 'material'),
      )
      const materialWhere = requestedMaterialWhere(requested)
      return Object.keys(rest).length
        ? { and: [rest, materialWhere] }
        : materialWhere
    }

    return Object.fromEntries(
      Object.entries(object).map(([key, child]) => [key, visit(child)]),
    )
  }

  return visit(where) as Where
}

/**
 * Catalog V2 currently stores `Products.material` as editorial free text.
 * This lightweight Payload proxy lets the public API accept stable material
 * keys while preserving the existing CMS schema and listing-rule semantics.
 *
 * Payload's `find` method is generic/overloaded, so the wrapper deliberately
 * narrows only the runtime shape needed here and casts the final proxy back to
 * Payload. This avoids leaking the generic overload into the wrapper itself.
 */
export function withCanonicalMaterialFilters(
  payload: Payload,
  requested: string[],
): Payload {
  if (!requested.length) return payload

  const rawFind = payload.find.bind(payload) as unknown as (
    args: FindArgs,
  ) => Promise<unknown>
  const wrappedFind = (args: FindArgs) => rawFind({
    ...args,
    where: rewriteRequestedMaterialWhere(args.where, requested),
  })

  return new Proxy(payload, {
    get(target, property) {
      if (property === 'find') return wrappedFind
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as Payload
}
