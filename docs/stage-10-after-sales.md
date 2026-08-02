# Esméra CMS — Etapa 10 · Pós-venda operacional

Status: **implementação concluída; gate final registrado ao fim da etapa**.

Branch: `feat/admin-operational-rebuild`

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0.

## Objetivo

A Etapa 10 transforma `/admin/after-sales` em uma central de operações. A tela prioriza:

- prazo;
- tarefa;
- entrega;
- ocorrência;
- responsável;
- próximo passo verificável.

Não é um dashboard analítico. Contagens funcionam como filtros da fila e não como decoração.

## Modelo de domínio

O pós-venda passa a usar entidades consultáveis individualmente:

- **AfterSaleCase:** contêiner da relação pós-venda, ligado à Sale e ao Customer;
- **Task:** ação operacional com tipo, prazo, prioridade, responsável e status;
- **Shipment:** acompanhamento logístico por estados discretos;
- **Occurrence:** ocorrência com tipo, severidade, status, descrição e resolução;
- **Activity:** timeline consolidada e append-mostly.

Payload e PostgreSQL permanecem como fonte única de verdade.

## AfterSaleCase

A Collection `after-sales` agora possui:

- `caseNumber` gerado pelo servidor;
- `sale`;
- `customer` derivado e validado contra a Sale;
- `summary`;
- `status`;
- `priority`;
- `owner`;
- `openedAt` e `closedAt` controlados pelo servidor.

Os arrays e campos legados permanecem temporariamente em uma aba somente leitura. Novas operações não escrevem em `followUps` aninhados.

## Tasks e follow-ups

`Tasks` foi evoluída com:

- `type = delivery_confirmation | satisfaction | testimonial | maintenance | curation | custom`;
- `relatedTo` incluindo AfterSaleCase, Sale, Customer, Shipment e Occurrence;
- `dueAt`, `assignee`, `priority`, `status` e `completedAt`;
- `legacySourceKey` para migração idempotente;
- Activities automáticas para criação, mudança de status e conclusão.

A fila operacional lê Tasks como fonte de follow-ups.

## Shipments

A Collection `shipments` guarda:

- caso, venda e cliente;
- transportadora ou responsável;
- código de rastreio;
- entrega prevista;
- entrega realizada;
- último evento real;
- observações;
- status discreto.

Estados:

1. Pedido confirmado;
2. Coletado;
3. Em trânsito;
4. Saiu para entrega;
5. Entregue.

Exceção e cancelamento também são estados explícitos. Não existe percentual artificial de entrega.

## Occurrences

A Collection `occurrences` guarda:

- caso, venda e cliente;
- tipo;
- severidade;
- status;
- responsável;
- descrição;
- resolução;
- timestamps de abertura e encerramento.

Resolver ou encerrar exige uma resolução verificável. O servidor rejeita conclusão vazia.

## Fila operacional

A fila combina Tasks, Shipments e Occurrences em uma visão única.

Filtros rápidos:

- Follow-ups hoje;
- Atrasados;
- Ocorrências abertas;
- Entregas ativas.

Filtros persistidos na URL:

- busca;
- responsável;
- prioridade;
- tipo;
- status;
- foco operacional.

A tabela usa TanStack Table para sorting e leitura consistente. No mobile, as linhas viram blocos operacionais em vez de uma tabela espremida.

## Inspector

O Inspector preserva a fila e seus filtros. Ele reúne:

- contexto do caso, cliente e venda;
- status, prioridade e responsável;
- follow-ups;
- logística e timeline de estados;
- ocorrências e resolução;
- Activity timeline consolidada;
- links para edição técnica do caso e da venda.

Em tablet e mobile, o Inspector ocupa a tela inteira e possui fechamento explícito.

## Endpoint operacional

`POST /api/admin-after-sales`

Ações:

- `create-task`;
- `update-task-status`;
- `create-shipment`;
- `update-shipment`;
- `create-occurrence`;
- `resolve-occurrence`;
- `update-case`.

O endpoint exige sessão e papel comercial/admin. As regras críticas ficam em `src/server/domain/afterSales/operations.ts` e nos hooks de domínio.

## Migração de follow-ups legados

Comandos:

```bash
pnpm migrate:after-sales-followups:dry-run
pnpm migrate:after-sales-followups
pnpm migrate:after-sales-followups:rollback
```

O processo:

1. lê `after-sales.followUps`;
2. cria uma Task por item válido;
3. vincula caso, venda e cliente;
4. preserva prazo, objetivo, status, notas e responsável possível;
5. usa `legacySourceKey` para idempotência;
6. permite rollback das Tasks migradas;
7. não apaga o array legado nesta etapa.

A execução contra banco persistente deve começar por backup e dry-run.

## Activities

Eventos estruturados adicionados:

- `task.created`;
- `task.status_changed`;
- `followup.completed`;
- `shipment.status_changed`;
- `shipment.delivered`;
- `occurrence.opened`;
- `occurrence.status_changed`;
- `occurrence.resolved`.

## Jobs Queue

Payload Jobs Queue não foi ativada nesta etapa. A Etapa 10 prepara o domínio e a fila. A Etapa 11 implementará:

- D+3/D+15/D+90;
- runner/deploy;
- retries;
- idempotência de jobs;
- automações de entrega e satisfação.

Nenhum agendamento é simulado antes do runner real existir.

## Testes

A integração cobre:

- criação de Sale e AfterSaleCase;
- código e timestamps de caso;
- Task vinculada e conclusão;
- Shipment derivando Sale/Customer;
- entrega por estado discreto e `deliveredAt`;
- Occurrence com resolução obrigatória;
- Activities de follow-up, entrega e ocorrência.

O release gate mantém TypeScript, ESLint sem warnings, Vitest, build, Playwright e baseline visual multi-viewport.

## Fora desta etapa

- Jobs Queue e runner;
- sincronização real com transportadora;
- notificações externas;
- automações de manutenção;
- exportações em background;
- realtime multioperador.
