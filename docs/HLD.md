# High-Level Design

## Context

```text
Billing Staff / Admin / Accountant
              |
       Next.js application
     /        |          \
 Auth/RBAC  Billing API   Reports/PDF
     \        |          /
       Prisma transaction layer
              |
        PostgreSQL / Neon
              |
     Backup + logs + monitoring
```

## Critical transaction: issue invoice

```text
Validate request -> authorize -> lock idempotency key
        -> lock FY sequence -> validate stock
        -> calculate authoritative totals
        -> save invoice + immutable snapshots
        -> save tax rows + stock movements + audit log
        -> commit
```

Any failure rolls back every step. The response contains a stable invoice identifier and can be safely replayed with the same idempotency key.

