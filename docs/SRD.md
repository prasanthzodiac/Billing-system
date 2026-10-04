# Software Requirements Specification

## Functional requirements

### Masters

- Company settings and one or more bank accounts
- Customers with billing/delivery addresses and GST details
- Products with SKU, HSN/SAC, units, decimal quantity support, tax rate, and stock policy
- HSN/SAC and transporter masters
- Users, roles, permissions, and session lifecycle

### Billing

- Bill of Supply and Tax Invoice types
- Financial-year invoice numbering in `PREFIX / FY / SEQUENCE` format
- Draft, issued, partially paid, paid, overdue, and cancelled lifecycle
- Customer and product snapshots retained on invoices
- Dispatch, transport, vehicle, LR/RR, delivery note, and terms fields
- Unlimited invoice items with server-authoritative totals

### Finance and inventory

- CGST/SGST for intra-state and IGST for inter-state transactions
- Configurable tax rates, discounts, rounding, amount-in-words, and Indian number grouping
- Stock ledger movements for opening, purchase, sale, reversal, adjustment, return, and damage
- Cash, bank transfer, UPI, cheque, credit, and other payments
- Customer statements and outstanding aging

### Reporting and operations

- Sales, customer statement, product sales, inventory, outstanding, GST/HSN reports
- PDF, CSV, and Excel export contracts
- Audit logs with before/after values for important changes
- Backup, restore, verification, and disaster recovery runbook

## Quality requirements

- Monetary values use PostgreSQL `numeric` and server-side decimal arithmetic.
- Critical workflows use ACID transactions and idempotency keys.
- Search uses indexed, paginated server-side queries.
- Protected actions enforce permissions on the server, not only in the UI.
- Errors shown to users are safe and actionable; internal details stay in structured logs.
- The interface is keyboard-friendly, desktop-first, responsive, accessible, and print-safe.

