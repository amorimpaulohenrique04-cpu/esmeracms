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
- avaliações ativas de prontidão de Produtos e Categorias;
- envelope estruturado de erros administrativos;
- Form System e campos monetários em reais;
- busca contextual baseada no request autenticado;
- rotas, migrations, CORS e contrato público do storefront.

## Implementações antigas não reaplicadas

### Preview editorial

A PR #20 continha uma rota visual interna que reconstruía uma representação própria do documento. Outra branch adicionou posteriormente um componente externo baseado em `NEXT_PUBLIC_EDITORIAL_PREVIEW_URL`, mas ele nunca foi conectado a um entry point e era classificado pelo release gate como código morto.

Nenhuma dessas duas implementações foi mantida nesta reconciliação. O CMS não exibe um preview fictício nem carrega estilos sem consumidor. Um preview editorial futuro deverá apontar para uma rota draft real e ser integrado explicitamente aos editores antes de entrar na `main`.

### Relatórios investigativos

A PR #20 continha uma reescrita ampla do `ReportsWorkspaceClient`. Outra integração adicionou um helper `reports/investigation.ts`, mas ele também permaneceu sem consumidor e era bloqueado pelo release gate.

A reescrita antiga não foi aplicada sobre o workspace atual. O helper desconectado foi removido. A camada ECharts compatível foi preservada, permitindo clique, hover e highlight sem trocar o contrato de dados ou criar uma segunda fonte de verdade.

### Busca administrativa

A rota antiga usava o parâmetro `context` enviado pelo cliente. A `main` já deriva o contexto do request autenticado e possui ações de domínio mais recentes. A rota atual foi mantida.

### Resíduos da fundação

Também foram removidos barrels sem consumidores e uma avaliação de Home que ainda não estava ligada a nenhum fluxo de publicação. Avaliações só devem existir quando são chamadas por uma rota ou coordenador real.

## Resultado

A branch de reconciliação contém somente diferenças compatíveis e alcançáveis a partir da `main` atual. A PR #20 deve ser fechada como substituída após a integração desta branch, e não mesclada diretamente.
