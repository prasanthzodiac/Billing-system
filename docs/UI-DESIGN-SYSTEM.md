# UI Design System

## Visual direction

Industrial ERP: warm off-white canvas, ink-black typography, deep forest navigation, amber action color, and restrained status colors. Surfaces are dense enough for billing staff but retain generous grouping and clear focus states.

## Tokens

```text
Canvas: #f5f3ee
Surface: #fffdf8
Ink: #1e211d
Muted: #777a70
Forest: #163c35
Amber: #d47a24
Success: #2e7650
Warning: #a7681c
Danger: #a33e35
Border: #dedbd1
Radius: 14px (cards), 10px (controls), 999px (pills)
```

## Component rules

- Use explicit labels, helper text, and inline validation.
- Use tabular numeric alignment for quantity, rates, tax, and totals.
- Use status pills only for state, not as decoration.
- Keep primary action visible while reviewing an invoice.
- Preserve keyboard focus and provide shortcut hints for billing operators.
- Never expose financial data in hover-only UI.

