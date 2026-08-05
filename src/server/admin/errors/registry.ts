/**
 * O registry editorial mora em `src/issues/registry.ts` — um módulo folha que
 * regras de negócio e collections do Payload podem importar sem arrastar o
 * runtime do Next junto. Este arquivo permanece só para não quebrar a superfície
 * do barrel `src/server/admin/errors`.
 */
export {
  DEFAULT_FALLBACK_TAB,
  defaultEntityTabs,
  editorialFieldRegistries,
  interpolateIndices,
  resolveEditorialFieldLocation,
  splitArrayPath,
  type EditorialFieldLocation,
} from '../../../issues/registry'
