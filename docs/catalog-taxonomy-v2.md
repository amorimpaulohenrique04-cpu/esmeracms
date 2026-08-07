# Catálogo V2 — taxonomia, navegação e coleções

## Decisão de arquitetura

`Categories` é a fonte única para hierarquia, rótulos, slugs, destino, regras de listagem, SEO, conteúdo editorial, visibilidade e destaques do menu. `Navigation` referencia apenas as raízes e guarda preferências de apresentação. `Products.categories` permanece a relação canônica múltipla; não existe array paralelo de produtos ou tags livres de prateleira.

O contrato V1 permanece disponível durante a migração. Os novos endpoints retornam `version: 2`, payload mínimo e validação em runtime.

## Tipos de categoria

- `collection`: página de produtos.
- `editorial`: página de conteúdo controlado.
- `external`: link absoluto com protocolo permitido.
- `group`: agrupador sem página própria ou com rota interna opcional.

Eixos taxonômicos: `navigation`, `piece_type`, `collection`, `environment`, `campaign` e `service`.

Modos de listagem:

- `assigned`: relação direta em `Products.categories`.
- `descendants`: categoria atual e descendentes, com limite de profundidade e detecção de ciclos.
- `rules`: regras tipadas convertidas em filtros seguros do Payload.
- `hybrid`: atribuição direta combinada às regras, com deduplicação realizada pela consulta.

## Endpoints públicos

### `GET /api/storefront/navigation`

Retorna a árvore derivada das categorias ativas e publicadas, destaques válidos e canais oficiais de WhatsApp/Instagram vindos de `SiteSettings`.

### `GET /api/storefront/collections/[slug]`

Parâmetros controlados:

- `q`
- `category`
- `collection`
- `environment`
- `piece_type` ou alias temporário `type`
- `material`
- `availability`
- `min` e `max` em centavos
- `sort`
- `page`
- `limit` (máximo 48)

Ordenações: `editorial`, `newest`, `price_asc`, `price_desc` e `name_asc`. Toda ordenação inclui um critério secundário estável.

### `GET /api/storefront/pages/[slug]`

Retorna páginas editoriais públicas com blocos controlados, breadcrumb, SEO, revisão e data pública.

## Cache e segurança

Os endpoints usam `Cache-Control`, `ETag`, `Last-Modified` e suportam `304 Not Modified`. A revisão é um hash determinístico do conteúdo público já projetado. Drafts, histórico, auditoria e documentos completos do Payload não são expostos.

Links externos são aceitos somente com `https:`, `http:`, `mailto:` ou `tel:`. Consultas públicas usam listas de campos, profundidade limitada, enums controlados e limites para busca, filtros e paginação.

## Seed inicial

Execute:

```bash
pnpm seed:catalog-taxonomy
```

O seed cria a estrutura inicial das cinco raízes e seus descendentes, publica os registros novos de baixo para cima e configura `Navigation.roots`. Registros já existentes com o mesmo slug são reutilizados e não são sobrescritos. Se um registro existente estiver arquivado ou não publicado, o seed informa o conflito e termina com erro para exigir decisão humana.

## Rollout

1. Aplicar migration e gerar tipos/import map.
2. Executar o seed em homologação.
3. Validar `/api/storefront/navigation`, coleções manuais, descendentes, automáticas e híbridas.
4. Migrar o frontend gradualmente para V2, mantendo V1 ativo.
5. Observar p95, erros de contrato, cache hit/304 e consultas mais caras.
6. Executar o seed em produção com backup e janela de rollback.
7. Remover os campos legados de `Navigation` somente após o frontend V2 estar validado em produção.

## Limite de facetas

A implementação evita uma consulta por opção. As facetas são calculadas sobre uma consulta controlada do conjunto filtrado. Quando o conjunto ultrapassa o limite operacional configurado, as contagens devem ser omitidas em vez de apresentar números parciais; ampliar esse limite exige medição de p95 e plano de agregação PostgreSQL específico.
