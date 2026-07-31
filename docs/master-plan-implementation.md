# Implementação do Plano Mestre — CMS Esméra

Este documento registra a execução incremental do Plano Mestre de Reconstrução do CMS Esméra. O plano mestre permanece a única fonte de verdade para arquitetura, UX, visual, integridade, responsividade e critérios de aceite.

## Regras fixas

- Payload CMS e PostgreSQL continuam como fonte única de verdade.
- O portal operacional organiza e acelera o trabalho.
- O Admin nativo continua responsável por CRUD, drafts, versions, permissões e publicação.
- Não criar uma segunda flag de publicação.
- Não exibir métricas demonstrativas ou estados de infraestrutura sem fonte verificável.
- Inter é a única família tipográfica do CMS.
- Mudanças de schema e integridade precedem o polimento visual.

## Estado da execução

### Fase 00 — Baseline e proteção

- [x] Branch de implementação isolada.
- [x] Registro de execução criado.
- [ ] Executar baseline completo de typecheck, lint, integração, E2E e build em ambiente com dependências e banco configurados.
- [ ] Capturar regressão visual dos viewports definidos no plano.

### Fase 01 — Integridade P0

- [x] Removido fallback privilegiado de `roleOf()`.
- [x] Removida promoção automática de usuário legado sem papel para administrador durante update.
- [x] Primeiro usuário continua recebendo papel `admin` no bootstrap.
- [x] Novos usuários sem papel explícito recebem fallback seguro `editor` na criação.
- [ ] Criar migration auditável para usuários existentes com `role IS NULL`.
- [ ] Automatizar snapshots de itens de venda.
- [ ] Calcular/validar subtotal, desconto, frete e total de vendas.
- [ ] Migrar owner/assignee de texto para relationships com Users.
- [ ] Separar readiness de draft e validação de publicação.
- [ ] Remover limites amplos usados como paginação operacional.

### Fase 02 — Design foundation

- [x] Criados tokens globais do Design System Esméra.
- [x] Aplicada família Inter ao shell e às superfícies nativas.
- [x] Criada camada controlada de overrides do Payload.
- [x] Padronizados canvas, superfícies, texto, linhas, estados, espaçamento, radius, sombra, motion e foco.
- [x] Sidebar alinhada aos tokens, sem sombra decorativa no estado ativo.
- [x] Respeito global a `prefers-reduced-motion`.
- [ ] Migrar as custom views antigas de Manrope/Hanken para Inter.
- [ ] Reduzir radius e sombras dos cards operacionais.
- [ ] Consolidar componentes compartilhados em `admin/components`.

### Próximas fases

1. Shell responsivo com sidebar expandida, rail e drawer.
2. Dashboard por papel com services de consulta.
3. Produtos e Categorias em master-detail.
4. Conteúdo como central editorial de saúde e acesso.
5. Clientes e Vendas em workspaces operacionais.
6. Pipeline acessível e Pós-venda.
7. Relatórios somente com dados rastreáveis.
8. Responsividade, acessibilidade, performance e QA final.

## Política de entrega

Cada etapa deve:

1. manter o Payload nativo como autoridade onde ele já resolve a função;
2. incluir migration quando houver alteração de dados;
3. incluir testes compatíveis com o risco alterado;
4. evitar regras de negócio espalhadas em JSX;
5. preservar deep-links e estados em URL nas views operacionais;
6. documentar qualquer desvio necessário do plano mestre.
