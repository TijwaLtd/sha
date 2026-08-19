# PHASE 3A — HOSPITAL PROFILE

Read:

AGENTS.md

.claude/skills/sha-compliance-ui/SKILL.md

Authentication, roles and application shell are complete.

Build ONLY the hospital profile experience.

---

# OBJECTIVE

Allow a hospital user to understand the facility they are submitting claims on behalf of.

---

# HOSPITAL USER

Determine the hospital from the authenticated user's server-side relationship.

Never allow the user to arbitrarily change hospitalId.

---

# UI

Create:

Hospital Home/Profile

Show:

- hospital name
- facility identifier
- verification status
- operational status
- available services
- basic facility information

Do not build claim submission yet.

---

# ROUTE

Use route-local architecture.

Example:

app/
└── (hospital)/
└── hospital/
├── page.tsx
└── _components/

Use Server Components by default.

---

# AUTHORIZATION

A hospital user can only view their own hospital.

---

# COMPLETION

Test mobile UI.

Test authorization.

Run TypeScript, lint and build.

Then STOP.
