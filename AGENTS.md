<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SHA Compliance

Demonstration platform for screening healthcare claims submitted to SHA. NOT a production system. AI assists analysis — never determines fraud alone.

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm lint             # eslint
pnpm format           # prettier (all ts/tsx)
pnpm typecheck        # tsc --noEmit
```

Run `pnpm lint && pnpm typecheck` before committing. Fix both before moving on.

## Toolchain

- **Package manager**: pnpm (not npm/yarn)
- **Next.js**: 16.2.6 — see `node_modules/next/dist/docs/` for API changes
- **Prisma**: 7.9.1 — uses `prisma.config.ts` (not env block in schema)
- **Prisma client**: generates to `app/generated/prisma` (gitignored)
- **Database**: PostgreSQL via `DATABASE_URL` in `.env`
- **shadcn/ui**: base-vega style, lucide icons, installed in `components/ui/`
- **Tailwind CSS**: v4 — no `tailwind.config`, config is in `app/globals.css`
- **Path alias**: `@/*` maps to project root
- **Prettier**: no semicolons, double quotes, trailing commas (es5), tailwind plugin with `cn`/`cva`

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add <component>
```

## Prisma workflow

```bash
pnpm prisma migrate dev --name <name>   # create migration
pnpm prisma generate                     # regenerate client
pnpm prisma db seed                       # seed database
```

Schema: `prisma/schema.prisma`. Config: `prisma.config.ts`.

## Project status

Fresh template. No models, migrations, tests, or CI yet.

## Domain rules

### Terminology (use consistently in code and UI)

- **Facility** — healthcare provider submitting claims
- **Claim** — billing request submitted to SHA
- **Claim Item** — individual service/charge within a claim
- **Finding** — specific issue identified during analysis
- **Risk Score** — accumulated risk indicators as a number
- **Review** — human investigation of a flagged claim

Never swap terms (e.g., "invoice" for claim, "hospital" for facility).

### Risk language (in UI and code comments)

Use: Suspicious, High Risk, Requires Review, Potential Anomaly, Compliance Concern.
Avoid: "fraud", "definitely fraudulent", "AI proved fraud". The system identifies risk, not guilt.

### Money

All monetary values stored as **integer cents** in the database. KES 1,500 = `150000`. Never use floats. Format through shared money utilities.

## Architecture

### Vertical-slice per feature

Each feature: route-local components in `_components/` and `_actions/` next to the page.

```
app/(app)/claims/
├── page.tsx           # Server Component: auth, data fetch, compose
├── _components/       # interactive/client pieces
└── _actions/          # server actions
```

### Server-first

`page.tsx` = Server Component by default. Add `"use client"` only to the specific interactive child component, never to the whole page.

### AI abstraction

Never call Groq/OpenRouter directly from UI. Use `lib/ai/` abstraction. AI output is untrusted — validate before use.

### Risk engine

Deterministic indicators (facility status, duplicates, unusual amounts) combined with AI findings. Must produce explainable scores.

## Multi-portal architecture

Two distinct portals, one codebase:

### Hospital portal

- Create invoices, add claim items, review totals, submit claims
- View own submitted claims and processing status
- **Never** access other hospitals, SHA tools, risk config, AI config, or investigator notes

### SHA portal

- View hospitals, verify facilities, monitor claims
- Inspect compliance findings, AI findings, risk scores
- Investigate flagged claims, resolve reviews
- View compliance analytics

### Role boundary

Roles: `HOSPITAL_USER`, `SHA_OFFICER`, `ADMIN`. Authorization on server — never rely on hiding nav items. A hospital user hitting a SHA route gets an authorization failure.

### Hospital ownership

A hospital user is bound to one facility. Every hospital-side claim operation must verify: `authenticated user + hospital relationship + claim ownership`. Never trust `hospitalId` from the browser.

### Claim submission flow

Hospital creates invoice → adds line items → reviews → submits → claim becomes `RECEIVED` → SHA processing begins (facility verification → compliance rules → AI analysis → risk assessment → `CLEARED`/`FLAGGED`). Hospital cannot directly control final compliance status.

### Claim visibility

Hospital users see: their claims, reference, submission time, amount, status, whether flagged, high-level reason for review. They must **not** see: internal risk contributors, investigator notes, rule config, AI prompts, private reviewer commentary.

## Claim lifecycle

```
DRAFT → SUBMITTED → RECEIVED → VALIDATING → ANALYZING → ASSESSED → CLEARED/FLAGGED → UNDER_REVIEW → RESOLVED
```

Processing may be simulated synchronously for the demo. No complex infrastructure (Kafka, streams) needed.

## Safety

- No real patient PII — use synthetic data only
- Never expose API keys or DB credentials to the browser
- Server actions must authorize and validate all inputs
- AI failure must not crash deterministic compliance checks
