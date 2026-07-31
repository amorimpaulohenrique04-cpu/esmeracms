# Server domain

Server-side business rules, validated mutations and reusable data-access helpers live here.

The operational portal and the native Payload Admin continue to operate over the same Payload/PostgreSQL documents. This directory must never become a parallel persistence layer.

Stage 1 starts the boundary with `shared/payload.ts`, which centralizes authenticated Local API reads used by operational modules.

Future feature services are organized by domain (`customers`, `opportunities`, `sales`, `after-sales`, `products`, `reporting`, `search`, `jobs`) as those stages are implemented.
