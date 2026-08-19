# PHASE 3B — HOSPITAL INVOICE CREATION

Read:

AGENTS.md

.claude/skills/sha-compliance-ui/SKILL.md

Phase 3A is complete.

Build ONLY draft invoice creation.

Do not implement submission processing yet.

Do not implement AI.

Do not implement compliance rules.

---

# OBJECTIVE

Allow a hospital user to create an invoice/claim in DRAFT state.

---

# WORKFLOW

Hospital user:

Create Invoice

↓

Enter patient reference

↓

Enter diagnosis/context

↓

Add claim items

↓

Review total

↓

Save Draft

---

# CLAIM ITEMS

The user should be able to:

- select a service
- enter quantity
- enter unit amount
- see calculated line total
- add multiple items
- remove items
- edit items

All money inputs must be converted to integer cents before persistence.

---

# MONEY

User enters:

KES 1,500

Database receives:

150000

Never store user-entered monetary values as Float.

---

# TOTALS

The invoice UI should clearly show:

Subtotal

Total

Use shared money formatting utilities.

---

# VALIDATION

Validate:

- patient reference
- required claim information
- service
- quantity
- amount
- at least one claim item

Validation must run server-side.

---

# SERVER ACTION

Create the invoice through a server action.

The action must:

1. Authenticate.
2. Verify HOSPITAL_USER.
3. Determine hospital from authenticated user.
4. Create claim in DRAFT state.
5. Create claim items.
6. Calculate/persist appropriate totals.
7. Return structured result.
8. Revalidate relevant routes.

Never accept hospital ownership as trusted client input.

---

# UI STRUCTURE

Use:

app/
└── (hospital)/
└── invoices/
├── page.tsx
├── new/
│ ├── page.tsx
│ ├── _components/
│ │ ├── invoice-form.tsx
│ │ ├── invoice-item-form.tsx
│ │ └── invoice-summary.tsx
│ └── _actions/
│ └── invoice-actions.ts

Follow the project's established conventions.

---

# MOBILE

This should feel like a mobile billing form.

Avoid desktop spreadsheet-style invoice entry.

Use stacked line items and mobile-friendly controls.

---

# COMPLETION

A hospital user must be able to create and save a draft invoice.

Do not implement submission.

Then STOP.
