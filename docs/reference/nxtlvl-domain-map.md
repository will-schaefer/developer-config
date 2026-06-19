# nxtlvl Domain Map — Three Layers

> Drafted 2026-06-18. Maps the **domains nxtlvl organizes around**, scoped down from ECC's
> ~23-domain breadth to this harness's actual workload. Uses "domain" in ECC's native sense
> (`reference/ECC-main` skills are *"Grouped by domain"*, [ecc-main-map.md](ecc-main-map.md):78)
> and the pairing rule from [ecc-agent-vs-skill-scoping.md](ecc-agent-vs-skill-scoping.md):55
> (*"a domain ships both"* — a knowledge skill + an isolated executor agent).
>
> **Anchor:** [`../intent/personal-harness.md`](../intent/personal-harness.md) (workload at
> lines 191–202; reconstruction backlog at 52–61). **Governs:** which buckets `/spec` and the
> intake gate ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)) file new
> components into, and which stay dormant-in-ecc
> ([ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md)).
> **Purpose:** a *lens for filing and scoping*, not a build manifest — most cells below are
> empty until the reactive loop earns them.

---

## 1. What "domain" means here — and the three layers

"Domain" gets used three ways in this harness; this map keeps them separate and shows how
they stack. Read top-down: a **workflow** operates over **capability domains**, running on the
**architectural subsystems**, all sitting above the **native** primitives we never rebuild.

```
LAYER 2 · WORKFLOW       review · dev · research · [agent-building*]      verbs / entry points
            │ operates over
LAYER 1 · CAPABILITY     languages · app-build · knowledge · agentic · quality   subject-matter
            │ runs on
LAYER 3 · ARCHITECTURAL  config · context · memory · composition · hooks · audit · metric   subsystems
            │ below the plugin boundary
NATIVE (never reconstructed)  skill routing · agent dispatch · tool-loop · context-window assembly
```

- **Layer 1 — Capability domains** = the ECC "grouped by domain" sense: *subject-matter*
  buckets a skill/agent is filed under (Rust, Frontend, Knowledge & Docs…). This is the layer
  the phrase "the domains we will use" most directly names. **§2.**
- **Layer 2 — Workflow domains** = the *verbs* / user-facing entry points (`review`, `dev`,
  `research`). A workflow reaches into capability domains on demand. **§3.**
- **Layer 3 — Architectural domains** = the *subsystems* the components live inside — the
  reconstruction backlog (config, context, memory, composition, hooks, audit, metric). **§4.**

How they compose is **§5**; the per-domain component-type rule (skill+agent+command) is **§6**;
growth/scoping is **§7**.

---

## 2. Layer 1 — Capability domains (the subject-matter taxonomy)

Scored ECC's domain list against the intent's workload (`personal-harness.md:191-202`:
Next.js full-stack · Python · Rust · knowledge-base · LLM-wiki · agentic engineering).
**~12 active domains vs ECC's 23 + 15 languages.**

### 2a. Domains nxtlvl *will* use

| Group | Domains | Why (workload driver) |
|---|---|---|
| **A · Languages** (language-plural day one — `personal-harness.md:197`) | TypeScript/JavaScript · Python · Rust | The three languages in the real monthly stream. |
| **B · App-build** (lean; web/desktop-app-shaped) | Frontend & UI · Backend/Architecture · Integrations & APIs · DevOps & Infra | Next.js full-stack + desktop apps. Kept thin — deploy/infra is *workbench-grade*, not ops-grade. |
| **C · Knowledge** (differentiated work) | Knowledge & Docs · Research | Knowledge-base + LLM-wiki construction. `research` is the one workflow built fresh (`personal-harness.md:42`). |
| **D · Agentic / Meta** (differentiated *and* dogfooded) | Agentic Engineering / Agent Orchestration · Meta/Harness | Building agents *with* the harness — dogfooding is automatic. Meta/Harness = nxtlvl building itself (the learning target). |
| **E · Quality** (cross-cutting — never standalone; applies across A–D) | Code Quality & Review · Testing · Security | Review is a core workflow; Testing is a build-loop stage; Security backs the audit's no-secrets gate. |

> **Build-now confident-core** ([ADR-013](../decisions/ADR-013-confident-core-capability-domains.md),
> 2026-06-18): Python · TypeScript/JS · Rust (group A) + Frontend & UI · Backend/Architecture
> (group B) are **pre-built now** — each ships the full §6 triad — rather than waiting for the
> fallback signal. The membership test's *build-now* branch (`ADR-008:22`) authorizes them, and
> the **bounded five-domain list is the new brake** (a 6th build-now domain is itself an ADR).
> The other group-B domains (Integrations & APIs, DevOps & Infra) remain **reactive**.

### 2b. Domains deliberately *out* → dormant-in-ecc, reached only via the logged fallback

Naming these **is** the scoping-down the intent insists on (`personal-harness.md:204-212`). Each
is a candidate the intake gate ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md))
must justify before it enters; until then it lives in dormant ecc
([ADR-002](../decisions/ADR-002-ecc-dormant-reference-backstop.md), `personal-harness.md:73-80`)
and every reach is logged ([ADR-005](../decisions/ADR-005-fallback-log-dual-metric.md)).

| Out-of-scope domains | Out-of-scope languages |
|---|---|
| Content & Marketing · Finance & Trading · Healthcare · Scientific · Logistics & Ops · Motion & Animation · Networking · Data & ML · Autonomous Loops | C# · C++ · Dart · F# · Go · Java · Kotlin · Perl · PHP · Ruby · Swift · Vue |

> **Taxonomy note:** the language column mirrors ECC's own `### Language:` groupings
> ([ecc-main-map.md](ecc-main-map.md):281-388) — which is why **Vue** appears there as a
> "language." **Ruby** is the one addition: ECC ships it only in its rules layer
> ([ecc-main-map.md](ecc-main-map.md):986), not as a `Language:` section.

> **Edge note:** Data & ML and Autonomous Loops sit closest to the line (Python/agentic work
> brushes them). They stay *out* by default precisely because they're the easiest to
> rationalize in — the gate exists for exactly these.

---

## 3. Layer 2 — Workflow domains (the verbs / entry points)

The user-facing entry points. Each **composes** native + agent-skills rather than rebuilding
substance ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md)); each reaches into
Layer-1 capability domains on demand — *that* is what "language-plural" means operationally.

| Workflow | Composes | Reaches (capability domains) | Status |
|---|---|---|---|
| **`review`** | agent-skills five-axis review, refined for fit | E (Quality) + the changed file's language (A) / shape (B) | Phase-0 (M0/M5) |
| **`dev`** | agent-skills `/spec→/plan→/build→/test→/review` loop | A + B + E, per the change | Phase-0 (M2/M5) |
| **`research`** | built fresh (`deep-research` as *structural ref only*) | C (Knowledge) | Phase-0 (M5) |
| **`agent-building`** \* | TBD | D (Agentic/Meta) | **Reactive** — likely 4th workflow, not pre-built ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)) |

\* Pre-building `agent-building` is exactly the "seems useful" move the intake gate forbids; it
enters only when the fallback log proves repeat-need.

---

## 4. Layer 3 — Architectural domains (the subsystems)

The reconstruction backlog (`personal-harness.md:52-61`) as internal domains. Strategy is
**not uniform** — three tiers per [ADR-003](../decisions/ADR-003-compose-not-reconstruct.md):
*reconstruct* the plumbing, *compose* the workflow substance, leave orchestration *native*.

| Subsystem | Strategy | Governing ADR | Phase-0 milestone |
|---|---|---|---|
| Layered config + packaging | reconstruct | [ADR-001](../decisions/ADR-001-plugin-local-marketplace-packaging.md) | M0/M1 |
| Context assembly/injection | reconstruct (budgeted, pointers>content) | [ADR-007](../decisions/ADR-007-context-budgeted-injection.md) | M4 |
| Memory | **extend native**, no new store | [ADR-004](../decisions/ADR-004-extend-native-memory.md) | M3 |
| Composition layer | reconstruct (when skills fire, how agents chain) | [ADR-003](../decisions/ADR-003-compose-not-reconstruct.md) | expressed via M2/M5 |
| Hooks | reconstruct (lean, fail-open, flat-per-lane) | [ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md) | M6 |
| Audit | reconstruct (objective, binary, *invoked*) | [ADR-009](../decisions/ADR-009-objective-invoked-audit-gate.md) | deferred (Phase ≥1) |
| Fallback-log + metric | reconstruct (north-star substrate) | [ADR-005](../decisions/ADR-005-fallback-log-dual-metric.md) | M7 |

> **The "never reconstruct" boundary** ([ADR-003](../decisions/ADR-003-compose-not-reconstruct.md)):
> skill routing, agent dispatch, the tool-use loop, and context-window assembly live below the
> plugin boundary and are **native, permanently.** A hand-built router is a slower, capped shim
> around the real dispatcher. This is the floor under all three layers.

---

## 5. How the three layers compose

A single task touches all three. Worked example — **a Rust bug fix driven through `dev`:**

1. **Workflow (L2):** `nxtlvl:dev` is the entry point — runs the `/spec→…→/review` loop.
2. **Capability (L1):** the loop reaches **Rust** (A) for idioms, **Testing** (E) for the
   regression test, **Code Quality & Review** (E) at the `/review` gate. Frontend, Python, and
   every out-of-scope domain stay untouched — that's the scoping paying off in context budget.
3. **Architectural (L3):** the run sits on **context injection** (SessionStart pointers),
   **composition** (how the review agent is spawned and its knowledge skill injected),
   **hooks** (fallback-log fires if any `ecc:` thing is reached), **memory** (durable Rust
   conventions recalled), and the **metric** (the session row).
4. **Native:** the dispatcher routes the skill and spawns the agent — we wrote none of that.

The orthogonality is the point: **adding a capability domain (L1) does not add a workflow (L2)
or a subsystem (L3).** A new `postgres-patterns` skill files under B/Data-adjacent without
touching the `dev` verb or the hook layer.

---

## 6. Component types per domain — the pairing rule

When a Layer-1 domain *earns* growth, it ships a **layered set**, not a lone file
([ecc-agent-vs-skill-scoping.md](ecc-agent-vs-skill-scoping.md):55-134):

```
COMMAND (thin entry) ──spawns──▶ AGENT (isolated, tool-scoped executor) ──consults──▶ SKILL (caller-agnostic knowledge)
```

The decisive tells (from that doc's §2/§5):

- **Reusable in-context knowledge** → **skill** (no tools, no model, no isolation).
- **Needs isolation, a tool sandbox, or autonomy** → **agent** (e.g. a *read-only* reviewer
  that must not write — inexpressible on a skill).
- **User-typed entry** → **command** (thin; delegates, holds no durable logic).
- **Fires unasked** → **hook**; **always-on shaping** → **rule**.

Mapped to nxtlvl's near-term pieces (from that doc's §7): `nxtlvl:review` = command/skill entry
→ isolated reviewer agent; the Quality domain (E) is where the *read-only reviewer agent*
pattern lives; awareness pings = hooks; ask-vs-proceed posture = a rule.

---

## 7. Growth & the intake gate

- Layer-1 domains are **filing buckets**, not commitments — most stay empty until a real task
  fills them.
- **Exception — the confident-core** ([ADR-013](../decisions/ADR-013-confident-core-capability-domains.md)):
  Python · TS/JS · Rust · Frontend & UI · Backend/Architecture are **build-now**, not reactive.
  The bounded five-domain list *is* the brake; everything outside it (including Integrations &
  APIs and DevOps & Infra) still needs the one-line intake entry.
- A new component enters **only** via the written intake gate
  ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)): a one-line backlog entry
  naming *the task that required it* and *the existing thing that failed*. Fed by the fallback
  log; an out-of-scope domain (§2b) crossing into scope is the same gate, just bigger.
- **Harden trigger:** the same logged miss N≈2–3× turns a workflow (L2) into a revision ticket.
- Hooks (L3) register **flat, one per event+matcher lane**; a consolidating dispatcher is
  itself reactive machinery, admitted only once a lane carries ≥2 hooks
  ([ADR-008 hook-layer corollary](../decisions/ADR-008-reactive-growth-intake-gate.md)).

The through-line: **the map defines the shape; the fallback log decides what actually grows
into it.**
