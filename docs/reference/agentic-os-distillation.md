# Agentic OS — Distillation (Adopt / Adapt / Reject)

> Distilled 2026-06-19 from the `agent-dev:agentic-os` skill
> (`plugins/agent-dev/skills/agentic-os/SKILL.md`, single 388-line `SKILL.md`).
> A **prescriptive architecture** for running Claude Code as a persistent runtime / "operating
> system": a `CLAUDE.md` kernel that routes to specialist agents, file-based memory, scheduled
> automation, and a JSON/markdown data layer. Analyzed read-only against nxtlvl's existing
> architecture; every finding cited to `SKILL.md:line`. **Purpose:** record an adopt/adapt/reject
> judgment per the nxtlvl build method (review harnesses to shape ours). Companion to
> [hooks-mastery-distillation.md](hooks-mastery-distillation.md),
> [agent-skills-distillation.md](agent-skills-distillation.md),
> [superpowers-distillation.md](superpowers-distillation.md).

---

## 1. What it is, and the thesis

`agentic-os` is a **scaffolding pattern**, not a toolset: it tells you how to lay out a project so
Claude Code behaves like a persistent OS. Four layers, each a directory in the **project root**
(`SKILL.md:25-31`):

| Layer | What it holds | nxtlvl analogue |
|-------|---------------|-----------------|
| **Kernel** (`CLAUDE.md`) | Identity, an **Agent Registry table**, routing rules, model policy | `CLAUDE.md` + `nxtlvl-router` meta-skill |
| **Agents** (`agents/*.md`) | Specialist identities, each with a `Memory Scope` declaring the files it reads | `plugins/nxtlvl/agents/*` |
| **Commands** (`.claude/commands/`) | User-facing workflows (`/daily-sync`, `/decision`) | `plugins/nxtlvl/commands/*` |
| **State** (`data/`) | JSON (structured) + markdown (narrative); **no vector DB, no SQL** (`:165`) | the C&M subsystem (XDG store) |

Plus two cross-cutting mechanisms: **append-only daily logs + session-end reflections** as a
no-code learning loop (`:199-210`), and **external cron** (LaunchAgent / systemd / pm2) because
Claude Code's session cron dies with the session (`:214`).

**The thesis — declarative, file-based, no-database persistence.** Its worldview is that a solo
agentic system needs *no infrastructure*: the filesystem is the database, routing is a markdown
table, learning is an appended reflection, and state survives restarts because it was never in
memory to begin with. Two sentences carry the whole philosophy:

> "The kernel should be **small and declarative**. Routing logic lives in plain markdown tables,
> not code." (`:81`)
>
> "Memory is file-based. **No vector DB, no Redis, no PostgreSQL.** JSON and markdown files in
> `data/` are the database." (`:165`)

**Why this matters for nxtlvl up front — the architectural-shape collision.** agentic-os is a
**per-project scaffold**: its closing rule is *"One project = one Agentic OS. Do not share a single
`CLAUDE.md` across unrelated projects"* (`:388`). nxtlvl is the *exact opposite* — a **portable
plugin** that rides on top of any project precisely so its skills/agents/commands/hooks are shared
everywhere. agentic-os forbids the thing nxtlvl exists to do. This is not a feature disagreement;
it is a different unit of packaging (project-scaffold vs. cross-project plugin). It reframes every
verdict below: agentic-os's layers mostly govern **project-local state** (`data/`, `projects/`,
daily logs) that a plugin *deliberately does not own* — nxtlvl pushes that responsibility into its
**memory subsystem** instead. So most of the skill is "right idea, wrong owner" for nxtlvl, and the
genuinely portable parts (§3) are the few that are packaging-agnostic.

---

## 2. Headline — kernel-as-COO and the two doctrine collisions

Three of agentic-os's load-bearing claims sit directly against decisions nxtlvl has already made —
two as collisions, one as agreement. The nxtlvl-side positions below are *pre-existing* (each cited
to a settled memory note or doc); what this distillation newly contributes is **naming the
contrast** and resolving it — that is the highest-value part of this review.

### 2.1 Agreement — "the kernel never writes code, it routes"

> "You are the COO… You **never write code directly**. You delegate to the right agent and
> synthesize results." (`:53-54`)

This *matches* nxtlvl's build method ("the main session orchestrates and delegates") and the
planner-lead pattern catalogued in [hooks-mastery-distillation.md](hooks-mastery-distillation.md)
§4.4 (orchestrator-never-writes → workers → terminal validate). **Confirmation, not new
capability** — but worth recording as a third independent harness converging on the same
orchestrate-don't-implement split.

### 2.2 Collision A — "routing lives in markdown tables, not code" (`:81`) vs. your discoverability lesson

agentic-os hard-codes intent→agent mapping as a **static Agent Registry table** in `CLAUDE.md`
(`:56-73`): parse the prompt for keywords, match the trigger column, load `agents/<name>.md`. It
brands the alternative — `if (intent.includes('deploy'))` — an anti-pattern ("Over-Engineered
Routing", `:368`).

nxtlvl learned the opposite-shaped lesson the hard way (memory: `meta-skill-discoverability-in-plumbing`):
**router/meta-skills don't fire from a description table — entry has to be wired into the floor
brief.** agentic-os would call `nxtlvl-router` over-engineered; nxtlvl found description-based
routing *insufficient to even fire*. The reconciliation is **scale + mechanism**: a flat keyword
table is fine at ~4–5 agents with disjoint triggers (agentic-os's worked example), but (a) it
degrades as triggers overlap, and (b) it assumes the kernel-author wires routing by hand, whereas
nxtlvl wants routing to be a *skill* the model invokes. **Verdict: reject the static-table mechanism
for nxtlvl's scale; adopt nothing — this is a worked counter-position that re-confirms the
floor-brief wiring call.**

### 2.3 Collision B — reflections (`:199-210`) vs. instincts (`continuous-learning-v2`)

agentic-os's learning loop is a **session-end markdown reflection** ("What worked / What didn't /
What to change") appended to the daily log — "a feedback loop that improves the system over time
without code changes" (`:210`). By construction it is cheap but unstructured: the skill describes
appending prose with no scoring, deduplication, or promotion step (`:199-210`), so a human (or the
next session) must read the prose and act on it. (The "lossy" read is *our* analysis of that
absence, not a claim the skill makes.)

nxtlvl already runs the heavier, structured version of this idea: `continuous-learning-v2` —
atomic instincts with confidence scoring and evolution into skills/commands/agents. agentic-os's
reflection is the **minimum-viable ancestor** of that system. **Verdict: reject as a replacement
(nxtlvl's is strictly more capable); the one borrowable nuance is the *ritual* — an explicit
end-of-session checkpoint as the trigger that produces the learning, which nxtlvl can keep even
though the storage/representation differs.**

---

## 3. The genuinely portable pieces (packaging-agnostic)

These are the parts that survive the project-scaffold-vs-plugin reframe because they don't depend
on owning `data/`. They are the real yield of this review.

### 3.1 `Memory Scope` per-agent contract — the single highest-value adopt

Every agent file declares, in a fixed section, exactly which files it reads (`:96`, and best-
practice line `:384`: *"Every agent has a `Memory Scope` section defining what files it reads"*).
This is a cheap, capability-adjacent discipline: an agent's read surface becomes an inspectable
part of its definition rather than implicit in its prose.

This composes cleanly with the **read-only-by-withheld-tools** pattern from
[hooks-mastery-distillation.md](hooks-mastery-distillation.md) §4.1: that one constrains *what an
agent can mutate*; `Memory Scope` documents *what it should read*. Together they make an agent's
I/O surface explicit on both sides. **Adopt** — add a `Memory Scope` (or `Reads:`) stanza to
nxtlvl agent definitions, starting with `context-scout` (whose entire job is bounded reading) and
`doc-keeper`. Zero architectural cost; pure legibility gain.

### 3.2 No-migration schema rule — "never rename, add + deprecate" (`:315-324`)

> "Never rename existing fields. Add new fields and mark old ones deprecated."
> (`_deprecated_priority` alongside `priority_v2`, `:317-324`)

A concrete data-evolution convention with one real virtue: **zero migration cost** — historical
records stay readable with no migration script, because old fields are never removed, only
superseded. This is the *data-layer* cousin of nxtlvl's "superseded ADRs are kept, never deleted"
(decision rule §3) and the `ai_docs/legacy/` keep-don't-overwrite idiom. **Adapt** — a useful
candidate convention for the C&M subsystem's on-disk record format (instincts, memory frontmatter):
prefer additive-with-deprecation over rename-and-migrate, *unless* the store is small enough that a
clean migration is cheaper than carrying deprecated cruft. Worth an explicit call in the C&M
lifecycle spec rather than silent default either way.

### 3.3 External-cron recipes (`:214`, LaunchAgent / systemd / pm2)

Concrete, copy-pasteable scheduling for *durable* automation, on the correct platform fact that
Claude Code's own session cron dies when the session ends (matches memory: CC cron is session-
scoped). The three recipes (macOS LaunchAgent plist, Linux systemd timer, cross-platform pm2
`cron_restart`) are reference material. **Adapt** — keep as a reference if/when nxtlvl wants a
scheduled job (e.g. a nightly C&M consolidation or instinct-evolution pass) that must survive
session death. nxtlvl is on darwin, so the **LaunchAgent recipe is the relevant one**. Note this is
*external* infrastructure outside the plugin boundary — a project/user concern, not a plugin
artifact.

### 3.4 Sizing heuristics (`:379-380`)

"`CLAUDE.md` under 200 lines / each agent file under 100 lines and focused on one domain." Plain,
sensible budgets that match nxtlvl's pointers-over-content context policy (ADR-007). **Adopt
(confirm)** — already aligned; a usable lint target if a future audit ever checks doc/agent length.

---

## 4. What nxtlvl already does better (reject as replacement, note as confirmation)

- **File-based memory.** agentic-os's flat `data/{daily-logs,projects,decisions,inbox,contacts}/`
  (`:170-177`) is a directory convention with no lifecycle — append, read, never edit (`:383`).
  nxtlvl's C&M subsystem (XDG store, bookmarks ≥10/mutation, `/evolve` clustering, evolver agent —
  memory: `nxtlvl-context-memory-subsystem`) is a *managed* lifecycle. agentic-os is the cruder
  ancestor; **reject** its flat-log model as a replacement, but note the append-only/never-edit
  discipline is a defensible default for the *raw log tier* beneath the curated store.
- **Decisions as `data/decisions/` ADRs.** agentic-os name-drops "ADR format" (`:172`) but gives no
  threshold, no format, no curation. nxtlvl's decision rule (ADR-worthy test, house frontmatter,
  superseded-kept) is strictly more disciplined. **Reject** the loose version.
- **No hooks layer at all.** agentic-os has *no* event-driven control surface — it is cron +
  routing + files. nxtlvl is hooks-forward (context-alert, dangerous-bash gate) under a firm
  doctrine (`harness-hooks-inform-not-force`). This is a **gap in agentic-os's model**, not a
  lesson — worth recording only as "the scaffold pattern omits the deterministic-control layer that
  [hooks-mastery] over-emphasizes; nxtlvl sits between the two."

**Anti-pattern catalog (`:333-376`) — mostly confirmation.** Monolithic-single-agent (`:333`),
stateless-sessions (`:342`), hardcoded-creds (`:351`), external-DB-for-simple-state, and
over-engineered-routing (`:368`). All but the last are uncontroversial and already respected by
nxtlvl; the last is Collision A (§2.2) and is *not* accepted as stated.

---

## 5. Adopt / Adapt / Reject ledger (mapped to nxtlvl surfaces)

| From agentic-os | Verdict | nxtlvl surface → action |
|-----------------|---------|--------------------------|
| `Memory Scope` per-agent read-contract (`:96`,`:384`) | **Adopt** | Add a `Reads:`/`Memory Scope` stanza to agent defs; start with `context-scout`, `doc-keeper`. Composes with read-only-by-withheld-tools. Highest-value takeaway. |
| Kernel-never-writes / COO orchestration (`:53`) | **Adopt (confirm)** | Confirms build-method "orchestrate and delegate"; third harness converging on it. |
| Sizing budgets — CLAUDE.md <200, agent <100 (`:379-380`) | **Adopt (confirm)** | Already aligned with pointers-over-content; usable audit lint target. |
| No-migration schema rule — never rename, add+deprecate (`:315-324`) | **Adapt** | Candidate C&M record-format convention; weigh vs. cheap clean migration on a small store. Decide explicitly in the C&M lifecycle spec. |
| External-cron recipes (`:214`) | **Adapt** | Keep LaunchAgent recipe (darwin) for any durable scheduled C&M/instinct job; external to the plugin boundary. |
| Session-end **reflection ritual** (`:199-210`) | **Adapt (ritual only)** | Keep the explicit end-of-session checkpoint *as a trigger*; representation stays `continuous-learning-v2` instincts, not prose logs. |
| Append-only / never-edit logs (`:383`) | **Adapt (raw tier)** | Defensible default for the raw log tier *beneath* the curated C&M store; not for the curated store itself. |
| Anti-pattern catalog minus routing (`:333-365`) | **Adopt (confirm)** | Monolith / stateless / hardcoded-creds / external-DB all already respected. |
| Static Agent Registry routing table (`:56-81`) | **Reject (counter-position)** | Collides with `meta-skill-discoverability-in-plumbing`; table-routing degrades past ~5 agents and assumes hand-wiring. Keep router-as-skill + floor-brief wiring. |
| Flat `data/` memory model (`:165-177`) | **Reject (as replacement)** | C&M subsystem is the managed successor; agentic-os is the crude ancestor. |
| Loose `data/decisions/` ADRs (`:172`) | **Reject** | nxtlvl decision rule (threshold + house format + curation) is strictly better. |
| Reflection as the *whole* learning loop (`:210`) | **Reject (as replacement)** | `continuous-learning-v2` instincts supersede; keep only the ritual (above). |
| Per-project scaffold framing — "one project = one OS" (`:388`) | **Reject (architectural)** | nxtlvl is a *portable plugin* by design; cross-project sharing is the point, not the anti-pattern. |
| Cost machinery — per-session spend logging (`:387` best-practice) | **Reject** | Irrelevant on Max (memory: `user-max-subscription`). |

**Confirmations (recorded, not actioned):** kernel-never-writes, the anti-pattern catalog, and the
sizing budgets all independently corroborate settled nxtlvl positions.

---

## 6. ADR candidates & next actions

Per the decision rule's ADR-worthy test (architectural *and* expensive to reverse), nothing here is
a fresh standalone ADR — the findings are either confirmations or applications of decisions nxtlvl
already made (curation beats dilution). Two are decision-*shaped* and route to existing docs:

1. **`Memory Scope` as a cross-cutting agent-authoring convention.** If adopted for *every* nxtlvl
   agent (not just the two seeds), record it as an **amendment to the agent scoping doctrine**
   ([ecc-agent-vs-skill-scoping.md](ecc-agent-vs-skill-scoping.md)) — alongside the read-only-by-
   withheld-tools amendment already flagged in [hooks-mastery-distillation.md](hooks-mastery-distillation.md)
   §7. The two are the same idea (make an agent's I/O surface explicit) from the read and write
   sides; record them together. **Per the triangulation rule, before locking this check how
   superpowers and the upstream agent-skills define agent read-scope — don't decide from
   agentic-os alone.**
2. **No-migration schema convention for the C&M store.** A real data-layer call (additive-with-
   deprecation vs. clean migration) → fold into the **C&M lifecycle plan**
   (`docs/plan/nxtlvl-context-memory-lifecycle-plan.md`); decide explicitly rather than defaulting.

**Concrete next actions:**
- [ ] Add a `Memory Scope`/`Reads:` stanza to `context-scout` and `doc-keeper` (sandbox/ or plugin);
  pair it with the read-only-tool constraint from the hooks-mastery follow-up.
- [ ] Note the no-migration-schema option in the C&M lifecycle plan as an open record-format
  decision.
- [ ] Keep the LaunchAgent cron recipe on file for the first durable scheduled C&M/instinct job.
- [ ] Stage-3 reader-test this distillation with a fresh sub-agent, then it's done.

**Provenance note:** the source is the installed `agent-dev:agentic-os` skill, not a vendored clone —
re-readable any time at `plugins/agent-dev/skills/agentic-os/SKILL.md`. *This doc* is the durable
tracked artifact; it carries the decisions.
