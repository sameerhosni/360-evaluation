# Pulse360 — pilot MVP

The Performance Intelligence layer of WorkQuest. This is a vertical-slice MVP built from the PRD + PKG Architecture: one surface per persona, end-to-end, with real Claude API calls for the Twin Advocate Brief, Auto-Achievement Detection, and Bias Sentinel descriptions.

---

## What's in V1

**Lina · employee** (`/dashboard`, `/inbox`, `/twin`)
Pulse Dashboard with breathing four-arc score ring, achievement inbox with AI-detected candidates, Twin console showing the advocate brief her manager will see.

**Khalid · manager** (`/cockpit`, `/cockpit/[personId]`)
Calibration Cockpit listing 11 direct reports sorted by Calibration Confidence ascending. Drill-in opens a calibration sheet with pre-computed Manager-Eval anchors, per-criterion ± 2-pt free range, mandatory justification capture beyond, and the Twin Advocate Brief side panel.

**Maha · HRBP** (`/sentinel`)
Bias Sentinel dashboard. Patterns, not personalities. Each open pattern carries effect size, sample size, neutral/cautious/urgent explanations from Claude, and acknowledge/investigate/resolve actions.

The pilot demonstrates the full Pulse360 loop — Lina's PKG events feed Khalid's pre-computed scores, Khalid's adjustments feed Maha's bias surface — on real data with real AI.

---

## Setup

Requires Node 22+ and npm 10+ (or pnpm/yarn).

```bash
# 1. Install
npm install

# 2. Add your Anthropic API key (optional but recommended)
# Edit .env and set ANTHROPIC_API_KEY="sk-ant-..."
# Without it, the Twin brief and bias explanations fall back to a "disabled" state.

# 3. Create the SQLite database and seed it
npx prisma migrate dev --name init
npm run db:seed

# 4. Run
npm run dev
```

Open <http://localhost:3000> and pick a persona:

- **Lina** → Pulse Dashboard (employee continuous surface)
- **Khalid** → Calibration Cockpit (manager twice-yearly surface)
- **Maha** → Bias Sentinel (HRBP oversight surface)

No password — the pilot ships without auth (PRD §8.3 — OIDC/SAML wired in production). The persona-picker stores a signed cookie holding the active email.

---

## Architecture

```
src/
├─ app/
│  ├─ page.tsx                       # Persona picker (landing)
│  ├─ dashboard/page.tsx             # Lina · Pulse Dashboard
│  ├─ inbox/page.tsx                 # Lina · Achievement Inbox
│  ├─ twin/page.tsx                  # Lina · Twin console
│  ├─ cockpit/page.tsx               # Khalid · directs list
│  ├─ cockpit/[personId]/page.tsx    # Khalid · calibration sheet
│  ├─ sentinel/page.tsx              # Maha · Bias Sentinel
│  └─ api/calibration/save/route.ts  # Calibration save handler
├─ components/
│  ├─ ui.tsx                         # Card, Chip, Avatar, ScoreRing, etc.
│  ├─ app-shell.tsx                  # Top-bar, role-based nav
│  └─ advocate-brief.tsx             # Twin Advocate Brief card
├─ lib/
│  ├─ db.ts                          # Prisma singleton
│  ├─ session.ts                     # Cookie-based mock auth
│  ├─ cn.ts                          # tailwind-merge utility
│  └─ ai/
│     ├─ client.ts                   # Anthropic SDK singleton
│     ├─ prompts.ts                  # Versioned system prompts
│     ├─ schemas.ts                  # zod schemas for AI outputs
│     ├─ aad.ts                      # Auto-Achievement Detection
│     ├─ twin.ts                     # Twin Advocate Brief
│     └─ bias.ts                     # Bias pattern description
└─ prisma/
   ├─ schema.prisma                  # PKG-shaped data model
   └─ seed.ts                        # T2 Marketing seed (deterministic)
```

### Data model

A simplified Performance Knowledge Graph. The full architecture (Kafka event bus, Neo4j graph, ClickHouse time-series, vector index, per-tenant DEKs) lives in `Pulse360_PKG_Architecture.pdf` — for the pilot, all entities live in a single SQLite database with the same schema shape so the migration to Postgres + the real PKG stores is a swap of `provider`, not a rewrite.

Entities present today: Tenant, Person, Cycle, Project, Task, TaskAssignment, Collaboration (VCN edges), LivePulse, CycleScore, Achievement, FeedbackEvent, ManagerJustification, DiscrepancyFlag, TwinAdvocateBrief, BiasPattern, AuditEntry.

### Score model

Manager Eval (30) + Cross-Functional (30) + Self-Appraisal (20) + Achievement Points (20) — PRD §4.2/4.3. Self-Awareness Multiplier (+0 to +2) is captured in the schema but not surfaced in the pilot UI (it lives in the Voice Self-Appraisal flow, which is Phase 2).

### AI integration

Three capabilities use real Claude API calls:

| Capability | Module | Triggered from |
|---|---|---|
| Auto-Achievement Detection | `lib/ai/aad.ts` | Wired but not auto-fired in pilot; seed produces pending candidates directly |
| Twin Advocate Brief | `lib/ai/twin.ts` | On manager's first open of a direct's calibration sheet — cached for cycle |
| Bias Pattern Description | `lib/ai/bias.ts` | On HRBP visit to `/sentinel`; seeded explanations used when available |

All three use:
- `claude-opus-4-7` by default (override via `ANTHROPIC_MODEL` env)
- `messages.parse()` with `zodOutputFormat()` for typed JSON output
- Stable system prompts with `cache_control: { type: "ephemeral" }` for prompt caching (effective once system prompts grow past ~4K tokens — currently a no-op but free to leave in)
- Versioned prompts in `lib/ai/prompts.ts` keyed for future audit

Every AI invocation writes an `AuditEntry` (PRD §7.5 inference audit).

---

## Scripts

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run db:migrate   # Run pending migrations
npm run db:seed      # Reset + seed demo data
npm run db:reset     # Drop and recreate (with prompts)
npm run db:studio    # Open Prisma Studio at localhost:5555
```

---

## What's NOT in V1 (intentional)

- **Voice Self-Appraisal** (FR-06) — needs ASR vendor + UI. Phase 2.
- **Cross-Functional Micro-Survey** (FR-05) — schema is ready (FeedbackEvent table). UI is Phase 2.
- **Predictive Performance Engine** (FR-10) — needs trained per-tenant time-series model. Phase 3.
- **Anti-Collusion Engine** (FR-08) — graph algorithms over interaction strength. Schema ready.
- **Calibration Meeting Room** (FR-15) — real-time multi-cursor HRBP+Manager surface. Phase 3.
- **PKG Explorer** (FR-12 audit-grade) — Cypher + audit-mode for PDPL subject-rights ops. Phase 3.
- **Real upstream event bus** — pilot uses seeded events; production wires Kafka to ClocklessOps, AI Voice/Text Task OS, AI HR, Mood, Skill Futures, Ghost Detector.
- **OIDC/SAML auth** — pilot uses a persona-picker cookie. Production drops in NextAuth or equivalent (PRD §8.3).
- **Bilingual / RTL parity** — design system supports Cairo font and `.rtl` utility; surfaces ship in English first. Arabic strings + RTL layout switching is a tracked v1.1 task.
- **In-Kingdom deployment + PDPL compliance** — schema and audit-log shape are PDPL-ready; in-Kingdom hosting + KMS-managed CMKs are deployment-time concerns.

---

## Moving toward production

The pilot's single-database simplification is intentional. The path to the full PKG architecture is:

1. **Postgres swap** — `provider = "postgresql"` in `schema.prisma`; the schema is portable as-is.
2. **Event bus** — wire upstream WorkQuest modules to Kafka (or MSK / Event Hubs in-region) using the event envelope from PKG Architecture §5.1.
3. **Stream processors** — split the synchronous score-recompute path into Kafka Streams jobs (score recomputation, VCN derivation, achievement candidate generation).
4. **Graph store** — move COLLABORATED_WITH, MENTIONED_BY, EVALUATED edges to Neo4j Fabric (tenant-isolated databases).
5. **ClickHouse** — move FeedbackEvent + Task time-series for Bias Sentinel queries (the SQL in PKG Architecture §6.3.3 is ClickHouse-shaped).
6. **Per-tenant DEKs + region-pinned deployment** — KMS-wrapped CMKs, KSA tenants on Riyadh / Jeddah.

Everything in `app/`, `components/`, and `lib/ai/` stays unchanged through that migration — they query through the same Pulse360 Query API surface.

---

## License

Internal — WorkQuest pilot.
