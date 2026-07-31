# Admin shell

The Stage 3 operational shell is implemented here.

Responsibilities:

- global application header;
- role-aware operational navigation;
- compact desktop/tablet rail behavior;
- mobile navigation drawer;
- command palette and keyboard entry points;
- global `+ Novo` orchestration;
- shared shell icons and navigation metadata.

Rules:

- shell code does not own business data or domain rules;
- authorization remains enforced by Payload Access Control and authenticated server queries;
- shell components orchestrate navigation and client interaction only;
- command search uses the authenticated Payload server boundary and never exposes records outside the current role;
- feature workspaces remain under `src/admin/modules/*`;
- the shell must not invent operational notifications, metrics or entities that are not backed by real data.

Current information architecture:

```text
Dashboard
Produtos
Categorias
Clientes
Vendas
Pós-venda
Relatórios
Configurações
────────────
Admin técnico
Usuários [admin]
```

`Pipeline` is not a global navigation item. During the transitional commercial model it is exposed as `Vendas?view=pipeline`, while `/admin/pipeline` exists only as a temporary compatibility redirect.
