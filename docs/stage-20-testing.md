# Etapa 20 — Testes obrigatórios

## Objetivo

Transformar as regras comerciais e os fluxos críticos do Esméra CMS em contratos executáveis. Nenhuma aceitação depende apenas de revisão manual ou de uma captura visual.

## Camadas

### Unitários — Vitest

A suíte `tests/unit/stage20-domain.unit.spec.ts` cobre:

- readiness de Product;
- transições válidas e inválidas de Opportunity;
- cálculo monetário exclusivamente em centavos inteiros;
- normalização de telefone;
- normalização de e-mail;
- detecção determinística de duplicidade de Customer;
- métricas sem `NaN`, `Infinity` ou zero fictício;
- ranking comercial estável;
- códigos compartilhados de erro.

A suíte `tests/unit/stage20-matrix.unit.spec.ts` lê `tests/stage20-matrix.json` e reprova quando um fluxo obrigatório perde seu arquivo ou sua evidência executável.

### Integração — Payload/Postgres

As suítes existentes permanecem obrigatórias no mesmo comando `pnpm test:int`:

- Access e API do Payload;
- Hooks e Collections;
- Jobs Queue;
- Reporting Service e drilldowns;
- Opportunity → Sale;
- Sale → AfterSale;
- Tasks, Shipments e Occurrences;
- Dashboard, performance e privacidade.

### E2E — Playwright

A matriz obrigatória cobre:

- login e navegação por papel;
- Product do draft à publicação e busca;
- Categoria por drag e por seletor acessível;
- Customer com normalização e duplicidade;
- Opportunity criada, movida, ganha e vinculada à Sale;
- entrega da Sale, Shipment e conclusão do follow-up;
- filtros de Relatórios, reload, compartilhamento e abertura da URL;
- entrada no Admin técnico e retorno com filtros e modo de visualização preservados.

## Comandos

```bash
pnpm test:unit
pnpm test:int
pnpm test:e2e
pnpm validate:release
```

`pnpm validate:release` continua sendo o gate integral: tipos, lint, unitários, integração, build e E2E.
