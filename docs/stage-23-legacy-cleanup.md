# Esméra CMS — Etapa 23 · Limpeza do legado

Status: **implementação em validação**.

Branch: `agent/etapa-23-legacy-cleanup`

Base: `agent/etapas-20-22-quality-gates` no commit `30010dc5dd43f2d738e0a1a02f591a999e4a45c7`.

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0.

## Objetivo

Remover superfícies, regras e estilos que ficaram sem responsabilidade depois da reconstrução operacional, sem apagar dados necessários para auditoria, migração ou rollback antes de existir evidência de rollout concluído.

## Remoções executadas

### ContentView

`src/admin/modules/content/ContentView.tsx` foi excluído.

O App Shell atual não possui a navegação `Conteúdo do Site`, e `payload.config.ts` não registrava essa view. O arquivo era órfão e reintroduzia uma superfície editorial paralela ao fluxo Produtos/Categorias/Admin técnico.

### Views antigas

As antigas views agregadoras já não existiam na base usada pela Etapa 23:

- `src/admin/views/BusinessViews.tsx`;
- `src/admin/views/Dashboard.tsx`;
- `src/admin/views/SiteViews.tsx`.

O analisador de código morto passa a bloquear o retorno desses caminhos.

### CSS compartilhado antigo

`src/admin/views/views.scss` foi limitado aos contratos realmente compartilhados:

- frame e cabeçalho de página;
- métricas genéricas;
- grids, cards e listas;
- estados e alias transitório de status.

Foram removidas regras antigas ou duplicadas de:

- Pipeline;
- cards antigos do Pipeline;
- trilha de estágios;
- qualidade editorial do ContentView;
- barras de relatório antigas.

O Pipeline atual continua integralmente definido em `src/admin/modules/sales/sales.scss`.

### Leads

Leads deixam de executar comportamento comercial:

- o hook `applyLeadRules` foi removido;
- etapa, próxima ação, prazo, encerramento e motivo de perda não aparecem mais na operação;
- novos Leads representam somente aquisição e qualificação;
- negociação e fechamento pertencem exclusivamente a Opportunities;
- vínculos com Customer e Opportunity permanecem para rastreabilidade.

Os campos comerciais antigos continuam no schema como campos ocultos e sem regra ativa, apenas para que dados históricos ainda possam ser lidos pela migração antes da remoção física definitiva.

## Follow-ups aninhados

A operação atual usa Tasks, Shipments e Occurrences. Leituras de `followUps` aninhados são permitidas somente em:

- `src/collections/AfterSales.ts`, como compatibilidade de schema;
- `src/scripts/migrate-after-sales-followups.ts`, como migração idempotente e rollback.

O analisador da Etapa 23 falha caso outra parte de `src/` volte a consultar esse array.

## Remoções deliberadamente adiadas

### Redirect `/admin/pipeline`

O redirect legado para `/admin/sales?view=pipeline` foi preservado.

O Plano Mestre condiciona a remoção de redirects ao término de um período definido. O repositório não contém data de expiração, telemetria de acesso ou registro de rollout em produção que autorize quebrar URLs antigas. A remoção deve ocorrer no Release Gate depois dessa evidência.

### Scripts e campos de migração

Foram preservados:

- `migrate-opportunities.ts`;
- `migrate-after-sales-followups.ts`;
- campos históricos usados por esses scripts;
- rotinas de rollback.

A remoção física só é segura depois de:

1. backup validado;
2. dry-run sem registros ignorados;
3. migração aplicada em produção;
4. conferência de contagem e vínculos;
5. janela de rollback encerrada.

## Análise de código morto

`pnpm analyze:dead-code`:

- constrói um grafo de imports relativos em `src/`;
- parte de Payload config, rotas, migrations e scripts como entry points;
- falha com arquivos órfãos;
- falha se caminhos legados conhecidos retornarem;
- falha se `followUps` for lido fora da fronteira de migração.

Relatório: `artifacts/dead-code-analysis.json`.

## Análise de bundle

`pnpm analyze:bundle` inventaria:

- `.next/static/chunks`;
- `.next/server/app`;
- bytes totais;
- bytes JavaScript;
- maiores assets gerais e JavaScript.

Relatório: `artifacts/bundle-analysis.json`.

As duas análises fazem parte de `pnpm validate` depois do build.

## Gate visual anterior

A captura principal possui 24 rotas em cinco viewports e excedeu o timeout global de 180 segundos depois de produzir a maior parte das imagens. O timeout do baseline foi ampliado para 480 segundos; o servidor continua com limite de inicialização de 180 segundos.

A mudança não reduz cobertura, não adiciona retry e não mascara seletor instável. Ela permite que a matriz existente conclua as 120 capturas antes da comparação.

## Critérios de aceite

- TypeScript verde;
- lint sem warnings;
- testes unitários e de integração verdes;
- build de produção verde;
- dead-code analysis sem órfãos;
- bundle analysis gerado;
- E2E verde;
- baseline capturado nos cinco viewports;
- comparação visual executada;
- nenhum campo histórico removido sem evidência de migração segura;
- nenhuma alteração na `main`.
