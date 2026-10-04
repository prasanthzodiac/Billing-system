# Testing Strategy

## Unit tests

- Tax split and intra/inter-state determination
- Discount, rounding, and grand total calculations
- Indian amount-to-words conversion
- Financial year and sequence formatting
- Payment/outstanding status
- Inventory balance transitions

## Integration tests

- Draft creation and snapshot capture
- Issue invoice transaction and stock deduction
- Concurrent invoice number generation
- Idempotent retries
- Cancellation and stock reversal
- Payment authorization and outstanding updates
- RBAC denial for restricted roles

## End-to-end tests

- Login, create invoice, issue, preview, print, and record payment
- Search/filter invoice history and export a report
- Keyboard-oriented billing flow and validation states

