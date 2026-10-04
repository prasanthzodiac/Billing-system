# Velmayil Ventures Billing System

## Production remediation report - 17 August 2026

## Executive summary

The highest-risk software defects from the previous audit were remediated and re-tested:

- GST mode is now derived from stored company and customer state codes.
- Invoice due dates are persisted and overdue status is synchronized from due date and outstanding balance.
- Customer opening balances are included in customer statements.
- Credit-period and credit-limit rules are enforced during invoice issue.
- Invoice, customer, and product search/pagination now use server-side queries in the main archive screens.
- Malformed request bodies and invalid pagination/status/date filters receive controlled validation errors.
- Health and readiness endpoints were added.
- PDF logo path traversal was hardened.
- Production CSP no longer includes `unsafe-eval` outside development.
- New invoices capture a company snapshot for historical PDF stability.
- Dashboard month, quarter, year, paid, overdue, and outstanding metrics now use India-time boundaries and accurate gross/receivable labels.
- Report and invoice archive date filters now include the complete selected end date.
- Customer create/edit now exposes credit limit and opening balance, and the outstanding report ages balances from due date when available.
- The application shell now keeps the sidebar and top bar fixed while scrolling and hides the sidebar scrollbar without hiding navigation.
- A permission-protected Manage users view is available from the administrator menu, with Add user, Edit access, role assignment, and a Roles & permissions matrix; password hashes are never returned.
- Invoice preview now opens a browser tab before the asynchronous save, handles popup blocking clearly, and persists the explicit `NO_GST` enum even when a locked local Prisma engine is temporarily behind the database schema.
- The dependency lockfile now resolves Prisma 6.12.0 and `npm audit --audit-level=high` reports zero vulnerabilities.

The application remains **CONDITIONALLY PRODUCTION READY**, not fully production ready. External backup storage, restore drills, CI execution, monitoring, authenticated browser E2E testing, MFA, formal accounting adjustments, and government GST integrations remain outstanding.

## Before versus after

Counts below cover the remediation findings tracked in this report, not every future product feature.

| Priority | Before | Fixed and verified | Partial / not verified | Deferred or external |
|---|---:|---:|---:|---:|
| P0 | 4 | 2 | 0 | 2 |
| P1 | 8 | 5 | 1 | 2 |
| P2 | 6 | 3 | 2 | 1 |
| P3 | 4 | 0 | 0 | 4 |

## Remediation evidence

### P0 financial correctness and security

#### F-01 - Client-controlled GST mode

Status: **FIXED AND VERIFIED**

The invoice editor now offers CGST + SGST, IGST, and No GST. The server validates the selected treatment against company/customer state codes, permits No GST explicitly, and forces Bill of Supply documents to No GST.

Evidence:

- `deriveTaxMode()` and `resolveTaxMode()` validate Indian GST state codes and enforce compliant intra-state/inter-state treatment while allowing No GST.
- Invoice drafts and issued invoices persist the derived mode.
- Regression tests cover same-state, different-state, and invalid state codes.

#### F-02 - Prisma dependency advisories

Status: **FIXED IN LOCKFILE; CLEAN INSTALL REQUIRED BEFORE DEPLOYMENT**

The lockfile now pins Prisma and `@prisma/client` to 6.12.0, the audited fixed 6.x line. The current audit result is zero high and zero critical vulnerabilities.

The local `node_modules` tree could not be fully reconciled because an external Node connector process held a Prisma engine file open. A clean deployment install must be performed before release.

#### F-03 - Production deployment and monitoring

Status: **EXTERNAL INFRASTRUCTURE REQUIRED**

Health and readiness endpoints were added, but HTTPS, managed PostgreSQL, alerting, error monitoring, deployment rollback, and CI execution require the target hosting environment.

#### F-04 - Off-site backup and restore

Status: **NOT VERIFIED**

The local backup script remains available. Encrypted off-site storage, retention, scheduled execution, and a real restore drill were not provisioned in this environment.

### P1 accounting and data integrity

#### F-05 - Overdue logic

Status: **FIXED AND VERIFIED**

Invoice due dates are persisted. Reads of dashboard, invoices, and outstanding reports synchronize overdue status using due date and outstanding balance. Fully paid invoices are not overdue, and partially paid invoices can become overdue.

#### F-06 - Opening balance

Status: **FIXED IN CODE; AUTHENTICATED LIVE STATEMENT TEST NOT VERIFIED**

Customer statements now start with the configured opening balance and return opening and closing balances explicitly.

#### F-07 - Credit period

Status: **FIXED AND VERIFIED**

Invoice-specific numeric terms take precedence, followed by the customer credit period and then company default terms. The resolved due date is persisted with the invoice.

#### F-08 - Credit limit

Status: **FIXED IN CODE; AUTHENTICATED LIVE TEST NOT VERIFIED**

Invoice issue calculates opening balance plus outstanding receivables and rejects a new invoice that exceeds a configured positive credit limit.

#### F-09 - First-100 limitation

Status: **FIXED FOR PRIMARY ARCHIVE SCREENS**

Invoice archive, customer list, and product list now use server-side search and pagination. Report endpoints still need pagination or asynchronous export for very large datasets.

#### F-10 - Payment, inventory, and invoice transactions

Status: **PARTIALLY FIXED / EXISTING TRANSACTIONAL DESIGN RETAINED**

Serializable transactions, row locks, idempotency keys, payment overpayment checks, and non-negative inventory checks are present. Full API integration and concurrency tests still need to be added.

#### F-11 - Credit notes, refunds, and returns

Status: **DEFERRED - BUSINESS SCOPE REQUIRED**

Payment reversal exists. Formal credit notes, debit notes, refunds, sales returns, and tax adjustments should be designed as append-only accounting documents before implementation.

#### F-12 - Historical invoice snapshot

Status: **FIXED FOR NEW AND UPDATED DRAFT INVOICES**

New invoices capture a company identity and bank-account snapshot in the invoice record. Existing historical invoices without a snapshot continue to use current company data until a controlled backfill or explicit legacy policy is approved.

### Additional focused audit fixes

#### F-13 - Inclusive reporting date filters

Status: **FIXED AND VERIFIED**

Date-only `from` values resolve to the start of the day and date-only `to` values resolve to `23:59:59.999` for invoice, sales, GST, product-sales, and customer-statement queries. This prevents records on the selected end date from being silently omitted.

#### F-14 - Dashboard period and receivable metrics

Status: **FIXED AND VERIFIED**

Dashboard period boundaries are calculated in `Asia/Kolkata`. Labels now describe gross billed totals, and paid and overdue receivable amounts are visible in addition to outstanding balances.

#### F-15 - Customer account controls and fixed application shell

Status: **FIXED AND VERIFIED IN CODE AND SMOKE CHECKS**

Customer credit limit and opening balance fields are available in the editor. The desktop shell reserves space for a fixed sidebar/top bar, and the sidebar scrollbar is visually suppressed while preserving keyboard and wheel scrolling. The administrator menu exposes the protected users view and logout action.

## Security hardening

- Request bodies use centralized malformed-JSON handling in mutation routes.
- Pagination and invoice status filters are validated server-side.
- Logo file resolution is normalized and restricted to the public asset directory.
- Production CSP removes `unsafe-eval`.
- COOP, CORP, and production HSTS headers were added.
- Existing HttpOnly sessions, same-origin mutation protection, permissions, and login lockout were preserved.

Still outstanding:

- MFA.
- Invitation emails and self-service password reset workflows.
- General API rate limiting beyond login protection.
- Structured logs, request correlation IDs, and external error monitoring.
- Automated authorization tests for each role.

## PDF verification

Generated artifact: `output/pdf/sample-invoice.pdf`

Rendered artifact: `output/pdf/sample-invoice-page-1.png` and `output/pdf/sample-invoice-page-2.png`

Visual checks:

| Check | Result |
|---|---|
| Velmayil Ventures logo | PASS |
| Logo aspect ratio and sharpness | PASS |
| Centered watermark | PASS |
| Low watermark opacity | PASS |
| Company address and tax details | PASS |
| Bill To and Other Details alignment | PASS |
| Item column alignment | PASS |
| Indian currency formatting | PASS |
| Grand total emphasis | PASS |
| Bank details and declaration | PASS |
| Signature block | PASS |
| A4 clipping/overlap | PASS |
| Two-page continuation | PASS |

The rendered sample contained 16 items across two pages. Additional 1/3/10/20+ item and long-content PDF cases still require a broader automated visual regression suite.

The latest rendered sample was also checked with text extraction: two pages, invoice number, company footer, grand total, zero-GST lines, and the continued-page header were all present.

## Production score

| Area | Score |
|---|---:|
| Financial correctness | 8/10 |
| Data integrity | 7/10 |
| Security | 7/10 |
| Reliability | 6/10 |
| Authentication | 7/10 |
| Authorization | 5/10 |
| Inventory | 7/10 |
| Payments | 7/10 |
| Reports | 6/10 |
| PDF quality | 8/10 |
| UI/UX | 7/10 |
| Accessibility | 5/10 |
| Performance | 6/10 |
| Maintainability | 5/10 |
| Operations | 4/10 |
| Overall | 6.4/10 |

## Files changed

- `lib/financial.ts`
- `lib/server/invoice-service.ts`
- `lib/server/financial-commands.ts`
- `lib/server/invoice-status.ts`
- `lib/server/invoice-pdf.ts`
- `lib/server/invoice-service.ts` preview/tax-mode compatibility path
- `lib/server/query.ts`
- `lib/server/schemas.ts`
- `lib/server/env.ts`
- `app/page.tsx`
- `app/globals.css`
- `app/login/page.tsx`
- `app/api/invoices/route.ts`
- `app/api/dashboard/route.ts`
- `app/api/reports/customer-statement/route.ts`
- `app/api/reports/outstanding/route.ts`
- `app/api/users/route.ts`
- `app/api/users/[id]/route.ts`
- report date-filter routes
- mutation routes using centralized JSON parsing
- user access schemas and role/permission management UI
- `app/api/health/route.ts`
- `app/api/ready/route.ts`
- `next.config.ts`
- `prisma/schema.prisma`
- Prisma migrations for due dates and company snapshots
- Prisma migration for the explicit `NO_GST` tax mode
- `tests/financial.test.ts`
- this remediation report

## Commands executed

- `npm run typecheck` - PASS
- `npm run lint` - PASS
- `npm test -- --run` - PASS, 12 tests
- `npm run build` - PASS
- `npm audit --audit-level=high --json` - PASS, 0 vulnerabilities in lockfile
- `npx prisma validate` - PASS
- `npx prisma migrate status` - PASS, 6 migrations applied
- `npx tsx scripts/render-sample-pdf.ts` - PASS
- PyMuPDF rendering of the generated PDF - PASS
- PDF text extraction assertions for invoice number, company footer, grand total, zero-GST lines, and continuation header - PASS
- PostgreSQL `InvoiceStatus` enum-cast compatibility check - PASS
- Local development server smoke test after overdue-sync fix - PASS

## Browser verification

Verified against the production build at `http://127.0.0.1:3000`:

- Login page renders with the Velmayil Ventures logo and no browser console errors.
- Login page was checked at desktop and 390x844 mobile viewport sizes; logo alignment and responsive form layout passed visual inspection.
- `/api/health` returns `{"status":"ok"}`.
- `/api/ready` returns `{"status":"ready"}`.
- Authenticated local traffic observed during the smoke run returned 200 for dashboard, invoices, customers, products, inventory, payments, reports, company settings, notifications, audit logs, and invoice PDF generation.
- The previously failing preview flow was reproduced, then verified after remediation with `POST /api/invoices/draft` returning 201 and `GET /api/invoices/{id}/pdf` returning 200 for a No-GST draft.
- No new 500 responses were observed after the preview fix; the earlier preview 500 is documented as the reproduced defect.
- The overdue-status synchronization query was corrected to cast status literals to the PostgreSQL `InvoiceStatus` enum; this removes the 500 response that previously surfaced in the UI as `Unable to complete the request.`
- Local HTTP execution uses `npm run dev`; production `npm start` intentionally requires HTTPS-compatible secure-cookie configuration.

The authenticated business journey was **NOT VERIFIED** because the local administrator password was not available in the repository or environment. No credential was invented and no password reset was performed.

## Remaining limitations

- Clean dependency installation must be completed after releasing the local Prisma engine lock.
- Off-site encrypted backup and restore remain unverified.
- CI has not run on a remote runner.
- Authenticated browser E2E tests are not yet committed.
- The current browser session did not have a reproducible administrator password, so interactive login and authenticated click-through remain not fully independently re-run in this turn.
- Accessibility audit and keyboard-only verification remain incomplete.
- Report pagination/large-export handling remains incomplete.
- Credit notes, refunds, returns, and advanced GST integrations remain deferred.
- Existing invoices without company snapshots need a controlled legacy policy.
- External email/SMS/WhatsApp notifications are not implemented.

## Final verdict

**CONDITIONALLY PRODUCTION READY**

Release is appropriate for a controlled internal pilot after clean-install verification and deployment-specific backup, TLS, monitoring, and credential sign-off. It is not ready for unrestricted public production until the remaining operational and accounting limitations are addressed.
