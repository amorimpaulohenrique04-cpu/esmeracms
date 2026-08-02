# Esméra CMS — Etapa 8 · Opportunities e migração comercial

Status: **implementação concluída; gate final registrado ao fim da etapa**.

Branch: `feat/admin-operational-rebuild`

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0.

## Objetivo

A Etapa 8 elimina a ambiguidade de domínio em que Leads e Sales podiam representar a mesma negociação.

O fluxo alvo passa a ser:

`Lead → Customer → Opportunity → Sale → AfterSaleCase`

Papéis definitivos:

- **Lead:** aquisição e qualificação;
- **Opportunity:** negociação comercial;
- **Sale:** transação ganha e snapshot financeiro;
- **AfterSales:** entrega, atendimento e continuidade pós-venda.

Payload e PostgreSQL continuam como fonte única de verdade. Não foi criado banco paralelo, CRM externo ou estado autoritativo no cliente.

## Collection Opportunities

Foi criada a Collection `opportunities` com:

- `code` único e gerado pelo servidor;
- `customer`;
- `source`;
- `stage`;
- `rank`;
- `owner`;
- `priority`;
- `interestedProducts`;
- `estimatedValueCents`;
- `nextAction`;
- `nextActionAt`;
- `expectedCloseAt`;
- `closedAt`;
- `lossReason` estruturado;
- `lossNotes`;
- `wonSale`;
- `sourceLead`;
- `migrationVersion`;
- `migratedAt`.

Índices de aplicação foram declarados para stage, rank, owner, source, nextActionAt, expectedCloseAt, closedAt e relações de compatibilidade.

`estimatedValueCents` nunca é inferido durante a migração. Quando o Lead legado não possui um valor verificável, o campo permanece `null`.

## Regras de estágio

Estágios:

- `new`;
- `curation`;
- `proposal`;
- `negotiation`;
- `won`;
- `lost`.

Transições intermediárias são validadas pelo servidor. Estados encerrados não reabrem silenciosamente.

Regras críticas:

- `won` exige Customer relacionado;
- `lost` exige motivo estruturado;
- `closedAt` é definido pelo servidor para novos encerramentos;
- campos de perda são removidos fora de `lost`;
- `wonSale` é removido fora de `won`;
- código e rank recebem defaults server-side.

O workflow completo de ganho com diálogo, confirmação de itens/valores e criação transacional da Sale pertence à Etapa 9. Nesta etapa foi criada a relação e a fronteira de domínio necessárias, sem simular fechamento financeiro.

## Stage history

Activities foi evoluída para registrar eventos indexáveis:

- `opportunity.created`;
- `opportunity.migrated`;
- `opportunity.stage_changed`.

Os eventos preservam:

- Opportunity;
- etapa anterior;
- nova etapa;
- motivo de perda;
- data/hora;
- responsável;
- relações com Lead e Customer.

O histórico continua append-mostly: operadores criam eventos por meio das operações do domínio; somente administradores podem alterar ou excluir o passado.

## Compatibilidade com Leads

Leads não foi removida nesta etapa.

Durante um ciclo de release:

- os campos comerciais legados continuam legíveis;
- `opportunity` e `opportunityMigratedAt` ligam o registro antigo ao novo;
- a descrição do Admin deixa explícito que os estágios comerciais de Lead são compatibilidade;
- novos Leads continuam servindo para entrada e qualificação;
- o Pipeline, Dashboard e funil comercial deixam de consultar `leads.stage`.

A simplificação definitiva de stages e dependências antigas só deve ocorrer após estabilização e conferência da migração.

## Migração idempotente

Serviço:

`src/server/domain/opportunities/migration.ts`

CLI:

`src/scripts/migrate-opportunities.ts`

A migração lê Leads em:

- `curation`;
- `proposal`;
- `negotiation`;
- `won`;
- `lost`.

Para cada Lead:

1. procura Opportunity existente por `sourceLead` ou código determinístico `OPP-L-{leadId}`;
2. reutiliza a existente quando encontrada;
3. tenta vincular Customer por relação direta ou por telefone/e-mail normalizados;
4. copia origem, estágio, responsável, produtos e próxima ação;
5. mantém valor estimado como `null` quando desconhecido;
6. vincula a Opportunity de volta ao Lead;
7. cria Activity de migração somente quando ainda não existe.

Lead ganho sem Customer inequívoco não é convertido silenciosamente. O registro é ignorado e aparece em `issues` para correção manual.

### Dry-run

```bash
pnpm migrate:opportunities:dry-run
```

O dry-run não grava documentos. Ele informa:

- quantidade examinada;
- quantas Opportunities seriam criadas;
- registros reutilizáveis;
- registros ignorados;
- conflitos e vínculos ausentes.

### Execução

```bash
pnpm migrate:opportunities
```

Por padrão, a CLI termina com código de erro quando existem registros ignorados. Isso impede tratar uma migração parcial como sucesso.

Após análise consciente, a operação pode aceitar skips sem mascará-los:

```bash
pnpm migrate:opportunities --allow-skips
```

### Reexecução

A reexecução não cria uma segunda Opportunity para o mesmo Lead. O serviço procura `sourceLead` e código determinístico antes de criar.

## Rollback

```bash
pnpm migrate:opportunities:rollback
```

O rollback:

- seleciona apenas Opportunities da versão `lead-stage-v1`;
- remove o vínculo no Lead;
- remove a Activity específica de migração;
- exclui a Opportunity migrada.

Ele é bloqueado quando a Opportunity já possui Sale relacionada ou `wonSale`. Uma negociação que já produziu transação não pode ser apagada por rollback automático.

## Ordem segura de implantação

O CI valida o schema em PostgreSQL descartável. Em produção, a ordem é:

1. backup verificável do PostgreSQL;
2. gerar e revisar a migration de schema do Payload a partir do ambiente alvo;
3. ensaiar schema + dry-run em cópia restaurada do banco;
4. aplicar schema;
5. executar `pnpm migrate:opportunities:dry-run`;
6. corrigir Customers ambíguos e Leads ganhos sem Customer;
7. executar `pnpm migrate:opportunities`;
8. comparar contagens por estágio e amostra de relações;
9. liberar a aplicação que lê Opportunities.

Não foi incluído SQL manual inventado no repositório: a migration de schema deve ser gerada pelo Payload contra o estado real do banco de destino, revisada e ensaiada antes do deploy.

## Sales e Activities

Sales recebeu relação única `opportunity`.

Sales continua preservando:

- snapshots de produto;
- SKU/seleção;
- preço em centavos;
- cálculo de subtotal e total;
- `confirmedAt`;
- estados de fulfillment.

Os status comerciais `proposal` e `negotiation` continuam no schema de Sales somente como compatibilidade legada e estão rotulados como tal no Admin. Novas negociações devem ocorrer em Opportunities.

## Superfícies atualizadas

### Vendas / Pipeline

`/admin/sales?view=pipeline` agora consulta `opportunities`.

Cada coluna mostra:

- quantidade;
- soma do valor potencial informado;
- código;
- cliente;
- origem;
- valor potencial ou ausência explícita;
- próxima ação;
- responsável.

A implementação interativa completa com dnd-kit, rank mutation, Inspector e diálogos Won/Lost pertence à Etapa 9.

### Dashboard

O KPI e o resumo do Pipeline consultam Opportunities abertas. O CTA comercial cria uma Opportunity, não um Lead usado como negociação.

### Relatórios

As fontes foram separadas:

- aquisição/origem: Leads;
- conversão comercial: Opportunities encerradas;
- receita: Sales confirmadas ou posteriores.

O corte padrão do novo funil é `2026-08-01T00:00:00.000Z`, configurável por:

```env
OPPORTUNITY_FUNNEL_CUTOVER_AT=2026-08-01T00:00:00.000Z
```

A janela efetiva usa a data mais recente entre o início do período consultado e o cutover. Opportunities migradas sem `closedAt` verificável não entram artificialmente na conversão.

### Busca e criação global

Command Palette pesquisa Opportunities por código, próxima ação e Customer.

O menu `Novo` distingue:

- Novo Lead — entrada/qualificação;
- Nova oportunidade — negociação comercial.

## Testes

A suíte de integração cobre:

- geração de código e rank;
- transições permitidas e bloqueadas;
- Customer obrigatório em `won`;
- motivo obrigatório em `lost`;
- `closedAt` server-side;
- stage history em Activities;
- dry-run;
- migração real;
- cópia de Customer e Products;
- ausência de valor inventado;
- idempotência;
- rollback seguro.

O E2E cobre:

- criação real de Opportunity via API autenticada;
- exibição no Pipeline;
- Pipeline sem leitura transitória de Leads;
- KPI no Dashboard;
- busca da Opportunity no Command Palette/API.

O baseline visual inclui Dashboard, Pipeline e documento técnico de Opportunity em cinco viewports.

## Fora desta etapa

Pertencem à Etapa 9:

- TanStack Table completo para Opportunities;
- filtros comerciais avançados;
- dnd-kit e ordenação dentro das colunas;
- mutation otimista para estágios intermediários;
- Inspector em Drawer;
- diálogos obrigatórios de Won/Lost;
- workflow transacional Opportunity won → Sale;
- confirmação de snapshots, preços e seleções;
- abertura direta da Sale gerada.
