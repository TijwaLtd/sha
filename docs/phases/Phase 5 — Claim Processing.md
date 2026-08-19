# PHASE 5A — CLAIM INTAKE AND PROCESSING

Read:

AGENTS.md

.claude/skills/sha-compliance-ui/SKILL.md

Hospital submission and SHA hospital registry are complete.

Build the first shared claim-processing workflow.

---

# OBJECTIVE

When a hospital submits a claim, SHA should be able to see it as an incoming claim.

---

# FLOW

Hospital:

Submit claim

↓

Claim becomes RECEIVED

↓

SHA incoming queue

↓

Claim can be opened

---

# SHA CLAIM QUEUE

Show:

Claim reference

Hospital

Amount

Submitted time

Status

Processing state

---

# HOSPITAL SIDE

Hospital can see:

Submitted

Received

Processing

but not internal compliance details.

---

# SHA SIDE

SHA can see incoming claims.

---

# DO NOT IMPLEMENT YET

Do not implement:

AI

Risk score

Advanced compliance rules

Investigation

---

# COMPLETION

Verify:

Hospital submits

↓

SHA sees claim

↓

Hospital sees submitted/received status

Then STOP.
