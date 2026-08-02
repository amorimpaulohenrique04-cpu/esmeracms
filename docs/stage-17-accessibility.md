# Esméra CMS — Etapa 17 · Acessibilidade e operação por teclado

## Referência

O alvo do Admin customizado é WCAG 2.2 AA. A validação automatizada complementa, mas não substitui, inspeção de fluxo, foco e semântica.

## Shell e atalhos

Atalhos globais:

- `Cmd/Ctrl + K`: abre a Command Palette;
- `/`: foca a busca local visível; sem busca local, abre a Command Palette;
- `N`: abre o menu global de criação;
- `Esc`: fecha menus, dialogs, drawers e Command Palette;
- setas e `Enter`: navegam e abrem resultados da Command Palette.

`/` e `N` não são executados enquanto o foco estiver em `input`, `textarea`, `select` ou conteúdo editável.

## Foco e alvos

- controles primários usam altura entre 38 e 42 px;
- controles menores nunca ficam abaixo de 24 × 24 px;
- `focus-visible` usa outline de 2 px e halo adicional;
- `scroll-padding` e `scroll-margin` impedem que foco fique escondido pelo header ou barras sticky;
- estados de foco não dependem somente de cor.

## Overlays

Dialogs e drawers usam Base UI para trap de foco, Escape, backdrop, semântica e retorno ao trigger. O Design System adiciona restauração de scroll.

## Drag and drop

Categories e Sales mantêm o sensor de teclado do DnD e fornecem alternativa explícita por `select` para etapa e posição. Feedback de salvamento e reversão usa `aria-live`. A operação nunca depende exclusivamente de arrastar.

## Movimento reduzido

Com `prefers-reduced-motion: reduce`:

- scroll suave é removido;
- animações são reduzidas a duração mínima;
- transições não essenciais deixam de criar deslocamento perceptível;
- a hierarquia e o feedback continuam disponíveis.

## Validação

`tests/e2e/hardening.e2e.spec.ts` cobre:

- atalhos e supressão durante digitação;
- abertura e fechamento por teclado;
- acesso ao workspace de Privacidade por papel;
- Axe com regras WCAG 2 A/AA, 2.1 AA e 2.2 AA sobre shell e workspace customizados;
- bloqueio de violações sérias e críticas.
