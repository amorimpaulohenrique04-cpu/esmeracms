/**
 * Ponte entre decisão e apresentação: `RawIssue` → `PublicationIssue`.
 *
 * O catálogo de copy é o último parâmetro e é injetável. Isso não é conveniência
 * de teste: é o que torna o ERR-U02 verificável — um catálogo alternativo muda
 * `message`/`suggestion` e mais nada.
 */

import { issueCopy, type IssueCopyCatalog } from './copy'
import { resolveEditorialFieldLocation } from './registry'
import type { PublicationIssue, RawIssue } from './types'

export function decorateIssue(
  raw: RawIssue,
  entity: string | undefined,
  catalog: IssueCopyCatalog = issueCopy,
): PublicationIssue {
  const location = resolveEditorialFieldLocation(entity, raw.path)
  const entry = catalog[raw.code]
  const params = raw.params || {}

  return {
    code: raw.code,
    severity: raw.severity,
    path: raw.path,
    tab: location.tab,
    label: location.label,
    message: entry ? entry.message(params) : raw.code,
    ...(entry?.suggestion ? { suggestion: entry.suggestion } : {}),
    ...(location.anchor ? { anchor: location.anchor } : {}),
    source: raw.source,
  }
}

export function decorateIssues(
  raws: readonly RawIssue[],
  entity: string | undefined,
  catalog: IssueCopyCatalog = issueCopy,
): PublicationIssue[] {
  return raws.map((raw) => decorateIssue(raw, entity, catalog))
}

/**
 * Deduplica por `code|path`.
 *
 * Antes a chave era a própria mensagem, que interpola dados do editor (SKU,
 * código de opção). Com paths por item, duas variantes sem SKU são duas
 * pendências distintas — e passam a ser contadas como tais.
 */
export function dedupeIssueKey(issue: { code: string; path: string }): string {
  return `${issue.code}|${issue.path}`
}

export function dedupeRawIssues(raws: readonly RawIssue[]): RawIssue[] {
  const seen = new Map<string, RawIssue>()
  for (const raw of raws) {
    const key = dedupeIssueKey(raw)
    if (!seen.has(key)) seen.set(key, raw)
  }
  return [...seen.values()]
}

export function mergeIssues(
  base: readonly PublicationIssue[],
  incoming: readonly PublicationIssue[],
): PublicationIssue[] {
  const merged = [...base]
  const known = new Set(merged.map(dedupeIssueKey))
  for (const issue of incoming) {
    const key = dedupeIssueKey(issue)
    if (known.has(key)) continue
    known.add(key)
    merged.push(issue)
  }
  return merged
}
