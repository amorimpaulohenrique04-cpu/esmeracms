# Migração do CMS Esméra: Sanity → Payload

## Fontes usadas

A implementação foi desenhada a partir de três fontes:

1. o repositório legado `cmsesmera`, incluindo os schemas Site/Business e a última correção arquitetural;
2. o laudo técnico de 31/07/2026;
3. as telas HTML e o Design System exportados do Stitch.

O objetivo não é portar literalmente a arquitetura anterior. A migração preserva a linguagem visual, o modelo editorial e os fluxos úteis, mas remove as causas dos problemas encontrados no diagnóstico.

## Decisão central

No Payload existe **uma única fonte de dados: PostgreSQL**.

A separação entre Site e Business passa a ser de domínio e permissão, não de dataset. Isso elimina a situação antiga em que o Site funcionava enquanto o Business podia estar inexistente/inacessível e, ainda assim, o dashboard transformava falhas em zeros.

A interface continua com dois níveis, mas sobre a mesma base:

- **Portal operacional** — views curadas dentro de `/admin`.
- **Admin técnico** — Collections/Globals nativos do Payload, com campos completos, drafts, versões e histórico.

## Mapeamento de dados

| Sanity antigo | Payload novo | Observação |
| --- | --- | --- |
| `product` | `products` | Drafts, versões, galeria semântica, variantes e SEO |
| `category` | `categories` | Hierarquia, ordem, imagem, sinônimos e SEO |
| assets | `media` | Upload, alt, crédito, tamanhos derivados |
| `homePage` | global `home` | Hero, manifesto, seleção, Matter, Signature, proveniência |
| `aboutPage` | global `about` | Institucional + SEO |
| `contactPage` | global `contact` | Canais, atendimento e CTA |
| `collectionPage` | global `collection-page` | Filtros e estados vazios |
| `navigation` | global `navigation` | Menu e links utilitários |
| `siteSettings` | global `site-settings` | Canais oficiais e parâmetros do site |
| `lead` | `leads` | Pipeline, próxima ação, interesse e consentimento |
| `customer` | `customers` | Relacionamento e privacidade |
| `sale` | `sales` | Itens, snapshots, valores, entrega e `confirmedAt` |
| `afterSale` | `after-sales` | Follow-ups, incidentes e entrega |
| `task` | `tasks` | Pendências operacionais |
| `activity` | `activities` | Histórico/auditoria operacional |

## Regras corrigidas no novo modelo

### Erro não é zero

Views customizadas usam Local API com Access Control aplicado. Uma falha de consulta gera estado de erro visível. Zero só é mostrado quando uma consulta bem-sucedida realmente retorna zero.

### Receita e quantidade de vendas

Uma venda só entra em métricas operacionais quando está em um dos estados:

- `confirmed`
- `production`
- `ready`
- `delivered`

O campo `confirmedAt` registra quando a venda entrou pela primeira vez em um estado elegível. O relatório mensal usa esse campo, evitando confundir data de criação do rascunho com data da venda confirmada.

### Conversão

Leads recebem `closedAt` quando entram em `won` ou `lost`. A conversão mensal considera somente leads encerrados no período e calcula `won / (won + lost)`. Sem base, a UI mostra **Sem base**, não `0%`.

### Follow-ups

Os indicadores contam itens reais de `followUps`, e não apenas documentos de pós-venda que possuam algum item.

### Analytics

Nenhum gráfico ou percentual de tráfego é simulado. Enquanto não houver uma integração verificável, a interface mostra **Não configurado**.

### Ações

Não há botões decorativos de publicar, exportar, compartilhar, busca ou notificações. Publicação usa os controles nativos do Payload. Novas ações só devem entrar no portal operacional quando tiverem handler, permissão, feedback e teste.

## Tradução e acessibilidade

O Admin carrega a tradução portuguesa oficial exposta pelo próprio pacote `payload/i18n/pt`. Os componentes customizados usam HTML semântico, links/botões reais, foco nativo e estados com texto, não apenas cor.

A galeria de produto mantém semântica explícita (`cover`, `detail`, `context`, `scale`) e texto alternativo obrigatório por uso.

## O que não deve ser fabricado na migração

### Dados do Sanity

Nenhum conteúdo real foi inventado ou copiado de screenshots. Para migrar registros existentes com segurança é necessário um export do projeto/dataset Sanity que contenha os documentos reais e, para mídia, os assets correspondentes.

Quando esse export existir, a migração deve:

1. criar categorias e mídia;
2. mapear IDs antigos → IDs Payload;
3. criar produtos e relacionamentos;
4. criar globals editoriais;
5. importar Leads/Customers/Sales/AfterSales/Tasks/Activities, se houver fonte íntegra;
6. validar contagens e relações antes de apontar o frontend para o Payload.

### Storage de mídia

O upload local serve para desenvolvimento. Em produção, configure storage persistente (S3/R2/Blob equivalente) antes de hospedar em ambiente efêmero.

### Integrações externas

Analytics, WhatsApp, e-mail transacional, ERP, pagamento ou automações comerciais não são presumidos. Cada integração deve ter credenciais próprias, health check, permissões e tratamento explícito de erro.

## Critério para evoluir o portal operacional

Uma tela customizada só substitui uma operação do Admin técnico quando houver equivalência comprovada em:

- validação;
- acesso/permissão;
- drafts/publicação quando aplicável;
- relacionamentos;
- feedback de sucesso/erro;
- acessibilidade;
- testes de regressão.

Até lá, o portal operacional funciona como camada curada e usa o editor nativo como destino seguro para edição profunda.
