# Esméra CMS — Etapa 9 · Vendas e Pipeline operacional

Status: **implementação concluída; gate final registrado ao fim da etapa**.

Branch: `feat/admin-operational-rebuild`

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0.

## Objetivo

A Etapa 9 transforma Vendas em um workspace operacional único, mantendo duas visualizações sobre o mesmo domínio:

- `/admin/sales?view=list` — leitura tabular e operação em lote de oportunidades;
- `/admin/sales?view=pipeline` — negociação por estágio;
- `/admin/pipeline` — redirect legado para o modo Pipeline.

O modelo permanece:

`Lead → Customer → Opportunity → Sale → AfterSales`

Leads não voltam a representar negociação. O Pipeline e a Lista consultam Opportunities; a área de transações consulta Sales.

## Fontes de dados

- **Opportunities:** negociação, etapa, rank, valor potencial, responsável, próxima ação e fechamento;
- **Activities:** timeline e histórico estruturado de etapas;
- **Products:** itens e variantes disponíveis para confirmação da venda;
- **Sales:** transações confirmadas e fulfillment;
- **Customers/Users:** contexto relacional e responsabilidade.

Payload e PostgreSQL continuam como fonte única de verdade. Não existe board autoritativo separado no navegador.

## Visão Pipeline

O Pipeline possui quatro colunas abertas:

- Novo;
- Curadoria;
- Proposta;
- Negociação.

Cada cabeçalho mostra:

- quantidade de Opportunities;
- soma do valor potencial informado.

Cada card prioriza:

- código;
- prioridade real;
- cliente;
- origem;
- valor potencial;
- próxima ação e prazo;
- responsável.

## Drag and drop e rank

O Pipeline usa dnd-kit para:

- mover entre etapas abertas;
- ordenar dentro da mesma coluna;
- persistir `rank` no servidor.

A atualização visual das etapas intermediárias é otimista com TanStack Query:

1. o cache é atualizado imediatamente;
2. a mutation é enviada para `/api/admin-sales`;
3. o servidor valida a transição;
4. source/target rank são persistidos em transação;
5. em erro, o cache anterior é restaurado e a mensagem fica visível.

Ganho e perda nunca são consolidados de forma otimista. Eles exigem confirmação do servidor.

### Alternativa sem mouse

Cada card oferece seletores nativos para:

- escolher a etapa;
- escolher a posição dentro da coluna.

Assim, a operação principal não depende de drag, touch ou precisão de ponteiro.

## Visão Lista

A Lista usa TanStack Table sobre o mesmo conjunto de Opportunities.

Recursos:

- sorting;
- seleção de linhas;
- visibilidade de colunas;
- paginação;
- filtros persistidos na URL;
- ações em lote somente para etapas abertas;
- Inspector sem abandonar a lista.

Colunas principais:

- oportunidade;
- cliente;
- etapa;
- valor;
- responsável;
- próxima ação;
- atualizado.

Fechamento em lote é bloqueado: Won/Lost exigem revisão individual.

## Filtros e URL

Filtros disponíveis:

- busca por código, cliente ou próxima ação;
- responsável;
- origem;
- etapa;
- próxima ação atrasada, hoje, 7 dias ou 30 dias;
- página e limite;
- modo Lista/Pipeline.

O estado relevante fica na URL para permitir compartilhar, recarregar ou retornar ao workspace.

## Inspector

O Inspector usa Drawer do Design System Esméra e não navega para outra página.

Conteúdo:

- dados principais;
- etapa e valor potencial;
- cliente, responsável e origem;
- próxima ação;
- produtos de interesse;
- timeline de Activities;
- Sale gerada, quando existir;
- CTA `Editar oportunidade`.

Em mobile, overlays críticos ocupam a tela inteira.

## Fechamento perdido

Mover para `lost` abre diálogo obrigatório.

Dados exigidos:

- motivo estruturado;
- contexto opcional.

O servidor:

- valida a transição;
- exige motivo válido;
- grava `closedAt`;
- limpa `wonSale`;
- registra `opportunity.stage_changed` em Activities.

## Fechamento ganho

Mover para `won` abre diálogo de confirmação financeira.

O operador revisa:

- canal;
- produtos;
- variante/SKU;
- quantidade;
- preço negociado para itens sob consulta;
- desconto;
- frete;
- previsão e forma de entrega;
- observações da entrega.

### Transação

O workflow `Opportunity won → Sale` executa em uma transação PostgreSQL:

1. relê a Opportunity;
2. valida transição e Customer;
3. impede segunda Sale para a mesma Opportunity;
4. cria a Sale como `confirmed`;
5. deixa `applySaleRules` gerar snapshots e recalcular centavos;
6. atualiza Opportunity para `won` e relaciona `wonSale`;
7. registra `sale.created` e a mudança de etapa;
8. confirma a transação.

Qualquer erro reverte todos os passos. Não existe estado em que a Sale seja criada sem a Opportunity ser encerrada, ou vice-versa.

## Snapshots preservados

O workflow reutiliza o domínio Sales existente. O servidor preserva/preenche:

- `snapshotTitle`;
- `snapshotSlug`;
- `snapshotSku`;
- `snapshotSelection`;
- `priceMode`;
- `unitPriceCents`;
- `subtotalCents`;
- `totalCents`.

Preço fixo vem do Product/Variant. Item sob consulta exige valor negociado. Uma Sale não entra em `confirmed` com total indefinido.

## Endpoint operacional

`POST /api/admin-sales`

Ações:

- `move-stage`;
- `reorder-stage`;
- `bulk-stage`;
- `win`;
- `lose`.

O endpoint exige sessão e papel comercial/admin. Toda regra crítica permanece no serviço de domínio, não no componente React.

## Histórico

Activities registra:

- `opportunity.stage_changed`;
- `sale.created`.

O histórico continua append-mostly e indexável. Reordenação sem mudança de etapa não cria ruído na timeline.

## Testes

A suíte de integração cobre:

- rank e transição intermediária;
- criação transacional da Sale;
- snapshots de produto;
- desconto, frete, subtotal e total em centavos;
- relacionamento `Opportunity.wonSale`;
- Activities;
- rollback integral quando item sob consulta não possui preço;
- fechamento perdido com motivo estruturado.

O E2E cobre:

- exibição do card no Pipeline;
- Inspector e produtos relacionados;
- mudança intermediária;
- diálogo de ganho;
- criação da Sale real;
- remoção da Opportunity do Pipeline aberto;
- visualização da Opportunity ganha na Lista;
- diálogo de perda e persistência do motivo.

O baseline visual recaptura Lista e Pipeline em cinco viewports.

## Fora desta etapa

Permanecem para fases seguintes:

- realtime multioperador por WebSocket;
- reserva/baixa física de estoque, caso o domínio venha a exigir;
- automações de pós-venda e Jobs Queue;
- Reporting Service e métricas temporais avançadas;
- exportação PDF;
- hardening final de performance, acessibilidade e índices após profiling.
