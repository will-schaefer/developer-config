# Domain Review — Skills (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **skills** rubric.
> Neutral: judges a harness's skills on **general best practice for skill design** — nxtlvl's own
> lessons (the description-is-the-trigger, pointers-over-content, compose-don't-reconstruct) are cited
> as *rationale for why a checkpoint matters*, never as the bar the reviewed harness is scored against.

---

## 1. What this domain is — where to look

A harness's **skills** are the model-invoked playbooks the runtime surfaces by *description match* — a
skill loads when the agent judges its `description` relevant to the task at hand. Unlike a hook
(deterministic code on an event) or a command (user-typed entry point), a skill is summoned by the
model, so the `description` *is* the interface: it gets the skill on stage, and the body is the
procedure it then performs. Read, in order:

- **The descriptions first** — every `skills/**/SKILL.md` frontmatter `description`. This is ground
  truth for *what fires when*. Read all of them before any body: triggering is the dominant axis, and
  collisions only show up across the set.
- **Then the bodies** — the SKILL.md procedure itself. Is it an actionable spine, or a wall of
  always-on prose that should live in `references/`?
- **The `references/` dirs** — the load-on-demand detail a skill pulls in only when needed. A skill
  with a lean spine and well-factored references is the load-on-demand pattern working as intended.
- **The conventions** — naming (`name` matches the directory), frontmatter shape, and whether the set
  follows one house style. *(Cross-check frontmatter keys against current upstream skill docs — repo
  conventions drift.)*

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimension: D1 (description-as-trigger quality)** — a skill that never fires is worth
nothing no matter how good its body, and a skill that fires on the wrong tasks is worse than absent.
D6 (single-purpose scope) is the close second: a grab-bag skill can't have a sharp trigger. A fatal
flaw in either caps the overall; don't flat-average it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Description-as-trigger quality** ⭐ | Does the `description` make the skill fire for the right task and *not* others? | Names concrete when-to-use situations, tasks, and user phrasings; specific enough to fire on the intended ask and stay silent otherwise. | Vague one-liner ("helps with code") that never matches real phrasing — dead on arrival — or so broad it fires on everything. |
| 2 | **Frontmatter correctness** | Are `name` and `description` present, valid, and conventional? | Required keys present and well-formed; `name` matches the directory; no schema violations. | Missing/malformed `description`; `name` mismatched or absent; invalid frontmatter the runtime can't parse. |
| 3 | **Body-vs-references factoring** | Is detail loaded on demand, or always-on? | SKILL.md is a lean spine; heavy procedure, tables, and examples live in `references/` and load only when needed. | A multi-hundred-line SKILL.md carrying everything inline; nothing pushed to `references/`; the whole payload paid on every load. |
| 4 | **Composition** | Does it build on other skills or re-implement what they own? | Routes to / composes sibling skills and native tools for capabilities they already own; adds only its unique part. | Re-implements a job another skill already does (its own ad-hoc planner, its own review pass) instead of routing to it. |
| 5 | **Process clarity** | Can a reader actually execute it? | A clear checklist or numbered flow with verification steps; an agent can follow it end-to-end and know when it's done. | Aspirational prose with no executable steps; no verification; the reader can't tell what to *do* or when it's complete. |
| 6 | **Single-purpose scope** | One job per skill, or a grab-bag? | One coherent job, sharply bounded — which is exactly what lets D1's trigger be specific. | A kitchen-sink skill spanning several unrelated jobs, forcing a vague description that can't trigger cleanly. |
| 7 | **Clarity & maintainability** | Readable, consistent, docs-match-behavior? | Consistent house style; references resolve; the body describes what the skill actually does. | Drifted docs (body promises steps it doesn't take); broken `references/` links; one-off formatting per skill. |

---

## 3. What to hunt — the concrete checks

- **The trigger read** — for each `description`, ask out loud: *what user phrasing makes THIS fire,
  and could it misfire?* A description that names no concrete situation scores D1 = 1. *(Why it
  matters: the description is the trigger — a skill whose description doesn't match how a task is
  really phrased never gets summoned, however good its body.)*
- **The collision sweep** — read all descriptions as a set and look for **two skills with overlapping
  triggers**. Ambiguous routing means the model picks unpredictably between them; that's a D1/D6 hit
  on both. *(Why: the runtime routes by description; overlapping descriptions create a triggering
  collision the body can't fix.)*
- **The meta-skill blind spot** — a router/dispatcher/"discover which skill applies" skill usually
  **won't fire from its description alone**. Check whether its entry point is wired in (named in a
  floor brief, command, or always-on rule) rather than left to description match — if not, it's
  latently dead. *(Why: nxtlvl found meta-skills don't trigger by description; the entry must be
  wired.)*
- **The length-and-factoring check** — measure SKILL.md size; for any heavy body, ask whether the
  bulk *should* sit in `references/` loaded on demand. A fat always-on spine is a D3 hit. *(Why:
  pointers-over-content — keep the spine lean, push detail to references.)*
- **The reconstruction hunt** — find skills that re-implement a capability another skill (or a native
  tool) already owns instead of composing it. That duplication is a D4 cap. *(Why: compose-on-native
  / composes-don't-reconstruct — don't duplicate what already exists, route to it.)*
- **The executability test** — confirm each skill carries an actual checklist or flow, and that the
  body follows it. Aspirational prose with no steps scores D5 = 1.
- **The drift check** — does the body describe what the skill actually does? A description or step
  list that promises behavior the procedure doesn't deliver is a claim-vs-wiring finding (D7).

---

## 4. Partition & signal-vs-demo

- **Partition:** ≲ 4 skills → one deep agent over the whole `skills/` tree (it can hold every
  description in view at once, which is what the collision sweep needs). More → one agent per
  **skill-cluster** (group by directory or by domain), each scoring §2 for its slice. Always have at
  least one agent — or the synthesis — read *all* descriptions together, since collisions and routing
  gaps are only visible across the full set.
- **Signal vs demo:** tutorial/teaching harnesses ship a deliberately-trivial example skill ("greet
  the user", "echo the input") to demonstrate the SKILL.md format. Don't score that as craft — note
  it as demo and judge the *real* skills.

---

## 5. Lessons & gotchas

- **The description is the whole interface.** Reviewers default to reading the body and skimming the
  description; invert that. The body only matters once the description has won the trigger — score the
  trigger first and hardest. A confident, well-written body behind a vague description is a 1 on D1.
- **A great body can't rescue a dead trigger, and a sharp trigger can't rescue a vague body** — but
  the failure modes are asymmetric. A skill that never fires is invisible; a skill that fires wrongly
  actively misroutes the agent. Weight misfiring as the worse outcome.
- **Meta-skills and routers are the classic trap.** They read as the most important skills in the set
  and are the most likely to be dead — because "use this to discover skills" doesn't match any
  concrete task phrasing. Always check that their entry is *wired*, not left to description match.
- **Bulk in the spine is a silent tax.** A fat SKILL.md isn't wrong on day one, but every load pays
  for detail most invocations don't use. Load-on-demand via `references/` is the default-correct
  shape; an always-on wall earns the D3 downgrade.
- **Composition beats reconstruction, but only if the composed skill exists and fires.** A skill that
  "routes to" a sibling whose own description never triggers has only moved the dead-trigger problem —
  check the target's D1, not just the caller's intent.
- **Separate signal from demo first.** Scoring a tutorial's throwaway example skill as if it were
  production craft inflates the verdict; call it out and judge the real set.
- **Cross-check frontmatter conventions** against current upstream skill docs before trusting a repo's
  own description of its required keys or routing rules — they go stale.
