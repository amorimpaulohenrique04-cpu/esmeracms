---
title: "Plano Completo de Implementação — CMS Esméra"
subtitle: "Publicação segura, UX editorial e evolução visual Premium Tech Quiet"
version: "1.0"
date: "2026-08-03"
status: "Fonte de verdade para implementação"
repositories:
  backend: "amorimpaulohenrique04-cpu/esmeracms @ 09d9504911f7e9a00888324304efe6dfbd2f3e63"
  frontend: "deco-sites/testeesmera @ 1c030e2c8f457cadf05087db5db0d1de8e13d910"
---

# Plano Completo de Implementação — CMS Esméra

## 0. Propósito do documento

Este documento consolida, corrige e transforma em plano executável:

1. o **Plano Mestre Técnico do CMS Esméra**;
2. a **Auditoria de Acessibilidade, Usabilidade e Linguagem**;
3. o **Plano de Evolução Visual e Interativa**;
4. a auditoria cruzada do código atual dos repositórios Payload e Deco;
5. as correções de leitura confirmadas por evidência no código atual.

O resultado deve ser tratado como a **fonte única de verdade para a próxima rodada de implementação**. Quando houver conflito entre documento antigo e código atual, prevalece esta ordem:

1. integridade funcional e segurança de publicação;
2. evidência do código atual;
3. acessibilidade e recuperação de erro;
4. consistência de produto;
5. direção visual aprovada;
6. preferências cosméticas locais.

Este plano não declara que a suíte atual está verde. A conclusão da implementação depende dos gates definidos na seção de qualidade.

---

# 1. Decisão executiva

## 1.1 O que será feito

O trabalho será dividido em duas trilhas sequenciais e integradas:

### Trilha A — Confiança editorial

Corrigir o contrato de salvar, publicar, verificar e explicar erros:

- toda publicação passa pelo mesmo coordenador;
- autosave e publicação usam concorrência otimista real;
- publicação em lote deixa de ser um caminho inferior;
- readiness passa a produzir issues estruturadas na origem;
- o probe da Deco compara a revisão esperada com a revisão observada;
- o resultado não chama conteúdo incompatível de “publicado com sucesso”;
- erros chegam ao campo, à aba e ao registro correto;
- a camada editorial existente em `FormSystem.tsx` é adotada nos formulários reais;
- o `FieldV2` é corrigido antes da migração ampla.

### Trilha B — Premium Tech Quiet

Aplicar a evolução visual e interativa sem substituir arquitetura, regras de negócio ou bibliotecas já adequadas:

- tokens de movimento, profundidade, blur, estados e contraste;
- rail com peek sem reflow em 1024–1279 px;
- shell, command palette, create menu e overlays mais refinados;
- hovers e focos que informam ação, sem decoração excessiva;
- formulários com foco preciso, dirty state e feedback persistente;
- tabelas, listas, filtros, cards e gráficos com comportamento coerente;
- aplicação por módulo, com intensidade diferente conforme a tarefa;
- testes visuais, acessibilidade e desempenho como gates de release.

## 1.2 O que não será feito

Não faz parte desta rodada:

- trocar Payload, Next.js, PostgreSQL ou Deco;
- criar um segundo banco ou dataset paralelo;
- reescrever o Admin com outro framework;
- migrar globalmente para Tailwind;
- importar a arquitetura do TailAdmin;
- trocar ECharts por ApexCharts;
- criar dark mode;
- adicionar central de notificações fictícia;
- adicionar métricas, gráficos ou dados demonstrativos;
- aplicar radius de 16–24 px em toda a interface;
- usar `transition: all`;
- esconder ações essenciais exclusivamente em hover;
- tratar refinamento visual como substituto das correções P0.

## 1.3 Guardrail de commits

Mudança funcional, mudança de contrato, mudança de schema e mudança visual **não devem entrar no mesmo mega-commit**.

Cada pull request deve possuir um objetivo principal, testes próprios, rollback claro e diff auditável.

---

# 2. Diagnóstico consolidado do estado atual

## 2.1 Fundamentos que devem ser preservados

O projeto já possui:

- Payload como núcleo de dados e permissões;
- PostgreSQL como fonte transacional;
- portal operacional e Admin técnico sobre os mesmos documentos;
- Custom Views e módulos por domínio;
- Base UI para overlays e gerenciamento de foco;
- View Transitions e tratamento de reduced motion;
- ECharts no módulo analítico;
- readiness de produto centralizada em uma função de domínio;
- coordenador de publicação individual;
- validação de contrato público no backend e no frontend;
- `FormSystem.tsx` com `FormShell`, `ErrorSummary`, `PublicationChecklist` e `ActionBar`;
- registro de erros com tabs/anchors;
- Playwright, Vitest e Axe já instalados.

O objetivo é **integrar e completar esses recursos**, não reconstruí-los do zero.

## 2.2 Falhas confirmadas por evidência

### FLOW-01 — Publicação segura apenas parcial

O fluxo individual `save-and-publish` usa o coordenador. A publicação em lote usa:

```text
findByID -> assessProductPublication -> payload.update(_status: published)
```

Esse caminho não usa:

- `coordinatePublication`;
- `expectedRevision`;
- `expectedUpdatedAt`;
- `confirmationToken`;
- `verify`;
- resultado operacional compatível com o site.

O único E2E de publicação existente exercita justamente o caminho em lote mais fraco.

**Classificação final:** P0 — parcial e com cobertura invertida.

### FLOW-02 — Concorrência otimista incompleta

- `revisionRef` e `updatedAtRef` começam como `null` no formulário de Produto;
- a revisão inicial não é entregue de forma confiável ao abrir o editor;
- `save-draft` recebe expectativas, mas as ignora no servidor;
- a primeira gravação da sessão não está protegida;
- autosave pode competir com outra aba ou outro operador;
- cancelar o `fetch` no browser não cancela necessariamente uma escrita já aceita no servidor.

**Classificação final:** P0 — proteção existente apenas em parte do publish.

### FLOW-03 — Readiness estruturada tarde demais

Existe uma engine central, `getProductReadiness`, mas ela retorna `string[]`. Em seguida:

- `productAssessment.ts` tenta reconstruir `path`, `tab` e severidade por correspondência textual;
- `Products.ts` adapta as mesmas strings para `publicationIssues`;
- diferentes caminhos de enforcement podem divergir conforme a copy muda.

**Classificação final:** P0 — uma origem, múltiplos adapters frágeis.

### FLOW-04 — Erros detalhados são descartados

- APIs reduzem exceções a mensagens genéricas;
- bulk retorna mensagens por item, mas a interface mostra apenas a quantidade;
- o usuário precisa abrir registros e adivinhar a correção.

**Classificação final:** P0/P1 — contrato e apresentação incompletos.

### FLOW-05 — “Publicado” não prova “visível na revisão correta”

- o probe recebe `revision`, mas não compara revisão esperada e observada;
- o validador do frontend verifica contrato e disponibilidade, não identidade do snapshot;
- no coordenador, `incompatible` e `not_run` ainda podem resultar em `published`;
- conectar o callback `verify` sem mudar a política apenas automatizaria um resultado incorreto.

**Classificação final:** P0 — fechamento do ciclo inexistente.

### A11Y-04 — Campo e erro não estão programaticamente ligados

O `FieldV2` atual calcula IDs e metadados, mas não injeta de forma garantida no controle filho:

- `id`;
- `aria-describedby`;
- `aria-invalid`;
- `aria-errormessage`.

Logo, não deve ser considerado pronto para migração ampla.

**Classificação final:** P0/P1 — base existente, implementação incompleta.

### A11Y-05 — Camada editorial pronta, mas sem consumidores reais

`FormSystem.tsx` já oferece:

- resumo focável com `role="alert"`;
- navegação entre abas;
- foco e `scrollIntoView` no campo;
- checklist de publicação;
- barra de ação com dirty state.

Os formulários reais de Produtos e Categorias não consomem essa camada. O feedback atual continua no rodapé, em grande parte com `role="status"` e `aria-live="polite"`.

**Classificação final:** P1 — adoção, não criação.

### A11Y-06 — Testes cobrem shell, não processo completo

- Axe é executado em escopo estreito;
- somente impactos `serious`/`critical` falham;
- o E2E de publicação não preenche o formulário como pessoa usuária;
- erros entre abas, foco, zoom e leitores de tela não são exercitados.

**Classificação final:** P1 — cobertura insuficiente.

## 2.3 Estado da direção visual

Há evolução visual real no código:

- View Transitions;
- entrada de inspector;
- rollback visual;
- spatial selection;
- blur de overlay;
- reduced motion.

Entretanto, isso representa uma evolução paralela. Ainda faltam os artefatos específicos aprovados:

- escala 180/280/420 ms;
- shadows interativas contextuais;
- gramática única de hover/focus/pressed/selected;
- rail peek sem reflow;
- feedback consistente de formulários;
- regras por modalidade de entrada;
- aplicação sistemática por módulo.

---

# 3. Arquitetura alvo de publicação

## 3.1 Princípio

Para qualquer entidade pública, “Publicar” deve significar:

1. o conteúdo visível foi salvo;
2. a revisão salva é a revisão avaliada;
3. não existem bloqueios editoriais;
4. warnings foram confirmados quando necessário;
5. a revisão exata foi enviada para publicação;
6. o contrato público foi verificado;
7. o CMS informa com precisão o que está ou não visível no site.

O usuário não precisa conhecer Payload, Deco, hash, schema ou probe. A interface deve apresentar:

- **Rascunho salvo**;
- **Pronto para publicar**;
- **Publicação em verificação**;
- **Visível no site**;
- **Publicado, mas ainda não confirmado**;
- **Publicado com incompatibilidade**;
- **Publicação revertida**.

## 3.2 Estado operacional

O estado do Payload (`draft`/`published`) não é suficiente para representar integração. Adotar um estado operacional explícito:

```ts
type OperationalPublicationStatus =
  | 'draft'
  | 'ready'
  | 'publishing'
  | 'pending_verification'
  | 'published'
  | 'published_but_unverified'
  | 'published_but_incompatible'
  | 'publish_reverted'
  | 'blocked'
  | 'conflict'
  | 'failed'
```

### Regras

| Estado | Significado | Copy editorial |
|---|---|---|
| `draft` | Rascunho persistido | Rascunho salvo |
| `ready` | Sem blockers locais | Pronto para publicar |
| `publishing` | Mutation ativa | Publicando… |
| `pending_verification` | Publicado no Payload, aguardando confirmação | Confirmando no site… |
| `published` | Revisão exata compatível | Visível no site |
| `published_but_unverified` | Site/probe indisponível após tentativas | Publicado; confirmação do site pendente |
| `published_but_incompatible` | Revisão encontrada, mas incompatível | Publicado com problema de compatibilidade |
| `publish_reverted` | Snapshot novo foi revertido com segurança | Publicação desfeita; versão anterior preservada |
| `blocked` | Readiness/contrato local bloqueou | Existem pendências para publicar |
| `conflict` | Revisão foi alterada por outro processo | O conteúdo foi atualizado em outro lugar |
| `failed` | Erro não recuperado | Não foi possível concluir a publicação |

## 3.3 Política definitiva para `compatible`, `unavailable`, `incompatible` e `not_run`

### `compatible`

- retorna `published`;
- persiste data, revisão e versão do contrato;
- habilita “Ver no site”.

### `unavailable`

- não prova incompatibilidade;
- não deve gerar rollback automático;
- retorna `published_but_unverified`;
- agenda nova verificação;
- não exibe mensagem verde “Visível no site”.

### `revision_mismatch`

- indica propagação atrasada, cache ou resposta de versão anterior;
- executar até 3 tentativas com backoff curto: 500 ms, 1.500 ms e 3.000 ms;
- se persistir, retornar `published_but_unverified` com causa `revision_mismatch`;
- agendar recheck; não chamar de compatible.

### `incompatible`

- nunca pode cair em `published`;
- retorna `published_but_incompatible`;
- registra issues do contrato;
- tenta rollback condicional apenas quando:
  - existe snapshot publicado anterior;
  - a revisão atual continua sendo exatamente a que acabou de ser publicada;
  - não houve gravação concorrente;
  - a restauração pode ser comprovada.
- se rollback seguro concluir, retornar `publish_reverted`;
- se não for seguro, preservar o documento e emitir alerta operacional crítico.

### `not_run`

- permitido apenas para entidade sem superfície pública contratada;
- para Produto, Categoria, Home, Navegação, Configurações de site e páginas públicas, ausência de `verify` é erro de configuração;
- o coordenador deve retornar `verification_required`/`failed`, nunca sucesso silencioso.

## 3.4 Coordenador único

Toda publicação pública deve passar por `coordinatePublication` ou por um adapter que o invoque.

Proibir `payload.update({_status: 'published'})` diretamente em:

- rotas customizadas;
- bulk actions;
- hooks administrativos;
- scripts de operação;
- testes que pretendem validar o fluxo real.

### Pipeline obrigatório

```text
1. Ler revisão atual
2. Comparar expectedRevision/expectedUpdatedAt
3. Salvar o draft com compare-and-swap
4. Ler o snapshot salvo
5. Calcular canonical revision
6. Executar readiness/contrato local
7. Bloquear ou solicitar confirmação de warnings
8. Publicar exatamente a revisão avaliada
9. Confirmar que a revisão não mudou
10. Verificar storefront
11. Persistir receipt/status
12. Retornar resultado estruturado
```

## 3.5 Publicação em lote

O lote deve ser um orquestrador do coordenador, não uma implementação paralela.

### Regras

- limite inicial: 25 itens por request;
- concorrência controlada: 3 itens simultâneos;
- erro de um item não aborta os demais;
- cada item carrega sua própria revisão esperada;
- warnings exigem token por item ou confirmação de lote vinculada ao conjunto exato de IDs/revisões;
- o resultado é parcial e determinístico;
- retry só reenvia itens não concluídos;
- nenhum item retorna “publicado” sem passar pela política de verificação.

### Contrato

```ts
type BulkPublicationResult = {
  requested: number
  published: number
  unverified: number
  incompatible: number
  reverted: number
  blocked: number
  conflicted: number
  failed: number
  results: Array<{
    id: string | number
    title?: string
    expectedRevision?: string
    publishedRevision?: string
    status: OperationalPublicationStatus
    message: string
    fieldErrors?: PublicationIssue[]
    verification?: StorefrontVerification
    retryable: boolean
  }>
}
```

## 3.6 Concorrência otimista real

### Revisão inicial

Toda leitura usada por formulário deve retornar:

```ts
{
  document: T
  revision: string
  updatedAt: string
}
```

A revisão precisa ser carregada antes de habilitar autosave ou publicar.

### Save draft

`save-draft` deve:

1. exigir `expectedRevision` após a criação inicial;
2. verificar revisão e `updatedAt` no servidor;
3. rejeitar conflito com HTTP 409;
4. nunca sobrescrever silenciosamente;
5. retornar a nova revisão.

### Fila de mutation no cliente

Produto e Categoria devem compartilhar uma fila serial:

```text
edit -> debounce -> enqueue save -> await server -> update revision
publish -> flush pending save -> await success -> publish same revision
```

Regras:

- publish nunca apenas “aborta” o autosave; ele aguarda a fila confirmar o último estado;
- erro de save interrompe publicação;
- um autosave antigo não pode escrever depois do publish;
- saída da página consulta dirty state e mutation em voo;
- conflito oferece: “Recarregar versão atual”, “Comparar alterações” e, para admin, “Salvar como cópia”.

## 3.7 Revisão canônica pública

Adotar uma revisão determinística sobre a projeção pública, não sobre o documento bruto.

### Campos internos recomendados

```ts
publicationRevision: string
publicationContractVersion: string
publicationVerifiedAt?: string
publicationVerificationStatus?: string
publicationTraceId?: string
```

Devem ser:

- gerados pelo servidor;
- somente leitura na camada editorial;
- ocultos em “Avançado” ou no Admin técnico;
- incluídos na API pública consumida pela Deco.

### Canonicalização

O hash deve considerar apenas dados que alteram a renderização pública:

- conteúdo editorial público;
- IDs/URLs públicas de mídia;
- status público;
- categorias e relacionamentos resolvidos na profundidade contratada;
- variantes e preço público;
- ordem de arrays semânticos.

Deve excluir:

- `updatedAt` isolado;
- IDs de versão internos;
- timestamps de auditoria;
- campos administrativos;
- ordem de propriedades de objeto;
- valores derivados não consumidos pelo frontend.

A mesma biblioteca de canonicalização deve possuir fixtures compartilhadas nos dois repositórios.

## 3.8 Contrato do probe da Deco

```ts
type StorefrontVerification = {
  status:
    | 'compatible'
    | 'incompatible'
    | 'revision_mismatch'
    | 'unavailable'
  expectedRevision: string
  observedRevision?: string
  contractVersion: string
  checkedAt: string
  publicUrl?: string
  issues?: Array<{
    code: string
    path?: string
    message: string
  }>
  retryAfterMs?: number
}
```

O endpoint deve:

- autenticar token;
- validar versão do contrato;
- buscar o documento pela rota pública real;
- ler `publicationRevision` da resposta;
- comparar expected e observed;
- executar `validatePayloadContract`;
- diferenciar documento ausente, mídia ausente, contrato inválido, mismatch e indisponibilidade;
- não ecoar uma revisão como se tivesse sido observada.

## 3.9 Receipt e observabilidade

Cada tentativa deve gerar um receipt estruturado:

```ts
type PublicationReceipt = {
  traceId: string
  entity: string
  documentId: string
  actorId: string
  expectedRevision?: string
  savedRevision?: string
  publishedRevision?: string
  previousPublishedRevision?: string
  status: OperationalPublicationStatus
  verificationStatus?: StorefrontVerification['status']
  contractVersion?: string
  startedAt: string
  completedAt: string
  durationMs: number
  issues?: PublicationIssue[]
}
```

Logs técnicos podem permanecer técnicos. A UI deve consumir uma tradução localizada e acionável.

---

# 4. Contrato único de readiness e erros

## 4.1 Issue estruturada na origem

Substituir `issues: string[]` por:

```ts
type PublicationIssue = {
  code: string
  severity: 'blocker' | 'warning' | 'info'
  path: string
  tab: string
  label: string
  message: string
  suggestion?: string
  anchor?: string
  source: 'readiness' | 'payload' | 'storefront' | 'media' | 'concurrency'
}
```

### Exemplo

```ts
{
  code: 'product.gallery.alt_required',
  severity: 'blocker',
  path: 'gallery.1.alt',
  tab: 'media',
  label: 'Texto alternativo da imagem 2',
  message: 'Adicione um texto alternativo à imagem 2.',
  suggestion: 'Descreva o objeto, o material e o enquadramento.',
  anchor: 'product-gallery-item-2-alt',
  source: 'readiness'
}
```

## 4.2 Uma engine, vários consumidores tipados

`getProductReadiness` continua como fonte central, mas passa a retornar issues estruturadas.

Consumidores:

- hook de Products;
- coordenador de publicação;
- checklist editorial;
- API bulk;
- testes unitários;
- preview/contrato.

Eliminar parsing por `startsWith`, `includes` e regex de mensagens humanas.

## 4.3 Contrato de erro das APIs

```ts
type AdminErrorResponse = {
  code:
    | 'validation_error'
    | 'revision_conflict'
    | 'publication_blocked'
    | 'verification_failed'
    | 'forbidden'
    | 'not_found'
    | 'internal_error'
  summary: string
  message: string
  fieldErrors: PublicationIssue[]
  traceId: string
  retryable: boolean
}
```

### Regras

- preservar nested validation errors do Payload;
- mapear `path` para `tab` e `anchor` pelo registry;
- nunca expor stack trace na camada editorial;
- incluir `traceId` para suporte;
- manter status HTTP coerente:
  - 400 request inválida;
  - 401 não autenticado;
  - 403 sem permissão;
  - 404 inexistente;
  - 409 conflito de revisão;
  - 422 bloqueio/validação editorial;
  - 503 probe/integração indisponível quando a operação exige verificação.

## 4.4 Bulk UI

Substituir a mensagem “N itens não foram alterados” por um painel:

```text
3 produtos não foram publicados

Nódulo I
Imagem 2 precisa de texto alternativo.
[Corrigir produto]

Cartografia Verde
A revisão foi alterada em outra sessão.
[Recarregar]

Vaso Horizonte
O site ainda não confirmou a nova revisão.
[Tentar verificar novamente]
```

O painel deve:

- preservar sucessos;
- agrupar por status;
- oferecer ação por item;
- permitir copiar/exportar detalhes;
- permanecer acessível por teclado;
- receber foco somente quando a operação termina com falha ou resultado parcial.

---

# 5. Camada Editorial UX

## 5.1 Decisão

Não criar um terceiro sistema de formulários. Adotar e completar o que já existe:

- `FormSystem.tsx` como shell editorial;
- `Forms.tsx` como biblioteca de campos;
- `registry.ts` como mapa de tabs/anchors;
- serializer de erro no servidor;
- `asyncState.ts` preservando código, issues e retryability.

## 5.2 Correção do `FieldV2`

O `FieldV2` deve aceitar um controle por render prop ou clone seguro:

```ts
type FieldControlProps = {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-errormessage'?: string
  required?: boolean
}

type FieldV2Props = {
  id: string
  label: string
  hint?: string
  error?: string
  suggestion?: string
  required?: boolean
  optional?: boolean
  counter?: React.ReactNode
  action?: React.ReactNode
  children: (controlProps: FieldControlProps) => React.ReactNode
}
```

### Critérios

- `label htmlFor` aponta para o controle real;
- hint e error compõem `aria-describedby` sem sobrescrever IDs externos;
- `aria-invalid` existe apenas quando há erro;
- `aria-errormessage` aponta para erro persistente;
- erro local usa `role="alert"` apenas quando surge após submissão; erros já presentes no carregamento não devem anunciar em massa;
- nenhum placeholder substitui label;
- campos de array recebem IDs estáveis por row ID, não apenas índice quando houver reordenação.

## 5.3 Adoção do `FormSystem`

### Produto

`ProductDraftForm.tsx` deve renderizar:

- `FormShell`;
- cabeçalho com status do rascunho e revisão;
- tabs Essencial, Conteúdo, Mídia, Comercial, Variantes, SEO e Avançado;
- `ErrorSummary` após falha;
- `PublicationChecklist` antes de publicar;
- `ActionBar` persistente com dirty state;
- feedback de integração separado de feedback de save.

### Categoria

`CategoryDetailEditor.tsx` deve renderizar:

- `FormShell`;
- tabs Geral, Mídia & SEO, Produtos relacionados;
- save-and-publish do estado visível;
- `ErrorSummary` focável;
- `ActionBar` com Salvar rascunho e Salvar e publicar;
- aviso de conflito e recuperação.

### Ordem de adoção

1. Produto;
2. Categoria;
3. Home e conteúdo público;
4. Cliente;
5. Venda e Pós-venda;
6. Configurações editoriais.

## 5.4 Hierarquia de ações

| Papel | Altura | Visual | Exemplo |
|---|---:|---|---|
| Primária | 40 px desktop / 44 px mobile | preenchida | Salvar e publicar |
| Secundária | mesma altura | borda/surface | Salvar rascunho |
| Quiet | mesmo alvo | baixa ênfase | Descartar alterações |
| Compacta | 36 px | apenas toolbar densa | Paginação |
| Destrutiva | 40/44 px | semântica + confirmação | Excluir categoria |

Regras:

- uma ação primária por contexto;
- loading preserva largura;
- usar verbo + objeto;
- filtros sempre usam “Aplicar filtros” e “Limpar filtros”;
- nunca reduzir legibilidade para indicar menor importância.

## 5.5 Linguagem editorial

| Termo técnico | Copy editorial |
|---|---|
| Draft oficial do Payload | Rascunho salvo |
| Readiness | Pronto para publicar / Pendências para publicar |
| Publication issues | Pendências para publicar |
| Slug | Endereço da página |
| Preço em centavos | Preço base |
| Taxonomia e sinônimos | Termos de busca |
| Relação derivada | Produtos que usam esta categoria |
| Admin técnico | Configurações avançadas |
| Aplicar recorte | Aplicar filtros |
| E.164 | Formato internacional |
| Snapshot | Versão salva |
| Deco probe | Confirmação do site |

A camada técnica pode manter os termos em logs, ajuda avançada e documentação de suporte.

---

# 6. Direção visual — Premium Tech Quiet

## 6.1 Personalidade

A interface deve parecer uma ferramenta editorial de alto padrão, não um template SaaS.

### Pilares

| Pilar | Expressão visual | Comportamento |
|---|---|---|
| Calma | canvas neutro, linhas finas, sombra discreta | nada se move sem causa |
| Precisão | Inter, alinhamento rigoroso, números tabulares | feedback rápido em controles |
| Profundidade | elevação curta e contextual | somente item acionável recebe lift |
| Continuidade | drawers e inspectors relacionados à origem | sem flash ou salto de contexto |
| Inteligência | estados explicam resultado e próximo passo | sem mensagens genéricas |
| Premium | paleta mineral e geometria controlada | sem glow, bounce ou excesso de cor |

### Teste perceptivo

Ao abrir o CMS, a reação esperada é:

> “Está mais rápido, claro e bem resolvido.”

Não:

> “Colocaram animações.”

## 6.2 Tipografia

Usar **Inter exclusivamente** em toda UI customizada.

| Uso | Tamanho | Peso | Line-height |
|---|---:|---:|---:|
| H1 operacional | 28–32 px | 600–650 | 1.20–1.25 |
| H2 de seção | 15–17 px | 600–650 | 1.35 |
| Título de card/row | 13–15 px | 500–600 | 1.35 |
| Texto de interface | 12–14 px | 400–500 | 1.45 |
| Metadado | 11–12 px | 400–500 | 1.35 |
| Eyebrow | 10–11 px | 600 | 1.2 |

Regras:

- não usar microtexto de 10 px para informação essencial;
- valores financeiros e métricas usam `font-variant-numeric: tabular-nums`;
- uppercase e tracking ampliado apenas em eyebrows;
- evitar bold excessivo como substituto de hierarquia.

## 6.3 Paleta e contraste

```css
:root {
  --esmera-primary: #324f46;
  --esmera-primary-strong: #243f36;
  --esmera-primary-soft: #e8efec;
  --esmera-canvas: #f6f7f6;
  --esmera-surface: #ffffff;
  --esmera-surface-raised: #fbfcfb;
  --esmera-surface-hover: #f1f4f2;
  --esmera-text: #17201c;
  --esmera-text-muted: #65706b;
  --esmera-text-subtle: #5f6a65;
  --esmera-line: #dde3e0;
  --esmera-line-strong: #c8d1cc;
  --esmera-focus: #4d7769;
}
```

`--esmera-text-subtle` deve ser recalibrado para contraste mínimo de 4,5:1 nos fundos em que é usado como texto normal.

Cor nunca é o único sinal de:

- seleção;
- sucesso;
- erro;
- urgência;
- publicação;
- disponibilidade.

## 6.4 Geometria

| Elemento | Radius |
|---|---:|
| inputs e botões | 6–8 px |
| painéis e inspectors | 8 px |
| cards editoriais excepcionais | 8–10 px |
| pills reais | 999 px |
| tabelas e regiões de layout | 0–8 px conforme superfície |

Não envolver toda informação em card. Preferir:

- regiões de layout;
- divisores;
- tabelas;
- whitespace;
- agrupamentos tipográficos.

## 6.5 Escala de espaço

Base de 4 px:

```text
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48
```

Regras:

- gap interno de controle: 8–12 px;
- gap entre campos relacionados: 12–16 px;
- gap entre grupos: 24–32 px;
- padding de painéis: 16–24 px;
- evitar vazios artificiais causados por `max-width` global.

## 6.6 Tokens de movimento e profundidade

```css
:root {
  --esmera-motion-instant: 80ms;
  --esmera-motion-fast: 120ms;
  --esmera-motion-component: 180ms;
  --esmera-motion-panel: 220ms;
  --esmera-motion-navigation: 280ms;
  --esmera-motion-data: 420ms;

  --esmera-ease-standard: cubic-bezier(.2, 0, 0, 1);
  --esmera-ease-enter: cubic-bezier(.16, 1, .3, 1);
  --esmera-ease-exit: cubic-bezier(.4, 0, 1, 1);
  --esmera-ease-emphasized: cubic-bezier(.16, 1, .3, 1);

  --esmera-shadow-min: 0 1px 2px rgba(20, 33, 29, .025);
  --esmera-shadow-interactive:
    0 8px 22px rgba(20, 33, 29, .07),
    0 1px 2px rgba(20, 33, 29, .03);
  --esmera-shadow-floating:
    0 20px 48px rgba(20, 33, 29, .12);

  --esmera-backdrop-strong: rgba(15, 24, 20, .28);
  --esmera-blur-header: 14px;
  --esmera-blur-overlay: 8px;
  --esmera-hover-lift: -1px;
  --esmera-press-scale: .99;
}
```

### Mapeamento

| Evento | Duração | Propriedades |
|---|---:|---|
| mudança de cor simples | 120 ms | color, background, border |
| press | 80 ms | transform |
| card/row interativo | 180 ms | transform, border, shadow contextual |
| menu/tooltip | 120–220 ms | opacity, translate, scale |
| inspector/drawer | 220–280 ms | translate, opacity |
| atualização de gráfico | 220–260 ms | série/opacity |
| entrada inicial de dados | 420 ms uma vez | barras/séries |

Nunca usar `transition: all`.

## 6.7 Gramática de estados

| Estado | Sinal principal | Regra |
|---|---|---|
| Hover | fundo ou borda mais presente | lift apenas se clicável |
| Focus-visible | outline 2 px + ring 3 px | sem deslocamento |
| Pressed | `translateY(1px) scale(.99)` | retorno imediato |
| Selected | primary-soft + barra/ícone/check | não depender só de cor |
| Disabled | surface disabled + contraste preservado | interação removida |
| Loading | spinner e `aria-busy` | sem alterar largura |
| Error | border danger + texto persistente | sem shake |
| Success | toast + marca local curta | sem verde permanente |

## 6.8 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
  }

  .is-interactive-surface,
  .esmera-drawer,
  .esmera-dialog,
  .esmera-tab-panel,
  .esmera-chart-series {
    animation: none !important;
    transform: none !important;
    transition-duration: 0.01ms !important;
  }
}
```

Mudanças de cor e estado podem permanecer instantâneas. Nenhuma função depende da animação.

---

# 7. Shell e navegação

## 7.1 Breakpoints do shell

| Faixa | Navegação | Conteúdo | Interação |
|---|---|---|---|
| ≥1280 px | sidebar fixa 260 px | grids completos | hover, foco, atalhos |
| 1024–1279 px | rail 72 px com peek | grids adaptativos | hover/focus-within, sem reflow |
| 768–1023 px | trigger + drawer | 1–2 colunas por container | touch-first |
| ≤767 px | drawer full-height | rows/cards empilhados | ações 44 px, overlays full-screen |

## 7.2 Rail peek

Na faixa 1024–1279 px:

- repouso: 72 px;
- ícones centralizados;
- labels disponíveis em tooltip;
- `hover` ou `focus-within`: painel expande por sobre o conteúdo até 260 px;
- usar `position`, `z-index`, `clip` e transform/opacity;
- não alterar a largura do grid do workspace;
- delay de intenção: 100–140 ms;
- saída: 120 ms;
- fechar ao sair, perder foco ou pressionar Escape;
- manter item ativo, role e tooltip acessíveis.

### Critério principal

O peek não pode:

- deslocar tabela;
- alterar scroll horizontal;
- causar content jump;
- esconder foco;
- abrir somente com mouse.

## 7.3 Header

- altura e padding estáveis durante scroll;
- blur de 14 px;
- linha inferior neutra;
- sombra mínima apenas quando houver sobreposição real;
- command trigger com estado ativo sem aumentar geometria;
- keycaps consistentes;
- create menu via Base UI;
- avatar/ring sutil;
- sem bell ou notificações fictícias.

## 7.4 Command palette

Preservar funcionalidade atual e refinar:

- abertura 180 ms;
- backdrop mineral 0.28 + blur 8 px;
- resultados selecionados por background, sem shadow em cada item;
- grupos Produto, Cliente, Oportunidade, Venda e Ações;
- loading sem limpar resultados anteriores;
- erro local com retry;
- atalhos não funcionam quando foco está em input/textarea/editable.

---

# 8. Componentes visuais compartilhados

## 8.1 Superfícies

| Nível | Uso | Sombra |
|---|---|---|
| 0 Canvas | fundo do workspace | nenhuma |
| 1 Painel | cards, tabelas, filtros | mínima |
| 2 Interativo | hover, menu, item ativo | interactive somente no item |
| 3 Overlay | dialog, command, drawer modal | floating |

Cards não clicáveis não recebem lift.

## 8.2 Métricas

- gap de 12 px;
- cards ópticos independentes;
- borda mínima;
- ícone em plate 30–32 px;
- delta tipográfico ou pill semântica somente quando houver comparação real;
- valores SSR e finais desde o primeiro paint;
- nenhum count-up substitui o número real;
- hover apenas quando a métrica abre filtro/drill-down.

## 8.3 Tabelas e listas

- row hover não altera altura;
- linha lateral de 2 px opcional para seleção/urgência;
- ações secundárias aparecem em hover e `focus-within` em pointer fine;
- em touch, ação principal permanece visível e demais ficam em overflow menu;
- header sticky usa canvas translúcido e blur de 6 px;
- seleção usa checkbox + primary-soft + selection bar;
- bulk bar entra 8 px verticalmente e permanece enquanto houver seleção;
- sombras/fades de overflow não bloqueiam scrollbar;
- evitar animar `width`, `left`, `padding` e shadow em centenas de rows.

## 8.4 Tabs e filtros

- tabs: cor 120 ms, indicador 180 ms;
- painel: opacity + 3 px em 160–180 ms;
- filtros não alteram geometria do header;
- contagens reservam espaço;
- chips entram/saem sem salto;
- “Limpar filtros” aparece somente com filtro ativo;
- resultados anteriores permanecem durante refetch;
- atualização é anunciada por status polite.

## 8.5 Formulários

- campo em repouso: surface + border strong;
- hover somente em `pointer:fine`;
- foco: border primary + ring 3 px;
- label muda para primary sem deslocar;
- erro persistente, sem shake;
- salvar mantém largura do botão;
- spinner substitui ícone e mantém label “Salvando…”;
- toast não cobre CTA ou ActionBar;
- sticky ActionBar reserva safe area e não oculta o foco.

## 8.6 Menus, popovers e tooltips

| Tipo | Entrada | Saída |
|---|---:|---:|
| Menu | opacity + y4, 180 ms | 120 ms |
| Popover | opacity + scale .985, 200 ms | 120 ms |
| Select | y4, 180 ms | 100 ms |
| Tooltip | opacity + y3, 120 ms | 80 ms |

A animação nunca atrasa:

- autofocus;
- Escape;
- navegação por setas;
- seleção por Enter;
- retorno de foco.

## 8.7 Dialogs, drawers e inspectors

| Componente | Movimento | Backdrop |
|---|---|---|
| Dialog | y8 + scale .985 em 220 ms | mineral .28 + blur 8 |
| Drawer | x18–24 em 240 ms | mesmo backdrop |
| Inspector | x12 em 220 ms | sem backdrop quando integra o grid |
| Mobile sheet | x/y24 em 260 ms | full-height, safe area |

O item de origem permanece visualmente selecionado enquanto o detalhe está aberto.

## 8.8 Feedback assíncrono

| Situação | Resposta |
|---|---|
| carregamento inicial | skeleton com forma do conteúdo final |
| refetch | conteúdo anterior permanece + indicador local |
| save | botão estável + status |
| sucesso | toast + timestamp local |
| erro recuperável | mensagem local + tentar novamente |
| resultado vazio | explicar filtros + limpar |
| integração ausente | estado honesto, sem dado estimado |
| operação longa | progresso real ou etapas |

---

# 9. Especificação por módulo

## 9.1 Dashboard

### Função

Responder:

- o que aconteceu;
- o que exige atenção;
- onde agir agora.

### Estrutura

1. header com saudação, data e `+ Novo`;
2. Produtos ativos;
3. Oportunidades/Leads ativos;
4. Vendas no mês;
5. Pendências;
6. pipeline compacto;
7. tarefas de hoje;
8. catálogo recente;
9. tráfego somente quando integração real existir.

### Visual

- métricas como cards ópticos independentes;
- primeira dobra sem cardização excessiva;
- apenas itens acionáveis recebem hover/lift;
- barras do pipeline podem entrar uma vez em 420 ms;
- cards não entram em cascata longa;
- nenhum `NaN`, placeholder ou dado inventado.

### Aceite

- conteúdo útil no SSR;
- primeira dobra comunica visão executiva e prioridade;
- clique em KPI abre filtro/registro real;
- mobile apresenta lista compacta, não grid espremido.

## 9.2 Produtos

### Lista

- lista como modo padrão;
- grid secundário para revisão visual;
- thumbnail 48–56 px;
- zoom interno máximo 1.015 sem alterar frame;
- status de catálogo, publicação e integração separados;
- filtros na URL;
- bulk bar contextual;
- voltar preserva página, filtros e scroll.

### Editor

Tabs:

1. Essencial;
2. Conteúdo;
3. Mídia;
4. Comercial;
5. Variantes;
6. SEO;
7. Avançado.

### Publicação

- ActionBar persistente;
- autosave serializado;
- revisão inicial obrigatória;
- checklist por seção;
- warnings confirmáveis;
- “Salvar e publicar” usa coordenador;
- status de site mostra revisão e horário;
- erro leva ao campo.

### Mídia

- cards com capa, alt, papel e status;
- erro no item exato;
- upload com progresso;
- drag-over primary-soft;
- reordenação com teclado;
- enquadramento nunca muda por hover.

### Variantes

- builder visual por tamanho/cor/kit;
- códigos gerados automaticamente;
- edição técnica em Avançado;
- erro aponta combinação específica;
- persistência continua no schema atual.

### Bulk

- passa pelo coordenador;
- exibe resultado por item;
- retry seletivo;
- nunca perde os sucessos.

## 9.3 Categorias

### Layout

- desktop: master-detail;
- tablet: lista + drawer;
- mobile: lista → detalhe full-screen.

### Lista

- thumbnail, título, contagem derivada, status, ordem;
- drag handle em hover/focus;
- alternativa “Mover para posição…”;
- selected state clara;
- não usar badge colorida para contagem comum.

### Editor

- Geral;
- Mídia & SEO;
- Produtos relacionados.

### Publicação

- botão publica o estado visível;
- save-and-publish obrigatório;
- `expectedRevision` desde o carregamento;
- conflito 409 recuperável;
- produtos relacionados permanecem query derivada.

## 9.4 Home e conteúdo público

### Modelo mental

Cada seção deve indicar:

- **Padrão do site**: usa fallback construído no Deco;
- **Personalizado**: substitui com conteúdo do CMS;
- **Oculto**: não exibe a seção quando o contrato permitir.

### Interface

Traduzir nomes técnicos:

- Hero → Capa principal;
- Matter → Matéria;
- Signature → Destaques;
- Matter Interlude → Intervalo visual.

### Regras

- conteúdo vazio não é erro quando fallback é permitido;
- mostrar explicitamente “O site usará a versão padrão construída no Deco”;
- carrossel valida quantidade mínima/máxima em tempo real;
- publicação usa revisão canônica e probe;
- preview distingue fallback e personalizado;
- baixa intensidade de motion: foco, tabs, preview e save feedback.

## 9.5 Clientes

### Layout

- master-detail relacional;
- lista densa com divisores;
- inspector/tabs preservam seleção;
- ações rápidas em hover/foco; em touch, overflow.

### Formulários

- telefone com máscara e copy “formato internacional”;
- moeda em R$;
- categorias com combobox multiselect;
- materiais/tags com TokenInput;
- `autocomplete` apropriado;
- erros com alert + resumo.

### Visual

- profundidade baixa;
- foco em identidade, histórico e próxima ação;
- avatar/initial plate discreto;
- sem “insights de IA” genéricos.

## 9.6 Vendas

### Navegação

- Lista e Pipeline são modos da mesma aba;
- filtros e modo ficam na URL;
- inspector não perde contexto.

### Intensidade visual

É um dos módulos com maior uso de microinteração:

- row hover e ações progressivas;
- card de pipeline com border response;
- drop target primary-soft + ring;
- dragging com shadow interactive e scale 1.01;
- drop confirmation 160 ms, sem bounce;
- bulk bar sem cobrir paginação.

### Segurança

- transições críticas aguardam servidor;
- ganho/perda exige diálogo e revisão;
- valores usam números tabulares;
- wizard de venda: itens/valores → entrega → revisão;
- resumo financeiro persistente;
- fechamento acidental não apaga rascunho sem aviso.

## 9.7 Pós-venda

### Função

Central de operações, não dashboard analítico.

### Interface

- fila operacional + inspector;
- KPIs menores funcionam como filtros;
- linha lateral por urgência;
- timeline curta e legível;
- drawer mantém relação com row selecionada;
- copy operacional:
  - Novo follow-up → Agendar acompanhamento;
  - Objetivo → O que precisa ser feito?;
  - Task consultável → tarefa na fila da equipe.

### Touch

- ação principal visível;
- demais no menu;
- nenhum reveal essencial depende de hover.

## 9.8 Relatórios

### Biblioteca

Preservar ECharts. Não importar ApexCharts.

### Visual

- grid y muito claro;
- séries primary, chart-2 e semânticas;
- área 16–4% de opacidade;
- markers em hover;
- tooltip elevado com números tabulares;
- série ativa 100%, demais 35–50%;
- entrada inicial 420 ms uma vez;
- updates 220–260 ms;
- valores disponíveis antes do efeito.

### Acessibilidade

Todo gráfico investigável possui:

- descrição;
- resumo de tendência;
- botão “Ver dados em tabela”;
- controles equivalentes por teclado;
- empty state fora do canvas.

## 9.9 Configurações e Admin técnico

### Configurações editoriais

- linguagem simples;
- canais, navegação, rodapé, URL pública e defaults reais;
- baixa intensidade de motion;
- foco e feedback de salvamento como principal acabamento.

### Admin técnico

- densidade e legibilidade acima de estilo;
- termos técnicos permitidos com documentação contextual;
- motion mínimo;
- não aplicar lift em objetos puramente técnicos;
- manter Collections, Globals, Versions, Jobs e API view acessíveis por role.

---

# 10. Responsividade e modalidade de entrada

## 10.1 Princípios

- responsividade muda comportamento, não apenas largura;
- usar container queries para módulos;
- usar media query de hover para lift/reveals;
- safe areas em toasts, drawers, ActionBar e bulk bar;
- sticky regions reservam espaço;
- nenhuma ação essencial fica fora da tela em 200% de zoom.

## 10.2 Matriz mínima

Validar:

- 1440 × 900;
- 1280 × 800;
- 1024 × 768;
- 768 × 1024;
- 390 × 844;
- 360 × 800.

## 10.3 Reflow

- desktop: tabelas completas e inspectors;
- tablet: tabela reduzida/drawer ou master-detail alternado;
- mobile: listas compactas, sheets e páginas full-screen;
- gráficos simplificam labels e pontos;
- kanban mobile oferece seletor de etapa e lista; drag não é obrigatório.

---

# 11. Acessibilidade

## 11.1 Meta

WCAG 2.2 AA para os processos do portal operacional.

## 11.2 Requisitos

- alvo mínimo de 24 × 24 px; ações primárias 40/44 px;
- focus ring 2–3 px com offset;
- sticky bars não ocultam foco;
- drag possui alternativa;
- dialogs, drawers, menus e selects usam Base UI;
- ações de hover também aparecem por foco;
- erro de submissão usa alert e foco no resumo;
- progresso/sucesso usa status polite;
- cor nunca é único sinal;
- texto subtle ≥ 4,5:1 quando texto normal;
- zoom 200% e 400% sem perda de processo;
- `autocomplete` em dados pessoais;
- gráficos com alternativa tabular.

## 11.3 Foco em erro

Fluxo:

```text
submit -> resposta estruturada -> ErrorSummary recebe foco
-> usuário ativa issue -> tab correta abre
-> campo recebe scroll-margin e foco
-> erro permanece associado ao controle
```

## 11.4 Leitor de tela

Validar no mínimo:

- NVDA + Chrome;
- VoiceOver + Safari;
- Product publish inválido;
- conflito de revisão;
- bulk parcial;
- dialog de warning;
- drawer/inspector;
- atualização de filtros;
- status de verificação do site.

---

# 12. Performance

## 12.1 Metas internas

| Métrica | Meta |
|---|---|
| feedback de clique | <100 ms percebidos |
| route transition quente | <300 ms percebidos |
| query operacional comum | P95 <250 ms em produção saudável |
| relatório agregado | P95 <800 ms antes de otimização adicional |
| animação em listas | somente item ativo usa transform/shadow |
| layout shift | nenhum causado por loading, save ou filtro |

## 12.2 Regras

- animar transform e opacity;
- evitar layout/paint caro em rows;
- ECharts lazy-loaded;
- skeleton corresponde ao layout final;
- resultados anteriores permanecem durante refetch;
- nenhuma dependência visual nova;
- sem WebSocket por padrão;
- sem full-screen spinner em operações comuns;
- SSR entrega valores finais estáveis.

---

# 13. Mapa de alterações por repositório

## 13.1 Backend — `esmeracms`

### Publicação e contrato

| Arquivo/área | Alteração |
|---|---|
| `src/server/publication/coordinator.ts` | estado operacional, verify obrigatório, incompatibilidade, retries e rollback condicional |
| `src/server/publication/revision.ts` | canonical revision, compare-and-swap e helpers públicos |
| `src/server/publication/types.ts` | novos statuses, receipts e verification types |
| `src/server/publication/productAssessment.ts` | consumir issues estruturadas, remover parsing textual |
| `src/server/publication/categoryAssessment.ts` | padronizar o mesmo contrato |
| `src/server/storefront-contract/validate.ts` | alinhar issues e contract version |
| `src/app/(payload)/api/admin-products/route.ts` | save-draft com CAS; bulk via coordinator; verify conectado; erros estruturados |
| `src/app/(payload)/api/admin-categories/route.ts` | save-draft com CAS; save-and-publish do estado visível; verify conectado |
| `src/businessRules/products/readiness.ts` | retornar `PublicationIssue[]` |
| `src/collections/Products.ts` | consumir issues estruturadas e campos internos de publicação |
| `src/collections/Categories.ts` | revisão/status de integração conforme contrato |
| `src/globals/Home.ts` | revisão pública, fallback explícito e status de verificação |
| `src/server/admin/errors/registry.ts` | completar paths/tabs/anchors |
| `src/server/admin/errors/*` | serializer comum e localization mapping |

### UX editorial

| Arquivo/área | Alteração |
|---|---|
| `src/admin/design-system/FormSystem.tsx` | estabilizar API e documentar adoção; não reescrever |
| `src/admin/design-system/Forms.tsx` | corrigir FieldV2 e ARIA real |
| `src/admin/design-system/Primitives.tsx` | distinguir alert de status |
| `src/admin/state/asyncState.ts` | preservar code, issues, traceId e retryable |
| `src/admin/modules/products/ProductDraftForm.tsx` | fila serial, revisão inicial, FormShell, ErrorSummary, Checklist e ActionBar |
| `src/admin/modules/products/ProductsWorkspaceClient.tsx` | detalhar bulk errors e retries |
| `src/admin/modules/products/ProductDocumentView.tsx` | fornecer revisão/updatedAt iniciais e status operacional |
| `src/admin/modules/categories/CategoryDetailEditor.tsx` | save-and-publish, dirty state e FormSystem |

### Visual

| Arquivo/área | Alteração |
|---|---|
| `src/admin/design-system/tokens.scss` | tokens de motion, depth, blur, contraste e radius |
| `src/admin/design-system/design-system.scss` | estados universais, cards, rows, forms, popups |
| `src/admin/design-system/advanced-interactions.scss` | harmonizar View Transitions com nova escala |
| `src/admin/design-system/reconciled-interactions.scss` | preservar rollback/selection e remover duplicidade |
| `src/admin/design-system/states.scss` | loading/saved/error |
| `src/admin/components/nav.scss` | rail peek e responsividade |
| `src/admin/shell/shell.scss` | header, command, menu e overlays |
| `src/admin/modules/*/*.scss` | ajustes contextuais somente após primitives |

## 13.2 Frontend — `testeesmera`

| Arquivo/área | Alteração |
|---|---|
| `routes/api/esmera-renderability.ts` | comparar expected/observed revision e retornar status tipado |
| `frontend/lib/payload/contract/validate.ts` ou caminho equivalente | manter validação de forma e incluir contract metadata |
| loaders/clients Payload | expor `publicationRevision` e `contractVersion` |
| fallback da Home | diferenciar padrão, personalizado e inválido |
| testes do contrato | fixtures de canonicalização e revision mismatch |
| observabilidade | log estruturado com traceId sem expor token |

## 13.3 Arquivos protegidos em PRs exclusivamente visuais

Em PR que declara escopo visual, não alterar:

- collections;
- globals;
- business rules;
- server/domain;
- migrations;
- payload config;
- contratos de API;
- integração Deco/Payload.

Essa proteção não se aplica aos PRs funcionais P0 explicitamente definidos neste plano.

---

# 14. Estratégia de migração

## 14.1 Issues estruturadas

1. introduzir `PublicationIssue` mantendo adapter temporário para strings;
2. converter `getProductReadiness` para issues estruturadas;
3. atualizar assessment e hook;
4. atualizar testes;
5. remover parser textual;
6. manter copy localizada fora da lógica de decisão.

## 14.2 Revisão pública

1. adicionar campos internos opcionais;
2. gerar revisão em novos saves/publishes;
3. executar backfill idempotente para publicados atuais;
4. Deco aceita ausência temporária como `legacy_revision_missing`;
5. após rollout dos dois repositórios, tornar revisão obrigatória;
6. remover modo legado.

## 14.3 Compatibilidade de deploy

Ordem segura:

1. backend começa a emitir novos campos sem exigir probe novo;
2. frontend aprende a ler e comparar revisão;
3. backend conecta verify e novos statuses;
4. UI passa a exibir estados;
5. modo legado é removido.

Nunca fazer deploy que exige um campo ainda não emitido pelo outro repositório.

## 14.4 Rollback

Cada PR deve documentar:

- flag ou caminho para desativar verify;
- compatibilidade de schema reversa;
- rollback de migration;
- preservação de versões publicadas;
- como reexecutar receipts pendentes;
- como restaurar comportamento visual sem remover correções funcionais.

---

# 15. Plano de implementação por fases

## Fase 0 — Baseline e contratos

### Entregas

- registrar commits-base dos dois repositórios;
- adicionar este documento a `docs/`;
- criar tipos compartilhados de issue/status/verification;
- criar fixtures de canonicalização;
- escrever testes que falham para os bugs confirmados;
- tirar screenshots baseline dos viewports obrigatórios.

### Aceite

- nenhum código de produção alterado sem teste de regressão correspondente;
- política de status codificada em testes.

## Fase 1 — Concorrência e save confiável

### Entregas

- revisão inicial no ProductDocumentView e Category editor;
- CAS em `save-draft`;
- fila serial de autosave;
- publish aguarda flush;
- 409 com recuperação;
- testes de duas abas e save atrasado.

### Aceite

- nenhuma publicação usa estado anterior ao visível;
- nenhum autosave antigo sobrescreve publish.

## Fase 2 — Coordenador único

### Entregas

- bulk usa coordenador;
- Category/Products usam o mesmo pipeline;
- verify obrigatório para entidades públicas;
- statuses corrigidos;
- warnings e confirmation token por revisão;
- receipts.

### Aceite

- busca estática não encontra publish direto fora de adapters autorizados;
- E2E cobre caminho individual e bulk coordenados.

## Fase 3 — Probe e revisão exata

### Entregas

- `publicationRevision` e contract version;
- probe compara expected/observed;
- retries de propagação;
- incompatibilidade e rollback condicional;
- recheck assíncrono de unverified.

### Aceite

- revisão antiga nunca é reportada como revisão nova;
- incompatible nunca retorna `published`.

## Fase 4 — Erros e readiness

### Entregas

- issues estruturadas na origem;
- serializer comum;
- bulk UI detalhada;
- registry completo;
- error summary por aba/campo.

### Aceite

- todo blocker possui code, path, tab, label, message e action;
- nenhuma lógica depende da copy da mensagem.

## Fase 5 — Editorial UX

### Entregas

- corrigir FieldV2;
- integrar FormSystem em Produto;
- integrar FormSystem em Categoria;
- ActionBar/dirty state;
- checklist e status do site;
- copy deck inicial.

### Aceite

- erro leva ao campo correto;
- leitor de tela recebe associação;
- Produto e Categoria usam o mesmo modelo de ação.

## Fase 6 — Fundação visual

### Entregas

- tokens de motion/depth/blur;
- contraste subtle;
- estados universais;
- async buttons;
- popup/overlay motion;
- reduced motion;
- testes de primitives.

### Aceite

- nenhuma dependência nova;
- nenhum `transition: all` novo;
- componentes não clicáveis não recebem lift.

## Fase 7 — Shell

### Entregas

- rail peek;
- header refinado;
- command/create menu;
- mobile drawer;
- safe areas.

### Aceite

- zero reflow em 1024, 1180 e 1279 px;
- teclado produz o mesmo peek;
- foco e Escape preservados.

## Fase 8 — Prova de linguagem

Aplicar primeiro em:

1. Dashboard;
2. Produtos;
3. Vendas.

Esses módulos representam:

- primeira impressão;
- edição/publicação crítica;
- operação intensiva.

### Aceite

- vídeo curto de interação;
- screenshots em todos os viewports;
- revisão humana e baseline automatizado;
- percepção “mais resolvido”, não “mais animado”.

## Fase 9 — Propagação por módulo

Ordem:

1. Categorias;
2. Home/Site;
3. Clientes;
4. Pós-venda;
5. Relatórios;
6. Configurações;
7. Admin técnico.

## Fase 10 — Hardening e release

- E2E completo;
- Axe por processo;
- keyboard-only;
- 200%/400%;
- NVDA/VoiceOver;
- visual regression;
- performance profiling;
- teste de migration/rollback;
- rollout gradual.

---

# 16. Sequência recomendada de pull requests

| PR | Escopo | Dependência |
|---|---|---|
| PR-01 | tipos, fixtures e testes vermelhos | nenhuma |
| PR-02 | revisão inicial + CAS + fila de autosave | PR-01 |
| PR-03 | coordenador único + bulk | PR-02 |
| PR-04 | revision pública + probe exato | PR-03 |
| PR-05 | statuses, retry e rollback condicional | PR-04 |
| PR-06 | issues estruturadas + serializer | PR-01 |
| PR-07 | bulk UI detalhada | PR-06 |
| PR-08 | FieldV2 corrigido + FormSystem em Produto | PR-06 |
| PR-09 | FormSystem em Categoria/Home | PR-08 |
| PR-10 | tokens e primitives Premium Tech Quiet | independente após baseline |
| PR-11 | shell/rail/header | PR-10 |
| PR-12 | Dashboard + Produtos + Vendas visual | PR-10/11 e P0 estabilizado |
| PR-13 | demais módulos | PR-12 |
| PR-14 | hardening, gates e rollout | todos |

## 16.1 Entregas pequenas permitidas antes do P0 completo

Duas entregas isoladas podem entrar cedo, desde que não sejam apresentadas como conclusão do P0:

1. mostrar `errors[]` por item no bulk de Produtos;
2. adotar `ErrorSummary` e `ActionBar` no ProductDraftForm.

A segunda exige cuidado: o resumo e a barra podem ser integrados antes, mas a associação completa campo–erro só é considerada concluída após a correção do `FieldV2` e do serializer.

---

# 17. Matriz de testes obrigatória

## 17.1 Unitários

| ID | Cenário |
|---|---|
| PUB-U01 | incompatible não resulta em published |
| PUB-U02 | not_run em entidade pública falha |
| PUB-U03 | unavailable resulta em unverified |
| PUB-U04 | revision mismatch executa retries |
| PUB-U05 | rollback só ocorre com revisão ainda idêntica |
| PUB-U06 | warning token expira quando revisão muda |
| REV-U01 | canonicalização ignora ordem de propriedades |
| REV-U02 | mudança pública altera hash |
| REV-U03 | mudança administrativa não altera hash |
| ERR-U01 | readiness retorna path/tab estáveis |
| ERR-U02 | copy alterada não quebra código/path |
| A11Y-U01 | FieldV2 compõe describedby corretamente |

## 17.2 Integração Payload

| ID | Cenário |
|---|---|
| PUB-I01 | save-draft rejeita revisão antiga |
| PUB-I02 | save-and-publish publica snapshot salvo |
| PUB-I03 | bulk parcial preserva sucessos |
| PUB-I04 | bulk usa coordinator para cada item |
| PUB-I05 | mídia privada bloqueia publicação |
| PUB-I06 | category dirty publica valor visível |
| PUB-I07 | receipt registra actor e revisões |
| MIG-I01 | backfill de revision é idempotente |
| AUTH-I01 | role sem permissão não publica por rota direta |

## 17.3 E2E Playwright

### Produtos

- criar rascunho incompleto;
- tentar publicar;
- resumo recebe foco;
- abrir aba pelo erro;
- corrigir campo;
- salvar e publicar;
- probe confirma revisão exata;
- “Ver no site” abre conteúdo esperado.

### Autosave

- simular 422/500;
- confirmar que publish não é chamado;
- simular save lento e clicar publicar;
- confirmar ordem serial;
- abrir duas sessões e gerar 409.

### Bulk

- lote com válido, blocker, conflict e unavailable;
- exibir cada resultado;
- retry apenas dos retryable;
- sucessos não voltam à seleção.

### Categorias

- editar título sem salvar manualmente;
- clicar Salvar e publicar;
- confirmar valor exato no documento e site.

### Storefront

- compatible;
- incompatible;
- revision mismatch transitório;
- revision mismatch persistente;
- timeout;
- token inválido;
- contract version não suportada;
- fallback de Home.

### Acessibilidade

- teclado integral;
- erro entre abas;
- dialog aberto;
- drawer aberto;
- mobile nav;
- 200% e 400%;
- reduced motion;
- touch sem hover.

## 17.4 Axe

Executar em:

- Dashboard;
- Produtos lista;
- Produto válido;
- Produto inválido;
- Categoria;
- Cliente;
- Vendas lista/pipeline;
- Pós-venda;
- Relatórios;
- Configurações;
- command palette aberta;
- dialog e drawer abertos;
- ErrorSummary presente;
- bulk result parcial.

O gate deve avaliar toda violação nova. Exceções precisam de justificativa registrada; não filtrar apenas por gravidade sem revisão.

## 17.5 Visual regression

Baselines por viewport e estado:

- default;
- hover/focus;
- selected;
- dirty;
- saving;
- error;
- drawer aberto;
- rail peek;
- reduced motion;
- empty/loading.

---

# 18. Gates de release

Executar no backend:

```bash
pnpm generate:types
pnpm generate:importmap
pnpm typecheck
pnpm lint
pnpm test:int
pnpm test:e2e
pnpm build
pnpm validate
```

Executar no frontend Deco conforme scripts atuais do repositório:

```bash
deno task gen
deno lint
deno check dev.ts main.ts
deno test -A
deno task validate
deno task build
```

## Gate funcional

- nenhum publish direto não autorizado;
- E2E individual e bulk passam pelo coordenador;
- revision mismatch não é success;
- conflito não perde dados;
- fallback continua funcional.

## Gate visual

- Inter exclusivamente;
- radius e sombras dentro dos tokens;
- rail sem reflow;
- nenhum lift em item não clicável;
- sem dependência visual nova;
- screenshots aprovados.

## Gate acessível

- sem regressão Axe;
- teclado completo;
- foco não obscurecido;
- reduced motion;
- 200%/400%;
- leitor de tela nos fluxos críticos.

## Gate operacional

- receipts e traceId disponíveis;
- runbook de probe indisponível;
- migration e rollback testados;
- logs não expõem tokens ou dados pessoais desnecessários.

---

# 19. Critérios globais de aceite

A implementação só pode ser considerada completa quando:

1. **Estado visível = estado publicado.** Nenhuma ação publica a versão anterior ao formulário.
2. **Um coordenador.** Individual, Categoria e bulk usam a mesma política.
3. **Concorrência segura.** Revisões antigas recebem 409; nenhuma escrita silenciosa.
4. **Revisão exata.** O probe compara expected e observed.
5. **Sem sucesso falso.** `incompatible` e `not_run` não retornam `published`.
6. **Erro acionável.** Todo blocker informa registro, campo, aba, motivo e correção.
7. **Readiness tipada.** Nenhuma decisão depende de parsing de copy.
8. **FormSystem em produção.** Produto e Categoria usam resumo, checklist e ActionBar.
9. **FieldV2 real.** Labels, hints e erros estão programaticamente ligados.
10. **Fallback explícito.** Home informa quando usa padrão Deco.
11. **Visual sistemático.** Tokens e estados são compartilhados, não exceções locais.
12. **Rail estável.** Peek não desloca workspace.
13. **Touch completo.** Nenhuma ação essencial depende de hover.
14. **Reduced motion.** Toda função permanece utilizável sem movimento.
15. **Dados honestos.** Sem placeholder, NaN, KPI inventado ou gráfico decorativo.
16. **Contexto preservado.** Filtros, seleção e scroll sobrevivem a inspector/edição.
17. **Testes de processo.** A suíte cobre preencher, errar, corrigir, publicar e confirmar no site.
18. **Rollout reversível.** Migrations, flags e rollback estão documentados.

---

# 20. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| conectar probe antes da política | implementar statuses e testes primeiro |
| rollback apagar mudança concorrente | rollback condicional por revisão exata |
| hash divergir entre repos | fixtures compartilhadas e canonicalização versionada |
| migração quebrar documentos antigos | campos opcionais + backfill + dual-read |
| FormSystem gerar nova inconsistência | adotar API existente e migrar módulo por módulo |
| FieldV2 parecer pronto sem ARIA real | teste unitário no DOM e render prop obrigatório |
| visual causar jank | transform/opacity e orçamento de movimento |
| rail causar reflow | overlay sobre grid + testes em 1024/1180/1279 |
| excesso de hover | media query pointer fine + focus/touch equivalentes |
| PR visual alterar domínio | mapa de arquivos protegidos e review checklist |
| E2E continuar validando caminho fraco | substituir teste bulk direto por coordinator + UI |
| status unverified ficar esquecido | recheck agendado, indicador e métrica operacional |

---

# 21. Definition of Done por pull request

Todo PR deve incluir:

- objetivo e não objetivos;
- arquivos alterados;
- contrato antes/depois;
- testes adicionados;
- evidência visual quando aplicável;
- acessibilidade considerada;
- risco;
- rollback;
- resultado dos comandos de validação;
- nenhuma afirmação de sucesso sem log de execução.

Para PR visual, incluir:

- screenshots dos seis viewports;
- estado hover/focus/touch;
- reduced motion;
- comparação de layout shift;
- confirmação de que não houve mudança de regra/schema/API.

Para PR de publicação, incluir:

- diagrama do caminho;
- status retornados;
- revisão expected/saved/published/observed;
- cenário de conflito;
- cenário de probe indisponível;
- cenário de incompatibilidade;
- prova de que bulk usa o coordenador.

---

# 22. Resultado final esperado

Ao concluir este plano, uma pessoa não técnica deve conseguir:

1. criar um rascunho com o mínimo necessário;
2. entender o que ainda falta;
3. navegar de cada erro ao campo correto;
4. salvar sem sobrescrever alterações de outra sessão;
5. publicar exatamente a versão visível;
6. compreender warnings antes de confirmar;
7. saber se o conteúdo está visível no site;
8. distinguir atraso de propagação, indisponibilidade e incompatibilidade;
9. recuperar-se de falhas sem perder trabalho;
10. operar o CMS em desktop, tablet, mobile, teclado e leitor de tela.

Visualmente, o sistema deve transmitir:

- precisão mineral;
- silêncio visual;
- resposta imediata;
- profundidade curta;
- continuidade entre lista e detalhe;
- tecnologia perceptível pela qualidade da interação, não por decoração.

O CMS Esméra não deve parecer um template adaptado. Deve parecer um produto operacional próprio, maduro e confiável.

---

# 23. Documentos-base e evidências

## Documentos-base

- `Plano_Mestre_Tecnico_Esmera_CMS_2026.pdf`
- `Auditoria_Acessibilidade_Usabilidade_CMS_Esmera.pdf`
- `Plano_Evolucao_Visual_Interativa_CMS_Esmera.pdf`

## Evidências principais no backend

- `src/server/publication/coordinator.ts`
- `src/server/publication/revision.ts`
- `src/app/(payload)/api/admin-products/route.ts`
- `src/app/(payload)/api/admin-categories/route.ts`
- `src/businessRules/products/readiness.ts`
- `src/server/publication/productAssessment.ts`
- `src/collections/Products.ts`
- `src/server/storefront-contract/validate.ts`
- `src/admin/design-system/FormSystem.tsx`
- `src/admin/design-system/Forms.tsx`
- `src/admin/design-system/Primitives.tsx`
- `src/admin/modules/products/ProductDraftForm.tsx`
- `src/admin/modules/products/ProductsWorkspaceClient.tsx`
- `src/admin/modules/categories/CategoryDetailEditor.tsx`
- `tests/e2e/hardening.e2e.spec.ts`
- `tests/e2e/stage20-product-publish.e2e.spec.ts`

## Evidências principais no frontend

- `routes/api/esmera-renderability.ts`
- `frontend/lib/payload/contract/validate.ts` ou caminho equivalente no commit-base
- loaders e adapters Payload usados pela Home e pelos produtos

---

**Fim do plano — versão 1.0**
