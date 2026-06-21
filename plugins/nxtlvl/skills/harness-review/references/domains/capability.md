# Domain Review — Capability / feature-spanning (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **capability**
> (feature-spanning) review. Neutral: judges a *capability that spans component types* on **general
> best practice** — nxtlvl's own lessons (single source of truth, route don't duplicate, load what
> you ship) are cited as *rationale for why a check matters*, never as the bar the reviewed harness
> is scored against.
>
> **Composed review, not a flat rubric.** A capability — "the planning capability", "the discovery /
> ideation capability", "the hook *feature*" — is delivered by a skill *and* an agent *and* a command
> *and* a rule together. This review does **not** invent a new dimension set; it **composes** the
> per-component rubrics around a spine and scores the *wiring between them* as the headline. This is
> the first-class form of the "names a feature, not a component type" path in
> [`../domain-review.md`](../domain-review.md) §1.

---

## 1. What this domain is — where to look

Reach for **`capability`** when the ask names a *capability* rather than a *component type*: "how good
is this harness's planning / brainstorming / memory-as-a-feature / research flow?" The capability is
encoded across several surfaces; the interesting question is rarely "is any one surface good?" but
"do the surfaces form **one** coherent capability with a single source of truth and routing between
them — or N drifting copies that nothing connects?"

Set the contract as `DOMAIN=<spine> · FOCUS=<capability>` (e.g. `DOMAIN=commands · FOCUS=planning`).
Read, in order:
- **Every surface that encodes the capability** — grep the feature's name/intent across `skills/`,
  `agents/`, `commands/`, `rules`/`modes`, docs. Count the encodings; you will usually find several.
- **The manifest / loader** — `plugin.json`/`settings.json`/`@import`s: which of those surfaces does
  the runtime *actually load*? (Encoded ≠ loaded; this gap is the review's core.)
- **The routing between them** — is there a front door that dispatches to the right surface, or do
  the copies sit unconnected?
- **The shipped vs. authored tree** — does `plugins/`/dist ship a *truncated* copy while the full
  version sits in an un-shipped `src/`? Safety guards often live only in the authored copy.

---

## 2. The method  (compose per-component rubrics around a spine)

This review scores three things: the **spine** (full rubric), the **supporting slices** (dominant
dimensions only), and the **cross-wiring** (the dominant, capping judgment).

**Step 1 — Pick the spine.** The spine is the **capability-bearing component the runtime actually
loads** — the surface that, if wired, *is* the capability (usually the skill or the command, sometimes
the agent). Not the richest file — the *loaded* one. Score the spine on its full component-type rubric
([`skills.md`](skills.md) / [`commands.md`](commands.md) / [`agents.md`](agents.md) / …) — a complete
1–5 scorecard.

**Step 2 — Assess the supporting slices.** Each other surface encoding the capability is a supporting
slice. Score it **only on its own rubric's dominant dimension(s)** — not a full scorecard — and let a
fatal flaw there cap that slice. (A planning *mode* → `rules.md`'s activation/wiring dimension; a
planning *agent* → `agents.md`'s single-job + tool-least-privilege dimensions.)

**Step 3 — Score the cross-wiring (the dominant, capping judgment).** The headline is whether the
surfaces compose into one capability. Score this 1–5; **it caps the overall** — a set of individually
decent surfaces with no source of truth and no router is *broken as a whole*, and the verdict must say
so rather than averaging the parts up.

| Cross-wiring | What a 5 looks like | What a 1 looks like |
|--------------|---------------------|---------------------|
| **Source of truth** | One canonical encoding; others reference it | The capability is re-encoded N× with no canonical copy; copies drift |
| **Routing** | A front door dispatches to the right surface | Encoded N×, **routed 0×** — no router; the user picks or the capability is lost |
| **Loaded = shipped** | The rich version is the loaded version | Depth lives in **dead files** the manifest never loads; the loaded copy is the shallow/truncated one |

**Verdict scale.** Report `≈X/5` with the recurring shape where it fits: **"strong in parts, broken as
a whole"** — strong individual surfaces, fatal cross-wiring. State the cap explicitly (e.g. "≈2/5 —
spine D3=1 compounded by no router").

---

## 3. What to hunt — the recurring failure archetypes

These are the defects feature-spanning reviews surface again and again; each maps to the cross-wiring
score or a slice's dominant dimension:

- **Encoded N×, routed 0×** — the capability written into several surfaces with no single source of
  truth and **no router** between the copies. The signature finding; caps cross-wiring.
- **Depth lives in dead files** — the richest artifact (a long config/mode/spec) is *unreachable*
  because the manifest omits its key (no `plugin.json` entry, no `@import`, no hook injection). The
  best file is the deadest; the loaded surface is shallow.
- **Stale copy shipped or stale copy survives** — two variants of the same rot: the build ships a
  *truncated* copy missing its safety scaffolding (STOP-guards, boundaries) while the complete version
  sits in an un-shipped `src/` (authors know what good looks like; the build ships the worse copy); or
  a new generation *supersedes* an old one in distribution but the legacy copy is *never retired*, so
  both ship and routing is ambiguous.
- **0/N components declare scope** — read-only roles inherit Write/Edit/Bash because the agents/skills
  declare no `tools:` field; systemic over-grant across the capability's components.
- **Colliding identities** — two surfaces with the same name and divergent bodies (e.g. `deep-research`
  vs. `deep-research-agent`), so routing is ambiguous even if a router existed.
- **Freshness rot / unmeasured claims** — named MCP engines (Tavily/Serena/Playwright) absent from the
  shipped `.mcp.json`; "30–50% faster" / "150×" performance claims asserted as fact, never measured,
  sometimes already debunked upstream.
- **Silent substrate degradation** — a backend step the capability depends on (a memory/neural/index
  stage) no-ops on empty or missing state and reports success anyway, so the capability *appears* wired
  but does nothing. Distinct from an unmeasured claim: here the step runs and silently delivers nothing.
  (When the capability *is* memory, audit it with [`memory.md`](memory.md)'s degraded-mode dimension.)

For each: separate what the docs *claim* from what the runtime *loads and runs*, and cite `file:line`.

---

## 4. Partition & signal-vs-demo

- **Partition:** fan out by **surface** — one agent on the spine (full rubric), one per supporting
  component type (its dominant dimensions), and reserve the **cross-wiring synthesis for the main
  thread** (it needs all digests at once and is the capping judgment, so it must not be split). State
  the spanning set in the header Scope line: `DOMAIN=<spine> · FOCUS=<capability>`.
- **Signal vs demo:** a harness may ship an example feature to show the format; judge the real
  capability, note the demo. A README's confident description of the capability is rhetoric until you
  confirm which surface the runtime actually loads.

---

## 5. Lessons & gotchas

- **A capability is only as good as the routing between its copies.** The whole point of this review is
  that good parts do not make a good capability; the connective tissue does. Lead with the cross-wiring
  judgment, and let it cap the verdict.
- **Pick the loaded surface as the spine, not the impressive one.** The seductive mistake is to score
  the 500-line mode file as the spine; if the manifest never loads it, it's a *dead* supporting slice,
  and the real spine is whatever shallow command actually fires.
- **Encoded ≠ loaded ≠ routed.** Three separate checks: is it written? does the runtime load it? does
  anything route a task to it? A capability can pass the first and fail the next two — that's the
  common case, and the common cap.
- **"Strong in parts, broken as a whole" is a real and frequent verdict.** Don't let high per-surface
  scores pull the overall up; name the systemic cross-wiring failure and cap accordingly.
- **Don't force a feature onto one registry row.** If the ask spans component types, this is the right
  review — composing per-component rubrics — not a single component-type audit that misses the wiring.
