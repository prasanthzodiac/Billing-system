# Security Model

## Assets

- Invoice totals, tax data, payment records, and stock balances
- Customer PII, GSTIN, PAN, addresses, and bank information
- User sessions, passwords, secrets, and database credentials
- Audit logs and backup archives

## Trust boundaries

1. Browser to Next.js: hostile input, cookies, file uploads, and request replay.
2. Next.js to PostgreSQL: privileged server-only connection.
3. Next.js to PDF renderer: invoice data must be validated and bounded.
4. Application to backup/log services: sensitive data must be minimized and access-controlled.

## Required controls

- Password hashing with a slow adaptive hash and bounded login attempts
- HttpOnly, SameSite cookies with Secure only in HTTPS production
- Server-side RBAC on every protected mutation
- Zod validation, numeric bounds, and allowlisted upload types
- CSRF/origin controls for cookie-authenticated mutations
- Security headers and a realistic CSP
- Parameterized ORM queries only; no SQL string construction from request values
- Redacted structured logs and no secret/error-stack exposure to browsers
- Immutable issued invoices and append-only audit/stock ledgers
- Lockfile, reproducible CI installs, dependency audit, and secret scanning

