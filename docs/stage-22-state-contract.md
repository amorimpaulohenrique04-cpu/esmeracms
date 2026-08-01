# Etapa 22 — Estados de loading, ausência e erro

## Contrato único

O contrato transversal está em `src/admin/state/asyncState.ts` e `src/admin/design-system/Feedback.tsx`.

### Loading

- skeleton local e contextual;
- `aria-busy` e status anunciado;
- dado anterior preservado durante atualização;
- bloqueio de página inteira evitado quando a ação é local.

### Empty

- consulta concluída sem registros;
- filtro sem correspondência;
- integração ainda não configurada;
- ação de saída contextual quando aplicável.

Ausência de integração nunca é transformada em tráfego, receita, conversão ou qualquer outro valor demonstrativo.

### Error

Códigos normalizados:

- `query_error`;
- `unauthorized`;
- `forbidden`;
- `not_found`;
- `conflict`;
- `duplicate`;
- `mutation_rollback`;
- `job_failed`;
- `integration_unconfigured`;
- `unknown`.

`expectAdminResponse` interpreta respostas HTTP e produz `AdminRequestError`. `normalizeAdminError` mantém a mesma estrutura na interface. Mutations de Privacidade e a Command Palette já usam o contrato compartilhado.

## Métricas verdadeiras

- `finiteMetric` rejeita `NaN` e infinitos;
- `assertFiniteMetric` produz erro explícito quando uma métrica é inválida;
- divisões sem denominador continuam retornando `null`;
- comparação contra zero não inventa percentual;
- erros de consulta preservam o último snapshot válido.

## Referência visual e E2E

O Admin técnico contém a referência visível dos quatro estados. O E2E comprova:

- renderização de loading, empty, integração e erro;
- erro controlado de Reporting sem ocultar o snapshot anterior;
- ausência de `NaN`, `Infinity` e `undefined` na view;
- erro explícito da busca sem resultados falsos.

A fonte continua sendo Payload/PostgreSQL ou uma integração real configurada. O contrato não cria fallback demonstrativo.
