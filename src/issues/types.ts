/**
 * Contrato tipado de issues de publicação (PR-06, §4.1 do plano do CMS).
 *
 * Este módulo é uma folha: não importa nada fora de `src/issues/`. Em especial não
 * importa `next/*`, `payload` nem `node:*`, porque é consumido tanto por regras de
 * negócio (`src/businessRules/`) quanto por collections do Payload, e arrastar o
 * runtime do Next para dentro de um collection config quebraria o build.
 */

export const issueSeverities = ['blocker', 'warning', 'info'] as const
export type IssueSeverity = (typeof issueSeverities)[number]

export const issueSources = ['readiness', 'payload', 'storefront', 'media', 'concurrency'] as const
export type IssueSource = (typeof issueSources)[number]

export type IssueParams = Record<string, string | number>

/**
 * Issue pronta para consumo: já carrega a copy editorial resolvida.
 * `path`, `tab` e `label` são obrigatórios — o registry sempre resolve os três.
 */
export type PublicationIssue = {
  code: string
  severity: IssueSeverity
  path: string
  tab: string
  label: string
  message: string
  suggestion?: string
  anchor?: string
  source: IssueSource
}

/**
 * Issue crua: a decisão de negócio, sem nenhum campo de copy.
 *
 * É deliberadamente impossível carregar uma mensagem legível aqui. Quem decide
 * (readiness, hierarquia de categorias) só produz `RawIssue`; a copy entra depois,
 * em `decorate()`. É esse limite estrutural que garante o ERR-U02: alterar a copy
 * não pode alterar código, path, aba nem decisão de negócio, porque a copy nunca
 * esteve disponível no ponto da decisão.
 */
export type RawIssue = {
  code: string
  severity: IssueSeverity
  path: string
  source: IssueSource
  params?: IssueParams
}

/**
 * Prefixo de path para issues que valem para o documento inteiro, não para um campo.
 *
 * `$` foi escolhido porque não pode aparecer num path de campo do Payload — `_`
 * colidiria com campos internos como `_status`.
 */
export const ENTITY_SCOPE_PREFIX = '$'

export const ENTITY_PATH_DOCUMENT = '$document'
export const ENTITY_PATH_REVISION = '$revision'

export function isEntityScoped(path: string): boolean {
  return path.startsWith(ENTITY_SCOPE_PREFIX)
}
