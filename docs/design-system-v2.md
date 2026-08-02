# Design System Esméra v2

## Finalidade

O Design System Esméra v2 é a fonte canônica da interface administrativa do CMS. Ele organiza tipografia, densidade, superfícies, estados, interação, responsividade e composição sem alterar os contratos de domínio do Payload.

O sistema não substitui Collections, Globals, hooks, access control, queries ou mutations. Sua função é garantir que Dashboard, Produtos, Categorias, Clientes, Vendas, Pós-venda, Relatórios, Privacidade, Configurações e Admin técnico compartilhem a mesma gramática visual e operacional.

## Princípios

1. **Uma fonte de verdade visual.** Não criar folhas `*.release.scss`, `*-polish.scss` ou camadas de override para corrigir a mesma estrutura.
2. **Sem dados demonstrativos.** Ausência de base é representada como estado vazio, integração não configurada ou dado parcial.
3. **Cor não substitui texto.** Status, prioridade e seleção devem permanecer compreensíveis sem percepção cromática.
4. **Estados pertencem à operação.** Loading, saving, rollback, erros e permissões são contratos explícitos, não efeitos visuais improvisados.
5. **Desktop, rail, tablet e mobile são composições diferentes.** Responsividade não significa apenas reduzir dimensões.
6. **Ações irreversíveis são raras e explícitas.** Cor de perigo e confirmação reforçada ficam restritas a operações destrutivas reais.

## Tokens

Arquivo canônico: `src/admin/design-system/tokens.scss`.

### Tipografia

- `--esmera-font-body`: 14 px. Texto corrido não deve ser rebaixado para 10–12 px.
- `--esmera-font-ui`: controles e labels operacionais.
- `--esmera-font-section`: títulos de seção.
- `--esmera-font-h1`: títulos principais responsivos.
- `--esmera-line-body`: leitura de descrições e mensagens.

### Densidade

- `--esmera-control-compact`: controles de tabelas, filtros auxiliares e cards de pipeline.
- `--esmera-control-standard`: formulários, ações principais e navegação.
- `--esmera-row-compact`: linhas operacionais densas.
- `--esmera-row-standard`: linhas com metadados e ações.

Não misturar densidade compacta e confortável dentro do mesmo bloco sem motivo funcional.

### Superfícies

- `--esmera-surface-canvas`: fundo geral.
- `--esmera-surface-panel`: painéis e documentos.
- `--esmera-surface-raised`: filtros, vazios e superfícies auxiliares.
- `--esmera-surface-selected`: seleção e contexto ativo discreto.
- `--esmera-surface-hover`: resposta transitória de hover.

A seleção persistente usa `--esmera-selection-bar`; não usar blocos inteiros de cor primária quando uma linha ou superfície selecionada comunica o mesmo estado.

### Larguras

- `reading`: textos e configurações com leitura sequencial.
- `standard`: páginas de configuração e formulários moderados.
- `wide`: workspaces administrativos usuais.
- `fluid`: tabelas e pipelines que precisam aproveitar a largura total.

A largura é definida em `ViewFrame`, não com `max-width` local aleatório.

### Motion

- `instant`: feedback quase imediato.
- `fast`: hover e microestados.
- `standard`: seleção, abertura de controles e mudança de superfície.
- `slow`: rearranjos ou visualizações mais amplas.

Toda animação deve respeitar `prefers-reduced-motion`.

## Primitives oficiais

Arquivo: `src/admin/design-system/Primitives.tsx`.

### `PageCommandBar`

Cabeçalho principal da página. Contém título, descrição, ações e contexto secundário.

Uso correto:

```tsx
<PageCommandBar
  eyebrow="Comercial"
  title="Vendas"
  description="Oportunidades e vendas transacionais."
  actions={<ButtonLink href="/admin/collections/opportunities/create">Nova oportunidade</ButtonLink>}
  context={<SegmentedControl />}
/>
```

Não criar cabeçalhos locais com título, subtítulo e botões duplicados.

### `SegmentedControl`

Alterna modos equivalentes, como Lista/Pipeline ou Produtos/Categorias. Não deve ser usado como conjunto de CTAs independentes.

- Estado atual: `selected`.
- Navegação por link quando o estado deve ser persistido na URL.
- Botões quando a troca é puramente local.

### `MetricStrip`

Indicadores compactos e comparáveis. Evita uma coleção de cards independentes.

- Labels sempre acima do valor.
- Valor com alinhamento numérico.
- Meta explica origem, comparação ou ausência de base.
- O item pode ser navegável.

### `FilterPanel`

Organiza filtros em duas camadas:

- primários: busca, status, responsável, período;
- avançados: dimensões de investigação menos frequentes.

Ações de aplicar e limpar ficam separadas dos campos. Não ocultar o filtro principal dentro de popover.

### `SplitWorkspace`

Estrutura master-detail usada em Produtos, Categorias e Clientes.

- Sem seleção: master ocupa a largura disponível.
- Com seleção: detalhe persistente no desktop.
- Mobile: master e detalhe não são comprimidos lado a lado.

### `ContextInspector`

Detalhe contextual dentro de um workspace. Deve preservar o filtro e a posição da lista.

- Fechamento explícito.
- Restauração de foco ao gatilho.
- URL pode guardar a seleção quando a continuidade é importante.

Não abrir inspector por `:focus`, `:focus-within` ou `:has()`.

### `DataSection`

Seção com título, descrição, ação opcional e corpo. Substitui cards decorativos sem função clara.

Use para tabelas, históricos, listas, integração e grupos de configuração.

### `EmptyVisualization`

Estado vazio específico para área de gráfico ou visualização. Não montar ECharts quando não existem pontos válidos.

### `InlineFeedback`

Feedback próximo à ação que o originou. Usos:

- atualização otimista;
- salvamento;
- erro recuperável;
- estado transitório.

Evitar banners globais para uma ação restrita a uma linha ou formulário.

### `SectionNav`

Navegação entre seções do mesmo registro. Mantém hierarquia, foco e estado atual sem recriar tabs locais.

### `QuickActionMenu`

Agrupa ações secundárias. A ação principal continua visível; operações críticas devem aparecer em grupo separado.

## Contratos de estado

Arquivo: `src/admin/design-system/Feedback.tsx`.

### Loading

- `LoadingState` para primeira carga sem dados válidos.
- Refetch silencioso mantém os últimos dados visíveis e informa atualização em `aria-live`.

### Empty result

A consulta foi concluída, mas o recorte não possui registros. A mensagem deve sugerir limpar ou alterar filtros.

### Empty system

O domínio ainda não possui registros. A ação pode orientar a criação do primeiro documento.

### Integration unconfigured

A fonte externa não foi conectada. Nenhum placeholder ou valor estimado deve ocupar seu lugar.

### Partial data

A tela possui dados reais, mas uma dimensão está ausente ou limitada. Deve explicar o limite sem bloquear o restante da operação.

### Permission denied

A permissão da interface deve coincidir com Collections e APIs. Nunca esconder o bloqueio com estado vazio.

### Recoverable error

Mantém os últimos dados válidos quando possível e oferece nova tentativa ou acesso técnico.

### Destructive error

Reservado a ações com risco real de perda. Não reutilizar em validações rotineiras.

### Saving, saved e rollback

- `saving`: operação em andamento;
- `saved`: confirmação local e objetiva;
- `rollback`: alteração falhou e o estado anterior foi restaurado.

## Teclado e foco

- Todos os controles precisam de `focus-visible` perceptível.
- Drag-and-drop deve possuir alternativa por `select`, botão ou comando de teclado.
- Dialogs e drawers usam foco gerenciado pela Base UI.
- Ao fechar um inspector mobile, o foco retorna ao botão que o abriu.
- `Esc` fecha overlays e inspectors móveis quando aplicável.
- `/` foca a busca local; sem busca local, abre a busca global.
- `Ctrl/Cmd + K` abre a busca global.
- `N` abre o menu contextual de criação quando o foco não está em campo editável.

## Responsividade

### ≥ 1280 px

Sidebar completa, workspace amplo e inspectors persistentes.

### 1024–1279 px

Rail de 72 px. Links mantêm `title` acessível como tooltip nativo. Conteúdo usa largura restante sem overflow horizontal global.

### 768–1023 px

Navegação vira drawer. Workspaces master-detail passam a uma superfície por vez.

### < 768 px

Filtros progressivos, tabelas com scroll interno ou cartões operacionais, dialogs em bottom sheet/fullscreen quando necessário.

## Gráficos

- Cores vêm de `--esmera-chart-*`.
- Eixos e grids usam tokens próprios.
- Sem base: `EmptyVisualization` em vez de gráfico zerado.
- Texto alternativo é obrigatório.
- Receita e volume não devem compartilhar escala sem indicação explícita.

## Exemplos incorretos

- Criar `.my-card`, `.my-filter`, `.my-tabs` para reproduzir primitive existente.
- Renderizar coluna para escondê-la por CSS.
- Usar `#fff`, `#000` ou verde local quando existe token semântico.
- Abrir inspector por foco CSS.
- Mostrar `0` quando a consulta falhou.
- Exibir gráfico com linha zerada quando não existe base.
- Usar vermelho para ação reversível comum.
- Adicionar folha `*-polish.scss` ou `*.release.scss`.

## Checklist de revisão

- O módulo usa primitives oficiais quando aplicáveis?
- Body permanece legível em 14 px?
- Existe apenas uma fonte visual para a estrutura?
- Estados de loading, empty, erro e permissão estão diferenciados?
- Foco e teclado funcionam?
- A alternativa ao drag-and-drop existe?
- Mobile não comprime master e detail simultaneamente?
- Cores literais foram substituídas por tokens?
- Reduced motion foi respeitado?
- A interface continua usando a mesma query, mutation e access control do domínio?
