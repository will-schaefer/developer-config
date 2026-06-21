---
name: harness-review
description: Vendor an agent harness and analyze it via parallel read-only fan-out, in one of three modes — (A) a neutral deep-dive quality + architecture report (its domains, skills, agents, commands, hooks, tools, strategy, and workflow, scored against a rubric), or (B) an adopt/adapt/reject ledger that judges what a target harness should borrow from it, or (C) a deep specialist audit of one domain — a component type (hooks, agents, skills, commands, tools, rules, scripts), a subsystem (memory/state, plugin marketplace), or a cross-cutting concern (a feature-spanning capability, or task-flow orchestration) — scored against a domain-expert rubric. USE THIS whenever an agent harness, Claude Code plugin, .claude/-style repo, subagent collection, or agent framework comes up to be understood, evaluated, or mined — phrases like "review this harness", "analyze how <repo> works", "how good is this agent setup", "deep dive into <plugin>", "what should we adopt from <repo>", "vendor and distill X", "should we copy how they do Y", "review the hooks/scripts of <repo>", "how good is X's hook system / memory / orchestration", "audit the <component> of <harness>", "review the planning capability of <repo>", "how honest is X's plugin marketplace". This analyzes someone else's harness — NOT a code review of your own diff (use a code-review skill for that), and NOT building a harness.
---

# Harness Review — vendor → fan-out → (general review | adopt/adapt/reject | domain review)

A repeatable method for analyzing an **agent harness**: vendor the repo as a disposable working
copy, fan out parallel read-only analysis over its independent subsystems, and synthesize one
tracked, citable artifact. The analysis is durable; the clone is throwaway.

The skill runs in **three modes** — pick one in Phase 0. They share the expensive front half (vendor →
map → fan-out) and the tail (reader-test → land), and diverge only in what the fan-out produces, how
you synthesize, and what you write:

- **Mode A — General Review** *(neutral)*: a deep-dive **quality + architecture report**. Dissects
  the harness's components (skills, agents, commands, hooks, tools, rules/docs) and its strategy and
  workflow, and **scores** each against a shared rubric — judged on the harness's own terms.
  Answers *"how is this built, and how good is it?"* → detail in
  [`references/general-review.md`](references/general-review.md).
- **Mode B — Adopt / Adapt / Reject Ledger** *(decision-oriented)*: maps findings against a
  **target** harness you build or maintain and renders a borrow verdict per finding. Answers *"what
  should `<target>` adopt, adapt, or reject from this?"* → detail in
  [`references/adopt-adapt-reject.md`](references/adopt-adapt-reject.md).
- **Mode C — Domain Review** *(neutral, one domain in depth)*: a deep specialist audit of **one
  domain** — a *component type* (`hooks`/`agents`/`skills`/`commands`/`tools`/`rules`/`scripts`), a
  *subsystem* (`memory`/`marketplace`), or a *cross-cutting concern* (`capability`/`orchestration`) —
  scored against a **domain-expert rubric** tuned to that domain's real failure modes — the depth
  Mode A's whole-harness pass can't reach. Answers *"how good is this harness's `<domain>`
  specifically?"* → framework in [`references/domain-review.md`](references/domain-review.md), rubrics
  in [`references/domains/`](references/domains/).

Read the relevant reference before your first run in a mode, or when a phase below needs more than
its summary. This body is the shared executable spine; the references are the per-mode rationale.

## Picking the mode (Phase 0)

Choose from the user's intent:

- *"How does X work / how good is it / analyze its architecture / deep dive on X"* → **Mode A**.
- *"What should `<target>` borrow from X / should we copy how they do Y / adopt-adapt-reject X / vendor and distill X for `<target>`"* → **Mode B**.
- *"Review the hooks/scripts of X / how good is X's agents or memory / audit the `<domain>` of X / how good is X's planning capability / how honest is X's marketplace"* → **Mode C** (the ask names one domain — a component type, a subsystem, or a cross-cutting concern — to go deep on).

Disambiguate by what the ask is *about*: one **domain** (component type, subsystem, or cross-cutting concern) to audit in depth → **Mode C**; a
**target harness to improve** by borrowing → **Mode B**; the **whole reviewed harness** on its own
terms → **Mode A**. (Mode A's `FOCUS` can still narrow attention to a component, but it keeps the
generic rubric; reach for **Mode C** when you want the domain-expert rubric and a focused audit.)
When it's genuinely ambiguous, ask — don't guess.

## What this analyzes (and what it doesn't)

An **agent harness** means any system that shapes how an agent works: a Claude Code plugin, a
`.claude/`-style repo, a subagent collection, a skills/prompt library, or an agent framework.

**Good targets** (full pipeline): multi-component harnesses and substantial subagent/skill
collections. **Poor targets** (skim or skip): "awesome" meta-lists and single-file gists — they
yield a short note, not a report. When in doubt, start; a thin harness produces a thin result.

This is **not** a code review of your own working diff (use a code-review skill for that), and it
does not modify the harness — it reads and judges it. If the user means "review my code," route
there instead.

## The contract

**Shared input**
- **`REPO`** (required) — the GitHub URL or `owner/name` of the harness. (A local path works too;
  skip the clone in Phase 1.)

**Mode A also takes**
- **`FOCUS`** (optional) — a narrowing of attention when the user only cares about part of the
  harness (e.g. "just the hooks"). A lens for attention, not a comparison; the report judges the
  harness on its own terms. Absent a focus, analyze the whole harness.

**Mode B also takes**
- **`TARGET`** (required) — the harness you're deciding *for* (the one you build/maintain).
- **`LENS`** (required) — the specific `TARGET` surfaces this repo most plausibly informs. *This is
  the most important Mode-B parameter*: it's what turns a code-read into an adopt/adapt/reject
  judgment. State it before any work and **ask if it's unclear** — don't guess a lens.

**Mode C also takes**
- **`DOMAIN`** (required) — the domain to audit, one of the registry values in
  [`references/domain-review.md`](references/domain-review.md) §2, across three **kinds**: a
  *component* type (`hooks`, `agents`, `skills`, `commands`, `tools`, `rules`, `scripts`), a
  *subsystem* (`memory`, `marketplace`), or a *composed* concern (`capability`, `orchestration`). It
  selects the specialist rubric and tells the run where to look. (For a `capability` review, also
  state the spanning set as `DOMAIN=<spine> · FOCUS=<capability>`.)
- **`FOCUS`** (optional) — a narrowing *within* the domain (e.g. "just the `PreToolUse` hooks"). Mode
  C is neutral — there is **no `TARGET`/`LENS`**; it judges the domain on the harness's own terms
  (borrow judgments are Mode B's job).

**Output:** a tracked artifact (default `docs/reference/<repo>-analysis.md` for Mode A,
`docs/reference/<repo>-distillation.md` for Mode B, `docs/reference/<repo>-<domain>-review.md` for
Mode C) plus the gitignored working clone, and a one-line index/memory pointer so it's findable later.

## The pipeline

Work the phases in order. Phases 0–2 and 6–7 are shared; Phases 3–5 fork by mode.

**Phase 0 — Frame & select.** State `REPO`, pick the **mode** (above), and state the mode's extra
inputs (`FOCUS`; or `TARGET` + `LENS`; or `DOMAIN` + optional `FOCUS`). Apply the good/poor-target
test and decide go/skip. **Set the DeepWiki gate:** if `REPO` is a public GitHub repo, a DeepWiki
orientation pass is available for Phase 2; if it's a local path or private, DeepWiki is skipped
silently and Phase 2 runs exactly as it did before (never a hard dependency).

**Phase 1 — Vendor.** Clone shallow into a gitignored scratch location and measure:
```
git clone --depth 1 https://github.com/<owner>/<repo>.git reference/<repo>-main
rm -rf reference/<repo>-main/.git        # flat, disposable working copy
du -sh reference/<repo>-main             # capture size
```
The clone needs network egress, so **run it with the sandbox disabled** — a permission action; if
you can't toggle it yourself, ask the user. The `rm -rf` only ever deletes the *fresh clone's own*
`.git`, so it is safe. Clones land under a gitignored path (`reference/` is local-only by
convention) — they are disposable; the analysis is the durable artifact, so don't track the clone. A
local-path `REPO` skips the clone here — and, per the Phase-0 gate, the DeepWiki pass below too.

**Phase 2 — Structural map & partition.** **DeepWiki sub-step (when the Phase-0 gate is on — public
GitHub `REPO`):** open by spawning the read-only [`deepwiki-scout`](../../agents/deepwiki-scout.md)
agent with `REPO` (+ the mode and any `FOCUS`/`DOMAIN`). It returns a lead-stamped orientation brief —
a proposed partition + 3–5 seeded fan-out questions — that *informs* the partition and *seeds* Phase
3, and nothing more: **DeepWiki gives leads, not evidence — zero DeepWiki claims reach any artifact**
(see [`references/deepwiki-orientation.md`](references/deepwiki-orientation.md); recorded as ADR-029).
Verify every lead against the clone below; if DeepWiki is off or unreachable, just skip this and map
manually. Then — always — `find reference/<repo>-main -maxdepth 3` + read the README
intro. Inventory the components, then **partition the harness into independently analyzable domains**
(no shared state) so they can run in parallel. A `.claude/`-style harness partitions naturally into
roughly: (1) hooks/automation, (2) agents/orchestration, (3) skills/commands/rules + docs/periphery.
Adjust to the repo's real shape; 2–4 domains is typical. This partition is the key design choice of
the run, and it is the same for Modes A and B. **Mode C forks here:** instead of partitioning the
whole harness, it partitions *within* the chosen `DOMAIN` — one agent per artifact (hook script,
agent, …) when there are many, or a single deep agent when there are few. **Composed**-kind domains
partition differently: `capability` fans out by *surface* (a spine agent + one per supporting
component type, cross-wiring synthesized on the main thread); `orchestration` is *one end-to-end task
trace on the main thread + per-stage slices*. Each `domains/<DOMAIN>.md` carries its own partition
hint (see [`references/domain-review.md`](references/domain-review.md) §1).

**Phase 3 — Parallel fan-out analysis.** Dispatch one `general-purpose` agent per domain, **all in
one message** (compose `superpowers:dispatching-parallel-agents`). Every agent prompt — in any of the three
modes — MUST carry these shared elements:
1. **Read-only mandate** — "modify nothing; your output is a digest the main session synthesizes."
2. **Scoped target** — the exact files/dirs this agent owns + the absolute repo path.
3. **Claims-vs-wiring discipline** — separate what the docs *claim* from what the code *ships*; trust
   the wiring, cite every claim to `file:line`.

Then add the **mode-specific payload** — what the agent must produce:
- **Mode A:** analyze the domain *on its own terms* and **score it on the shared rubric** (cohesion,
  composition, robustness, discoverability, clarity, effectiveness; 1–5 each — see
  [`references/general-review.md`](references/general-review.md) §1). Output: what's there, how it
  works, strengths, weaknesses/risks, rubric scores with one-line justifications.
- **Mode B:** map findings against the **`LENS`** (the `TARGET` surfaces) and **end in an explicit
  Adopt / Adapt / Reject list** — see [`references/adopt-adapt-reject.md`](references/adopt-adapt-reject.md) §1.
- **Mode C:** load the **specialist rubric** for the `DOMAIN`
  ([`references/domains/`](references/domains/)`<domain>.md` §2) and **score each domain-specific
  dimension 1–5 with `file:line` justification**, judged on general best practice (nxtlvl's lessons
  are rationale, not the bar — see [`references/domain-review.md`](references/domain-review.md) §1).
  Output: what's there, how it works, strengths, weaknesses/risks, specialist scores. For a
  **composed**-kind domain (`capability`/`orchestration`) the rubric's §2 is a *composition method*,
  not a flat table: the spine agent scores its component rubric in full, each supporting-slice agent
  scores only its own rubric's dominant dimension(s), and the **cross-wiring is scored on the main
  thread** as the capping judgment.

Agents return *conclusions, not file dumps* — that preserves the main thread's context for synthesis.

**Phase 4 — Synthesize.** Read the digests and find the spine, then **separate signal from demo**
(teaching/demo repos ship deliberate filler — toy apps, demo domains — that must not be mistaken for
craft). The spine differs by mode:
- **Mode A:** the **central design strategy** that explains how the harness coheres (its
  orchestration model, how a task flows through it, what it optimizes for); roll the per-domain
  rubric scores into an **overall quality assessment**.
- **Mode B:** the **cross-cutting borrow finding** — frequently *not* a feature to copy but a
  contrast that confirms or challenges a decision `TARGET` already made.
- **Mode C:** the **headline judgment about the subsystem** — is it sound, what defines its quality,
  what caps it; roll the per-artifact specialist scores into an overall assessment, letting a fatal
  flaw in the domain's dominant dimension cap the overall rather than averaging it away.

**Phase 5 — Write the artifact.** Scaffold all headers first, then fill and review each section,
leading with the Phase-4 spine.
- **Mode A** → the deep-dive **report** ([`references/general-review.md`](references/general-review.md) §2): dated header · overview/thesis · architecture map · per-component deep-dive (each present
  component type) · strategy & workflow · scored quality assessment + verdict.
- **Mode B** → the **distillation** ([`references/adopt-adapt-reject.md`](references/adopt-adapt-reject.md) §2): dated header · numbered sections with `file:line` quotes · a consolidated **Adopt /
  Adapt / Reject ledger** mapped to `TARGET` surfaces · an "applying to `<target>`" close.
- **Mode C** → the focused **domain review** ([`references/domain-review.md`](references/domain-review.md) §3): dated header · spine (headline judgment) · what's there & how it works · a **specialist
  scorecard** (the domain's dimensions × 1–5) with strengths, weaknesses/risks, and a headline verdict.

**Phase 6 — Reader-test.** Dispatch a fresh-context agent to read the finished artifact cold: does it
stand alone, are the calls (scores / adopt-adapt-reject) justified by cited evidence, any unsupported
claim or missing citation? Fix what it surfaces.

**Phase 7 — Land it.** Add a one-line index/memory pointer so the artifact is findable later. Keep the
working clone gitignored or delete it — the analysis is the durable artifact. (Mode B: if a borrow
finding is architectural and expensive to reverse, raise it as a decision to record via whatever
decision-recording process `TARGET` uses; curate hard — most findings are notes, not decisions.)

## Knobs (what varies per run)

`REPO` is required; mode picks the rest (`FOCUS`; or `TARGET` + `LENS`; or `DOMAIN` + optional
`FOCUS`). Per-run knobs: domain partition (2–4, or within-domain for Mode C), fan-out agent count,
signal-vs-demo filter, and artifact depth. Full knobs tables live in each mode's reference (Mode C: §4).

**Right-size the run to the target.** The phase sequence is fixed; the *effort* inside it is not.
Scale reference-loading, fan-out width, and artifact depth to how much harness is actually there. A
few-artifact subsystem — a five-hook set, a handful of agents, a small rules folder — warrants **one
lean pass**: load the one rubric it needs (for Mode C, just `references/domains/<DOMAIN>.md` — you
already know the spine, so don't re-read the whole framework), do the single deep agent the partition
rule already allows, and write a **tight** scorecard. Reserve the heavy treatment — wide fan-out,
every reference, deep per-component dives, long artifacts — for harnesses big enough to repay it.
This is not a shortcut around rigor: the scored verdict and its evidence are non-negotiable at any
size. It is matching *spend* to *substance* — full ceremony on a thin subsystem buys a verdict a
leaner pass would have reached, at real token and latency cost, and tends to pad the artifact with
length that dilutes rather than sharpens the judgment. Spend where the harness is rich; stay lean
where it is thin.

## Gotchas worth knowing before you start

The phases carry the recurring traps (the spine and signal-vs-demo split are Phase 4; claims-vs-wiring
is Phase 3). Two that live outside the flow, in all modes:

- **Cross-check stale reference material** against current upstream docs before trusting it — a
  reviewed repo's own tables can be incomplete or out of date.
- **Judge the wiring, not the README.** A confident philosophy doc is not evidence of a robust hook;
  let the shipped code drive the score/verdict, and note any gap between claimed and actual as a finding.

## Composes (don't reconstruct)

- Phase 2 → [`deepwiki-scout`](../../agents/deepwiki-scout.md) (read-only DeepWiki orientation;
  public GitHub only; leads-not-evidence — see [`references/deepwiki-orientation.md`](references/deepwiki-orientation.md)).
- Phase 3 & 6 → `superpowers:dispatching-parallel-agents` (independent-domain fan-out; fresh-context
  reader for the cold read).
