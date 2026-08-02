# Esméra CMS — Etapa 5 · Produtos

Status: **concluída** em 31 Jul 2026.

Branch: `feat/admin-operational-rebuild`

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0.

## Objetivo executado

A Etapa 5 reconstrói Produtos como workspace operacional real, preservando Payload + PostgreSQL como fonte única de verdade e reutilizando as regras de produto já existentes no servidor.

Nenhum schema paralelo foi criado. O workspace lê e escreve por Payload com Access Control ativo.

## Workspace de catálogo

`/admin/products` agora oferece:

- lista como visualização padrão;
- grid como visualização secundária;
- TanStack Table para a lista operacional;
- paginação server-side de 50 ou 100 registros;
- busca por título, subtítulo, código, slug e material;
- filtros de catálogo, disponibilidade, publicação/prontidão e categoria;
- filtros, página, limite e modo preservados na URL;
- Empty State explícito quando a consulta não retorna produtos;
- Inspector em Drawer sem abandonar o contexto da lista;
- retorno do documento ao mesmo contexto de filtros/página/view.

## Ações em lote

A seleção de produtos suporta:

- publicar;
- despublicar;
- arquivar;
- restaurar;
- adicionar categoria sem duplicar relações já existentes;
- alterar disponibilidade para Peça única, Disponível, Sob encomenda ou Edição limitada.

As ações são processadas em `/api/admin-products`, autenticadas pelo Payload e limitadas pelo `canManageSite` + `overrideAccess: false`.

Erros de validação permanecem visíveis por item; falha de publicação não é convertida em sucesso parcial silencioso.

Não foi criada ação de “destaque” porque não existe campo real de destaque no schema atual.

## Regra única de prontidão

O workspace **não replica** a regra de publicação no cliente.

`src/businessRules/products/readiness.ts` continua sendo a regra única e `src/collections/Products.ts` continua calculando:

- `publicationReady`;
- `publicationIssues`.

A tentativa de publicar continua passando pelo hook do Payload. Produto incompleto é rejeitado pelo servidor.

O E2E da Etapa 5 cria um rascunho deliberadamente incompleto e confirma que a tentativa de publicação retorna erro, provando que a UI operacional não contorna a regra central.

## Documento operacional do produto

O workspace possui documento editorial próprio dentro de `/admin/products?product=<id>` com as abas:

1. Visão geral
2. Mídia
3. Comercial
4. Variantes
5. Ficha técnica
6. SEO
7. Histórico

### Visão geral

Apresenta:

- capa;
- status do catálogo;
- estado de publicação;
- prontidão e pendências reais;
- identidade do produto;
- categorias;
- edição rápida do rascunho.

### Edição rápida e autosave

Título, subtítulo, material, edição, disponibilidade e modo/preço base podem ser editados no workspace.

- autosave ocorre com debounce de 700 ms;
- toda alteração rápida é salva como **draft**;
- publicar é uma ação separada;
- falha de autosave é mostrada ao usuário;
- descrição rica, opções e variantes completas continuam disponíveis no editor técnico do Payload.

Isso evita transformar autosave em publicação implícita.

### Mídia

A galeria operacional usa dnd-kit para ordenação semântica e mantém alternativa explícita sem drag:

- arrastar para reordenar;
- botões ↑ / ↓ para teclado e tecnologia assistiva;
- `mediaKey`, `role`, `alt` e relacionamento com Media são preservados;
- a nova ordem é salva como draft;
- nenhuma mídia sem relacionamento válido é aceita pela action route.

A obrigatoriedade de `alt`, existência de mídia e capa única continuam validadas pelo schema/readiness do servidor.

### Comercial e Variantes

A UI lê o schema existente:

- `availability`;
- `priceMode`;
- `basePriceCents`;
- `optionDefinitions`;
- `variants`;
- preço herdado/próprio/sob consulta;
- status da variante e combinações.

Nenhum novo modelo de variação foi criado.

### SEO e Histórico

SEO apresenta slug, metadata e descoberta interna já cadastrados. Histórico mantém o mecanismo nativo de versões do Payload como fonte auditável e oferece acesso direto ao Admin técnico para comparação/restauração.

## Responsividade

`products.scss` usa o container `esmera-workspace` estabelecido na Etapa 4:

- toolbar reorganiza em 2 colunas e depois 1 coluna;
- grid reduz de múltiplas colunas para 2 e depois 1;
- documento passa de composição em duas colunas para fluxo vertical;
- edição rápida passa de 3 para 2 e depois 1 coluna;
- tabs têm scroll horizontal local;
- DataTable mantém scroll interno e não cria overflow horizontal no documento;
- galeria reordenável adapta thumbnail, metadata e controles no mobile.

## Testes adicionados

Playwright cobre o fluxo operacional de Produtos:

- criação de rascunho de teste;
- abertura da lista;
- alternância Lista → Grid;
- abertura do documento operacional;
- presença das sete abas;
- prontidão com pendências reais;
- autosave de rascunho;
- tentativa de publicação bloqueada pela readiness server-side;
- estado de galeria vazia.

A suíte estrutural anterior continua varrendo `/admin/products` em tablet e mobile para overflow horizontal do documento.

## Gate de execução

Código/testes da Etapa 5 validados no head:

`637ea4348afe8291f387bc0bd1a416157869c020`

- `Validate Esmera CMS` run `30671447283`: **success**
- `Stage 0 - Security and Baseline` / visual capture run `30671447284`: **success**
- frozen install: **success**
- Payload types/importmap: **success**
- TypeScript: **success**
- ESLint com zero warnings: **success**
- Vitest/integration: **success**
- production build: **success**
- Playwright E2E: **success**

## Baseline visual da Etapa 5

Artifact:

- nome: `admin-baseline-30671447284`
- ID: `8809002069`
- digest: `sha256:1fbeaeaa42be2a736c8bf4b7ef2902463e747207e96c1b971f7b1c28c61c8bcd`
- matriz: **13 views × 5 viewports = 65 screenshots**

Views capturadas:

- Dashboard
- Products List
- Products Grid
- Product Overview
- Product Media
- Categories
- Customers
- Sales List
- Sales Pipeline
- After-sales
- Reports
- Settings
- Technical Admin

Viewports:

- `1440×900`
- `1280×800`
- `1024×768`
- `768×1024`
- `390×844`

Inspeção visual manual confirmou:

- filtros e tabela coerentes em desktop;
- grid secundário consistente;
- documento operacional com hierarquia clara;
- pendências de prontidão legíveis;
- edição rápida separada da ação Publicar;
- tabs com overflow local no mobile;
- lista mobile sem overflow horizontal do documento;
- mídia vazia apresenta estado explícito, sem placeholder de dado fictício.

## Checklist de aceite

- [x] Lista padrão implementada.
- [x] Grid secundário implementado.
- [x] TanStack Table integrado.
- [x] Paginação server-side 50/100.
- [x] Busca e filtros server-side com estado na URL.
- [x] Inspector implementado.
- [x] Ações em lote de publicação, catálogo, categoria e disponibilidade.
- [x] Empty State real.
- [x] Documento operacional com sete abas.
- [x] Readiness reutilizada do servidor, sem duplicação no cliente.
- [x] Autosave apenas em draft e publicação separada.
- [x] Galeria com dnd-kit e alternativa sem arrastar.
- [x] Alt/capa/mídia continuam governados pelo schema/readiness.
- [x] Schema existente de preço e variantes preservado.
- [x] Histórico continua usando versões nativas do Payload.
- [x] Responsividade baseada em Container Queries.
- [x] E2E de Produtos verde.
- [x] Baseline visual de 65 screenshots gerado e inspecionado.

**Etapa 5 concluída.**

Próxima etapa do Plano Mestre: **Etapa 6 — Categorias**, com master-detail, busca, ordenação acessível e detalhe editorial sem duplicar relações deriváveis de Produtos.
