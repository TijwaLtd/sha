# PHASE 3C — HOSPITAL CLAIM SUBMISSION

Read:

AGENTS.md

.claude/skills/sha-compliance-ui/SKILL.md

Phase 3B is complete.

Build ONLY invoice review and submission.

---

# OBJECTIVE

Allow a hospital to submit a completed draft invoice to SHA.

---

# WORKFLOW

Draft

↓

Review

↓

Submit

↓

Confirmation

↓

Claim becomes SUBMITTED / RECEIVED according to the existing state model.

---

# SUBMISSION RULES

A claim cannot be submitted if:

- it has no items
- required information is missing
- any line item is invalid
- hospital association is invalid
- claim is not owned by the authenticated hospital user

---

# SERVER ACTION

Submission must happen server-side.

The action must:

1. Authenticate.
2. Authorize.
3. Verify claim ownership.
4. Verify claim is still draft.
5. Validate the claim.
6. Set submission timestamp.
7. Change claim state.
8. Create audit event.
9. Revalidate claim/invoice pages.
10. Return structured result.

---

# CONFIRMATION UI

Before submission:

Show:

Claim reference

Hospital

Number of items

Total amount

Patient reference

Submit button

Use confirmation for the final submission.

---

# IMPORTANT

Submission must not immediately allow the hospital to manipulate the claim as if it were still a draft.

After submission:

The hospital may view it.

It cannot edit the submitted claim unless a future correction workflow explicitly supports it.

---

# COMPLETION

Demonstrate:

Create draft

Review

Submit

View submitted state

Then STOP.
