# Mode C — Domain Review (deep single-component specialist audit)

> Per-mode reference for the **`harness-review` skill**, Mode C. `SKILL.md` is the shared spine
> (vendor → map → fan-out → reader-test → land); this file owns the **fork**: the `DOMAIN` contract
> and fan-out payload (§1), the domain registry (§2), the artifact format (§3), the knobs (§4), the
> lessons (§5), and the recipe for **authoring a new domain rubric** (§6). Read it before your first
> Mode-C run, then load the one `domains/<domain>.md` rubric for the component type you're reviewing.
>
> Mode C answers **"how good is this harness's `<DOMAIN>` specifically?"** — a deep, specialist audit
> of *one* component type (its hooks, or its agents, or its skills…), scored against a rubric tuned
> to that component's real failure modes. It is the depth Mode A's whole-harness pass can't reach:
> Mode A applies a generic six-dimension rubric across everything; Mode C swaps in a domain-expert
> rubric and points it at one subsystem. (For "how good is the *whole* harness," use Mode A →
> [`general-review.md`](general-review.md); for "what should *my* harness borrow," use Mode B →
> [`adopt-adapt-reject.md`](adopt-adapt-reject.md).)

---

## 1. The `DOMAIN` contract and the fan-out payload

**`DOMAIN`** (required) is the component type to audit — one of the registry rows in §2 (`hooks`,
`agents`, `skills`, `commands`, `tools`, `rules`). It selects the specialist rubric and tells the
run where to look. **`FOCUS`** (optional) narrows *within* the domain (e.g. "just the `PreToolUse`
hooks", "only the build-resolver agents") — a lens for attention, not a comparison.

Mode C is **neutral**, like Mode A: it judges the domain **on the harness's own terms against
general agent-harness best practice** — there is **no `TARGET` and no `LENS`**. Mapping a domain
against *your* harness's surfaces to decide what to borrow is Mode B's job, not Mode C's. The
specialist rubrics cite nxtlvl's own hard-won lessons (inform-don't-force, single-objective-gate,
fail-open-for-session-hooks) as **rationale for why a checkpoint matters** — never as the bar a
reviewed harness is scored against. *Judge the harness, not its resemblance to nxtlvl.*

**Phase 2 forks here.** Instead of partitioning the *whole harness* into domains, Mode C partitions
**within** the chosen domain so the fan-out still parallelizes:
- **Few artifacts** (≲ 4 hook scripts / agents / etc.) → a **single deep agent** over the whole
  domain is enough; skip the fan-out.
- **Many artifacts** → fan out **one agent per artifact (or per artifact-group)**, each scoring its
  slice on the same specialist rubric. The domain's rubric file carries a partition hint.

**The fan-out payload.** On top of the shared Phase-3 elements (read-only mandate, scoped target,
claims-vs-wiring discipline, `file:line` citations — see `SKILL.md`), every Mode-C fan-out agent
prompt MUST add:

1. **The specialist rubric** — paste or point the agent at `references/domains/<DOMAIN>.md` §2, and
   require it to **score each dimension 1–5 with a one-line `file:line` justification**. Score the
   wiring, not the README.
2. **The neutral framing** — "judge this on general best practice for `<DOMAIN>`; nxtlvl's lessons
   are rationale, not the bar."
3. **Required output shape** — what's there, how it works (cited), strengths, weaknesses/risks, and
   the rubric scores. Conclusions, not file dumps.

---

## 2. The domain registry

The six component types Mode C reviews. Each row maps a `DOMAIN` value to its specialist rubric, what
it covers, and where it typically lives. **These rubrics are the canonical per-component-type
criteria** — Mode A's "weighting by component type" table ([`general-review.md`](general-review.md)
§1) is the one-line summary; the depth lives here.

| `DOMAIN` | Rubric | What it audits | Typical location |
|----------|--------|----------------|------------------|
| `hooks` | [`domains/hooks.md`](domains/hooks.md) | Event-driven automation: gates, guards, lifecycle handlers | `hooks/`, `hooks.json`, `settings.json` |
| `agents` | [`domains/agents.md`](domains/agents.md) | Subagents: system prompts, tool grants, isolation, return shape | `agents/`, `*.md` with agent frontmatter |
| `skills` | [`domains/skills.md`](domains/skills.md) | Skills: descriptions-as-triggers, factoring, composition | `skills/**/SKILL.md` |
| `commands` | [`domains/commands.md`](domains/commands.md) | Slash commands: argument design, naming, thin-wrapper discipline | `commands/`, `*.md` with command frontmatter |
| `tools` | [`domains/tools.md`](domains/tools.md) | Tools / MCP: input schemas, output shapes, error surfaces | `mcp/`, tool/server definitions |
| `rules` | [`domains/rules.md`](domains/rules.md) | Rules / docs / context: guidance that shapes behavior | `CLAUDE.md`, `rules/`, `docs/`, context files |

**Adding a domain** is the extension contract: author a `domains/<name>.md` from the §6 template,
add one row here, and (if it overlaps a Mode A component type) cross-link Mode A's weighting table.
That's the whole move — no spine changes.

---

## 3. The artifact format (Phase 5 output)

Write `docs/reference/<repo>-<DOMAIN>-review.md` (e.g. `superpowers-hooks-review.md`). Scaffold every
header with a placeholder first, then fill and review each in turn. Lead with the Phase-4 spine — the
headline judgment about this subsystem.

```markdown
> **<repo> — <DOMAIN> review.** <one-line what the subsystem is>. Analyzed <date> · <size> ·
> source: <url>. Scope: <DOMAIN>[ · FOCUS]. Method: vendor → parallel read-only fan-out
> (<N> artifacts) → <DOMAIN>-specialist synthesis.

## 1. Spine — the headline judgment
The single most important thing about this subsystem: is it sound, what defines its quality, what
caps it. Lead here.

## 2. What's there & how it works
The artifact inventory and how the subsystem operates end-to-end, cited to file:line. A table or
diagram if it helps.

## 3. Specialist scorecard   (the scored verdict)
- The rubric table: each <DOMAIN> dimension × score (1–5) with one-line file:line justification.
- **Strengths** — what it does genuinely well, with evidence.
- **Weaknesses & risks** — fragilities, gaps, claim-vs-wiring mismatches; flag any fatal flaw that
  caps the overall (don't flat-average it away).
- **Headline verdict** — one paragraph: overall quality of this subsystem, and what caps it.
```

**Citations:** every non-obvious claim cites `file:line` from the clone. **Separate signal from
demo:** call out teaching/demo filler (a tutorial's deliberately-trivial example hook) so it isn't
scored as craft.

---

## 4. Knobs (Mode C)

| Knob | Varies by | Default |
|------|-----------|---------|
| `REPO` | every run | — (required) |
| `DOMAIN` | which component type to audit | — (required; a §2 registry value) |
| `FOCUS` | user only cares about part of the domain | — (optional; whole domain) |
| Within-domain partition | artifact count | single agent ≲4 artifacts; else per-artifact |
| Fan-out agent count | partition size | 1–N |
| Signal-vs-demo filter | teaching/demo vs production repo | on for demo repos |
| Audit depth | subsystem richness | full template; thin subsystem → short note |

---

## 5. Lessons & gotchas

- **Neutral, not nxtlvl-graded.** The fastest way to corrupt a Mode-C run is to score a harness on
  how closely its hooks match nxtlvl's. Judge general best practice; cite house doctrine only as
  *why a dimension matters*. Borrow judgments are Mode B.
- **Score the wiring, not the README.** A confident philosophy doc is not evidence of a robust hook
  or a well-triggered skill. Where claimed capability and shipped behavior diverge, that gap *is* a
  finding — usually a hit to the domain's effectiveness/fitness dimension.
- **One rubric per domain, or scores don't compose.** When fanning out per-artifact, every agent
  must use the same `domains/<DOMAIN>.md` §2 dimensions and 1–5 scale; otherwise Phase 4 reconciles
  apples and oranges.
- **Don't flat-average the overall.** A fatal flaw in the dimension that dominates this domain (e.g.
  a fail-closed session hook with no kill switch) can cap the subsystem's overall score even amid
  high marks elsewhere — say so.
- **Separate signal from demo first.** Teaching repos ship deliberately-trivial example components;
  scoring those as craft inflates the verdict.
- **Cross-check stale reference material** against current upstream docs before trusting a reviewed
  repo's own tables (a hook-events table, a tool-schema doc) — they can be incomplete or out of date.
- **Edit wrapped prose carefully** — read the exact line before an `Edit`; match a unique
  single-line token so `old_string` doesn't miss on soft-wrapped paragraphs.

---

## 6. Authoring a new domain rubric (the recipe)

Every `domains/<name>.md` follows the **same five-part shape** so any fan-out agent can consume it
and the scores roll up cleanly. To add a domain, copy this skeleton, fill it for the component type,
add a §2 registry row, and cross-link Mode A's weighting table if it overlaps.

```markdown
# Domain Review — <Component type> (Mode C rubric)

> Per-domain specialist rubric for the harness-review skill, Mode C. SKILL.md is the spine;
> domain-review.md is the framework; this file owns the <component> rubric. Neutral: judges
> <component> on general best practice (nxtlvl's lessons cited as rationale, not the bar).

## 1. What this domain is — where to look
What counts as a "<component>" in a harness, where it lives (paths/globs/conventions), what to read
first to map the subsystem.

## 2. The specialist rubric   (score each 1–5, justify with file:line)
A table of the domain's 5–8 real dimensions:
| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
The **dominant dimension(s)** for this component type are marked — they can cap the overall.

## 3. What to hunt — the concrete checks
A checklist of the specific things to verify, the failure modes to look for, each tied to the
dimension it scores and (where relevant) to the nxtlvl lesson that explains why it matters.

## 4. Partition & signal-vs-demo
When to use a single deep agent vs per-artifact fan-out for this domain; what counts as deliberate
teaching/demo filler here.

## 5. Lessons & gotchas
Domain-specific traps — the mistakes a reviewer of this component type makes most.
```

**The dominant-dimension rule** is what makes each rubric a *specialist*: name which dimension(s)
matter most for this component (robustness for hooks, triggering for skills, cohesion for agents) and
let a fatal flaw there cap the overall — don't let a flat average hide it.
