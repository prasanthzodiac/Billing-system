# API Specification Baseline

## Conventions

- JSON requests and responses, UTF-8, ISO dates, decimal values represented as strings.
- Every mutation accepts an `Idempotency-Key` header.
- `401` means unauthenticated; `403` means authenticated but unauthorized; `409` means a concurrency or state conflict; `422` means validation failure.
- All list endpoints return `{ data, page, pageSize, total }`.

## Core endpoints

```text
GET    /api/dashboard
GET    /api/customers
POST   /api/customers
GET    /api/products
POST   /api/products
POST   /api/invoices/draft
POST   /api/invoices/:id/issue
POST   /api/invoices/:id/cancel
GET    /api/invoices
GET    /api/invoices/:id
GET    /api/invoices/:id/pdf
POST   /api/invoices/:id/payments
GET    /api/reports/sales
GET    /api/reports/outstanding
GET    /api/reports/gst
GET    /api/audit-logs
```

## Security contract

All protected routes perform server-side session and permission checks. Cookie-authenticated mutations validate a strict origin/CSRF strategy. Runtime schemas reject unknown or malformed input before domain services run.

