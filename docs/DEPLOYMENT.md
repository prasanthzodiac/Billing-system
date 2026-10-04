# Deployment Architecture

## Production shape

- Next.js production build behind a managed edge/reverse proxy
- Neon PostgreSQL production project with pooled application connection
- Separate preview/staging branches for migrations and QA
- Encrypted object storage for validated logos/signatures and generated PDFs if retention is required
- Central error and security monitoring with alert routing

## Release gates

1. Type-check, lint, unit tests, integration tests, and PDF render checks pass.
2. Database migration is reviewed and tested on a disposable Neon branch.
3. Dependency/security scan is clean or has documented accepted findings.
4. Backup verification is green.
5. Production deployment uses a pinned lockfile and server-only secrets.

