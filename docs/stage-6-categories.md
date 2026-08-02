# Esméra CMS — Etapa 6 · Categorias

Status: **concluída** em 31 Jul 2026.

Branch: `feat/admin-operational-rebuild`

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0.

## Objetivo executado

A Etapa 6 transforma Categorias em uma área operacional master-detail, preservando Payload + PostgreSQL como fonte única de verdade.

A implementação segue o Plano Mestre:

- lista à esquerda e detalhe à direita em desktop;
- detalhe como fluxo próprio em tablet/mobile;
- ordenação editorial diretamente na lista;
- Ativas / Arquivadas como estados explícitos;
- busca por título, slug e sinônimos;
- contagem de produtos derivada de `Products.categories`;
- tabs `Geral`, `Mídia & SEO` e `Produtos relacionados`;
- relação de produtos derivada, sem array duplicado na categoria;
- prevenção server-side de ciclos de hierarquia;
- proteção contra categoria inválida em produto ativo.

Nenhum schema comercial paralelo foi criado.

## Workspace master-detail

`/admin/categories` agora oferece uma composição operacional própria.

### Desktop

A tela mantém simultaneamente:

- **Master**: lista editorial de categorias;
- **Detail**: categoria selecionada e sua edição contextual.

Selecionar uma categoria preserva o estado de busca e status na URL.

### Tablet e mobile

Quando uma categoria é selecionada, o master é substituído pelo detalhe dentro do mesmo workspace e o cabeçalho do detalhe oferece `← Categorias` para retorno.

Essa solução evita sidebar/lista comprimida atrás do formulário e respeita a fundação responsiva da Etapa 4.

## Lista operacional

A lista contém:

- miniatura;
- nome;
- slug;
- profundidade hierárquica;
- quantidade de produtos derivada;
- status;
- ordem editorial;
- controle acessível de posição.

### Busca e estados

O topo possui:

- segmented control visual para **Ativas** e **Arquivadas**;
- busca server-side por `title`, `slug` e `searchTerms.term`;
- estado de busca preservado na URL.

### Contagem de produtos

`productCount` não é armazenado em Categorias.

A contagem é calculada a partir de `Products.categories`, mantendo uma única relação persistida e evitando divergência entre coleções.

## Ordenação editorial

A ordenação usa dnd-kit para interação direta e oferece alternativa explícita sem drag:

- arrastar para reordenar;
- `Mover <categoria> para posição` por `<select>` acessível;
- feedback de salvamento em `aria-live`;
- normalização server-side de ranks inteiros em intervalos de 100.

A action route exige o conjunto completo de IDs da taxonomia antes de persistir a nova ordem. Isso impede reordenação parcial silenciosa quando a lista está filtrada.

## Detalhe da categoria

O detalhe possui exatamente três seções operacionais:

1. `Geral`
2. `Mídia & SEO`
3. `Produtos relacionados`

### Geral

Permite editar como rascunho:

- nome;
- slug;
- descrição;
- categoria principal;
- status;
- ordem editorial.

Publicar/despublicar continua separado do salvamento do rascunho.

O Admin técnico do Payload permanece disponível para o fluxo nativo completo e histórico de versões.

### Mídia & SEO

A seção disponibiliza:

- imagem principal da categoria;
- sinônimos em chips removíveis;
- Base UI Combobox para procurar termos existentes ou criar novo sinônimo;
- título SEO;
- descrição SEO;
- imagem social;
- `noIndex`;
- preview básico de snippet de busca.

Os chips possuem remoção explícita por botão e são operáveis por teclado.

### Produtos relacionados

A seção consulta produtos cujo `Products.categories` contém a categoria atual.

Nenhum campo `products[]` foi criado em Categorias.

A tabela mostra produto, estado de catálogo, publicação e disponibilidade, com acesso ao workspace operacional de Produtos.

## Integridade da hierarquia

Foi criada a regra server-side `src/businessRules/categories/hierarchy.ts`.

Antes de validar uma categoria, o servidor percorre a cadeia de pais e rejeita:

- categoria apontando para si mesma;
- ciclo indireto;
- categoria principal inexistente;
- ciclo já presente na cadeia;
- profundidade anormal acima do limite defensivo.

Essa validação acontece no Payload, não apenas na UI.

## Status e integridade com Produtos

Categorias continuam usando um único significado de `status`:

- `active` = participa do catálogo;
- `archive` = arquivada.

Draft/publicação permanece responsabilidade do workflow nativo do Payload.

### Arquivamento/despublicação protegidos

Uma categoria não pode ser arquivada silenciosamente enquanto existirem produtos simultaneamente:

- ativos no catálogo;
- publicados;
- relacionados à categoria.

A action operacional de despublicação aplica a mesma proteção.

### Produto ativo → categoria válida

A Etapa 6 integra validade de categoria à regra já existente de prontidão do produto.

`withActiveProductCategoryValidity()` consulta as categorias relacionadas e injeta uma pendência transitória na execução da readiness quando um produto ativo aponta para categoria que não esteja ativa e publicada.

A regra base de Produtos continua sendo a autoridade única que calcula:

- `publicationReady`;
- `publicationIssues`;
- rejeição de publicação incompleta.

A pendência transitória é removida antes da persistência. Portanto não foi criado campo duplicado nem uma segunda regra de publicação no cliente.

## API operacional

`/api/admin-categories` suporta:

- `save-draft`;
- `publish`;
- `unpublish`;
- `reorder`.

Todas as operações:

- autenticam pelo Payload;
- exigem `canManageSite`;
- usam `overrideAccess: false` para gravação operacional;
- retornam erro explícito quando uma regra de integridade impede a operação.

## Responsividade

`categories.scss` usa Container Queries sobre `esmera-workspace`.

Comportamentos confirmados:

- desktop: master + detail simultâneos;
- faixas intermediárias: master compacto e detalhe com prioridade espacial;
- tablet/mobile: detail substitui master quando selecionado;
- formulário passa de duas para uma coluna;
- tabs usam overflow horizontal local quando necessário;
- lista reduz metadata secundária em telas estreitas;
- tabela relacionada preserva overflow apenas dentro do componente;
- nenhum overflow horizontal é criado no documento.

Após inspeção do primeiro baseline foi corrigida a separação visual entre `← Categorias` e o eyebrow `CATEGORIA` no mobile.

## Testes adicionados

Playwright cobre a Etapa 6 com dados reais:

- criação de categoria principal;
- criação de subcategoria;
- busca por sinônimo;
- produto relacionado derivado;
- contagem derivada na lista;
- reordenação por alternativa acessível;
- abertura do master-detail;
- salvamento de rascunho;
- tentativa de criar ciclo na hierarquia e rejeição pelo servidor;
- publicação das categorias;
- chips de sinônimos e preview SEO;
- produtos relacionados;
- modo detail no mobile;
- ausência de overflow horizontal do documento.

A suíte de integração existente continua validando os contratos de acesso, publicação e prontidão.

## Gate de execução do código

Código da Etapa 6 validado no head:

`5f1e72cc493c50e991fde1811ae645c4783aa5f4`

- `Validate Esmera CMS` run `30675102636`: **success**
- `Stage 0 - Security and Baseline` / visual capture run `30675102619`: **success**
- frozen install: **success**
- Payload types/importmap: **success**
- TypeScript: **success**
- ESLint com zero warnings: **success**
- Vitest/integration: **success**
- production build: **success**
- Playwright E2E: **success**

## Baseline visual da Etapa 6

Artifact de inspeção do código:

- nome: `admin-baseline-30675102619`
- ID: `8810203878`
- digest: `sha256:ff9eea8eff1398969f9b92ecfb5fad4f3e4b50676aba827d35ec2781f00056e8`
- matriz: **16 views × 5 viewports = 80 screenshots**

Views capturadas:

- Dashboard
- Products List
- Products Grid
- Product Overview
- Product Media
- Categories List
- Category General
- Category Media & SEO
- Category Products
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

- lista de categorias legível e hierarquia evidente;
- master-detail equilibrado no desktop;
- campos gerais e estados com hierarquia clara;
- chips e preview SEO funcionais e coerentes com o Design System;
- relação de produtos explicitamente derivada;
- lista mobile compacta sem overflow do documento;
- detalhe mobile em fluxo único;
- navegação de retorno separada do eyebrow após o ajuste visual final.

## Checklist de aceite

- [x] Master-detail implementado.
- [x] Lista à esquerda e detalhe à direita no desktop.
- [x] Fluxo de detalhe dedicado em tablet/mobile.
- [x] Ativas / Arquivadas implementado.
- [x] Busca por título, slug e sinônimos.
- [x] Miniatura, nome, contagem derivada, status e ordem na lista.
- [x] dnd-kit integrado.
- [x] Alternativa acessível “Mover para posição”.
- [x] Rank inteiro normalizado.
- [x] Tabs Geral / Mídia & SEO / Produtos relacionados.
- [x] Campos de taxonomia e hierarquia editáveis.
- [x] Chips removíveis + Combobox de sinônimos.
- [x] Preview básico de SEO.
- [x] Produtos relacionados derivados de `Products.categories`.
- [x] Nenhum array duplicado de produtos em Categorias.
- [x] Ciclos de categoria impossíveis via regra server-side.
- [x] Arquivamento/despublicação protegidos contra produtos ativos publicados.
- [x] Produto ativo incorpora validade da categoria à readiness central.
- [x] Responsividade baseada em Container Queries.
- [x] E2E verde.
- [x] Baseline visual de 80 screenshots gerado e inspecionado.

**Etapa 6 concluída.**

Próxima etapa do Plano Mestre: **Etapa 7 — Clientes**.
