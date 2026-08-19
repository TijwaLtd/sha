# PHASE 2B — ROLE-AWARE APPLICATION SHELL

Read:

AGENTS.md

.claude/skills/sha-compliance-ui/SKILL.md

Authentication and role authorization are complete.

Build the application shell only.

---

# OBJECTIVE

Create separate but visually consistent application shells for:

Hospital users

SHA officers

Admin users where applicable

---

# HOSPITAL NAVIGATION

Hospital users should eventually have access to:

Home

Invoices

Claims

Hospital

More

Do not create functionality that belongs to later phases.

Navigation can point only to implemented routes or intentional placeholders.

---

# SHA NAVIGATION

SHA officers should eventually have:

Dashboard

Claims

Alerts

Hospitals

Reviews

More

Again, do not implement future functionality yet.

---

# MOBILE

Use bottom navigation.

The hospital portal should feel like a simple mobile billing/submission application.

The SHA portal should feel like a mobile compliance operations application.

They should share the same design system but have different information architecture.

---

# DESKTOP

Adapt the same navigation to sidebar/desktop layouts.

Do not create separate applications.

---

# COMPLETION

Verify role-specific navigation.

Verify unauthorized users cannot access the wrong portal.

Run TypeScript, lint and build.

Then STOP.
