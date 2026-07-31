# Esméra CMS — Payload

Hub editorial e comercial da Esméra construído com Payload CMS, Next.js e PostgreSQL.

## Arquitetura

O Payload é a única fonte de verdade. O Admin possui duas camadas sobre os mesmos documentos:

- **Portal operacional**: dashboard, catálogo, clientes, vendas, pipeline, pós-venda e relatórios em views curadas.
- **Admin técnico**: Collections, Globals, drafts, versões e formulários completos nativos do Payload.

A decisão evita a duplicidade de superfícies e de fontes de dados encontrada no protótipo anterior.

## Desenvolvimento

```bash
pnpm install
pnpm generate:types
pnpm generate:importmap
pnpm dev
```

Admin local:

```text
http://localhost:3000/admin
```

## Banco

Defina `DATABASE_URL` no `.env`. O projeto usa o adapter oficial PostgreSQL do Payload.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
PAYLOAD_SECRET=...
```

Nunca versione o `.env` real.

### Uploads em produção

O adapter de upload padrão grava arquivos no filesystem local. Antes de publicar em infraestrutura efêmera (por exemplo, funções serverless), configure storage persistente compatível com Payload, como S3/R2 ou outro provider adequado. O banco PostgreSQL não substitui o storage dos arquivos.

## Papéis

- `admin`: acesso integral.
- `editor`: conteúdo do site e catálogo.
- `commercial`: CRM, vendas e pós-venda.

A camada Business exige usuário autenticado. Conteúdo público só expõe produtos publicados/ativos, categorias ativas e mídia pública.

A interface nativa do Payload é carregada com a tradução oficial em português (`payload/i18n/pt`), além dos rótulos específicos da Esméra.

## Modelo editorial

- Products
- Categories
- Media
- Home
- About
- Contact
- Collection Page
- Navigation
- Site Settings

Produtos possuem drafts nativos, código, categorias, galeria semântica, disponibilidade, preço, opções, variantes, busca e SEO.

## Modelo comercial

- Leads
- Customers
- Sales
- After Sales
- Tasks
- Activities

Itens de venda mantêm snapshots de título, slug, seleção e preço para preservar o histórico mesmo quando o catálogo muda.

## Integridade das métricas

Nenhum KPI é demonstrativo. Falha de consulta é exibida como erro e nunca convertida em zero. Relatórios informam fonte, período e regra de inclusão.

Vendas válidas para quantidade/receita usam `confirmedAt` no período e somente os estados `confirmed`, `production`, `ready` e `delivered`.

## Antes do primeiro run após atualizar o schema

```bash
pnpm generate:types
pnpm generate:importmap
```

Em desenvolvimento, o adapter Postgres pode sincronizar o schema. Em produção, trate mudanças de banco com migrations revisadas.

Veja `docs/architecture.md` para o contrato arquitetural e `docs/migration-from-sanity.md` para o mapeamento da migração, decisões e itens deliberadamente não fabricados.
