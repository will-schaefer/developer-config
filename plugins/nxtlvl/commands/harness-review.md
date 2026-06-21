---
description: Vendor an agent harness and analyze it via parallel read-only fan-out — in one of three modes — (A) a neutral deep-dive quality + architecture report, (B) an adopt/adapt/reject ledger for a target harness, or (C) a deep specialist audit of one domain. On a public GitHub repo it opens with a DeepWiki orientation pass (leads, not evidence) to accelerate the structural map.
argument-hint: "<mode A|B|C> <REPO> [mode extras]"
---

# /harness-review

Invoke the **`harness-review` skill** (Skill tool) to vendor a harness, fan out read-only analysis
over its independent subsystems, and synthesize one tracked, citable artifact. This command is the
entry surface of that skill — it does **not** reimplement the pipeline.

## What to pass

- **`mode`** — `A` (general review), `B` (adopt/adapt/reject), or `C` (domain review). If unstated,
  infer from intent (see the skill's "Picking the mode"); ask only when genuinely ambiguous.
- **`REPO`** (required) — GitHub `owner/name` or URL (a local path also works). A public GitHub
  `REPO` enables the Phase-2 **DeepWiki orientation** pass (`deepwiki-scout`); local/private skips it
  silently and behaves exactly as before.
- **Mode extras:**
  - **Mode A** — optional `FOCUS` (narrow attention to part of the harness).
  - **Mode B** — required `TARGET` (the harness you decide *for*) + `LENS` (the surfaces this repo
    informs).
  - **Mode C** — required `DOMAIN` (e.g. `hooks`/`agents`/`memory`/`orchestration`) + optional `FOCUS`.

## What it does

1. **Invoke `harness-review`** with the parsed `mode + REPO + extras`.
2. The skill runs its phases: frame & select → vendor → structural map & partition (DeepWiki
   orientation when available) → parallel fan-out → synthesize → write artifact → reader-test → land.
3. DeepWiki, when on, only *orients* the partition and *seeds* the fan-out — **leads, not evidence;
   the finished artifact cites only local `file:line`** (ADR-029).

## When to use

Whenever an agent harness, Claude Code plugin, `.claude/`-style repo, subagent collection, or agent
framework comes up to be understood, evaluated, or mined. Not a code review of your own diff (use a
code-review skill) and not for building a harness.

$ARGUMENTS
