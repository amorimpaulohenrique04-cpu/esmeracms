# Interações de assinatura — Rodada 3

## Objetivo

A terceira rodada adiciona continuidade, investigação e feedback avançado ao CMS Esméra sem trocar os contratos de domínio ou transformar o Admin em uma interface ornamental. Toda interação precisa melhorar uma tarefa real, preservar acessibilidade e continuar funcional sem APIs experimentais.

## View Transitions

A navegação interna do Admin é interceptada em `AdminStateProvider` somente quando:

- o clique é primário e não usa modificadores;
- o destino pertence ao mesmo domínio e começa com `/admin`;
- o link não abre nova aba, não baixa arquivo e não desativa explicitamente a transição;
- `document.startViewTransition` existe;
- o usuário não ativou `prefers-reduced-motion`.

Sem suporte, a navegação continua pelo comportamento normal do Next.js. A transição não pode impedir input ou aguardar indefinidamente; um timeout encerra a captura caso o route key não mude.

### Nomes de transição

Links podem usar `data-esmera-transition`:

- `navigation`: mudança comum de módulo ou seção;
- `inspector`: abertura de detalhe contextual;
- `record`: abertura de documento técnico;
- `reports-drilldown`: aprofundamento analítico;
- `reports-filter`: alteração do recorte principal.

## Continuidade de contexto

O provider global preserva por URL:

- `scrollX` e `scrollY`;
- identificador do elemento focado;
- origem da navegação para documentos técnicos;
- registros recentes abertos no navegador.

Elementos que precisam recuperar foco devem possuir `id` ou `data-esmera-context-key` estável.

## Inspectors

Inspectors entram pela direita em 220 ms e mantêm o item selecionado visualmente ligado ao painel. Em telas menores, tornam-se sheets inferiores.

Regras:

- a lista e os filtros permanecem na URL;
- fechar restaura o foco no gatilho;
- `Esc` deve fechar quando o componente expõe um controle de fechamento;
- não abrir por `:focus`, `:focus-within` ou `:has()`;
- conteúdo crítico permanece acessível por link técnico.

## Command Palette

A palette combina fontes distintas sem misturá-las semanticamente:

1. seleção atual;
2. registros recentes locais;
3. filtros salvos locais;
4. ações contextuais retornadas pelo servidor;
5. busca autorizada em registros;
6. seções de Relatórios.

Ações de criação e mutação são determinadas por papel e pelo contrato real. Exemplos:

- Produto e Categoria podem ser criados por usuários editoriais;
- Cliente, Lead, Opportunity e follow-up podem ser criados por usuários comerciais;
- uma `Sale` não é criada diretamente: a ação leva ao Pipeline, onde uma Opportunity ganha gera a venda transacional.

Histórico recente e filtros salvos ficam em `localStorage`; não são enviados ao servidor como perfil comportamental.

## Relatórios investigativos

O cross-filter usa a URL como fonte de verdade. Cada aprofundamento:

- cria uma entrada no histórico do navegador;
- atualiza o resumo persistente;
- mantém o recorte compartilhável;
- permite remover uma dimensão;
- pode ser desfeito por “Voltar um nível”.

Dimensões suportadas:

- período/ponto temporal;
- origem;
- produto;
- categoria;
- responsável;
- comparação.

Cliques em gráficos e tabelas nunca fabricam dados. Eles alteram filtros ou abrem drilldowns consultados no servidor. Durante refetch, os últimos dados válidos permanecem visíveis e apenas a região afetada indica progresso.

## Preview editorial draft

O preview existe somente para Produtos e Categorias.

A rota `/preview/editorial/[kind]/[id]`:

- exige sessão autenticada;
- exige permissão editorial;
- lê o documento com `draft: true` e access control;
- usa `noindex` e `nofollow`;
- não publica nem altera dados;
- pode ser aberta em nova aba.

O painel do Admin oferece Desktop, Tablet e Mobile. Ele atualiza depois que o draft foi salvo de verdade. O iframe comunica apenas o nome do campo clicado ao pai por `postMessage` same-origin; o Admin então rola e foca o campo com `data-preview-field` correspondente.

Preview editorial é proibido em Vendas e Pós-venda porque essas áreas representam operação e transação, não composição de conteúdo.

## Feedback e rollback

Atualizações otimistas são permitidas apenas quando existe estado anterior confiável.

- Produto autosave: falha restaura o último draft salvo.
- Galeria: falha restaura a última ordem confirmada.
- Categorias: falha restaura itens e ordem completa anteriores.
- A mensagem explica o que ocorreu e o live region anuncia a restauração.

Estados busy não devem mudar a largura do controle. A confirmação de compartilhamento e salvamento aparece junto à ação. Erros não apagam os últimos dados válidos.

## Motion e acessibilidade

- resposta visual inicial: até 100 ms;
- feedback padrão: 120–180 ms;
- inspector e rearranjo espacial: até 220 ms;
- nenhuma animação bloqueia teclado ou ponteiro;
- `prefers-reduced-motion` desativa movimentos não essenciais;
- drag-and-drop sempre possui alternativa por botão ou select;
- hover nunca é a única forma de obter informação ou executar ação.

## Checklist de revisão

- A URL representa o estado investigativo?
- Voltar restaura o nível anterior?
- Foco e scroll sobrevivem à navegação?
- Existe fallback sem View Transition API?
- Reduced motion remove o movimento?
- A Command Palette respeita papel e domínio?
- O preview consulta draft autenticado?
- Um erro otimista restaura o estado anterior?
- O último dado válido permanece visível durante refetch?
- A interação continua utilizável apenas com teclado?
