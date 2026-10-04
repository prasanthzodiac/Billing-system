# Backup and Disaster Recovery

## Policy

- Use automated encrypted database backups and point-in-time recovery according to the selected Neon plan.
- Keep an export path for invoices, audit logs, and company configuration.
- Never treat a successful backup job as proof of recoverability.

## Verification runbook

1. Restore or branch from a known backup point.
2. Apply the expected schema migration state.
3. Run row counts, foreign-key checks, invoice total checks, and stock reconciliation.
4. Render a sample invoice PDF and verify company/bank data.
5. Record the result, operator, timestamp, and recovery point.

## Recovery targets

- Target RPO: 15 minutes or the configured database recovery window
- Target RTO: 4 hours for core billing operations
- Reconcile issued invoice, payment, and inventory ledgers before reopening production writes

