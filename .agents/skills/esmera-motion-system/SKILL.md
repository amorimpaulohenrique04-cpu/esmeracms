---
name: esmera-motion-system
description: Use ao criar ou alterar qualquer transição, animação, keyframe, View Transition ou duração de movimento no Admin do Esméra (arquivos .scss em src/admin, custom.scss, ou qualquer componente que anime opacity/transform/CSS). Protege performance, acessibilidade e a legibilidade da navegação — não redesenha a interface.
---

# Esméra Motion System

## 1. Missão e escopo

Esta skill governa **todo** motion do Admin do Esméra: transições de hover/foco,
entrada/saída de overlays, feedback de estado, loaders contínuos e navegação de
rota. Ela existe porque uma camada global de View Transitions já causou uma
regressão real (rota antiga e nova compostas na mesma tela, sensação de
travamento, conteúdo parecendo sobrescrito — corrigida em
`fix/post-pr12-motion-stability`). O objetivo é impedir que esse padrão volte.

Esta skill **não** cobre: paleta de cores, tipografia, layout estrutural,
regras de negócio, collections/hooks/access do Payload (isso é
`.agents/skills/payload/SKILL.md`). As duas skills são independentes: a do
Payload protege a arquitetura do CMS; esta protege movimento, desempenho e
acessibilidade. Uma não substitui a outra — mudanças que tocam admin UI motion
+ dados devem satisfazer as duas.

## 2. Fontes de verdade

Nesta ordem — nunca crie uma duração, easing ou política de motion fora
destes três arquivos:

1. `src/admin/design-system/tokens.scss` — única fonte de durações, easings e
   da política de `prefers-reduced-motion` (compartilhada por todos os entry
   points do admin).
2. `src/admin/design-system/advanced-interactions.scss` — motion "avançado":
   hoje contém apenas a entrada local do painel de detalhe
   (`.esmera-split-workspace__detail`). **Não deve conter** nenhuma View
   Transition de rota.
3. `src/admin/design-system/reconciled-interactions.scss` — motion de
   rollback, seleção espacial e overlays reconciliados pós-regressão.

Qualquer outro arquivo `.scss` (módulos em `src/admin/modules/**`,
`shell.scss`, `nav.scss`, `views.scss`) consome tokens destes três arquivos;
não define escala própria.

## 3. Escala oficial de duração

```
--esmera-motion-instant:    80ms   hover, press, foco
--esmera-motion-fast:      120ms   feedback, seleção, popups pequenos
--esmera-motion-component: 180ms   menus, tooltips, componentes compostos
--esmera-motion-panel:     220ms   inspector, drawer, dialog — teto operacional
--esmera-motion-navigation: 280ms  reservado; NÃO usar em UI operacional (>220ms)
--esmera-motion-data:      420ms   apenas visualizações de dados complexas (gráficos)
```

Aliases legados (`--esmera-motion-standard`, `--esmera-motion-slow`,
`--esmera-ease`) resolvem para a escala acima — nunca redefina um valor
próprio para eles.

Easings: `--esmera-ease-standard` (padrão), `--esmera-ease-enter` (entrada),
`--esmera-ease-exit` (saída), `--esmera-ease-emphasized`.

Loops contínuos (spinner, skeleton) usam escala própria e nunca a
operacional: `--esmera-motion-loop-spinner` (.7s), `--esmera-motion-loop-skeleton`
(1.2s).

**Nenhuma transição operacional (hover, seleção, inspector, drawer, popup)
pode exceder 220ms (`--esmera-motion-panel`).** Se uma duração parecer
insuficiente, o problema é quase sempre a propriedade animada (seção 5), não a
duração.

## 4. Uso obrigatório de tokens

Nunca escreva um valor de tempo literal (`180ms`, `.7s`) em CSS de motion.
Toda `transition`, `animation` e `animation-duration` referencia um token da
seção 3. Ao introduzir um novo padrão de loop contínuo, adicione um token
`--esmera-motion-loop-*` em `tokens.scss` — não crie um `--esmera-transition-*`
paralelo (esses aliases já foram removidos uma vez; não os reintroduza).

## 5. Propriedades permitidas e propriedades a evitar

**Priorize:** `opacity`, `transform` (translate/scale). São as únicas
propriedades garantidamente compostas fora do layout/paint, então não
disparam reflow e não competem com o carregamento de dados da view.

**Evite animar:** `width`, `height`, `grid-template-columns`, `margin`,
`padding`, `top`, `left`, `right`, `bottom`. Essas propriedades forçam layout
a cada frame e, em conjunto com View Transitions, foram a causa raiz da
mistura visual entre rotas. Quando uma estrutura de grid ou split-view muda
(ex.: `.esmera-split-workspace`, `.esmera-after-sales-workspace`), a mudança
estrutural acontece de uma vez (sem transição); apenas o painel que entra
pode animar `opacity`/`transform`.

## 6. Política de route navigation

**Navegação de rota nunca tem snapshot animado.** Isso significa, sem
exceção:

- Nenhum `@view-transition { navigation: auto }` (nem em CSS nem via feature
  flag do Next.js).
- Nenhuma chamada a `document.startViewTransition()` envolvendo
  `router.push()` ou qualquer navegação entre views do admin.
- Nenhum `::view-transition-old(root)` / `::view-transition-new(root)`
  estilizado globalmente.
- Nenhum `view-transition-name` permanente em contêineres reaproveitados
  entre rotas (ex.: `.esmera-workspace-frame`) — um nome fixo reaplicado a
  cada navegação faz o browser compor snapshots de duas rotas diferentes sob
  o mesmo par de pseudo-elementos, produzindo exatamente a regressão que esta
  skill existe para prevenir.

O AppHeader e o Nav **nunca** alteram `opacity` ou `transform` durante uma
navegação de rota. A troca de conteúdo é instantânea; qualquer sensação de
"chegada" vem apenas da entrada local de dados/skeleton dentro da nova view,
nunca de uma transição da moldura.

## 7. Política de inspectors, drawers e overlays

Estes **podem** ter entrada/saída local:

- Inspector/drawer/dialog: `opacity` + `translateX`/`translateY`, duração
  máxima `--esmera-motion-panel` (220ms).
- Backdrop: `opacity`, `--esmera-motion-panel` na entrada,
  `--esmera-motion-fast` na saída (saída sempre mais rápida que entrada).
- Cada instância usa sua própria classe/seletor. Não reaproveite um nome de
  transição genérico entre tipos de inspector diferentes (ex.: não dê o mesmo
  `view-transition-name` a `.esmera-context-inspector`,
  `.esmera-customer-detail` e `.esmera-report-drawer` simultaneamente — ver
  seção 9).

## 8. Política para View Transitions

A View Transition API pode ser usada **apenas** para uma transição local,
efêmera, de um único elemento nomeado dinamicamente, nunca para navegação de
rota inteira. Antes de introduzir qualquer uso novo de
`document.startViewTransition` ou `view-transition-name`:

1. Confirme que não é para navegação entre views (proibido — seção 6).
2. Confirme que o nome é único e temporário (seção 9).
3. Documente o motivo em comentário no CSS/TSX.
4. Se a motivação for "suavizar a troca de página", a resposta é não usar
   View Transitions — resolva com entrada local do conteúdo novo (seção 7).

## 9. Exigência de nomes únicos e temporários

Se um `view-transition-name` for genuinamente necessário (elemento
compartilhado entre dois estados da mesma view, ex. drag-and-drop), o nome:

- É derivado do id do registro (`esmera-record-${id}`), nunca um literal fixo
  reaproveitado por múltiplas instâncias/rotas.
- É aplicado via `style` inline ou classe condicional, e **removido** quando
  o elemento sai de cena (não persiste como regra CSS global permanente
  aplicada a toda uma classe de componentes).
- Nunca é o mesmo nome usado por dois tipos de componente diferentes ao mesmo
  tempo (isso foi exatamente o bug: `esmera-inspector` aplicado genericamente
  a 4 componentes distintos).

## 10. Progressive enhancement e feature detection

Motion nunca é requisito de funcionamento. Qualquer código que dependa de uma
API de animação (View Transitions, `Element.animate`, etc.) deve funcionar
corretamente — mesmos dados, mesma navegação, mesmo resultado — quando a API
não existe ou é interrompida. Nunca faça `router.push`/mudança de estado
depender de um callback de transição para prosseguir; a navegação/mudança de
dados acontece independentemente do motion.

## 11. `prefers-reduced-motion`

A política vive em `tokens.scss` (seção única, compartilhada por todos os
entry points) e zera durações/transforma de toda superfície interativa,
overlay e loop contínuo listada ali. Ao adicionar um novo componente animado:

- Se ele usa uma classe já coberta pelo seletor em `tokens.scss`, nada a
  fazer.
- Se usa uma classe nova, adicione-a à lista em `tokens.scss` — não crie um
  bloco `@media (prefers-reduced-motion: reduce)` duplicado em outro arquivo,
  a menos que o componente exponha uma classe estrutural exclusiva de um
  módulo (nesse caso, mantenha o bloco local pequeno e comente por quê).
- Overlays continuam abrindo, fechando, recebendo e devolvendo foco sob
  reduced motion — apenas o movimento visual é removido, nunca o
  comportamento.

## 12. Foco, teclado e acessibilidade

- Nenhuma transição pode atrasar o foco chegar a um elemento — `focus-visible`
  aplica outline/box-shadow sem `transform` (ver regra consolidada em
  `design-system.scss`).
- Escape sempre fecha o overlay/inspector visível mais no topo,
  independentemente de motion estar ativo.
- Elementos com `aria-busy="true"` mantêm a largura/altura originais no fluxo
  (o conteúdo real fica `visibility: hidden`, nunca `display: none`), para
  não causar reflow quando o loader aparece/some.

## 13. Proibição de Framer Motion, GSAP e flags experimentais

Não adicione `framer-motion`, `motion`, `gsap`, o `<ViewTransition>`
experimental do React, ou `experimental.viewTransition` do Next.js
(`next.config`) sem uma ADR aprovada explicitamente pelo time. `pnpm test:unit
tests/unit/motion-policy.unit.spec.ts` falha se qualquer uma dessas
dependências aparecer em `package.json`.

## 14. Exceções para spinner e skeleton

Loops contínuos (`esmera-button-spin`, `esmera-command-spin`,
`esmera-feedback-spin`, `esmera-state-spin`, `esmera-skeleton`) são a única
categoria com duração fora da escala operacional de 220ms — usam
`--esmera-motion-loop-spinner`/`--esmera-motion-loop-skeleton`. Continuam
sujeitos à seção 11 (zerados sob reduced motion).

## 15. Testes mínimos

Toda PR que toca motion do admin roda, no mínimo:

```bash
pnpm test:unit -- tests/unit/motion-policy.unit.spec.ts
pnpm test:e2e -- tests/e2e/admin-motion.e2e.spec.ts
```

O primeiro é estático (grep determinístico nos arquivos-fonte); o segundo
navega entre views reais e verifica `document.getAnimations()`, headings,
URLs e ausência de overflow — nunca `sleep` arbitrário.

## 16. Checklist obrigatório antes de finalizar qualquer PR com motion

- [ ] Nenhuma duração literal fora de `tokens.scss` — tudo via `var(--esmera-motion-*)`.
- [ ] Nenhuma transição operacional acima de 220ms.
- [ ] Apenas `opacity`/`transform` animados (exceto loaders, seção 14).
- [ ] Nenhum `@view-transition { navigation: auto }` e nenhum
      `document.startViewTransition()` envolvendo navegação de rota.
- [ ] Nenhum `view-transition-name` fixo reaproveitado entre rotas ou entre
      tipos de componente diferentes.
- [ ] AppHeader e Nav não animam `opacity`/`transform` durante navegação.
- [ ] `prefers-reduced-motion: reduce` testado manualmente ou via e2e.
- [ ] Nenhuma dependência nova de Framer Motion, GSAP ou flag experimental.
- [ ] `pnpm test:unit -- tests/unit/motion-policy.unit.spec.ts` e
      `pnpm test:e2e -- tests/e2e/admin-motion.e2e.spec.ts` passam.
