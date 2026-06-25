---
name: claude-config-repo
description: Global CC config is version-controlled IN the Developer repo at config/claude/; ~/.claude/* are symlinks into it. GitHub remote renamed developer-config → will-schaefer/nxtlvl-harness (2026-06-25); PR→main workflow. Local dir stays ~/Developer.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 8db67a93-7293-44df-9250-c3aa64fe7dc6
---

**The Developer repo is the single source of truth for global CC config** (decided 2026-06-18). The real files live in `Developer/config/claude/` — `CLAUDE.md`, `settings.json`, `rules/`, `skills/`, and `memory/` (this auto-memory). `~/.claude/{CLAUDE.md,settings.json,rules,skills}` and `~/.claude/projects/-Users-willschaefer-Developer/memory` are **symlinks** pointing into that dir; `Developer/config/claude/link.sh` recreates them on a new machine. The earlier standalone `~/.claude` git repo was **retired** (no longer a repo). Machine-local runtime state (`plugins/`, transcripts, telemetry) stays in `~/.claude`, untracked. **Now has a GitHub remote** — `github.com/will-schaefer/nxtlvl-harness` (renamed from `developer-config` 2026-06-25 as part of the strict-harness transition; GitHub redirects the old URL) — with a PR→`main` workflow (PR #1 merged 2026-06-18 via clean fast-forward; merged branch pruned). The **local clone dir stays `~/Developer`** (renaming it would break the `~/.claude` symlinks + the `-Users-willschaefer-Developer` memory path); remote name and local dir name intentionally differ. Terminal/editor dotfiles (iterm2/kitty/helix) were extracted out to the separate `will-schaefer/dotfiles` repo; `config/claude` stays here. See [[developer-repo-git-workflow]].

Implications: (1) **`settings.json` is tracked — keep secrets OUT** (creds in the macOS Keychain; use `apiKeyHelper`, never inline env secrets). (2) Memory now lives in the Developer repo, so harness memory writes dirty that repo — commit when tidying. (3) **Atomic-write risk:** if Claude Code rewrites `~/.claude/settings.json` (or `CLAUDE.md`) via rename, it may clobber the *file* symlink → re-run `link.sh`. Directory symlinks (rules/skills/memory) are safe. (4) The Developer repo now has TWO settings.json — `config/claude/settings.json` (global) and `.claude/settings.json` (project) — different scopes, both intended. See [[developer-repo-git-workflow]], [[distill-reusable-to-doc-plus-memory]].
