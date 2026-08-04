/**
 * @deprecated Adapter de migração da PR-06. Delega inteiramente a `./serialize`.
 *
 * Mantido enquanto houver consumidores fora das rotas administrativas auditadas.
 * O parser textual que vivia aqui (`inferCode`, com `message.includes('unique')`
 * e comparação de `error.name` por substring) foi removido — a classificação
 * agora é por `instanceof` em `classifyAdminError`.
 *
 * Para remover este arquivo: migrar os imports restantes e conferir que
 * `rg "fromPayload|normalizePayload|inferCode"` não retorna referência ativa.
 */
export {
  normalizeAdminServerError,
  type NormalizedAdminError,
} from './serialize'
