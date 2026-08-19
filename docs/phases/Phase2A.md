# PHASE 2A — AUTHENTICATION AND USER ROLES

Read:

AGENTS.md

.claude/skills/sha-compliance-ui/SKILL.md

Phase 1 is complete.

Do not implement claims.

Do not implement hospital invoicing.

Do not implement compliance rules.

Do not implement AI.

Do not implement risk scoring.

Build ONLY authentication and role-aware access.

---

# OBJECTIVE

Establish the identity and authorization foundation for the two application experiences:

1. Hospital Portal
2. SHA Compliance Portal

---

# USER ROLES

Support the roles already defined in the database.

At minimum:

HOSPITAL_USER
SHA_OFFICER
ADMIN

Do not invent additional roles unless the existing schema requires them.

---

# HOSPITAL USER

A HOSPITAL_USER must be associated with a hospital.

After login, the system must be able to determine:

currentUser
→ role
→ hospital

Do not accept hospital identity from the client as the authority.

---

# SHA USER

A SHA_OFFICER can access the SHA compliance application.

They must not be restricted to a single hospital unless the database explicitly supports such a restriction.

---

# ROUTING

Create role-aware application boundaries.

Conceptually:

app/
├── (auth)/
│ └── login/
│
├── (hospital)/
│ └── ...
│
└── (sha)/
└── ...

The exact routing may follow the existing project conventions.

---

# SECURITY

Authorization must happen on the server.

Do not rely on:

- hidden buttons
- client-side role checks
- navigation visibility

as the security mechanism.

---

# LOGIN

Implement the existing project's authentication mechanism.

Do not install another auth framework if authentication already exists.

---

# DEMO USERS

If the project uses seed/demo accounts, make it possible to demonstrate:

Hospital User A

Hospital User B

SHA Officer

Admin

Use fictional data only.

---

# UI

Build only authentication UI.

Do not build hospital or SHA dashboards yet.

---

# COMPLETION

Report:

Implemented

Authentication

Roles

Hospital association

Protected routes

Authorization

Demo accounts

UI

Tests

TypeScript

Lint

Build

Then STOP.
