# Esméra CMS — Etapa 7 · Clientes

Status: **concluída** em 01 Ago 2026.

Branch: `feat/admin-operational-rebuild`

Fonte de verdade: Plano Mestre Técnico Esméra CMS 2026 v2.0.

## Objetivo executado

A Etapa 7 transforma Clientes em um workspace relacional de uso diário, preservando Payload + PostgreSQL como fonte única de verdade.

A implementação cobre:

- master list densa com detalhe contextual;
- busca por nome, telefone, e-mail, empresa, produto e número de venda;
- filtros por status, origem e responsável;
- preservação de seleção na URL e posição de scroll da lista;
- tabs `Visão geral`, `Histórico`, `Interesses`, `Vendas`, `Pós-venda` e `Notas`;
- resumo comercial derivado das relações existentes;
- próxima ação baseada em Tasks reais;
- timeline baseada em Activities;
- normalização de identidade e detecção de duplicidade;
- interesses de alto valor em uma relação própria;
- mesclagem administrativa com transferência de relações e auditoria.

Nenhum banco paralelo, cache autoritativo ou CRM externo foi introduzido.

## Workspace master-detail

`/admin/customers` agora possui uma composição operacional própria.

### Master list

A lista mostra:

- nome;
- empresa ou contato principal;
- status do cliente;
- origem;
- quantidade de compras derivada de Sales;
- seleção contextual persistida na URL.

A busca server-side cruza:

- nome;
- telefone;
- e-mail;
- empresa;
- cidade;
- tags;
- código/título de produto por meio das vendas relacionadas;
- número, item ou SKU de venda.

Os filtros são preservados na URL. A posição de scroll da lista é preservada em `sessionStorage` para reduzir perda de contexto durante a navegação.

### Detail

Em desktop, master e detail permanecem simultâneos. Em tablet/mobile, selecionar um cliente substitui a lista pelo detalhe e expõe o retorno `← Clientes`.

## Status do cliente

O status de Customer foi explicitado como uma dimensão própria:

- `active`;
- `follow_up`;
- `inactive`;
- `archived`.

Ele não representa a etapa de uma oportunidade comercial. O workspace declara essa separação no formulário e evita usar status de cliente como substituto de Pipeline.

## Visão geral

A Visão geral reúne:

- compras confirmadas ou posteriores;
- valor histórico derivado de Sales;
- última compra;
- interesses ativos;
- próxima Task real;
- perfil relacional editável.

O perfil inclui:

- identidade e contato;
- cidade/estado;
- origem;
- responsável;
- categorias de interesse;
- materiais de interesse;
- faixa de investimento;
- tags;
- notas do relacionamento.

### Opportunities deliberadamente não simuladas

A métrica `Oportunidades abertas` exibe `—` e informa que será disponibilizada após a migração de Opportunities na Etapa 8.

Nenhum número fictício ou derivação indevida de Leads foi criado para preencher esse espaço.

## Interesses explícitos

Foi criada a Collection `client-interests` para representar relações de alto valor entre Customer e Product.

Cada interesse preserva:

- cliente;
- produto;
- status próprio;
- origem;
- responsável;
- contexto;
- data de inclusão;
- data de encerramento.

Status suportados:

- ativo;
- em curadoria;
- convertido em compra;
- pausado;
- arquivado.

O workspace impede dois interesses abertos equivalentes para o mesmo cliente e produto.

Essa modelagem evita um array JSON crescente dentro de Customer e permite evolução futura sem duplicar Products.

## Histórico e notas

Activities passou a aceitar `eventType` estruturado:

- `sale.created`;
- `opportunity.stage_changed`;
- `interest.added`;
- `followup.completed`;
- `shipment.delivered`;
- `note.created`;
- `contact.logged`.

A Collection é append-mostly para o operador:

- usuários comerciais podem ler e criar eventos;
- somente administradores podem alterar ou excluir o passado.

Adicionar uma nota ou interesse pelo workspace gera Activity vinculada ao cliente. As tabs Histórico e Notas consultam essa fonte relacional, sem copiar timeline para Customer.

## Normalização e duplicidade

Antes de validar Customer:

- e-mail é convertido para lowercase e trim;
- telefone é normalizado para E.164;
- `normalizedEmail` e `normalizedPhone` são mantidos para busca de candidatos.

Ao criar um cliente, a API procura coincidências por telefone ou e-mail normalizados. Quando encontra candidatos, retorna conflito com os registros existentes antes da criação.

A interface permite abrir o registro existente. A criação forçada continua disponível como decisão explícita, não silenciosa.

## Mesclagem administrativa

A operação `merge` é restrita a administradores.

Ela:

- exige origem e destino distintos;
- transfere Sales, AfterSales, Leads e ClientInterests;
- atualiza vínculos de Tasks e Activities;
- combina tags e preferências sem duplicação simples;
- preserva contato do registro principal quando existente;
- arquiva o duplicado;
- registra `mergedInto` e `mergedAt`;
- cria uma Activity de auditoria.

O registro duplicado não é apagado silenciosamente.

## API operacional

`/api/admin-customers` suporta:

- `create`;
- `save-profile`;
- `add-note`;
- `add-interest`;
- `set-interest-status`;
- `merge`.

As operações:

- autenticam pelo Payload;
- exigem papel comercial para operação comum;
- exigem admin para mesclagem;
- respeitam Access Control nas gravações operacionais;
- retornam erro explícito para duplicidade ou validação.

## Responsividade

O workspace usa Container Queries sobre `esmera-workspace`.

Comportamentos confirmados:

- desktop: master + detail;
- faixas intermediárias: colunas reequilibradas e KPIs em duas colunas;
- tablet/mobile: detail substitui master;
- tabs com overflow horizontal local;
- formulário passa de duas para uma coluna;
- lista deixa de usar altura fixa em telas estreitas;
- nenhuma expansão horizontal do documento.

Durante a inspeção visual foram corrigidos:

- grid de filtros do master para impedir selects comprimidos;
- separação entre `← Clientes` e o eyebrow `CLIENTE` no mobile.

## Testes adicionados

Playwright cobre com dados reais:

- normalização de telefone e e-mail;
- persistência dos campos normalizados;
- detecção de duplicidade com candidatos;
- criação de venda relacionada;
- criação de interesse explícito;
- criação de nota e Activity;
- busca de cliente por produto vendido;
- presença das seis tabs;
- valor histórico derivado;
- ausência de oportunidade simulada;
- timeline relacional;
- interesse e status;
- venda relacionada;
- notas;
- detail mobile;
- ausência de overflow horizontal.

A suíte de integração existente continua validando acesso, publicação e contratos de domínio anteriores.

## Gate de execução do código

Código e polimento visual da Etapa 7 validados no head:

`3bd8fa87616bdbb16ef14d0d80a652b5036ebbf8`

- `Validate Esmera CMS` run `30683938751`: **success**
- `Stage 0 - Security and Baseline` run `30683938752`: **success**
- frozen install: **success**
- Payload types/importmap: **success**
- TypeScript: **success**
- ESLint com zero warnings: **success**
- Vitest/integration: **success**
- production build: **success**
- Playwright E2E: **success**

## Baseline visual da Etapa 7

Artifact do código validado:

- nome: `admin-baseline-30683938752`;
- ID: `8813305234`;
- digest: `sha256:c15d5b81dd34a88d475f742097cace7246e39ce2333d9ee0eb1ad59d8eae46ee`;
- matriz: **22 views × 5 viewports = 110 screenshots**.

Views de Clientes capturadas:

- lista;
- visão geral;
- histórico;
- interesses;
- vendas;
- pós-venda;
- notas.

A inspeção final confirmou filtros legíveis no desktop e retorno/eyebrow separados no mobile.

## Fora desta etapa

Não foi criada a Collection Opportunities nem realizada a migração comercial de Leads. Essa correção de domínio pertence à Etapa 8 e será executada com backfill, validação e estratégia de rollback próprias.
