# Etapa 21 — Regressão visual

## Matriz obrigatória

As telas críticas são capturadas em:

- 1440 × 900;
- 1280 × 800;
- 1024 × 768;
- 768 × 1024;
- 390 × 844.

A matriz inclui Dashboard, Produtos, Categorias, Clientes, Opportunity, Vendas, Pipeline, Pós-venda, Relatórios, Configurações, Admin técnico e Privacidade. Estados interativos adicionais registram foco por teclado, Command Palette e Drawer mobile.

## Dataset visual isolado

`pnpm baseline:capture` começa executando `pnpm baseline:prepare`.

A preparação:

- só pode apagar dados em CI, banco local ou mediante `ALLOW_VISUAL_DATA_RESET=true` explícito;
- remove dados funcionais criados pelos testes anteriores, respeitando a ordem de dependências;
- recria o diretório de capturas;
- grava `baseline-manifest.json` com a versão do dataset.

A versão atual é `stage23-v1`, definida por `VISUAL_DATASET_VERSION` no workflow.

Artifacts sem manifesto ou com versão diferente são incompatíveis e não podem ser usados como referência. Nesse caso, as capturas limpas entram como `new`; depois de incorporadas à branch-base, tornam-se o baseline obrigatório das próximas mudanças.

Isso impede que fixtures dos testes E2E alterem a quantidade de linhas, a altura das páginas ou os KPIs usados na comparação visual.

## Comparação

`src/scripts/compare-visual-baseline.ts` compara o artifact atual com o último artifact compatível e aprovado da branch-base.

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
2. limpa e versiona o dataset visual;
3. captura a matriz atual;
4. baixa o último baseline aprovado da branch-base;
5. valida a compatibilidade do manifesto;
6. executa `pnpm baseline:compare`;
7. publica as capturas e o relatório JSON.

Novas imagens ou uma nova versão de dataset são registradas como `new` na primeira introdução. Depois de incorporadas à branch-base, tornam-se comparações obrigatórias.
