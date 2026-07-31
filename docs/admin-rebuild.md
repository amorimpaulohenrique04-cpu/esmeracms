# Esmera CMS — Admin Operational Rebuild

## Source of truth

This reconstruction follows the **Plano Mestre Tecnico Esmera CMS 2026 v2.0 (31 Jul 2026)**.

- Repository: `amorimpaulohenrique04-cpu/esmeracms`
- Audited/main baseline commit: `8db4119d392fc4a37f0c6c691b44ebaa334a5a9f`
- Reconstruction branch: `feat/admin-operational-rebuild`
- Payload remains the application core and PostgreSQL remains the transactional source of truth.
- The operational portal must never become a second schema or second data source.
- Domain migration and broad UI reconstruction remain incremental and independently testable.

## Release gate

```bash
pnpm install --frozen-lockfile
pnpm validate:release
```

The release gate includes Payload type/import-map generation, TypeScript, ESLint with zero warnings, integration tests, production build and Playwright E2E.

---

## Stage 0 — Security and baseline

Stage 0 established the reproducible baseline before structural reconstruction.

### Runtime baseline

- Node engine: `>=20.9.0`
- Local recommended Node LTS: Node 24 (`.nvmrc`)
- Next.js / eslint-config-next: `16.2.11`
- Payload packages: `3.86.0`
- React / React DOM: `19.2.6`

### Original visual baseline

Viewports:

- `1440x900`
- `1280x800`
- `1024x768`
- `768x1024`
- `390x844`

Original routes captured before reconstruction included Dashboard, Content, Products, Categories, Customers, Sales, Pipeline, After-sales, Reports, Settings and Technical Admin.

### Verified execution

- `Stage 0 - Security and Baseline` run `30655973657`: **success**
- `Validate Esmera CMS` run `30655973708`: **success**
- Artifact: `admin-baseline-30655973657`
- Original baseline: **55 PNG screenshots**

### Acceptance

- [x] Audited baseline commit confirmed.
- [x] Reconstruction branch isolated from `main`.
- [x] Next.js security patch applied.
- [x] Node engine corrected and local LTS standardized.
- [x] E2E added to the release gate.
- [x] Lockfile normalized.
- [x] Multi-viewport visual baseline automated.
- [x] Release gate green.

**Stage 0 complete.**

---

## Stage 1 — Architectural foundation

Stage 1 created explicit feature and server boundaries without introducing a second data model.

### Infrastructure

Runtime dependencies:

- `@tanstack/react-query`
- `@tanstack/react-table`
- `@base-ui/react`
- `@dnd-kit/react`
- `@dnd-kit/helpers`
- `echarts`

Development dependency:

- `@axe-core/playwright`

TanStack Virtual remains intentionally absent until measured volume justifies it.

### Feature boundaries

```text
src/admin/modules/
  dashboard/
  products/
  categories/
  content/
  customers/
  sales/
  after-sales/
  reports/
  settings/
  technical/
```

The old monolithic `BusinessViews.tsx`, `SiteViews.tsx` and legacy Dashboard implementation were removed. Authenticated Payload reads were moved to:

```text
src/server/domain/shared/payload.ts
```

This boundary preserves Payload Access Control, current user and request context.

### Verified execution

- Final Stage 1 code head: `2f110e79f565a4446977606a354bc67edb500716`
- `Validate Esmera CMS` run `30657263318`: **success**
- `Stage 0 - Security and Baseline` compatibility run `30657263052`: **success**

### Acceptance

- [x] Approved infrastructure installed and lockfile refreshed.
- [x] Generic Payload reads extracted from UI helpers.
- [x] Operational modules split by feature.
- [x] Payload config references feature entrypoints directly.
- [x] Monolithic view files removed.
- [x] Shell and Design System boundaries created.
- [x] `pnpm validate:release` green.

**Stage 1 complete.**

---

## Stage 2 — Esmera Design System

Stage 2 established the proprietary visual and interaction foundation used by subsequent workspaces.

### Tokens

`src/admin/design-system/tokens.scss` centralizes:

- Inter as the sole UI font family;
- mineral green, neutral backgrounds, surfaces, text and semantic states;
- spacing scale `4/8/12/16/20/24/32/40`;
- control/surface radius;
- minimal shadow tokens;
- 120–160ms motion tokens;
- focus ring and z-index layers;
- operational typography and tabular numbers.

### Primitives

The Design System exposes reusable primitives for buttons, icon buttons, fields, search, select/combobox, menu, tabs, segmented controls, dialog, drawer, popover, tooltip, toast, status, empty/error states, skeletons, data tables, filters, inspectors and bulk action bars.

Base UI is used as the headless accessibility layer where appropriate; Esmera owns the visual language.

### Visual direction enforced

- reduced decorative pastel surfaces;
- reduced card-for-everything treatment;
- minimal shadows;
- tighter typography and metadata hierarchy;
- semantic status color only when it communicates state;
- no fake insights, traffic metrics or decorative percentages.

### Verified execution

- Final Stage 2 head: `b7d248603b71511d8fcecf2a32c99e45b8b6fc35`
- `Validate Esmera CMS` run `30658143427`: **success**
- visual baseline run `30658143445`: **success**

### Acceptance

- [x] Tokens centralized.
- [x] Core Esmera primitives implemented.
- [x] Focus/reduced-motion foundations included.
- [x] Existing operational screens migrated to shared visual tokens.
- [x] Visual baseline generated across target viewports.
- [x] Release gate green.

**Stage 2 complete.**

---

## Stage 3 — Global App Shell

Stage 3 replaces the generic operational chrome with the final Esmera information architecture while preserving Payload as the authenticated application core.

### Final operational navigation

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

Changes:

- `Conteúdo do site` is no longer an operational navigation surface.
- `Pipeline` is no longer a global navigation item.
- technical Collections/Globals remain reachable through Admin técnico.
- links are role-aware in the client, while real authorization remains enforced by Payload Access Control.

The legacy Content module remains in source temporarily for later cleanup, but it is no longer registered as an operational custom view.

### Global header

`src/admin/shell/AppHeader.tsx` provides:

- global authenticated search trigger;
- `Cmd/Ctrl + K` and `/` keyboard entry points;
- role-aware global `+ Novo`;
- current user/account access;
- mobile navigation trigger.

No notification badge is rendered because no real notification source exists yet.

### Command palette

The command palette is backed by authenticated server search at:

```text
/api/admin-search
```

The endpoint:

- authenticates through Payload;
- uses Payload Local API queries with `overrideAccess: false`;
- returns only role-accessible entities;
- limits selected fields;
- searches products for editorial roles and customers/leads/sales for commercial roles;
- exposes role-aware navigation/create actions;
- supports keyboard navigation and Enter/Escape interaction.

The commercial search still names the existing Lead model because the Opportunities domain migration belongs to the later commercial-domain stage. Stage 3 does not invent a pre-migration Opportunity entity.

### Vendas + Pipeline

There is now one operational Sales workspace:

```text
/admin/sales?view=list
/admin/sales?view=pipeline
```

`/admin/pipeline` is retained only as a temporary compatibility redirect to `/admin/sales?view=pipeline`.

The Pipeline view currently reads the existing `leads.stage` model and only presents active stages:

- Novo
- Curadoria
- Proposta
- Negociação

Won/Lost are not treated as ordinary operational columns. The later Opportunities migration will replace this transitional data source.

### Responsive shell

- `>=1280px`: full 236px sidebar.
- `1024–1279px`: compact 72px navigation rail.
- `<=1023px`: fixed sidebar is removed and navigation moves to the Esmera Drawer.
- mobile header keeps menu, search, create and account controls without the former sidebar sliver/overlap.

### Test coverage added

Playwright now verifies:

- final operational navigation contains no Content/Pipeline items;
- global AppHeader is visible;
- command palette opens and returns authenticated actions;
- legacy Pipeline route redirects into Sales;
- `1024px` uses the compact rail;
- mobile hides the fixed sidebar, opens the Drawer and has no horizontal document overflow;
- technical Payload screens retain the Esmera global header.

### Visual baseline after Stage 3

Current capture matrix:

- 10 operational routes/views;
- 5 target viewports;
- **50 PNG screenshots**.

The old standalone Content and Pipeline screenshots were intentionally removed from the current operational baseline. Sales List and Sales Pipeline are captured as separate views of the same route.

### Verified execution

- Final Stage 3 code/test head: `d498e49822439c548d9deefd506c87e937455db8`
- `Validate Esmera CMS` run `30665399700`: **success**
- `Stage 0 - Security and Baseline` / visual capture run `30665399695`: **success**
- Visual artifact: `admin-baseline-30665399695`
- Artifact ID: `8806829849`
- Artifact digest: `sha256:c9e7c9480b5c14ae9dfe092aa91fe14a1c471f6eb9061dcb1472291ead079b95`

Visual inspection confirmed:

- full sidebar at desktop;
- compact rail at exactly `1024px`;
- mobile content no longer renders behind a leftover sidebar;
- mobile global header remains usable at `390x844`.

### Stage 3 acceptance checklist

- [x] Final navigation information architecture implemented.
- [x] Content removed from operational custom views/navigation.
- [x] Pipeline removed from global navigation.
- [x] Sales list and Pipeline unified under `/admin/sales`.
- [x] Temporary `/admin/pipeline` redirect retained.
- [x] Global AppHeader implemented.
- [x] Command palette implemented with authenticated server search.
- [x] `Cmd/Ctrl + K`, `/`, arrows, Enter and Escape interactions implemented where applicable.
- [x] Global `+ Novo` respects the current role.
- [x] No fake notification state introduced.
- [x] Full desktop sidebar implemented.
- [x] 1024–1279 compact rail implemented.
- [x] <=1023 mobile Drawer implemented.
- [x] Mobile sidebar overlap regression removed.
- [x] Stage 3 E2E tests green.
- [x] Stage 3 multi-viewport visual baseline generated and inspected.

**Stage 3 is complete.**

---

## Next stage

The next implementation milestone is **Stage 4 — structural responsiveness/workspace behavior**, followed by the feature workspaces in dependency order. Domain migrations such as `Opportunities` remain deferred to their explicit commercial-domain stage and must not be pulled forward into shell work.
