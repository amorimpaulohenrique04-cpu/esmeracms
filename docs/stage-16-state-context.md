# Esméra CMS — Etapa 16 · Estado, cache e preservação de contexto

## Arquitetura

O Admin permanece server-first. Autenticação, papel, consultas, agregações e HTML inicial continuam em Server Components e na Local API autenticada do Payload. Componentes cliente ficam restritos a filtros interativos, tabelas, DnD, overlays, formulários rápidos, gráficos e Command Palette.

## Provider global

`src/admin/state/AdminStateProvider.tsx` é registrado em `admin.components.providers` e fornece:

- um único Query Client global com retry e tempos de descarte conservadores;
- região global `aria-live` para feedback de mutações;
- persistência de posição da página e foco por `pathname + search`;
- restauração após voltar/avançar;
- registro da origem ao abrir documentos técnicos em `/admin/collections/*`.

A query string continua sendo a fonte de verdade para filtros, página, seleção de registro e abas compartilháveis.

## Query keys canônicas

`src/admin/state/queryKeys.ts` define somente os contratos aprovados:

- `['products', filters]`;
- `['customer', id]`;
- `['sales', filters]`;
- `['after-sales', filters]`;
- `['reports', filters]`.

Chaves derivadas, como drilldowns de Relatórios, ficam subordinadas à raiz correspondente. Nenhuma mutação inventa uma segunda fonte de dados: o cache recebe resposta do servidor e o RSC é revalidado quando necessário.

## Overlays

`DialogPanel` e `DrawerPanel` são controlados pelo Design System. Ao abrir, registram scroll; ao fechar por botão, Escape ou backdrop, restauram scroll e deixam o Base UI devolver o foco ao acionador.

O inspector não reescreve filtros. Abrir um documento técnico registra a URL operacional de origem para que a navegação de retorno preserve filtros, página e contexto.

## Critérios de aceite

- HTML útil na primeira resposta;
- ausência de loading vazio obrigatório para montar o workspace;
- cache global disponível para todas as ilhas cliente;
- filtros representados na URL;
- fechamento de overlay sem salto de scroll;
- retorno do navegador restaurando posição e foco quando o elemento ainda existe;
- origem de edição registrada sem expor dados pessoais.
