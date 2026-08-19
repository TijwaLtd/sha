# PHASE 5B — CLAIM PROCESSING SIMULATION

Read:

AGENTS.md

.claude/skills/sha-compliance-ui/SKILL.md

Claim intake is complete.

Build a simple demonstration processing workflow.

---

# OBJECTIVE

Simulate the progression of a submitted claim through the SHA screening pipeline.

---

# FLOW

RECEIVED

↓

VALIDATING

↓

ANALYZING

↓

ASSESSED

↓

CLEARED / FLAGGED

---

# IMPORTANT

This is a demonstration.

Do not introduce:

- Kafka
- RabbitMQ
- microservices
- Kubernetes
- complex event processing

A simple server-side workflow is sufficient.

---

# PROCESSING UI

The SHA claim detail should show a processing timeline.

Example:

✓ Claim received

✓ Facility verification

● Compliance checks

○ AI analysis

○ Risk assessment

---

# HOSPITAL UI

The hospital should see a simplified version:

Submitted

Received

Under assessment

Completed

Do not expose internal compliance implementation.

---

# COMPLETION

The same persisted Claim record must move through the states.

Then STOP.
