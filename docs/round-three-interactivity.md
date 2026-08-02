# Rodada 3 — Assinatura tecnológica e interatividade avançada

## Objetivo

Adicionar diferenciação perceptível sem comprometer sobriedade, desempenho, acessibilidade ou os contratos operacionais do CMS.

## Decisão de bundle

A Rodada 3 não adiciona `motion` ou `framer-motion`.

A implementação usa:

- View Transition API como progressive enhancement;
- CSS transitions com tokens de 120 ms e 220 ms;
- Base UI para dialogs, drawers e menus;
- DnD Kit para reordenação existente;
- React Query para atualização localizada e preservação dos últimos dados válidos.

Uma biblioteca de motion só poderá ser reavaliada depois de medição objetiva de bundle e somente se houver lacuna funcional comprovada.

## Navegação progressiva

Arquivo: `src/admin/design-system/advanced-interactions.scss`.

- navegação entre documentos: 120 ms;
- inspector e detail: 220 ms;
- fallback automático quando View Transition API não existe;
- nenhuma navegação depende da animação;
- `prefers-reduced-motion: reduce` desativa navegação animada, transforms e reordenação visual.

## Continuidade de inspector

- workspace recebe `view-transition-name` estável;
- detail/inspector recebe identidade espacial compartilhada;
- grid recalcula a largura em 220 ms;
- mobile troca deslocamento lateral por entrada vertical curta;
- o estado de seleção continua na URL quando o módulo já oferece essa capacidade;
- fechamento deve devolver foco ao gatilho e manter filtros/scroll.

## Command palette contextual

Endpoint: `src/app/(payload)/api/admin-search/route.ts`.

A resposta considera o `referer` autenticado para priorizar ações da tela atual.

Ações contextuais implementadas:

- Produtos: novo produto e filtro de pendências;
- Categorias: nova categoria;
- Clientes: novo cliente e novo follow-up real em Tasks;
- Vendas: nova oportunidade, Lista e Pipeline;
- Pós-venda: nova tarefa e pendências abertas;
- Relatórios: manter recorte atual, limpar investigação e abrir Vendas.

A command palette também pesquisa Products, Categories, Customers, Opportunities, Leads e Sales, respeitando access control do Payload.

Não incluir comandos sem rota, Collection ou mutation real.

## Relatórios investigáveis

Contrato: `src/admin/modules/reports/investigation.ts`.

- cada nível contém `kind`, `value` e label legível;
- a pilha é serializada no parâmetro `investigation`;
- `pushInvestigation` adiciona um nível;
- `popInvestigation` remove somente o último nível;
- filtros e pilha compartilham a mesma URL;
- copiar a URL preserva período, dimensões e investigação.

O serviço de métricas permanece em `server/reporting`; a camada investigativa não recalcula métricas no client.

## Preview editorial draft

Arquivos:

- `src/admin/editorial/EditorialPreview.tsx`;
- `src/admin/editorial/previewURL.ts`;
- `src/admin/editorial/editorial-preview.scss`.

A variável `NEXT_PUBLIC_EDITORIAL_PREVIEW_URL` deve apontar para uma rota draft real e pode usar:

- `{collection}`;
- `{id}`;
- `{slug}`.

Exemplo:

```env
NEXT_PUBLIC_EDITORIAL_PREVIEW_URL=https://preview.esmera.com/{collection}/{slug}?document={id}
```

O CMS acrescenta `draft=true&source=esmera-cms`.

Sem configuração real, o componente mostra integração indisponível e não renderiza placeholder enganoso.

O preview oferece:

- desktop 1440 px;
- tablet 768 px;
- mobile 390 px;
- debounce de 700 ms;
- atualização localizada;
- abertura completa em nova aba.

O componente é exclusivo de Products e Categories. Não deve ser usado em Vendas ou Pós-venda.

## Feedback

- resposta de hover/seleção: até 120 ms;
- abertura de painel: 220 ms;
- busy preserva largura do botão;
- refetch mantém dados anteriores;
- erro local usa feedback local;
- toast permanece reservado a resultado global;
- rollback só é animado onde a reversão é segura.

## Gate

- typecheck;
- lint sem warnings;
- unitários;
- integração;
- build;
- E2E das interações;
- reduced motion;
- regressão visual nos viewports obrigatórios;
- bundle e P95 dentro dos budgets existentes.
