# Arquitetura do Esméra CMS em Payload

## Decisão de produto

O Payload é a única fonte de verdade para conteúdo editorial, catálogo e operação comercial.

A experiência possui dois níveis sobre os mesmos documentos:

1. **Portal operacional** — views curadas dentro de `/admin` para tarefas frequentes, leitura de indicadores reais e atalhos de edição.
2. **Admin técnico** — List/Edit/Versions nativos do Payload em `/admin/collections/*` e `/admin/globals/*`, para campos completos, histórico, drafts, permissões e operações avançadas.

Não existem datasets paralelos de Site e Business. A separação é feita por Collections, Access Control e papéis de usuário.

## Papéis

- `admin`: acesso editorial + comercial + usuários.
- `editor`: conteúdo, mídia, catálogo e globals.
- `commercial`: leads, clientes, vendas, pós-venda e tarefas; leitura de catálogo para referência comercial.

Usuários criados antes da introdução do campo `role` são tratados como `admin` por compatibilidade. Após a primeira inicialização, o papel deve ser salvo explicitamente em cada usuário.

## Rotas operacionais

- `/admin` — dashboard
- `/admin/content` — conteúdo do site
- `/admin/products` — catálogo
- `/admin/categories` — categorias
- `/admin/customers` — clientes
- `/admin/sales` — vendas
- `/admin/pipeline` — pipeline comercial
- `/admin/after-sales` — pós-venda
- `/admin/reports` — relatórios reais
- `/admin/settings` — configurações editoriais
- `/admin/technical` — índice explícito do Admin técnico

## Contrato de indicadores

Um número só é exibido após consulta bem-sucedida. Falhas geram estado de erro visível. Zero é um valor legítimo apenas quando a consulta conclui com zero registros.

Receita e quantidade de vendas operacionais usam `confirmedAt` no período e consideram somente:

- `confirmed`
- `production`
- `ready`
- `delivered`

Rascunho, proposta, negociação e cancelamento não entram silenciosamente nesses totais. Conversão usa `closedAt` e apenas leads atualmente em `won` ou `lost`.

Analytics de tráfego não exibe porcentagem ou gráfico até existir integração real.

## Publicação e edição

Produtos e Globals editoriais usam versões/drafts do Payload. O portal operacional não reimplementa publicação: seus atalhos abrem o editor nativo, que permanece o Admin técnico até existir equivalência funcional comprovada.
