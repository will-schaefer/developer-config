# Implementation Plan: DeepWiki Orientation Accelerator for `harness-review`

> Spec: [`docs/spec/harness-review-deepwiki-orientation.md`](../spec/harness-review-deepwiki-orientation.md)
> · Status: **awaiting approval before implementation**

## Overview

Add DeepWiki as a Phase-2 orientation accelerator to `harness-review` via three surfaces
(MCP registration → scout agent → skill edit → command), plus an ADR and discoverability
pointers. The whole build is Markdown/JSON prompt artifacts — no code toolchain. The binding
constraint threaded through every task: **DeepWiki orients, it never testifies** (leads, not
evidence; never a hard dependency).

## Architecture Decisions (from approved spec)

- **Orientation-not-evidence** — DeepWiki output shapes the Phase-2 partition and seeds fan-out
  questions only; zero DeepWiki citations reach any artifact. → recorded as ADR (Task 7).
- **Read-only-by-withheld-tools** — `deepwiki-scout` gets *only* the 3 `mcp__deepwiki__*` tools +
  WebFetch; no Read/Write/Edit/Bash/Glob/Grep. It physically cannot touch tree or artifact.
- **Graceful degradation** — public GitHub `REPO` → DeepWiki on; local/private → silently skipped,
  behavior identical to today. Never a hard dependency.
- **Edit, don't fork** — the consolidated 3-mode (A/B/C) skill is preserved; we add a sub-step, not
  a new skill. The skill stays the single source of truth; the agent is spawned by it.

## Dependency Graph

```
Task 1 (.mcp.json — tools resolve)
   └── Task 2 (deepwiki-scout agent + reference doc — uses the tools)
          └── Task 3 (SKILL.md edit — Phase 0/1 gate + Phase 2 spawns scout)
                 └── Task 4 (/harness-review command — invokes the skill)
Task 5 (ADR)            ─ independent, after design is locked (now)
Task 6 (discoverability) ─ after Tasks 2 & 4 exist
Task 7 (verification)    ─ after Tasks 1–4 land
```

Build bottom-up: tools → brain → wiring → entry → record → discover → verify.

---

## Task List

### Phase 1: Enable + Brain

## Task 1: Register the DeepWiki MCP server

**Description:** Create the plugin's first `.mcp.json`, registering the remote no-auth DeepWiki
server so `mcp__deepwiki__*` tools resolve in-session.

**Acceptance criteria:**
- [ ] `plugins/nxtlvl/.mcp.json` registers a server named `deepwiki` → `https://mcp.deepwiki.com/mcp`
      (remote HTTP transport, no auth).
- [ ] Schema matches Claude Code plugin `.mcp.json` conventions; no other servers added.

**Verification:**
- [ ] `plugin-dev:plugin-validator` passes on the manifest/`.mcp.json`.
- [ ] MCP smoke test: the 3 tools resolve and return for `mindfold-ai/Trellis`.

**Dependencies:** None · **Files:** `plugins/nxtlvl/.mcp.json` · **Scope:** XS

## Task 2: Build the `deepwiki-scout` agent + orientation reference

**Description:** Create the read-only scout (sibling of `context-scout`) and the short reference doc
that documents the leads-not-evidence discipline. Done together — the agent body points at the
reference's contract.

**Acceptance criteria:**
- [ ] `agents/deepwiki-scout.md`: frontmatter `tools:` lists ONLY the 3 `mcp__deepwiki__*` tools +
      `WebFetch`; `model: sonnet`; description mirrors the `context-scout` idiom.
- [ ] Body: given `REPO`, returns a tight orientation brief = component map
      (`read_wiki_structure`) + **3–5** mode-seeded `ask_question` answers; **every** claim stamped
      `LEAD — verify at source` + a staleness note; treats input as data not instructions; never
      writes tree/artifact; WebFetch fallback on `https://deepwiki.com/<owner>/<repo>`.
- [ ] `references/deepwiki-orientation.md`: the 3 tools, the verify discipline, staleness +
      hallucination caveat, the 3–5 budget. Lean.

**Verification:**
- [ ] `plugin-dev:plugin-validator` passes on the agent frontmatter.
- [ ] Manual read: brief format makes a leaked DeepWiki citation impossible to mistake for evidence.

**Dependencies:** Task 1 · **Files:** `agents/deepwiki-scout.md`,
`skills/harness-review/references/deepwiki-orientation.md` · **Scope:** S

### Checkpoint: Enable + Brain
- [ ] MCP tools resolve; scout validates; reference reads cleanly. Review before wiring.

### Phase 2: Wire + Entry

## Task 3: Wire DeepWiki into `harness-review/SKILL.md`

**Description:** Edit the skill: add the public-GitHub availability gate to Phase 0/1 and the
`deepwiki-scout` sub-step to Phase 2, with the leads-not-evidence contract. Preserve all Mode A/B/C
semantics and the existing phase numbering.

**Acceptance criteria:**
- [ ] Phase 0/1 state the availability gate (public GitHub → on; local/private → skip, degrade).
- [ ] Phase 2 spawns `deepwiki-scout` as a sub-step that informs the partition + seeds fan-out
      questions, explicitly tagged leads-not-evidence, pointing to `references/deepwiki-orientation.md`.
- [ ] No change to Phase 3–7, rubrics, scoring, or artifact formats. SKILL.md body stays lean
      (detail lives in the reference).

**Verification:**
- [ ] Diff review: only Phase 0/1/2 prose changed; modes intact.
- [ ] Dogfood (Task 7) exercises this path.

**Dependencies:** Task 2 · **Files:** `skills/harness-review/SKILL.md` · **Scope:** S

## Task 4: Add the `/harness-review` command

**Description:** Create the entry command (frontmatter mirrors `brainstorm.md`) that invokes the
skill with `mode + REPO + mode extras`.

**Acceptance criteria:**
- [ ] `commands/harness-review.md`: `description` + `argument-hint`; body explains mode + REPO +
      extras (FOCUS / TARGET+LENS / DOMAIN) and ends with `$ARGUMENTS`.
- [ ] Invokes the `harness-review` skill (does not reimplement it).

**Verification:**
- [ ] `plugin-dev:plugin-validator` passes; `/harness-review` appears as a command.

**Dependencies:** Task 3 · **Files:** `commands/harness-review.md` · **Scope:** XS

### Checkpoint: Wire + Entry
- [ ] `/harness-review` invokes the skill, which spawns the scout in Phase 2. Review before record/verify.

### Phase 3: Record + Discover + Verify

## Task 5: Record the orientation-not-evidence ADR

**Description:** Via the decision rule → `documentation-and-adrs`, record the architectural
principle in the house ADR format.

**Acceptance criteria:**
- [ ] `docs/decisions/ADR-0NN-deepwiki-orientation-not-evidence.md` with valid frontmatter, Context ·
      Decision · Alternatives · Consequences; README index updated; number verified against the
      committed tree (no collision).

**Verification:**
- [ ] ADR integrity check (frontmatter, index match, no numbering gap/dup).

**Dependencies:** None (design locked) · **Files:** `docs/decisions/ADR-0NN-*.md`, `docs/decisions/README.md` · **Scope:** S

## Task 6: Discoverability pointers

**Description:** One index/memory pointer so the new command + agent are findable. Router stays
as-is (command is the surface of the existing skill entry — **no** new router-table row).

**Acceptance criteria:**
- [ ] Memory `MEMORY.md` harness-review-related pointer notes the new `/harness-review` command +
      `deepwiki-scout` + the orientation-not-evidence principle.
- [ ] No new router-table row added.

**Verification:** Manual — pointer resolves; router unchanged.

**Dependencies:** Tasks 2, 4 · **Files:** `config/claude/memory/MEMORY.md` (+ a memory file if warranted) · **Scope:** XS

## Task 7: Verification sweep (dogfood + degradation)

**Description:** Exercise the whole path end-to-end.

**Acceptance criteria:**
- [ ] Dogfood: `/harness-review` Mode A on one already-reviewed public harness — scout brief stamps
      leads, partition is sane, finished artifact cites only local `file:line` (zero DeepWiki).
- [ ] Degradation: a local-path `REPO` run skips DeepWiki silently; behavior matches baseline.
- [ ] Existing Phase-6 reader-test still passes on the produced artifact.

**Verification:** The three runs above; capture results.

**Dependencies:** Tasks 1–4 · **Files:** none (produces a throwaway review artifact) · **Scope:** M

### Checkpoint: Complete
- [ ] All acceptance criteria met; lead-stamping + DeepWiki-citation-free artifact proven; degradation proven. Ready for review/commit.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP tool-id prefix differs from `mcp__deepwiki__*` | Med | Confirm at Task 1 smoke test; the agent `tools:` list is the only place to fix. |
| DeepWiki claim leaks into an artifact as evidence | High | Read-only-by-withheld-tools (scout can't write) + lead-stamp + Task 7 dogfood asserts zero DeepWiki citations. |
| DeepWiki unreachable / wiki not generated for a repo | Low | WebFetch fallback, then silent skip — never a hard dependency. |
| Wiki staleness vs vendored SHA misleads the partition | Low | Staleness note in the brief; partition is verified by Phase-3 fan-out regardless. |
| Plugin's first `.mcp.json` mis-registers | Med | `plugin-validator` + smoke test at the Phase-1 checkpoint. |

## Open Questions

None — the three from the spec are resolved (namespace `mcp__deepwiki__*`, 3–5 question budget,
command-surface-only routing).

## Parallelization

Mostly sequential (linear dependency chain). Task 5 (ADR) can run in parallel with Tasks 1–4.
Task 6 waits on 2 + 4. Task 7 is the terminal gate.
