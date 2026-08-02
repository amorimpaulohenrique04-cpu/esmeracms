# Stage 11 — Payload Jobs Queue

## Objective

Stage 11 moves durable follow-ups and external delivery synchronization out of the main Admin request while keeping Payload and PostgreSQL as the only transactional source of truth.

No fake notification, percentage, tracking event or report export is generated. Every operational Task is persisted in the existing `tasks` Collection and every execution is observable in Payload's native `payload-jobs` Collection.

## Queues

| Queue | Responsibility | Default worker cadence |
| --- | --- | --- |
| `operational` | Sale preparation and future D+3/D+15/D+90 Tasks | every minute |
| `integrations` | Real external tracking synchronization | every five minutes |

The future `reports` queue remains intentionally absent until the real reporting/export implementation is delivered. Stage 11 does not add a placeholder PDF job.

## Registered tasks

### `createAfterSalesTask`

- retries: 3;
- accepts an immutable `automationKey`;
- verifies that the Sale still exists and is not cancelled;
- finds or creates the related AfterSaleCase;
- creates a real Task related to case, sale and customer;
- returns the existing Task when a retry or duplicated hook reaches the same automation key.

The unique `tasks.automationKey` field is the final idempotency boundary. Duplicate queued jobs cannot create duplicate operational Tasks.

### `syncActiveShipments`

- retries: 2;
- registered with a recurring 15-minute schedule only when `TRACKING_SYNC_URL` exists;
- reads active Shipments with a real tracking code;
- sends their current state to the configured provider;
- accepts only statuses from the discrete Shipment domain;
- updates Payload only when the provider returned a real change;
- never fabricates events when no integration is configured.

Expected provider response:

```json
{
  "status": "in_transit",
  "lastEvent": "Objeto transferido para a unidade de destino",
  "estimatedDelivery": "2026-08-08T18:00:00.000Z",
  "deliveredAt": null
}
```

## Lifecycle rules

### Sale confirmed

The first transition into `confirmed`, `production`, `ready` or `delivered` queues one immediate job with:

```text
sale:<saleId>:preparation:v1
```

The resulting Task uses the Sale delivery forecast as its due date. When no forecast exists, the configurable preparation delay is used.

### Shipment delivered or Sale deliveredAt recorded

Both lifecycle paths converge on Sale-based keys, preventing duplication:

```text
sale:<saleId>:satisfaction:v1
sale:<saleId>:testimonial:v1
sale:<saleId>:maintenance:v1
```

Default rules:

- satisfaction: D+3;
- photo/testimonial: D+15;
- preventive maintenance: D+90 only when enabled and applicable to the Sale product/category.

Future jobs use Payload `waitUntil`; they are not eligible for execution before the configured instant.

## Configuration

The `after-sales-automation` Global contains the business rules for new schedules:

- delivery preparation enabled/delay;
- D+3 satisfaction enabled/delay;
- D+15 testimonial enabled/delay;
- D+90 maintenance enabled/delay;
- maintenance scope for all sales or selected products/categories.

Only administrators may update the rules. Commercial users may read them.

Changing the Global does not rewrite already queued jobs. This preserves auditability and avoids silently moving existing commitments.

## Dedicated worker

Recommended for a persistent server or separate worker container:

```bash
pnpm jobs:run:operational
pnpm jobs:run:integrations
```

The commands call Payload's native runner with `--handle-schedules`. The queue name used by the runner matches the queue registered in the task/hook.

In-process `autoRun` exists but only starts when:

```text
PAYLOAD_JOBS_AUTORUN=true
```

Keep it disabled on serverless deployments.

## Serverless runner

Call the native endpoint from the hosting provider cron:

```text
GET /api/payload-jobs/run?queue=operational&limit=25
GET /api/payload-jobs/run?queue=integrations&limit=10
Authorization: Bearer <CRON_SECRET>
```

The endpoint accepts either an authenticated Payload administrator or the exact `CRON_SECRET`. Commercial/editor sessions cannot run workers manually.

## Environment

```dotenv
PAYLOAD_JOBS_AUTORUN=false
CRON_SECRET=replace-with-at-least-16-random-characters
TRACKING_SYNC_URL=
TRACKING_SYNC_TOKEN=
```

`TRACKING_SYNC_URL` is optional. Without it, no recurring tracking schedule is registered.

## Test contract

The Stage 11 integration test verifies:

- immediate preparation job on Sale confirmation;
- future jobs for D+3, D+15 and selected-product D+90;
- `waitUntil` dates calculated from the real delivery timestamp;
- execution through Payload `jobs.runByID`;
- retry-safe idempotency through `automationKey`;
- completed native job records without errors.

The existing release gate still runs generated Payload types/import map, TypeScript, zero-warning ESLint, all integration tests, production build and Playwright E2E.
