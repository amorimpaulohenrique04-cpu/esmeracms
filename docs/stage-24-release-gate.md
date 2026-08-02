# Etapa 24 — Release gate

## Escopo desta revisão

A Etapa 24 fecha a reconstrução somente quando os gates finais do Plano Mestre estiverem verificáveis. Esta revisão concentra-se nas duas superfícies que ainda apresentavam inconsistências visuais perceptíveis: **Categorias** e **Pós-venda**.

Nenhuma regra de domínio, fonte de dados ou mutação foi substituída. Categorias continua derivando produtos de `Products.categories`; Pós-venda continua usando `Tasks`, `Shipments`, `Occurrences`, `Activities` e `AfterSales` do Payload/Postgres.

## Categorias

### Achados confirmados

- A lista master possuía seis áreas funcionais na mesma linha: drag handle, identidade, contagem, status, ordem e seletor de posição.
- Em desktop e notebook, o seletor de posição ultrapassava a largura do painel master e invadia visualmente o detalhe.
- Status e publicação eram exibidos no cabeçalho do detalhe e repetidos na faixa inicial do editor.
- Em mobile, o drag handle mantinha peso visual excessivo para uma superfície editorial.

### Ajustes

- A lista passa a exibir somente identidade, contagem e posição, mantendo drag-and-drop e seletor acessível.
- Status e ordem permanecem disponíveis no detalhe e no formulário, sem repetir informação em toda linha.
- A grade usa colunas elásticas com `minmax(0, 1fr)` e largura explícita para o seletor.
- O editor remove a repetição dos estados e prioriza as ações de publicação e acesso técnico.
- Em mobile, a relação master-detail continua alternando lista e detalhe, com formulário em uma coluna e controles de toque íntegros.

### Gates

- master-detail preservado;
- drag-and-drop preservado;
- alternativa sem drag preservada;
- ausência de overflow testada em desktop e mobile;
- filtros e categoria selecionada continuam na query string.

## Pós-venda

### Achados confirmados

- Quatro indicadores, sete controles de filtro, tabela e inspector competiam no mesmo primeiro plano.
- O inspector crescia com todo o documento, em vez de permanecer contido no viewport.
- No mobile, o primeiro caso era selecionado automaticamente e o inspector aparecia sobre a página enquanto fila e filtros continuavam ocupando o documento abaixo.
- A conversão da tabela em blocos preservava densidade excessiva do desktop.

### Ajustes

- Indicadores foram compactados e continuam funcionando como filtros reais.
- Filtros foram reorganizados por largura sem remover nenhum critério.
- O inspector desktop passa a ter altura de viewport e rolagem interna.
- No mobile, a fila é a superfície inicial; o inspector somente aparece após o comando **Inspecionar** e bloqueia a rolagem do fundo.
- A fila mobile reduz metadados concorrentes e mantém a ação principal em largura total.

### Gates

- fila segue derivada de `Tasks`, com entregas e ocorrências como itens operacionais complementares;
- criação e atualização de follow-up continuam gravando Task real;
- inspector preserva filtros e contexto da fila;
- operação por teclado permanece possível;
- ausência de overflow testada em 390 × 844;
- o cenário E2E exige fila primeiro, abertura explícita e retorno à fila após fechar.

## Regressão visual

As alterações visuais intencionais ficam restritas às seguintes rotas nos cinco viewports obrigatórios:

- `categories-list`;
- `category-general`;
- `category-media-seo`;
- `category-products`;
- `after-sales`;
- `after-sales-occurrences`.

O baseline usa dataset determinístico e manifesto versionado. Nenhuma diferença externa a essas superfícies pode ser aprovada pela Etapa 24.

## Critério de conclusão

A Etapa 24 só pode ser encerrada depois de:

1. TypeScript e lint sem warnings;
2. testes unitários e de integração verdes;
3. E2E de Categorias e Pós-venda verdes;
4. build e análises de código morto/bundle verdes;
5. captura dos cinco viewports sem overflow;
6. comparação visual aprovada exclusivamente para as superfícies declaradas;
7. gates de segurança, backup, migrations e Jobs mantidos verdes.
