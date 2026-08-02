# Esméra CMS — Etapa 12 · Reporting Service

Status: **implementação aplicada na branch `feat/admin-operational-rebuild`**.

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0 e contratos comerciais consolidados nas Etapas 8–11.

## Objetivo

Criar uma camada semântica única para Dashboard e Relatórios, agregada no PostgreSQL por Drizzle, sem carregar datasets operacionais completos no browser e sem repetir regras de negócio em componentes.

## Estrutura

```text
src/server/reporting/
  db.ts
  filters.ts
  funnel.ts
  index.ts
  losses.ts
  metrics.ts
  products.ts
  sales.ts
  sources.ts
  team.ts
```

## Contrato semântico

`metrics.ts` centraliza:

- venda válida;
- receita;
- oportunidade criada;
- conversão;
- ticket médio;
- ciclo de venda;
- período e comparação;
- versão semântica do relatório.

Regras principais:

- vendas válidas usam `confirmedAt` e status `confirmed`, `production`, `ready` ou `delivered`;
- receita é a soma de `sales.totalCents` das mesmas vendas;
- oportunidades migradas não são tratadas como novas oportunidades;
- conversão usa Opportunities encerradas como `won` ou `lost` após o corte verificável do funil;
- ciclo médio exclui migrações sem início comercial verificável;
- aquisição/origem de topo continua derivada de Leads, conforme a separação de domínio da Etapa 8.

## Agregação e performance

- consultas são executadas por `payload.db.drizzle.execute`;
- agregações, agrupamentos e filtros acontecem no PostgreSQL;
- apenas linhas agregadas retornam ao servidor/UI;
- cada consulta registra duração e P95 em uma janela móvel de 200 amostras;
- consultas acima de 800ms são registradas automaticamente; logging completo pode ser habilitado com `REPORTING_QUERY_LOGS=true`;
- nenhuma Materialized View foi criada antes de medição real justificar a complexidade.

## Funil

O funil usa o histórico estruturado de `Activities`:

- `opportunity.created`;
- `opportunity.stage_changed`;
- `fromStage`;
- `toStage`.

Isso permite calcular volume alcançado, progressão e perdas por etapa sem inferir histórico a partir apenas do estado atual.

## Filtros

O contrato aceita:

- período;
- comparação com período anterior ou ano anterior;
- responsável;
- origem;
- produto;
- categoria.

A janela padrão é mês até a data em `America/Recife`.

## Integração

- `DashboardView` usa o Reporting Service para oportunidades abertas, pipeline, vendas válidas e receita;
- `ReportsView` usa o mesmo contrato para vendas, receita, conversão, canais e origem;
- `Sales.ts` importa a definição central de status válidos;
- índices adicionais foram declarados para `sales.channel` e `sales.owner`.

## Integridade

- nenhum KPI fake;
- nenhum erro convertido em zero fora do contrato da agregação;
- valores financeiros permanecem em centavos no servidor;
- receita por produto/categoria é bruta por item; desconto e frete não são distribuídos artificialmente;
- produtos com várias categorias podem contribuir para mais de uma categoria e essa sobreposição é documentada.

## Testes

A integração cobre:

- oportunidades criadas;
- vendas válidas;
- receita;
- conversão;
- ticket médio;
- ciclo de venda;
- origem de Leads;
- canais;
- funil baseado em Activities;
- motivos de perda;
- produtos;
- equipe;
- compartilhamento do contrato com Dashboard;
- bloqueio de acesso para papel editorial.
