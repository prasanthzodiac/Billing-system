# Information Architecture and User Flows

```text
Dashboard
Billing
  Create Invoice
  All Invoices
Customers
Products
Inventory
  Stock
  Stock Movements
Payments
Transporters
Reports
  Sales | Customers | Products | Outstanding | GST
Administration
  Users | Roles | Audit Logs
Settings
  Company | Bank Accounts | Invoice Settings
```

## Issue invoice flow

1. Billing staff opens Create Invoice.
2. Selects customer; address, GST, state, and credit terms are filled.
3. Adds products; HSN, unit, price, and tax are filled.
4. Enters dispatch information and reviews calculated totals.
5. Saves a draft or submits Issue Invoice.
6. Server validates permissions, customer/product status, inventory, totals, and idempotency.
7. One transaction assigns the number, stores snapshots, creates stock movements, and writes an audit event.
8. User previews, prints, downloads, or records a payment.

## Cancellation flow

1. Authorized user opens an issued invoice and selects Cancel.
2. Reason is required and displayed before confirmation.
3. Server transaction records the cancellation, reverses stock, updates payment implications, and writes an audit event.
4. Original values remain visible and cannot be silently edited or deleted.

