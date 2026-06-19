# Session Handoff (✅ DONE): nxtlvl `git-workflows` domain — built as the ECC 3-layer triad

> Continuity doc written 2026-06-19 for a fresh build session (which had `agent-skills` +
> `/skill-creator`; this drafting session had neither). **That session has since completed the
> work — see the Resolution banner below.** The plan body is kept for the record; for live state,
> read [ADR-024](../decisions/ADR-024-git-workflows-domain-command-agent-skill.md) and intake
> entry #3 in [`nxtlvl-skill-intake-backlog.md`](nxtlvl-skill-intake-backlog.md).

> **Resolution (build session, 2026-06-19) — DONE.** The domain shipped as
> `/git-workflow` (command) → `git-workflow-runner` (agent: `Bash` but no `Write`/`Edit`, `model: sonnet`,
> composes `nxtlvl:review`) → `github-workflow` (skill, refined in place). **ADR renumber:** `main`
> had meanwhile taken ADR-012–014, so this branch's `ADR-012-github-workflow…` was renumbered to
> **ADR-023** (Superseded) and the domain decision recorded as **ADR-024** (supersedes ADR-023) — *not*
> the 012/013 the plan below names. Read the live state in
> [ADR-024](../decisions/ADR-024-git-workflows-domain-command-agent-skill.md) and
> [`../decisions/README.md`](../decisions/README.md); the steps below are the original plan, kept for
> the record.

## Goal

Build a **git-workflows domain** for `nxtlvl` in ECC's three-layer shape —
`command (entry) → agent (executor) → skill (knowledge)` — **sourcing the skill from
`agent-skills`** (+ relevant ECC materials) via **`/skill-creator`**. This supersedes the
single-skill approach already on the branch (see "Where we are").

## Read these, in order

1. **Agent-vs-skill doctrine (governs the whole shape):** `docs/reference/ecc-agent-vs-skill-scoping.md`
   — §3 the command→agent→skill pairing, §4 the worked `/go-review` trace, §5 the agent-vs-skill checklist, §6 smells.
2. **Intent (anchor):** `docs/intent/personal-harness.md` — "compose, don't reconstruct"; agent-building is *reactive*; ECC is the dormant backstop.
3. **Current decision being superseded:** `docs/decisions/ADR-023-github-workflow-skill-and-conventions.md`
   (renumbered to `ADR-023-…` during the build — see the Resolution note above).
4. **The seed skill already built:** `plugins/nxtlvl/skills/github-workflow/SKILL.md`.
5. **House ADR format + lifecycle:** `plugins/nxtlvl/skills/documentation-and-adrs/SKILL.md`.
6. **Intake gate:** `docs/plan/nxtlvl-skill-intake-backlog.md` + `docs/decisions/ADR-008-reactive-growth-intake-gate.md`.

## Where we are (branch `claude/magical-newton-uoss1i`, draft PR #10)

This session standardized the GitHub workflow as a **single skill** and recorded it. Now the
direction is the **full domain with an executor agent**. What exists on the branch:

```
plugins/nxtlvl/skills/github-workflow/SKILL.md   ECC-vendored skill (Conventional Commits, full
                                                 loop, no attribution); composes nxtlvl:review.
                                                 → the SEED: replace/refine via /skill-creator.
docs/decisions/ADR-012-…-skill-and-conventions.md  Accepted. → SUPERSEDE with ADR-013.
docs/decisions/README.md                          ADR index (row 012). → add 013, flip 012.
docs/plan/nxtlvl-skill-intake-backlog.md          entry #2 (github-workflow skill). → add entry #3.
```

There is **no `commands/` or `agents/` dir in the plugin yet** — those are the new layers to build.
A standalone agent briefly existed and was deliberately removed (commit `1267b55`) because the bare
loop is skill-shaped; the **domain** framing (broader scope + the harness-learning goal) is what now
justifies the executor agent. Don't re-litigate that — build the domain.

## Locked decisions (from this session — do not reopen)

1. **Conventional Commits** is the nxtlvl standard (`<type>(<scope>): <subject>`), chosen over this
   repo's sentence-case history. (ADR-012 §Decision.)
2. **Full loop** scope: `branch → commit → PR → review → CI → merge`. Ops (issue triage, releases,
   stale, security) stay **reactive** — admit only on a logged repeat-need.
3. **No attribution** in commits (clean; no `Co-Authored-By`). Env-forced trailers from a remote CI
   harness are the documented exception, not the standard.
4. **ECC three-layer structure** now: command + agent + skill (this is the new direction).
5. **ADR handling:** write **ADR-013** for the domain; set ADR-012 `status: Superseded` +
   `superseded-by: ADR-013`; keep it (never delete). Same branch / PR #10.

## Source materials

**In-repo (ECC reference — vendor + refine, strip ECC's "Prompt Defense Baseline" block):**

- Knowledge → `reference/ECC-main/skills/git-workflow/SKILL.md` (branching, commits, merge/rebase,
  PR, conflicts, releases) and `reference/ECC-main/skills/github-ops/SKILL.md` (PR mgmt, CI, releases, security).
- Command templates (all under `reference/ECC-main/commands/`) → `pr.md` (create-PR, phased
  VALIDATE→…, `--draft`, `[base-branch]`), `prp-commit.md` (smart commit, natural-language staging,
  ASSESS→STAGE), `review-pr.md` (multi-agent review entry), `go-review.md` (the canonical
  command→agent template).
- Executor-agent templates (all under `reference/ECC-main/agents/`) → `go-reviewer.md` (85 lines:
  read-only `tools: ["Read","Grep","Glob","Bash"]`, `model: sonnet`, ends with a `see skill:` pointer
  — the shape to copy) and `pr-test-analyzer.md` (PR-specific executor).

**New session only (the primary source for the skill):** `agent-skills` via `/skill-creator` —
generate the git-workflows knowledge skill from agent-skills + the ECC materials above, then refine
for fit.

## Target structure

```
plugins/nxtlvl/
  commands/<entry>.md         NEW — thin entry/entries (see granularity decision below)
  agents/<executor>.md        NEW — isolated executor; lean (procedure+rubric+pointer)
  skills/github-workflow/…    existing seed — refine or replace with the /skill-creator output
  skills/<new-skill>/SKILL.md the /skill-creator skill(s), if separate from the seed
```

**nxtlvl file conventions (match the existing artifacts, NOT raw ECC):**

- **Skills:** frontmatter `name` + `description` only (like `review`, `documentation-and-adrs`).
  No `tools`/`model`. Self-contained for the everyday path; pointer into `reference/ECC-main` for the
  long tail. End with `$ARGUMENTS` and a Verification checklist.
- **Agents:** frontmatter `name`, `description`, `tools` (array), `model`. **Lean body** — role +
  "when invoked" procedure + rubric + a `see skill:` pointer; do **not** inline a big reference
  (that's the §6 "600-line agent" smell — factor it into the skill). The review step should **spawn
  the existing `nxtlvl:review` agent**, not re-derive review.
- **Commands:** frontmatter `description` (+ optional `argument-hint`). Thin — detect context,
  delegate to the agent/skill, present results; **durable logic lives in the skill**, not the command.
- **No "Prompt Defense Baseline"** block anywhere — nxtlvl strips ECC's. File names lowercase-hyphen.
- **One-way dependency:** command → agent → skill. The skill must be **caller-agnostic** (names no
  agent/command). Agents don't auto-load skills — the command/agent injects/points to skill conventions
  (scoping doc §3).

## Build steps

1. Read the anchors above.
2. **Decide command granularity** (open — see below): one `/git-workflow` entry, or several
   (`/git-commit`, `/git-pr`, `/git-review`) mirroring ECC's `prp-commit` / `pr` / `review-pr`.
3. **Author the skill(s)** with `/skill-creator` from agent-skills + ECC `git-workflow`/`github-ops`.
   Refine for fit: Conventional Commits, no attribution, full loop, pointers-over-dumps, language-plural.
   Either refine the existing `github-workflow` seed in place or supersede it.
4. **Build the executor agent** — lean, isolated; read-only where it only analyzes; spawns
   `nxtlvl:review` for the five-axis pass; consults the skill via a pointer.
5. **Build the thin command entry/entries** that delegate to the agent/skill.
6. **Harness bookkeeping:** ADR-013 (domain decision; supersede ADR-012); update `docs/decisions/README.md`
   index; add intake-backlog entry #3 naming the task + the thing that failed (ADR-008); record per ADR-010.
7. **Validate (audit-style):** every JSON manifest parses; frontmatter parses (skills name+desc;
   agents name/desc/tools/model; commands description); no dead skill/agent refs; ADR cross-links
   resolve; no Prompt Defense Baseline leaked in from vendoring.
8. **Commit** in Conventional-Commit form (dogfood the standard), push to `claude/magical-newton-uoss1i`,
   update PR #10.

## Open decisions for the new session

- **Command granularity:** single `/git-workflow` vs. several (`/git-commit`, `/git-pr`, `/git-review`).
- **Executor agent:** name/role, exact `tools` allowlist (read-only vs. needs write/push), `model` tier.
- **Seed disposition:** does the `/skill-creator` skill replace `skills/github-workflow/SKILL.md` or
  sit alongside it as separate knowledge?
- **Confirm ADR move:** supersede (recommended, ADR-013) vs. amend ADR-012 in place.

## Gotchas (carry forward)

- `/plugin install|update` and invoking `/nxtlvl:*` are **manual interactive steps** — the agent
  can't run them (see `nxtlvl-phase-0-handoff.md`). Author files; the user installs/invokes/observes.
- `dangerous-bash` gate blocks force-push to `main`; use `--force-with-lease` on your own branch only.
- This session's commits carry env-forced `Co-Authored-By`/`Claude-Session` trailers — remote-env
  exception, **not** the nxtlvl standard (which is no-attribution).
- Adding skills/agents/commands is gated by the written intake gate (ADR-008) — log it.
