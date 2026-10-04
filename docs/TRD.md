# Technical Requirements Document

## Chosen architecture

- Next.js App Router with TypeScript strict mode
- React Server Components by default; client components only for interactive forms
- Route Handlers for external API boundaries and Server Actions only where origin controls remain strict
- Prisma ORM over PostgreSQL/Neon
- Zod schemas at every request boundary
- `Decimal` for financial calculations and PostgreSQL `numeric` for storage
- A4 invoice rendering isolated behind a server-only PDF service

## Application layers

```text
UI / Server Components
        |
Validated application commands
        |
Domain services: billing, tax, numbering, inventory, payments
        |
Prisma repositories and transactions
        |
PostgreSQL / Neon
```

Server-only modules live under `lib/server` and must never be imported by client components. Secrets are never prefixed with `NEXT_PUBLIC_`.

## Reliability decisions

- Invoice sequence rows are locked inside the issuing transaction.
- An idempotency key is unique per command and stored with its resulting entity.
- Issued invoices are immutable; corrections use cancellation/reversal workflows.
- Inventory is derived from an append-only ledger, with a cached balance only as a read optimization.
- Reports query indexed aggregates and never load full histories into the browser.
- Neon branches are used for isolated development and migration testing; pooled connections are used for bursty serverless traffic.

## Required environments

- `development`: local or Neon development branch, seeded demo data
- `test`: isolated database branch, deterministic fixtures
- `staging`: production-like branch, masked data only
- `production`: restricted deployment, verified backups, alerting, and audit retention

