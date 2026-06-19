# Session Handoff: nxtlvl `git-workflows` workflow domain — build the COMMAND→AGENT→SKILL triad

> Continuity doc for a **fresh session** that has `agent-skills` + `/skill-creator` available (the
> drafting session had neither). Read this first, then the anchors. Written 2026-06-19; **realigned
> to `main`'s ADR-012/013/014 + domain map** after `main` advanced under the branch.

## Goal

Build the **`git-workflows` workflow domain** as the established three-layer triad —
`command (thin entry) → agent (isolated executor) → skill (caller-agnostic knowledge)` — sourcing the
skill knowledge from `agent-skills` (+ the in-repo ECC materials) via `/skill-creator`. The
**knowledge layer already exists as a seed** (`plugins/nxtlvl/skills/github-workflow/SKILL.md`); this
session adds the **command + executor agent** and records the decision.

## What changed under us (the framing moved — read this)

While the seed was built, `main` advanced (PRs #12–#14) with governing doctrine this domain must
follow. The branch is now merged up to `main`; an earlier, now-obsolete `ADR-012` ("skill-not-agent")
from this branch was **dropped** — it collided with main's `ADR-012` and is contradicted by it. The
conventions it captured survive in the **skill** (the SSOT). Binding doctrine now:

- **[ADR-012](../decisions/ADR-012-agents-execute-skills-hold-knowledge.md) — agents execute, skills
  hold knowledge.** An agent is minimal + behavioral (workflow phases, output contract, stop
  conditions, *which skill to load*); the **skill is the single source of truth** for rules — the
  agent **loads** it and does **not** restate or paraphrase it. **`plugins/nxtlvl/agents/doc-keeper.md`
  is the first agent and the template — mirror it.**
- **[ADR-013](../decisions/ADR-013-confident-core-capability-domains.md) — confident-core.** Only 5
  capability domains (Python · TS/JS · Rust · Frontend · Backend) are build-now. **`git-workflows`
  is NOT one** — it's a Layer-2 *workflow* domain, admitted via the **intake gate** (entry already
  logged: `nxtlvl-skill-intake-backlog.md` #2). Same posture as `agent-building`.
- **[ADR-014](../decisions/ADR-014-quality-first-over-leanness.md) — quality first.** Size/leanness
  are backstops, **not** the objective. Choose the shape that's *best*, not smallest.
- **[domain map](../reference/nxtlvl-domain-map.md)** — §3 workflow domains (the verbs), §6 the triad
  pairing rule, §7 growth/intake. `git-workflows` is a new §3 workflow domain alongside
  review/dev/research/agent-building.

## Read these, in order

1. **Domain map:** `docs/reference/nxtlvl-domain-map.md` — §3 (workflow domains), §6 (triad), §7 (intake).
2. **Agent doctrine + template:** `docs/decisions/ADR-012-agents-execute-skills-hold-knowledge.md` and
   `plugins/nxtlvl/agents/doc-keeper.md` — copy its shape: own context window, "load the skill first",
   output contract, stop conditions, `tools:` comma-separated, `model: sonnet`, **no Prompt Defense Baseline**.
3. **Agent-vs-skill axis:** `docs/reference/ecc-agent-vs-skill-scoping.md` §3/§5/§6.
4. **The seed skill (SSOT):** `plugins/nxtlvl/skills/github-workflow/SKILL.md` — refine it; don't restate its rules elsewhere.
5. **Intake record + ADR format:** `docs/plan/nxtlvl-skill-intake-backlog.md` #2; `plugins/nxtlvl/skills/documentation-and-adrs/SKILL.md`.

## Locked conventions (they live in the skill = SSOT — don't restate in the agent/command)

1. **Conventional Commits** (`<type>(<scope>): <subject>`), over this repo's sentence-case history.
2. **Full loop** scope: branch → commit → PR → review → CI → merge.
3. **No attribution** in commits (env-forced trailers from a remote CI harness are the exception).
4. **Compose, don't reconstruct** review — spawn the existing `nxtlvl:review` agent; don't re-derive it.

## Build this (the triad)

```
plugins/nxtlvl/
  commands/<entry>.md     NEW — thin entry/entries; delegate to the agent; hold no durable logic
  agents/<executor>.md    NEW — isolated executor; mirrors doc-keeper; LOADS the github-workflow skill
  skills/github-workflow/ seed knowledge (refine/extend via /skill-creator; keep it the SSOT)
```

- **Skill (seed exists):** refine `github-workflow` via `/skill-creator` from agent-skills + the ECC
  `git-workflow`/`github-ops` materials. Frontmatter `name` + `description` only. It already carries
  the conventions above; keep it self-contained for the everyday path, pointer for the long tail.
- **Agent (new) — what earns it isolation (§6 tells):** it runs the loop in its **own context window**
  and returns a **status contract** (keeps diff/CI/review noise off the main thread — the
  fire-and-forget `/ship` case), and **spawns `nxtlvl:review`** (the read-only reviewer) at the review
  step. Per ADR-012 it **loads `github-workflow` as its SSOT** and does not restate the conventions.
  Copy doc-keeper's frontmatter + scaffolding (`tools:` incl. `Bash`, `Edit`, `Skill`; `model: sonnet`;
  phased workflow; output contract; stop conditions). **No Prompt Defense Baseline.**
- **Command(s) (new) — granularity is a quality call (ADR-014, not leanness):** per-action entries
  mirroring ECC's proven split — `/git-commit` (← `reference/ECC-main/commands/prp-commit.md`),
  `/git-pr` (← `commands/pr.md`), `/ship` (full loop) — vs. one `/git-workflow` entry with `$ARGUMENTS`.
  Recommendation: ship the entries that are genuinely distinct user actions, following §3's verb style;
  `review` already has `nxtlvl:review`, so it needs no new command. Pick on what's clearest to invoke,
  not what's fewest.

## Steps

1. Read the anchors.
2. Author/refine the **skill** via `/skill-creator` (agent-skills + ECC sources).
3. Build the **executor agent** (mirror doc-keeper; loads the skill; spawns `nxtlvl:review`; status contract).
4. Build the **thin command(s)**.
5. **Record ADR-015** — "add `git-workflows` as a reactive Layer-2 workflow domain shipping the
   COMMAND→AGENT→SKILL triad" — via the **`doc-keeper`** agent (it owns ADRs). Cite ADR-003/008/012/013/014.
   Add the `docs/decisions/README.md` index row; **add a `git-workflows` row to domain-map §3**.
6. **Validate (audit-style):** JSON manifests parse; frontmatter parses (skills name+desc; agents
   name/desc/tools/model; commands description); no dead skill/agent/ADR refs; cross-links resolve; no
   Prompt Defense Baseline leaked from vendoring; the agent does **not** restate skill rules (ADR-012).
7. Commit (Conventional Commits — dogfood), push to `claude/magical-newton-uoss1i`, update PR #10.

## Open decisions for the build session

- **Command granularity** (per-action vs single entry) — a quality call per ADR-014.
- **Executor agent** name/role, exact `tools`, and whether it returns status-only (fire-and-forget) or also streams.
- **Domain/entry naming** — align with §3's verb style (review/dev/research → e.g. `ship` / `git`).
- **Skill disposition** — refine the `github-workflow` seed in place vs. regenerate under a domain name.

## Gotchas (carry forward)

- `/plugin install|update` and invoking `/nxtlvl:*` are **manual interactive steps** — author files; the user installs/invokes/observes.
- **Next free ADR number is 015** (main has 012/013/014). Use `doc-keeper` to write it; never assume a number — verify.
- The agent must **not** restate the skill's rules (ADR-012) — load and follow; that's the §6 "600-line agent" smell.
- `dangerous-bash` gate blocks force-push to `main`; `--force-with-lease` on your own branch only.
- This session's commits carry env-forced `Co-Authored-By`/`Claude-Session` trailers — remote-env exception, **not** the nxtlvl standard (no-attribution).
