# Reconciliação da PR #20 — Rodada 3

## Contexto

A PR #20 foi criada sobre `agent/round-2-design-system-v2` e permaneceu aberta enquanto a `main` recebeu integrações posteriores da Rodada 3, da publicação editorial segura e da fundação operacional 10/10.

Mesclar a branch antiga diretamente reintroduziria versões anteriores de formulários, publicação, busca e preview. Esta reconciliação parte da `main` atual e reaplica somente os contratos exclusivos que continuam válidos.

## Reaplicado sobre a `main`

### Continuidade e navegação

- View Transition API como melhoria progressiva, sem dependência funcional;
- preservação de scroll, foco e origem de edição;
- fechamento de inspector por `Escape` somente quando não existe overlay prioritário;
- histórico local de registros recentes;
- identificação da seleção atual para ações contextuais;
- respeito a `prefers-reduced-motion`.

### Command Palette

- seleção atual;
- registros recentes locais;
- recortes salvos;
- atalhos para seções de Relatórios;
- deduplicação de resultados locais e do servidor;
- manutenção da busca autenticada e das permissões existentes na `main`.

### Interações operacionais

- rollback confiável da ordem de Categorias;
- rollback confiável da Galeria para a última ordem confirmada;
- anúncios acessíveis de sucesso, movimentação e restauração;
- seleção espacial e feedback visual sem depender de hover;
- eventos de clique, hover e highlight na camada ECharts.

## Preservado da fundação mais recente

Os seguintes contratos da `main` prevalecem sobre as versões antigas da PR #20:

- revisão canônica e proteção contra conflitos;
- `save-and-publish` e coordenador de publicação;
- avaliações de prontidão para Produtos, Categorias e Home;
- envelope estruturado de erros administrativos;
- Form System e campos monetários em reais;
- busca contextual baseada no request autenticado;
- rotas, migrations, CORS e contrato público do storefront.

## Substituído por implementação posterior

### Preview editorial

A PR #20 continha uma rota visual interna que reconstruía uma representação própria do documento. A `main` adotou `EditorialPreview`, `previewURL` e `NEXT_PUBLIC_EDITORIAL_PREVIEW_URL`, que apontam para uma rota draft real e não exibem um placeholder enganoso quando a integração não está configurada.

Por isso, os arquivos `EditorialPreviewPanel.tsx`, `EditorialPreviewDocument.tsx`, a rota interna e seu CSS não foram reaplicados.

### Relatórios investigativos

A `main` já contém o contrato `reports/investigation.ts`, navegação serializada na URL e a integração da Rodada 3. O `ReportsWorkspaceClient.tsx` antigo não foi sobrescrito integralmente para evitar duas fontes de verdade e regressão do workspace atual.

A camada ECharts reutilizável foi preservada porque é compatível e permite que o workspace atual consuma eventos e highlight sem trocar seus contratos de dados.

### Busca administrativa

A rota antiga usava o parâmetro `context` enviado pelo cliente. A `main` já deriva o contexto do request autenticado e possui ações de domínio mais recentes. A rota atual foi mantida.

## Resultado

A branch de reconciliação contém somente diferenças compatíveis com a `main` atual. A PR #20 deve ser fechada como substituída após a integração desta branch, e não mesclada diretamente.
