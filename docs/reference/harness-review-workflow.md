# Harness Review Workflow — vendor → fan-out → distill

> Drafted 2026-06-19 as the design doc for a reusable skill. Generalizes the method run on
> `disler/claude-code-hooks-mastery` (see [hooks-mastery-distillation.md](hooks-mastery-distillation.md))
> so the same pipeline can be applied to the 10+ other harnesses queued for review. This is the
> **process**; each run's *output* is a distillation in `docs/reference/`.
>
> **Build-method anchor:** nxtlvl is shaped by *systematically reviewing existing harnesses and
> deciding, area by area, adopt / adapt / reject* (see `CLAUDE.md`). This workflow is the
> mechanical realization of that method. It **composes** existing skills rather than reinventing
> them — `superpowers:dispatching-parallel-agents` (Phase 3), `doc-coauthoring` (Phase 5), and the
> decision rule / `nxtlvl:documentation-and-adrs` (Phase 7).

---

## 1. Purpose & when to use

Use when a new external harness/repo needs to be reviewed for what nxtlvl should **adopt, adapt,
or reject**. The output is a durable, citable judgment so the vendored repo can stay a disposable
"book on the shelf" — only the analysis is tracked.

**Good targets** (worth the full pipeline): full multi-component harnesses (hooks/agents/
commands/skills) and substantial subagent collections. **Poor targets** (skip or skim — no deep
review): curated "awesome" meta-lists and single-file gists. The adopt/adapt/reject test is
self-limiting: a repo with no transferable patterns simply produces a short ledger.

---

## 2. Inputs & outputs (the contract)

**Inputs**
- `REPO` — the GitHub URL / `owner/name`.
- `LENS` — the nxtlvl surfaces this repo most plausibly informs (the comparison frame). *This is
  the most important per-run parameter* — it's what turns a generic code-read into an
  adopt/adapt/reject judgment. e.g. for hooks-mastery the LENS was: context-alert hook,
  dangerous-bash gate, C&M / PreCompact Hook 2, ideation agents.

**Outputs**
- `reference/<repo>-main/` — the vendored clone (**gitignored**; machine-local).
- `docs/reference/<repo>-distillation.md` — the **tracked** artifact (house distillation format).
- A `MEMORY.md` pointer + auto-memory file (per `distill-reusable-to-doc-plus-memory`).
- Zero or more **ADR candidates** when a finding rises to an architectural decision.

---

## 3. The pipeline (outline)

| Phase | Name | Output of the phase |
|------:|------|---------------------|
| **0** | **Frame & select** | confirmed `REPO` + `LENS`; go/skip decision |
| **1** | **Vendor** ("book on the shelf") | `reference/<repo>-main/` (gitignored), size + top-level tree |
| **2** | **Structural map** | subsystem inventory + the fan-out partition (independent domains) |
| **3** | **Parallel fan-out analysis** | N structured digests, each ending in Adopt/Adapt/Reject + `file:line` |
| **4** | **Synthesize** | the cross-cutting spine (headline finding); signal-vs-demo split |
| **5** | **Distill** (doc-coauthoring) | `docs/reference/<repo>-distillation.md`, section-by-section |
| **6** | **Reader-test** | fresh-context agent confirms the doc stands alone |
| **7** | **Land it** | memory pointer + `MEMORY.md` line + ADR candidates raised |

---

## 4. Phase detail (the report)

### Phase 0 — Frame & select
State the `REPO` and the `LENS` explicitly before any work. The LENS is what every downstream
agent maps findings against; without it, the fan-out produces a neutral code summary instead of a
decision. Apply the good/poor-target test (§1) and decide go/skip.

### Phase 1 — Vendor ("book on the shelf")
```
git clone --depth 1 https://github.com/<owner>/<repo>.git reference/<repo>-main
rm -rf reference/<repo>-main/.git        # flat tree, matches ECC-main convention
du -sh reference/<repo>-main             # capture size
```
- **Naming:** `<repo>-main` (mirrors GitHub's ZIP-download convention used for `ECC-main`).
- **Tracking:** `.gitignore` is `/reference/*` with `!/reference/ECC-main` — so new clones are
  **local-only by design**. Do *not* add a tracking exception; the distillation is the durable
  artifact. (ECC-main is the one tracked exception, per ADR-002 dormant-backstop.)
- **Sandbox:** the clone needs network — run it with the sandbox disabled.
- **GateGuard:** the first Bash call triggers a fact-force gate; the `rm -rf` triggers a
  destructive-command gate. Both are satisfied by stating facts once, then retrying (see §6).

### Phase 2 — Structural map
`find <repo>-main -maxdepth 3` + read the README intro. Identify the subsystems and **partition
them into independent domains** for the fan-out. The partition is the key design choice of this
phase — domains must be independently analyzable (no shared state) so they can run in parallel.
For a `.claude/`-style harness the natural partition is roughly:
1. **Hooks / automation** (the deterministic-control surface)
2. **Agents / orchestration** (subagents, meta-agents, team patterns)
3. **Philosophy / docs / commands / periphery** (README thesis, output styles, status lines, specs)

Adjust the partition to the repo's actual shape; 2–4 domains is typical.

### Phase 3 — Parallel fan-out analysis
Dispatch one `general-purpose` agent per domain, **all in one message** (parallel). Each agent
prompt MUST contain the five elements that made this run work:
1. **Build-method context** — pass nxtlvl's "review harnesses to shape ours" framing along (the
   `CLAUDE.md` requirement when spawning subagents).
2. **Read-only mandate** — "modify nothing; your output is a digest the main session synthesizes."
3. **Scoped target** — the exact files/dirs this agent owns, and the absolute repo path.
4. **The LENS** — the specific nxtlvl surfaces to map findings against (from Phase 0).
5. **Required output shape** — a structured markdown digest, every claim cited to `file:line`,
   **ending in an explicit "Adopt / Adapt / Reject" list**.

Agents return conclusions, not file dumps — this preserves the main thread's context for synthesis.

### Phase 4 — Synthesize
Read the digests and find the **cross-cutting spine** — the single most important finding, which
is frequently *not* a feature to copy but a **contrast that confirms or challenges an existing
nxtlvl decision** (for hooks-mastery: "deterministic control" vs "inform, don't force"). Also
separate **signal from demo** — teaching/demo repos carry deliberate filler (demo domains, toy
apps) that must not be mistaken for craft.

### Phase 5 — Distill (compose `doc-coauthoring`)
Write `docs/reference/<repo>-distillation.md` in the **house distillation format**:
- Dated blockquote header (what it is, what was analyzed, **Purpose**, companion links).
- Numbered `##` sections; verbatim quotes with `file:line` citations throughout.
- A consolidated **Adopt / Adapt / Reject ledger** mapped to nxtlvl surfaces.
- An **"Applying to nxtlvl"** / ADR-candidates close.

Default to **section-by-section** drafting (scaffold all headers with placeholders, then fill and
review each). Lead with the spine from Phase 4 as the headline section.

### Phase 6 — Reader-test (doc-coauthoring Stage 3)
Dispatch a fresh-context agent to read the finished distillation cold and report: does it stand
alone, are the adopt/adapt/reject calls actionable, any unsupported claim or missing citation.
Fix what it surfaces.

### Phase 7 — Land it
- Add an auto-memory pointer + a one-line `MEMORY.md` index entry (per
  `distill-reusable-to-doc-plus-memory`).
- For any finding that is **architectural and expensive to reverse**, raise an **ADR candidate**
  via the decision rule (`/interview-me`→`/grill-me`→`/spec`→`/plan`→`nxtlvl:documentation-and-adrs`).
  Curate hard — most findings are notes, not ADRs.

---

## 5. What to parameterize (the skill's knobs)

| Knob | Varies by | Default |
|------|-----------|---------|
| `REPO` | every run | — (required) |
| `LENS` (nxtlvl surfaces) | what the repo is about | — (required; ask if unclear) |
| Domain partition | repo shape | hooks / agents / periphery (3) |
| Fan-out agent count | partition size | 2–4 |
| Signal-vs-demo filter | teaching/demo vs production repo | on for demo repos |
| Distillation depth | repo richness + LENS overlap | full pipeline; skim for poor targets |

---

## 6. Gotchas & lessons (from the hooks-mastery run)

- **GateGuard (ECC) is the main friction.** Three gates fire: (a) first-Bash-of-session
  fact-force, (b) destructive-command (`rm -rf`) fact-force, (c) edit/write fact-force. Each is
  satisfied by stating the requested facts once and retrying; (c) fires **once per file per
  session**, then is quiet. For a multi-file doc session, offer to disable just
  `pre:edit-write:gateguard-fact-force` via `ECC_DISABLED_HOOKS` to cut friction — the
  dangerous-bash block stays live.
- **Clone needs the sandbox off** (network egress); the in-repo `rm -rf .git` is safe (only the
  fresh clone's own `.git`).
- **Edit wrapped prose carefully** — read the exact line before an `Edit`; soft-wrapped paragraphs
  make `old_string` guesses miss. Match a unique single-line token.
- **The best finding is often a contrast, not a feature.** Budget synthesis time for "what does
  this repo's stance reveal about a decision nxtlvl already made?"
- **Separate signal from demo first.** Demo repos optimize for teaching; the toy domains
  (crypto/TTS/hello-world/task-manager apps in hooks-mastery) are not craft.
- **Always pass the build method to subagents** and **always require the Adopt/Adapt/Reject list
  in their output** — retrofitting the framing during synthesis is more expensive.
- **Cross-check stale reference material** — hooks-mastery's flow-control table documented 8 of 13
  hook events; verify any reference-grade table against current upstream docs before trusting it.

---

## 7. Composes (don't reconstruct)

- **Phase 3** → `superpowers:dispatching-parallel-agents` (independent-domain fan-out).
- **Phase 5/6** → `doc-coauthoring` (scaffold → section-by-section → reader-test).
- **Phase 7** → the decision rule (`~/.claude/rules/decisions.md`) +
  `nxtlvl:documentation-and-adrs`; `distill-reusable-to-doc-plus-memory` for the memory pointer.
- **Cross-run** → `triangulate-three-harnesses-build-decisions`: when a *build decision* (not a
  repo review) is on the table, review how 3 harnesses each do it. This workflow feeds that —
  every distillation is one of the three voices.

---

## 8. Worked example

`disler/claude-code-hooks-mastery`, run 2026-06-19 → [hooks-mastery-distillation.md](hooks-mastery-distillation.md).
- LENS: context-alert hook · dangerous-bash gate · C&M / PreCompact Hook 2 · ideation agents.
- Partition: 3 domains (hooks · agents/orchestration · philosophy/periphery).
- Spine: "deterministic control" vs "inform, don't force" — a contrast that *validated* nxtlvl's
  doctrine (shipped config blocks on exactly one event; fail-open everywhere else).
- Highest-value adopt: read-only validator via withheld write tools → nxtlvl `design-critic`.
