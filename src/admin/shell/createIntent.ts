export const CREATE_INTENT_PARAM = 'novo'

export type CreateIntent = 'produto' | 'oportunidade' | 'cliente'

/** Rota da página de destino + sinalização de qual popup de criação abrir assim que ela carregar. */
export function createIntentHref(path: string, intent: CreateIntent) {
  return `${path}?${CREATE_INTENT_PARAM}=${intent}`
}
