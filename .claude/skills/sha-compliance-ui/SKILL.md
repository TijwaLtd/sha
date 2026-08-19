# SHA COMPLIANCE UI DESIGN SKILL

## PURPOSE

This skill defines the visual and interaction system for SHA Compliance.

The application is mobile-first.

It should feel like a modern operational mobile application used by a compliance investigator.

It must not look like a generic enterprise admin template.

---

# 1. DESIGN PRIORITY

Priority order:

1. Mobile usability
2. Information clarity
3. Risk visibility
4. Fast investigation
5. Consistency
6. Desktop responsiveness

---

# 2. VISUAL LANGUAGE

The interface should communicate:

- trust
- seriousness
- operational clarity
- urgency where appropriate
- calmness for normal claims

Avoid:

- excessive gradients
- decorative dashboards
- unnecessary animations
- huge charts
- excessive colors
- visual clutter

Risk should be visually obvious without making the entire interface look alarming.

---

# 3. MOBILE APPLICATION STRUCTURE

Primary mobile structure:

Top App Bar

↓

Page Content

↓

Bottom Navigation

Use sticky bottom navigation where appropriate.

Primary actions should be reachable by the thumb.

---

# 4. PAGE PATTERN

Every major page should generally follow:

Page Header
↓
Context / Summary
↓
Filters or Actions
↓
Primary Content
↓
Supporting Information

Example:

Claims

[Search]

[All] [Flagged] [Review]

Claim list

Bottom Navigation

---

# 5. DETAIL PAGE PATTERN

Detail pages should follow:

Back navigation

Title

Status

Primary summary

Important metrics

Sections

Actions

Example:

Claim #CLM-10293

HIGH RISK

KES 246,000

Hospital:
ABC Medical Centre

Risk Score:
87/100

---

# 6. RISK VISUALIZATION

Risk levels:

LOW
MODERATE
HIGH
CRITICAL

Do not rely on color alone.

Always include:

- label
- icon where useful
- numerical score where useful
- explanatory finding

Example:

HIGH RISK
87/100

not simply:

red circle

---

# 7. CLAIM CARD

A claim card should expose the most important information immediately:

Hospital

Claim reference

Amount

Status

Risk level

Date/time

Number of findings

Example:

ABC Medical Centre
CLM-10482

KES 246,000

HIGH RISK · 87

3 findings

2 min ago

---

# 8. FINDING CARD

A finding should show:

Severity

Rule/type

Affected item

Reason

Score contribution where applicable

Example:

HIGH

Service Relevance

MRI Scan

Potential mismatch with submitted
clinical context.

+25 risk

---

# 9. HOSPITAL CARD

Show:

Hospital name

Verification status

Facility status

Risk level

Recent claims

Flagged claims

Do not overload the card.

---

# 10. SHADCN CUSTOMIZATION

shadcn/ui is the base component system.

If a visual pattern repeats, create a reusable component or variant.

Do not repeatedly write custom Tailwind classes.

For example:

Use:

<Button variant="primary">

rather than repeatedly styling:

className="..."

for the same button appearance.

Likewise create semantic variants for:

- RiskBadge
- StatusBadge
- SeverityBadge
- MetricCard

---

# 11. COMPONENT RULE

Prefer reusable semantic components:

<RiskBadge level="high" />

<StatusBadge status="flagged" />

<MoneyDisplay cents={amountCents} />

<ClaimCard />

<FindingCard />

<EmptyState />

Do not make every screen invent its own visual language.

---

# 12. FORMS

Forms should be:

- mobile-first
- vertically stacked
- clearly labelled
- easy to scan
- forgiving of touch interaction

Avoid dense desktop form grids on mobile.

Use sheets/dialogs when appropriate for short workflows.

Use dedicated pages for complex forms.

---

# 13. TABLES

Do not default to desktop tables.

On mobile, prefer:

cards
lists
grouped rows
expandable sections

If a table is necessary, provide a mobile-friendly representation.

---

# 14. LOADING STATES

Use skeletons for larger content areas.

Avoid blank screens.

Example:

Claim list skeleton

Hospital skeleton

Metric skeleton

---

# 15. EMPTY STATES

Every list must have an intentional empty state.

Example:

No flagged claims

All claims currently appear within normal
risk thresholds.

Avoid generic:

"No data."

---

# 16. ERROR STATES

Errors should be actionable.

Example:

Unable to load claims.

[Try again]

Do not expose raw database errors.

---

# 17. SUCCESS STATES

After actions:

- provide toast/inline feedback
- update the relevant UI
- preserve context

Do not require unnecessary page refreshes.

---

# 18. INVESTIGATION UX

The investigator should be able to move:

Claim List
→ Claim Detail
→ Findings
→ Evidence
→ Decision

with minimal navigation.

Primary review actions should remain obvious.

---

# 19. DASHBOARD

The dashboard should prioritize:

Claims received

Claims flagged

High-risk claims

Claims under review

Total claimed

Recent alerts

Live processing

Avoid building a giant desktop analytics dashboard.

---

# 20. AI PRESENTATION

Never present raw model output as authoritative.

Present:

AI Assessment

Confidence

Findings

Reason

Use wording such as:

"AI-assisted finding"

"Potential mismatch"

"Requires review"

Never:

"AI detected fraud"

unless clearly presented as a demonstration label and not a factual determination.

---

# 21. RESPONSIVENESS

Design mobile first.

Then adapt at larger breakpoints.

Do not create separate mobile and desktop implementations unless absolutely necessary.

---

# 22. ACCESSIBILITY

Use:

- semantic HTML
- accessible labels
- keyboard navigation
- sufficient contrast
- focus states
- appropriate touch target sizes

Do not rely exclusively on color.

---

# 23. FINAL UI RULE

Consistency beats novelty.

If a component already exists:

reuse it.

If a visual pattern repeats:

extract it.

If a shadcn component can handle it:

use it.

If Tailwind classes are being repeatedly copied:

stop and create a reusable variant/component.
