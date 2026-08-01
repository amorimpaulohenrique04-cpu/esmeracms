# Etapa 21 — Regressão visual

## Matriz obrigatória

As telas críticas são capturadas em:

- 1440 × 900;
- 1280 × 800;
- 1024 × 768;
- 768 × 1024;
- 390 × 844.

A matriz inclui Dashboard, Produtos, Categorias, Clientes, Opportunity, Vendas, Pipeline, Pós-venda, Relatórios, Configurações, Admin técnico e Privacidade. Estados interativos adicionais registram foco por teclado, Command Palette e Drawer mobile.

## Comparação

`src/scripts/compare-visual-baseline.ts` compara o artifact atual com o último artifact aprovado da branch-base.

O gate verifica:

- presença do mesmo arquivo;
- dimensões da captura;
- proporção de pixels alterados;
- delta médio dos canais RGB;
- novas superfícies adicionadas à matriz.

Orçamento padrão:

- diferença de canal considerada: 24;
- máximo de pixels alterados: 2,5%;
- delta médio máximo: 5.

Arquivos ausentes, mudança de dimensão ou diferença acima do orçamento reprovam o workflow.

## Aprovações explícitas

Mudanças visuais intencionais usam `visual-regression.approvals.json`. A aprovação fica vinculada ao SHA exato da branch-base. Assim, ela vale apenas para a mudança declarada e expira automaticamente quando o novo baseline entra na reconstrução.

A Etapa 22 aprova uma única mudança intencional: a referência visível de estados no Admin técnico, nos cinco viewports.

## Workflow

O workflow `Stage 0 - Security and Baseline`:

1. executa o release gate;
2. captura a matriz atual;
3. baixa o último baseline aprovado da branch-base;
4. executa `pnpm baseline:compare`;
5. publica as capturas e o relatório JSON.

Novas imagens são registradas como `new` na primeira introdução. Depois de incorporadas à branch-base, tornam-se comparações obrigatórias.
