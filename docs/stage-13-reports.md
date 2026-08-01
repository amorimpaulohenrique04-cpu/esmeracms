# Esméra CMS — Etapa 13 · Relatórios investigáveis

Status: **implementação aplicada sobre `feat/admin-operational-rebuild`**.

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0, Etapa 13, usando o contrato semântico consolidado na Etapa 12.

## Objetivo

Transformar `/admin/reports` em um fluxo de investigação:

`KPI → segmento → registros reais`

A tela não é uma coleção decorativa de gráficos. Filtros, comparações, gráficos e tabelas usam o mesmo Reporting Service e sempre permitem chegar aos documentos do Payload.

## Filtros globais

- período inicial e final;
- comparação com período anterior ou mesmo período do ano anterior;
- responsável;
- origem;
- categoria;
- produto.

Os filtros ficam na URL. O botão **Compartilhar** copia a URL exata, incluindo as datas normalizadas. Reabrir a URL restaura o mesmo recorte.

Durante uma nova consulta:

- os últimos dados válidos permanecem visíveis;
- a área entra em estado muted;
- não existe spinner de tela cheia;
- falhas aparecem como erro explícito sem converter resultados em zero.

## KPIs

Os quatro indicadores principais são:

- oportunidades criadas;
- conversão de encerradas;
- ticket médio;
- ciclo médio de venda.

Cada KPI abre um Drawer com os registros reais usados no cálculo. Comparações são mostradas como variação do contrato semântico, sem pills decorativas.

## Evolução comercial

Foi criado um único wrapper:

```tsx
<EChart option={...} ariaLabel="..." />
```

Características:

- ECharts carregado dinamicamente apenas na rota de Relatórios;
- renderer SVG;
- tema visual Esméra registrado no wrapper;
- `ResizeObserver` por container;
- ARIA habilitada e rótulo acessível;
- configuração dos gráficos concentrada em `charts.ts`.

A evolução alterna entre:

- volume de Leads, Opportunities e Sales;
- receita;
- comparação temporal quando selecionada.

## Funil

O funil não usa o trapézio genérico. As etapas horizontais exibem:

- volume alcançado;
- conversão para a próxima etapa;
- drop-off em volume e percentual;
- abertura dos registros da coorte que alcançaram a etapa.

A fonte continua sendo `Activities`, com `fromStage` e `toStage` estruturados.

## Segmentos investigáveis

### Motivos de perda

Ranking horizontal com volume, percentual e Drawer de Opportunities perdidas.

### Origem

Tabela com oportunidades, conversão e receita. A origem pode ser aplicada como filtro global ou aberta em drill-down.

### Produtos e categorias

Tabela alternável com oportunidades, conversão, vendas e receita bruta por item. Produto/categoria pode ser aplicado como filtro ou aberto em drill-down.

### Responsáveis

Tabela com oportunidades, conversão, vendas, receita e ticket. O responsável pode ser aplicado como filtro ou aberto em drill-down.

## API e drill-down

Endpoint autenticado:

```text
GET /api/admin-reports
GET /api/admin-reports?mode=drilldown&kind=...
```

O endpoint usa a autenticação do Payload, aplica o mesmo contrato de filtros e retorna no máximo 100 registros recentes por recorte. Cada registro leva à Collection real de Opportunities ou Sales.

## Performance

- agregações continuam no PostgreSQL;
- séries temporais usam `generate_series` e agrupamento diário;
- o browser recebe apenas séries e linhas agregadas;
- ECharts não entra no bundle inicial do restante do Admin;
- P95 continua instrumentado pelo runner da Etapa 12.

## Testes

A cobertura adicionada verifica:

- filtros preservados na URL;
- atualização muted mantendo dados anteriores;
- cópia da URL exata;
- abertura do drill-down;
- renderização acessível do gráfico;
- ausência de overflow horizontal em tablet e mobile.

A Etapa 13 também corrige o bloqueio de lint da Etapa 12 removendo a constante não utilizada em `funnel.ts`.
