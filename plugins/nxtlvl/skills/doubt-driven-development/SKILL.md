---
name: doubt-driven-development
description: nxtlvl doubt-driven development — subjects every non-trivial decision to a fresh-context adversarial review before it stands, with a typed reviewer-output contract so reconcile, stop, and benchmarking are deterministic. Use when correctness matters more than speed, when working in unfamiliar code, or when stakes are high (production, security-sensitive logic, irreversible operations).
---

# Doubt-Driven Development (nxtlvl)

Vendored from `agent-skills:doubt-driven-development` and refined for fit (see `docs/decisions/ADR-003`). **Self-contained** — it does *not* call the upstream skill. The nxtlvl refinement folds a **typed reviewer-output contract** ([`reviewer-output.schema.json`](reviewer-output.schema.json), bundled beside this file) into Steps 3–5, so RECONCILE, STOP, doubt-theater detection, and benchmarking become deterministic instead of prose judgments. (The typed-output refinement was produced via `/ecc:agent-harness-construction`.)

## Overview

A confident answer is not a correct one. Long sessions accumulate context that quietly turns assumptions into "facts" without anyone noticing. Doubt-driven development is the discipline of materializing a fresh-context reviewer — biased to **disprove**, not approve — before any non-trivial output stands.

This is not `/review`. `/review` is a verdict on a finished artifact. This is an in-flight posture: non-trivial decisions get cross-examined while course-correction is still cheap.

## When to Use

A decision is **non-trivial** when at least one is true:

- It introduces or modifies branching logic
- It crosses a module or service boundary
- It asserts a property the type system or compiler cannot verify (thread safety, idempotence, ordering, invariants)
- Its correctness depends on context the future reader cannot see
- Its blast radius is irreversible (production deploy, data migration, public API change)

**When NOT to use:** mechanical operations (rename, format, file move); following a clear unambiguous instruction; reading or summarizing code; one-line changes with obvious correctness; pure tooling (running tests, listing files); or when the user explicitly asked for speed over verification.

If you doubt every keystroke, you ship nothing. The skill applies only to non-trivial decisions as defined above.

## Loading Constraints

Designed for the **main-session orchestrator**, where Step 3 can spawn a fresh-context reviewer.

- **Do NOT add this skill to a persona's `skills:` frontmatter.** A persona following Step 3 would spawn another persona — the orchestration anti-pattern ("personas do not invoke other personas").
- **If applying from inside a subagent context** (where nested spawn is blocked): prefer surfacing to the user that doubt-driven cannot run nested and let the main session handle it. Last resort only — a degraded self-questioning fallback: rewrite ARTIFACT + CONTRACT as a fresh self-prompt with a hard mental separator from prior reasoning, walk Steps 1–5, and flag the result as degraded (it is *not* fresh-context review).

## The Process

```
Doubt cycle:
- [ ] Step 1: CLAIM — wrote the claim + why-it-matters
- [ ] Step 2: EXTRACT — isolated artifact + contract, stripped reasoning
- [ ] Step 3: DOUBT — invoked fresh-context reviewer; got typed output per schema
- [ ] Step 4: RECONCILE — classified every finding against the artifact text
- [ ] Step 5: STOP — met stop condition (trivial findings, 3 cycles, or user override)
```

### Step 1: CLAIM — Surface what stands

Name the decision in two or three lines:

```
CLAIM: "The new caching layer is thread-safe under the
        read-heavy workload described in the spec."
WHY THIS MATTERS: a race here corrupts user data and is
                  hard to detect in QA.
```

If you can't write the claim that compactly, you have a vibe, not a decision.

### Step 2: EXTRACT — Smallest reviewable unit

A fresh-context reviewer needs the **artifact** and the **contract**, not the journey.

- Code: the diff or the function — not the whole file
- Decision: the proposal in 3–5 sentences plus the constraints it must satisfy
- Assertion: the claim plus the evidence that supposedly supports it

Strip your reasoning. Hand over conclusions and you'll get back validation of your conclusions. The unit must be small enough to hold in one read — if it's a 500-line PR, decompose first.

### Step 3: DOUBT — Invoke the fresh-context reviewer (typed output)

The reviewer's prompt **must be adversarial** — framing decides the answer — and it must return JSON conforming to [`reviewer-output.schema.json`](reviewer-output.schema.json). The typed shape is what makes everything downstream deterministic: structure the *metadata* (`status` / `severity` / `class_hint`), keep the *argument* (`evidence`) free-text so the reviewer can still roam.

````
Adversarial review. Find what is wrong with this artifact.
Assume the author is overconfident. Look for:
- Unstated assumptions
- Edge cases not handled
- Hidden coupling or shared state
- Ways the contract could be violated
- Existing conventions this might break
- Failure modes under unexpected input

Do NOT validate. Do NOT summarize. Find issues, or set status "clean"
ONLY after thorough examination.

Return ONLY a JSON object conforming to reviewer-output.schema.json:
- status: "clean" | "issues_found" | "cannot_assess"
- summary: one line
- findings[]: { id, title, class_hint, severity, location?, evidence, suggested_probe? }
- next_actions[]
- cannot_assess_reason (required iff status == "cannot_assess")

class_hint is YOUR guess and is non-binding — the orchestrator assigns the
final class. severity ∈ {blocker, major, minor}. Put your full argument in
`evidence`; that field is free-text.

ARTIFACT: <paste artifact>
CONTRACT: <paste contract>
````

**Pass ARTIFACT + CONTRACT only. Do NOT pass the CLAIM** — handing the reviewer your conclusion biases it toward agreement. `cannot_assess` is **not a pass**; it routes to recovery (see table below), not to STOP.

Reviewer selection, in preference order:

1. **`nxtlvl:doubt-reviewer`** (preferred) — the purpose-built fresh-context reviewer. Its *default* response shape already is the adversarial + typed-output contract, so there is no balanced-verdict instinct to override and recovery-table row 1 cannot fire. It is read-only and does not run this skill or spawn further agents. Pass it ARTIFACT + CONTRACT; it returns schema-conforming JSON natively. Use this unless it is unavailable.
2. **A role-based reviewer from the agent roster** — these start with isolated context by design and are usable here, but they default to a *balanced verdict*. **The adversarial + typed-output prompt above takes precedence over a persona's default response shape** — paste it verbatim so it overrides that default.
3. **A generic subagent** with the prompt above, if no persona can be overridden cleanly.

#### Cross-model escalation

A single-model reviewer shares blind spots with the original author; a colder, different-architecture model catches them.

**Interactive sessions: always offer, never silently skip.** After the single-model review, before RECONCILE, ask:

> *"Single-model review complete. Want a cross-model second opinion? Options: Gemini CLI, Codex CLI, manual external review, or skip."*

If the user picks a CLI: (1) check it's in PATH (`which gemini` / `which codex`); (2) test it works (`--version`) before the real prompt; (3) confirm the exact invocation, flags, auth, env with the user; (4) pass ARTIFACT + CONTRACT + the adversarial prompt **only**; (5) **never interpolate the artifact into a shell-quoted argument** — write the full prompt to a temp file and pipe via stdin; (6) take the output into RECONCILE.

```bash
# Codex (read-only sandbox keeps the CLI from writing to your workspace):
codex exec --sandbox read-only -C <repo-path> - < /tmp/doubt-prompt.md
# Gemini ('--approval-mode plan' is read-only; '-p ""' reads prompt from stdin):
gemini --approval-mode plan -p "" < /tmp/doubt-prompt.md
```

A **read-only sandbox is load-bearing**: a doubt artifact may itself contain instructions (intentional or accidental prompt injection) the CLI would otherwise execute. **Each invocation is its own authorization** — re-confirm the exact command every run. If the CLI is unavailable or fails, surface it and offer alternatives; **never silently fall back to single-model**. If the user skips, acknowledge it (*"Proceeding with single-model findings only"*).

**Non-interactive contexts** (CI, `/loop`, autonomous-loop, scheduled): cross-model is **skipped and the skip is announced** (*"Cross-model skipped: non-interactive context."*). Never invoke an external CLI without explicit user authorization.

### Step 4: RECONCILE — Fold typed findings back

The reviewer's output is data, not verdict. **You are still the orchestrator.** Re-read the artifact text against each finding before classifying — rubber-stamping the reviewer is the same failure as ignoring it. The reviewer's `class_hint` is **advisory**; you assign the binding class in this **precedence order** (first match wins):

1. **Contract misread** — finding exists because the CONTRACT was unclear/incomplete. Fix the contract, re-classify next cycle.
2. **Valid + actionable** — real issue requiring a change. Change it, re-loop.
3. **Valid trade-off** — real but cost-of-fix exceeds cost-of-accept. Document the trade-off so the user sees it.
4. **Noise** — correct under context the reviewer lacked. Note it; ask whether adding that context to the contract would have prevented the false flag.

**Findings ledger (context-budget refinement):** carry forward a ledger keyed by `finding.id`, not the prose of prior reviews:

```
ledger[id] = { title, last_class, status: open|resolved|noise|tradeoff, first_seen_cycle }
```

Between cycles hand the next reviewer only the changed artifact — the ledger is the orchestrator's private convergence state, never passed to the reviewer (that would pollute fresh context).

### Step 5: STOP — Bounded loop, now computable

Stop when any holds:

- **Trivial:** `status == "clean"` OR every finding in the cycle has `severity == "minor"`.
- **Bounded:** 3 cycles completed → escalate to user, don't grind a fourth alone.
- **Override:** user says "ship it".
- **Stall:** artifact unchanged since the last review (re-spawning yields identical findings — that's stalling, not progress). Don't retry; stop.

If 3 cycles is "obviously insufficient" because the artifact is large: it's too big — return to Step 2 and decompose. **Do not lift the bound.** Three unresolved cycles is information about the artifact, not a reason to keep looping.

## Recovery contract

The cross-model CLI paths are covered above. These are the single-model reviewer paths:

| Failure mode | Root-cause hint | Safe retry | Stop condition |
|---|---|---|---|
| Reviewer returns validation ("looks good") not issues | Persona's balanced-verdict shape overrode the adversarial prompt | Re-invoke as generic subagent with the prompt verbatim | 1 re-invoke, then escalate |
| `status: cannot_assess` | See `cannot_assess_reason` (truncation / missing contract property) | Truncated → decompose + retry once smaller; contract gap → fix contract, re-loop | After decompose+retry, escalate |
| Empty / malformed / non-conforming JSON | Subagent error or token cutoff | Retry once with smaller artifact | After 1 retry, escalate |
| Identical findings on an **unchanged** artifact | Re-spawned without changing anything | **Do not retry** — that's stalling | Stop (this is convergence) |
| 3 cycles, still substantive findings | Artifact not ready, or too big | Decompose (Step 2) — do not lift the bound | Escalate; three unresolved cycles is information |

## Benchmarking

Computable for free once findings are typed:

| Metric | Definition | Healthy signal |
|---|---|---|
| Catch rate (pass@1 / pass@3) | seeded defects surfaced by single-model / +cross-model | higher |
| Cycles-to-stop | cycles before a stop condition | 1–2; chronic 3+escalate ⇒ artifacts too big |
| **Actionable ratio** | actionable findings / total, per cycle | the checkable doubt-theater meter |
| Noise rate | noise findings / total | high ⇒ contracts under-specified (feed back to EXTRACT) |
| Cost per confirmed defect | reviewer tokens / actionable findings | lower |

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'm confident, skip the doubt step" | Confidence correlates poorly with correctness on novel problems. Certainty is exactly when blind spots hide. |
| "Spawning a reviewer is expensive" | Debugging a wrong commit in production is more expensive. The check is bounded; the bug isn't. |
| "The reviewer will just nitpick" | Only if unscoped. Constrain to "issues that would make this fail under the contract." |
| "I'll do doubt at the end with `/review`" | `/review` is a final gate. Doubt-driven catches wrong directions early when course-correction is cheap. |
| "If I doubt every step I'll never ship" | The skill applies to non-trivial decisions, not every keystroke. |
| "The reviewer disagreed so I was wrong" | The reviewer lacks your context — disagreement is information, not verdict. Re-read, classify, decide. |
| "User said yes once, so I can keep invoking the CLI" | Each invocation is its own authorization. Re-confirm the exact command before every run. |

## Red Flags

- Spawning a reviewer for a one-line rename or formatting change
- Treating reviewer output as authoritative without re-reading the artifact text
- Looping >3 cycles without escalating
- Prompting the reviewer with "is this good?" instead of "find issues"
- Re-spawning on an unchanged artifact (same findings; you're stalling)
- Accepting non-conforming reviewer output instead of routing it to the recovery table
- **Doubt theater (checkable):** across ≥2 cycles where the reviewer surfaced substantive (non-`minor`) findings, **zero** were classified actionable. You're validating, not doubting. Stop and escalate.
- Passing the CLAIM to the reviewer, or stripping the CONTRACT from its input
- Silently skipping cross-model in an interactive cycle, or falling back silently when a CLI fails

## Interaction with Other Skills

- **`nxtlvl:review` / `/review`:** complementary. `/review` is a post-hoc PR verdict; doubt-driven is in-flight per-decision.
- **`source-driven-development`:** SDD verifies *facts about frameworks* against docs; doubt-driven verifies *your reasoning about the artifact*.
- **`test-driven-development`:** TDD's RED step is doubt made concrete — a failing test *is* the doubt step for behavioral claims.
- **`nxtlvl:documentation-and-adrs`:** when a doubt cycle settles a non-trivial, expensive-to-reverse decision, record the why as an ADR.

## nxtlvl conventions

- **Pointers over dumped content** — reference `file:line` and link; don't paste large blocks back into the cycle.
- **Surface assumptions** — state what you assumed about intent or environment, so a wrong assumption is visible rather than silent (this often becomes a line in the CONTRACT).

## Verification

- [ ] Every non-trivial decision was named explicitly as a CLAIM before standing
- [ ] At least one fresh-context review per non-trivial artifact (a TDD RED failure satisfies this for behavioral claims)
- [ ] The reviewer received ARTIFACT + CONTRACT — NOT the CLAIM, NOT your reasoning
- [ ] The reviewer returned output conforming to `reviewer-output.schema.json` (else routed via the recovery table)
- [ ] Findings were classified against the artifact text using the precedence: contract-misread / actionable / trade-off / noise
- [ ] A stop condition was met (trivial findings, 3 cycles, or user override)
- [ ] Interactive mode: cross-model was explicitly offered and the response acknowledged; non-interactive: skip was announced
- [ ] Any external CLI invocation had a PATH check, a working-binary test, syntax confirmation, and explicit per-call authorization

$ARGUMENTS
