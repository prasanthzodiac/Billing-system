# Industrial Billing & Inventory System - Product Requirements

## Product objective

Replace the manual Bill of Supply workflow with a reliable business system for invoice creation, inventory, payments, customer balances, transport details, reporting, and auditability.

## Users and outcomes

| Role | Primary outcome |
| --- | --- |
| Super Admin | Configure the company, users, permissions, numbering, and recovery controls |
| Admin | Operate billing, inventory, payments, transport, and reports |
| Billing Staff | Create accurate invoices quickly with minimal typing |
| Viewer / Accountant | Review invoices, payments, statements, GST summaries, and reports |

## MVP acceptance criteria

1. A user can create a draft invoice from reusable customer and product masters.
2. The server recalculates every monetary value using decimal arithmetic and rejects mismatches.
3. Issuing an invoice atomically assigns a financial-year sequence, stores immutable buyer/item snapshots, deducts stock, and records an audit event.
4. Cancelling an issued invoice creates reversal movements and preserves the original record.
5. Payments update paid/outstanding status without permitting invalid overpayment.
6. An A4 invoice PDF is printable, multi-page safe, and visually matches the approved business layout.
7. Every protected mutation enforces authentication, role authorization, runtime validation, idempotency, and safe error handling.
8. Search and reports are server-side paginated and remain usable for 100,000+ invoices.

## Key KPIs

- Issued sales by day, month, and financial year
- Outstanding receivables and collection rate
- Unpaid/overdue invoice count and age
- Stock on hand and low-stock product count
- Invoice creation-to-issue time
- Calculation or validation failure rate
- Audit coverage of financial mutations

## Non-goals for the first release

- Direct GST portal filing
- Online customer self-service portal
- Multi-company cross-tenant deployment
- Automated bank reconciliation

