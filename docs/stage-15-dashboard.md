# Esméra CMS — Etapa 15 · Dashboard final

Status: implementação na branch `agent/etapa-15-dashboard-final`, baseada em `feat/admin-operational-rebuild`.

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0, Etapa 15.

## Objetivo

O Dashboard final responde três perguntas:

1. o que aconteceu;
2. o que exige atenção;
3. onde o usuário deve agir.

Ele não replica Relatórios, não cria uma segunda definição de métricas e não exibe dados simulados.

## Snapshot server-side

A consulta central fica em:

```text
src/server/dashboard/index.ts
```

O snapshot é montado no servidor, respeita o papel do usuário e combina:

- produtos reais do Payload;
- métricas comerciais do mesmo `Reporting Service` usado por Relatórios;
- estado atual do pipeline de `Opportunities`;
- `Tasks` reais abertas;
- estado explícito da integração de tráfego.

A primeira resposta já contém HTML útil. Não existe loading vazio aguardando JavaScript.

## Header

O cabeçalho apresenta:

- saudação com o primeiro nome disponível;
- data operacional em `America/Recife`;
- contexto editorial do Dashboard;
- ações de criação compatíveis com o papel do usuário.

Administradores recebem criação de oportunidade e produto. Usuários comerciais recebem oportunidade. Usuários editoriais recebem produto.

## Indicadores

Para usuários com acesso comercial, a faixa principal contém:

- produtos ativos;
- oportunidades abertas;
- vendas válidas no mês;
- Tasks abertas.

Cada indicador abre uma área real do CMS. Receita mensal aparece como contexto da quantidade de vendas, não como métrica paralela.

Usuários exclusivamente editoriais recebem produtos ativos e pendências reais de prontidão, sem exposição de dados comerciais.

## Pipeline compacto

O pipeline usa `getDashboardReporting`, que delega ao Reporting Service.

Cada estágio apresenta:

- rótulo oficial;
- volume real;
- barra proporcional ao maior estágio atual;
- link para `/admin/sales?view=list&stage=<stage>`.

O Dashboard não substitui a página de Vendas. O link “Ver pipeline completo” abre `/admin/sales?view=pipeline`.

## Pendências

A área de pendências consulta `Tasks` com status `pending` ou `in_progress`.

Regras:

- ordenação crescente por `dueAt`;
- Tasks atrasadas aparecem antes das futuras;
- KPI separa atrasadas e as que vencem no restante do dia;
- cada linha abre o vínculo operacional mais relevante;
- a Task técnica continua disponível como acesso secundário.

Prioridade de contexto:

1. caso de pós-venda;
2. oportunidade;
3. ocorrência;
4. entrega;
5. cliente;
6. venda;
7. lead;
8. própria Task como fallback.

## Catálogo recente

Usuários editoriais e administradores veem os cinco produtos atualizados mais recentemente, com:

- título;
- código;
- estado editorial;
- estado de catálogo;
- horário de atualização;
- link para o Document View operacional.

Nenhum item demonstrativo é criado.

## Tráfego

Enquanto não existir integração real de Analytics, o Dashboard mostra apenas:

```text
Não configurado
```

Não são exibidos visitantes, sessões, percentuais ou gráficos fictícios.

## Responsividade e acessibilidade

O layout usa o container `esmera-workspace`:

- quatro KPIs em desktop;
- dois por linha em tablet;
- um por linha no mobile;
- painéis em coluna abaixo de 980px;
- tarefas e produtos reorganizados sem overflow do documento;
- foco visível em todos os links de ação;
- `prefers-reduced-motion` remove transições não essenciais.

## Testes

Cobertura adicionada:

- `tests/int/dashboard.int.spec.ts`
  - permissões;
  - catálogo recente real;
  - pipeline do Reporting Service;
  - contagem de Tasks abertas, atrasadas e do dia;
  - tráfego não configurado.
- `tests/e2e/dashboard.e2e.spec.ts`
  - quatro indicadores operacionais;
  - pipeline, pendências, catálogo e tráfego;
  - link de estágio para Vendas filtradas;
  - ausência de percentual placeholder;
  - ausência de overflow em tablet e mobile.

## Critérios de aceite

- Dashboard e Relatórios usam o mesmo contrato comercial;
- produtos, oportunidades, vendas e Tasks vêm do Payload/PostgreSQL;
- pipeline abre registros filtrados em Vendas;
- atrasos têm precedência visual e de ordenação;
- catálogo recente possui links reais;
- tráfego permanece “Não configurado” até integração real;
- nenhum número é inventado;
- a `main` permanece intocada durante a reconstrução.
