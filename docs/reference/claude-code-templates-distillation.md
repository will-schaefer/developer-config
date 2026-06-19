# claude-code-templates (aitmpl) — Distillation (Adopt / Adapt / Reject)

> Distilled 2026-06-19 from a vendored clone of `davila7/claude-code-templates` (aitmpl.com),
> at `reference/claude-code-templates-main/` (116M; gitignored, not tracked). Analyzed read-only
> via a four-agent parallel fan-out, one per review lens: **distribution & promotion**,
> **observability & analytics**, **the repo's own meta-harness**, and **component-catalog mining**.
> CCT is a **distribution catalog product**: an `npx claude-code-templates` CLI that installs
> components (agents/commands/hooks/mcps/skills/settings) out of a GitHub monorepo into a user's
> project, plus an analytics dashboard suite, plus a meta-harness for manufacturing catalog entries
> at scale. Every finding cited to `file:line` (paths relative to the clone root). **Purpose:**
> record an adopt/adapt/reject judgment per the nxtlvl build method (review harnesses to shape
> ours). Companion to [hooks-mastery-distillation.md](hooks-mastery-distillation.md),
> [agentic-os-distillation.md](agentic-os-distillation.md),
> [agent-skills-distillation.md](agent-skills-distillation.md),
> [superpowers-distillation.md](superpowers-distillation.md).

---

## 1. The spine — right mechanism, wrong owner (and a product nxtlvl is the inverse of)

CCT optimizes for **reach and volume**: thousands of installable components, a public marketplace,
a web dashboard, instant publish-to-`main` distribution. nxtlvl optimizes for **curation and
quality**: a few-but-right plugin, a staging-and-promote gate, CLI-first local-only signals. Read
through that lens, the four-domain fan-out converges on one shape:

**The durable harvest from CCT is a handful of small *mechanisms* whose correct home is a gate
nxtlvl already owns — its promotion step and its read-only-agent doctrine — while everything CCT
built for *scale* (the installer, the external catalog, the dashboard, the telemetry, the Linear
queue) is a reject that confirms nxtlvl's small-curated architecture by contrast.**

The sharpest recurring tell: **CCT repeatedly builds a sophisticated enforcement mechanism and
then doesn't wire it to the decision point that matters.**

- It ships a **5-axis component validator** (structural, semantic, integrity, reference,
  provenance) — invoked only from an opt-in `security-audit` command, **never from the install
  path**, which is a bare `fetch → writeFile` (`cli-tool/src/index.js:482-526`;
  `ValidationOrchestrator.js:13-20` called only at `security-audit.js:101-104`).
- Its plugin **`marketplace.json` lists 8 agents** against **434 on disk** — a catalog that drifted
  because nothing forces it to agree with the tree (`cli-tool/components/.claude-plugin/marketplace.json:1-92`).
- Its **"hook stats" counts *configured* hooks, not *fired* ones** (`cli-tool/src/hook-stats.js:34-83`).

So the transplant is not to copy CCT's features — it's to take its best *mechanism designs* and wire
them to the gate CCT left them detached from. That single move (validator → **promotion gate**) is
the headline adopt. Everything else is either a small primitive or a contrast that ratifies a choice
nxtlvl already made.

A second, independent thread: **CCT corroborates two nxtlvl doctrines from a high-volume production
harness** — "read-only agents via withheld tools" (its agent fleet enforces a strict read/write
tool split, one named writer) and "pointers/scoped-context over monolith" (its own monolithic
`CLAUDE.md` rotted while its path-scoped rules stayed current). External evidence worth citing in any
ADR that leans on those principles.

---

## 2. Distribution & promotion — the cautionary contrast

CCT's distribution paradigm is a **stateless npx installer that copies single files out of GitHub
`main` into the user's `.claude/` at install time**:

- Install = live fetch + verbatim write, no validation, version pinned to the literal string `main`
  (`cli-tool/src/index.js:482-526,491`; `cli-tool/src/file-operations.js:8-13`). Two users running
  `npx …@latest` a day apart get different bytes — **no reproducibility**.
- "Promote a component to live" = **merge to `main`** → instantly installable by every user, with
  **no activation step and no staging boundary**.
- The genuinely good asset — the 5-axis `ValidationOrchestrator` — is **off the install path** (§1).

**The contrast that ratifies nxtlvl's design** (per the distribution-lens agent):

| Axis | CCT | nxtlvl |
|---|---|---|
| Unit of distribution | single file copied per-project | one whole plugin, shared |
| Runtime source of truth | live GitHub `main` fetch | SHA-pinned plugin cache snapshot |
| "Promote to live" | publish to `main` (instant, global) | `git mv sandbox/ → plugins/` + manual `/plugin` refresh |
| Catalog | external (aitmpl.com / GitHub tree) | the monorepo *is* the catalog |
| Versioning | CLI SemVer; components unversioned dead metadata | git history of one repo |

CCT's "merge-to-`main`-is-live" is **exactly the failure mode nxtlvl's `sandbox/` + two-gate promote
+ SHA-pin is built to avoid**: committed must not equal live; live must be reproducible. The
8-vs-434 `marketplace.json` drift is what a catalog-without-a-gate looks like. This is the
"contrast-not-feature" spine the harness-review method expects — CCT is the negative example that
justifies nxtlvl's promotion architecture.

---

## 3. Observability & analytics — adopt the data layer, reject the egress layer

CCT reads the **same `~/.claude/**/*.jsonl` transcript substrate nxtlvl reads**
(`analytics/core/ConversationAnalyzer.js:75-95`), and its token accounting **independently confirms
nxtlvl's "live context = transcript usage sum" model** — summing `input_tokens`, `output_tokens`,
`cache_creation_input_tokens`, `cache_read_input_tokens` off each message's `usage` field, with a
`length/4` fallback only when usage is absent (`ConversationAnalyzer.js:380-406,128`). That's the
exact field list nxtlvl's context-alert hook needs.

Two reusable parsing techniques:
- **tool_use ↔ tool_result two-pass correlation** — maps `tool_use.id`, attaches the matching
  `tool_result` back onto the originating assistant message, suppresses the standalone entry
  (`ConversationAnalyzer.js:235-313`). Clean transcript-folding algorithm for any future per-tool
  error/latency signal.
- **5-hour rolling "Claude session" windows** keyed on user-message timestamps, mirroring
  Anthropic's billing window (`ConversationAnalyzer.js:732-825`).

**But the flagship is everything nxtlvl rejected:** an Express server on :3333 that auto-opens a
browser, WebSocket push, a **public `trycloudflare.com` tunnel** (`analytics.js:1274-1303,1344-1400`),
session upload to the public paste host `x0.at` (`session-sharing.js:215-251`), and **default-on
cloud telemetry to aitmpl.com** (`tracking-service.js:132,262,338`, opt-out via `CCT_NO_TRACKING`).
CCT measures **liveness** (a recency/time-threshold state machine, `StateCalculator.js:20-234`);
nxtlvl measures **health** (the 150–200K-token degradation band). No overlap on the alert logic
itself — but CCT's token summation is the *input* to it.

Aligned with nxtlvl's "inform, don't force": the `*-stats` CLI sub-commands (one-shot ASCII tables)
and `health-check.js`'s non-blocking pass/warn/fail scorecard (`health-check.js:70-256`). Its
security-audit's "block only in `--ci`, warn otherwise" (`security-audit.js:137-148`) cleanly
mirrors nxtlvl's "objective gate may block, taste only warns" doctrine.

**Dead end recorded:** CCT's "hook stats" reads *configured* hooks from `settings.json`, never
*fired* hooks — so it does **not** answer the "hook firing stats" question nxtlvl was hoping to mine;
that signal would need nxtlvl's own PostToolUse counter (`hook-stats.js:34-83`).

---

## 4. The meta-harness — corroboration + two reusable primitives

CCT's `.claude/` exists to **manufacture catalog entries at scale**. Its agent fleet is a genuine
separation-of-concerns lifecycle, and the standout is a **read/write split enforced by tool grants**:

| Agent | Role | Tools (the tell) |
|---|---|---|
| component-researcher | reads + researches, returns a prioritized report | `Read, WebSearch, WebFetch, Grep, Glob` — **no Write/Edit** (`component-researcher.md:1-5`) |
| component-reviewer | validates format/fields/security; APPROVED/WARNINGS/CRITICAL | `Read, Grep, Glob, Bash` — read-only (`component-reviewer.md:1-5`) |
| component-improver | **"the only agent that modifies files and creates PRs"** | `Read, Write, Edit, Bash, …` (`component-improver.md:1-5,82-90`) |
| linear-tracker | the work *queue* — Linear as durable state, `haiku` model | (`linear-tracker.md:1-6,50`) |

This researcher → improver → reviewer loop is **externally orchestrated, not CI-driven** — there is
no `.github/workflows/` file running it; orchestration lives outside the repo with **Linear as the
database**. The tool-grant read/write split (`component-researcher.md:4` read-only vs
`component-improver.md:3` "the only agent that modifies files") is **independent corroboration of
nxtlvl's "read-only agents via withheld tools" doctrine** from a production harness.

Two genuinely reusable primitives:
- **`.worktree-task.md` — a context brief that travels with an isolated workspace.** `/worktree-init`
  writes a tiny brief (branch, task, date, source repo) into each git-worktree
  (`worktree-init.md:43-51`); `/worktree-deliver` consumes it to author the commit/PR, then
  **`rm`s it so it never lands in the commit** (`worktree-deliver.md:28-33`).
- **Squash-merge detection by empty diff** in `/worktree-cleanup` (`worktree-cleanup.md:55-62`) —
  `git branch --merged` misses squash merges; CCT detects them via empty-diff and reaps the branch.
  Real reusable git craft.

**Orchestration mechanism worth adopting:** CCT steers via **path-scoped `rules/*.md`** with a
`paths:` glob frontmatter (`rules/cli-tool.md:1-5`, `rules/dashboard.md:1-4`) — domain-local briefs
that load only when matching files are touched. The proof they beat a monolith is in CCT's own repo:
the root `CLAUDE.md` says Vercel is the host (`CLAUDE.md:294-343`) while the scoped
`rules/dashboard.md:6-8` records they **migrated to Cloudflare and removed `vercel.json`** — **the
monolith rotted, the scoped rule stayed current.** (CCT also steers via "ALWAYS use agent X"
mandate-prose, e.g. `CLAUDE.md:82,337` — which works for it because the mandated actions are
*objective* (validate, deploy), the opposite of nxtlvl's "inform, don't force" for judgment calls.)

**Craft-vs-demo filter:** the worktree family, the tool-split fleet, path-scoped rules, squash
detection, and a tidy notify-don't-block Telegram-on-PR hook (`telegram-pr-webhook.py:90-133`) are
real signal. `/lint`, `/test`, `/cleanup-cache`, the `*-expert` / blog / docusaurus agents, and the
Vercel/Cloudflare/Neon/Discord ops sections of `CLAUDE.md` are product/demo filler — ignore.

---

## 5. The catalog — mostly reject, one gem

The catalog is **volume, not craft**, and the headline number is a fiction: the "5,590 skills"
(a raw file count under `cli-tool/components/skills/`) is **~870 real `SKILL.md` files** (per
`find … -name SKILL.md`) inflated by bundled assets (856 `.py`, 649 SWE-bench `.patch`, 390
OOXML `.xsd`, 54 `.ttf` — all `find`-by-extension counts, not single-line cites). A large share are **Anthropic's own skills vendored verbatim**
(`skills/ANTHROPIC_ATTRIBUTION.md` lists `skill-creator`, `mcp-builder`, `docx`/`pdf`/`pptx`/`xlsx`,
`canvas-design`…) which nxtlvl already reaches natively. The 434 agents / 341 commands carry heavy
intra-dir duplication (`create-pr.md` *and* `create-pull-request.md`; 5+ overlapping security
auditors). Formats are **standard CC formats** (real `SKILL.md`, standard agent/command frontmatter),
not a proprietary schema — so nothing structural to learn either. **Breadth reveals no missing nxtlvl
component category.**

Two clarifications recorded so the main thread doesn't conflate them:
- **The one gem:** `agents/security/read-only-auditor.md:6-15` is the single agent that puts a
  **`hooks:` block in agent frontmatter** with `PreToolUse` matchers (`Write|Edit|MultiEdit`, `Bash`)
  that `exit 1` — **hook-enforcing** read-only at the system level on top of withholding the tools.
  A stronger, belt-and-suspenders sibling of nxtlvl's existing doctrine.
- **The "sandbox component" is a false friend.** CCT's `sandbox/` is **remote/containerized
  execution isolation** (docker / cloudflare / e2b launchers to run a Claude session in a VM,
  `sandbox/README.md`) — **unrelated** to nxtlvl's `sandbox/` *staging tree* for pre-promotion WIP.
  Same word, opposite meaning. Do not cross-pollinate.

---

## 6. Verified CC-feature claims (cross-check done)

Two adopts below ride on Claude Code features I would not take from a vendored repo on faith. Both
were verified against current official Claude Code docs (2026-06-19) via the `claude-code-guide`
agent, which reads live Anthropic documentation:

- **`hooks:` in agent/subagent frontmatter → SUPPORTED, documented.** Hooks can be defined directly
  in skill and subagent frontmatter using the same config format; they are **scoped to the
  component's lifetime** (cleaned up when the agent finishes), unlike plugin-level hooks that persist
  the whole session. So the read-only-auditor enforcement pattern is real.
- **`paths:` glob in rules frontmatter → SUPPORTED, documented.** A rule *without* `paths:` loads at
  session start like `CLAUDE.md`; a rule *with* `paths:` loads **only when Claude reads a matching
  file**. **Compaction nuance (matters for nxtlvl's context work):** path-scoped rules are
  **summarized away on compaction until a matching file is read again**, whereas unscoped rules are
  re-injected from disk. So path-scoping trades guaranteed presence for on-demand loading — a real
  consideration for any load-bearing rule.

---

## 7. Consolidated Adopt / Adapt / Reject ledger

### ADOPT

| # | Item (cite) | nxtlvl surface |
|---|---|---|
| A1 | **5-axis validator design as a pre-promote gate** — objective Structural (frontmatter valid, required fields, file-size + ≤20-section caps to protect the 150–200K band) + Semantic (prompt-injection scan) checks. `ValidationOrchestrator.js:13-20`, `StructuralValidator.js`, `SemanticValidator.js:19-130` | A lint that runs before `git mv sandbox/skills/<x> plugins/…`; folds into the earmarked `nxtlvl:audit`. Maps to the decision-rule §5 "objective gate may BLOCK, taste only WARNs" split. **Top adopt.** |
| A2 | **Semantic prompt-injection/exfil regex catalog (severity-tagged)** `SemanticValidator.js:19-130` | (a) Run over **vendored harnesses in `harness-review`** before they sit in `reference/` — a self-referential safety pass; (b) candidate enrichment of the dangerous-bash gate beyond bash. |
| A3 | **`hooks:`-in-agent-frontmatter read-only enforcement** `agents/security/read-only-auditor.md:6-15` (feature verified §6) | Belt-and-suspenders for `doubt-reviewer`, `idea-critic`, `context-scout`, `doc-keeper`-in-audit: withhold the tools **and** block them via a frontmatter `PreToolUse` exit-1. Pairs with the read-only-by-withheld-tools memory note. |
| A4 | **Path-scoped `rules/*.md` (`paths:` glob)** `rules/cli-tool.md:1-5`; drift-proof at `CLAUDE.md:294` vs `dashboard.md:6` (feature + compaction nuance verified §6) | Split nxtlvl's monolithic `CLAUDE.md` context into on-demand path-triggered briefs. Mind the compaction trade-off (§6) for load-bearing rules. |
| A5 | **Transcript token-summation (incl. cache fields) + tool_use↔tool_result correlation** `ConversationAnalyzer.js:380-406,235-313` | The context-alert hook's token counter (exact field list) + a future per-tool signal util. Corroborates "context = transcript usage sum." |
| A6 | **Squash-merge detection by empty diff** `worktree-cleanup.md:55-62` | A cleanup/merge-verification primitive for the `github-workflow` skill / `git-workflow-runner`. |

### ADAPT

| # | Item (cite) | nxtlvl surface |
|---|---|---|
| D1 | **researcher → improver → reviewer improvement loop**, scoped to curation not throughput `component-researcher.md` → `component-improver.md` → `component-reviewer.md` | A candidate nxtlvl **skill/component reviewer** (frontmatter correctness, tool-grant minimality, naming) — reuse the *report → single writer applies → read-only gate* shape; reject the at-scale automation. Could extend `harness-review` or be a new meta-agent. |
| D2 | **`.worktree-task.md` context-brief-per-workspace** `worktree-init.md:43-51`, deleted at `worktree-deliver.md:28-33` | If nxtlvl adds worktree isolation: carry task intent into the isolated workspace via a small brief the deliver step consumes then removes. Pairs with `superpowers:using-git-worktrees`. |
| D3 | **`health-check.js` pass/warn/fail config scorecard** `health-check.js:70-256` | An advisory `nxtlvl doctor`-style one-shot install-health check (non-blocking — matches inform-don't-force). |
| D4 | **5-hour session bucketing** `ConversationAnalyzer.js:732-825` | A possible `instinct-status` / session metric ("sessions this week"). |

### REJECT (each confirms an nxtlvl choice by contrast)

| # | Item (cite) | Confirms |
|---|---|---|
| R1 | npx installer / per-project file-copy / external catalog / **publish-to-`main`-is-live** `bin/create-claude-config.js`, `index.js:482-526`, `marketplace.json` | nxtlvl's plugin + `sandbox/` + two-gate promote + SHA-pin |
| R2 | Express dashboard + WebSocket + **cloudflare tunnel + x0.at upload + default-on telemetry** `analytics.js:1274-1400`, `session-sharing.js:215-251`, `tracking-service.js:132` | nxtlvl's CLI-first, local-only posture |
| R3 | **Linear-as-queue** for the build loop `linear-tracker.md` | nxtlvl's file-based memory; SaaS issue-tracker is over-infrastructure at personal scale |
| R4 | The component catalog as content (~870 real skills, much Anthropic-verbatim; 434 dup-heavy agents) `skills/ANTHROPIC_ATTRIBUTION.md` | nxtlvl's curated-not-cataloged, quality-first ethos |
| R5 | **"ALWAYS use agent X" mandate-prose steering** `CLAUDE.md:82,337` | nxtlvl's "inform, don't force" (CCT's works only because its mandated actions are objective) |
| R6 | Static per-component `version: "1.0.0"` frontmatter (dead metadata, never read) `marketplace.json` | git history is nxtlvl's version axis |
| R7 | `ps aux \| grep claude` live-process detection `ProcessDetector.js:23-95` | the active transcript already answers "is a session live" |

---

## 8. Applying to nxtlvl — ADR candidates & next steps

Most findings are **notes, not ADRs** — small primitives (A5, A6, D2, D3, D4) fold into existing
surfaces when those surfaces are next touched, no decision required. Curate hard. Three rise toward
*architectural and expensive-to-reverse*, i.e. ADR candidates worth running through the decision rule
(`/interview-me`→`/grill-me`→`/spec`→`/plan`→`nxtlvl:documentation-and-adrs`):

1. **A promotion-gate validator (A1 + A2).** Adding an objective lint to the `git mv` promotion step
   — and to `harness-review`'s vendoring step — is a structural addition to how components enter the
   live plugin. The "block on objective facts, warn on taste" boundary is the load-bearing decision.
   This is the single highest-value transplant from CCT and the most likely genuine ADR.
2. **Hook-enforced read-only agents (A3).** Whether to harden the read-only fleet from
   tool-withholding to belt-and-suspenders frontmatter hooks is a doctrine-level choice affecting
   every read-only agent; verified-supported, so the question is policy, not feasibility. Likely an
   *amendment* to whatever records the read-only-by-withheld-tools doctrine rather than a fresh ADR.
3. **Path-scoped `CLAUDE.md` decomposition (A4).** Splitting the monolith into `paths:`-scoped rules
   changes how nxtlvl's own steering context loads — with a real compaction trade-off (§6). Architectural
   for the harness's own configuration; worth a deliberate decision rather than a drive-by edit.

**Cross-run note:** this distillation is now the fourth external voice (alongside ecc, agent-skills,
superpowers) for the `triangulate-three-harnesses-build-decisions` practice — but it is a **distribution/
catalog product**, not a peer harness, so weight its *contrasts* (it ratifies nxtlvl's curation and
local-only choices) over its *content* (mostly reject).
