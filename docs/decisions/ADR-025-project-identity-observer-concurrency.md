---
id: ADR-025
title: "Project identity = git common directory; atomic writes + single-flight observer guard"
status: Accepted
date: 2026-06-19
implementation: build-deferred (design-time; no code yet)
---

# ADR-025: Project identity = git common directory; atomic writes + single-flight observer guard

## Context

The context-and-memory spec (2026-06-19) introduced a `nxtlvl` instinct store — one file per
learned instinct, scoped to a project. The scope key is the "project identity." That identity
was used throughout the spec but never defined: the doubt-driven review (T-series refinements)
found this gap and also found that concurrent or crashed observers had no tear-safety story.
Appendix A X4 had been marked "resolved, no new decision" — that marking was wrong. The
identity key is **expensive to reverse** once instincts accumulate under it (renaming the key
orphans every existing instinct), meeting the ADR-worthy test independently of ADR-013's
backbone decision. It is recorded here rather than as an ADR-013 consequence-amendment.

Two forces drove this decision: (1) a worktree-aware developer creates multiple working
directories off one repo — if identity is folder-path, each worktree gets a distinct instinct
silo even though they represent the same project. (2) Atomic writes and a single-flight guard
are the minimum concurrency story for a background one-shot observer process running alongside
a live session; without them, concurrent or crashed observers can tear files or lose updates.

## Decision

**(i) Project identity = the git common directory** (`git rev-parse --git-common-dir`):
- **Worktrees** of one repository **share** identity and instincts — they are the same project
  from the instinct store's perspective.
- **Separate clones** get **distinct** identities even if checked out at the same relative path
  — the common-dir path differs because the `.git` directory differs.
- **Off-git fallback** — when not inside a git repository, identity falls back to the working
  folder. This is a degraded mode, not the primary case.

**(ii) Atomic writes (tmp + rename)** for every instinct-file update. The writer creates a
temp file alongside the target, writes it to completion, then renames it over the target. A
crash or concurrent write therefore never tears a file, loses an update, or leaves a
half-written record.

**(iii) Per-session single-flight guard** before spawning the one-shot observer. Before the
background Haiku pass is launched for a given session, a guard admits only one observer at a
time for that session. This is the cheap, sufficient stand-in for ecc's PID/lock/daemon
machinery — sufficient because (a) the observer is short-lived (one-shot, exits on completion)
and (b) writes are atomic regardless.

See spec §5 and Appendix A X4 for the full decision log.

## Alternatives Considered

### Folder-path identity
- Pros: simple; no git dependency.
- Cons: two clones at the same relative path share an instinct silo and corrupt each other's
  per-project instincts; a worktree at `feat/foo` gets a silo separate from the main worktree
  even though both are working on the same repo.
- Rejected: clone collision makes this unusable for the primary multi-worktree case.

### ecc's PID/lock/daemon machinery
- Pros: proven; handles long-lived processes.
- Cons: heavyweight; requires a running daemon process; imports macOS lock-juggling complexity;
  incompatible with the one-shot observer model (the observer exits after one pass, so a
  persistent daemon is over-engineered).
- Rejected: atomic writes + a per-session single-flight guard are sufficient for a short-lived
  one-shot process.

### Non-atomic in-place writes
- Pros: no temp-file overhead.
- Cons: a crash mid-write leaves a torn or empty file; a concurrent observer can interleave
  partial writes and produce a corrupt instinct.
- Rejected: correctness under concurrency and crash is not optional for an append-only store.

### Per-session lockfile (without atomicity)
- Pros: prevents concurrent observer spawns.
- Cons: a lockfile without atomic writes still allows torn files if the observer crashes; and
  stale lockfiles require a TTL cleanup path.
- Rejected: atomicity is the primitive; the single-flight guard is an optimization on top, not
  a substitute.

## Consequences

- **Identity is irreversible once instincts accumulate under a key.** This was the trigger for
  the ADR-worthy call — changing the key later orphans all existing instincts under the old
  path. The git-common-dir choice is made with that in mind.
- **Worktree sharing is a feature, not a bug.** Instincts learned on `feat/x` are visible on
  `main` and vice versa, because they represent work on the same codebase.
- **No PID/lock daemon to maintain.** Concurrency safety comes from atomic writes; the
  single-flight guard is an in-process check per session, with no persistent process or file to
  clean up.
- **Off-git identity degrades gracefully** to folder path; that case is acknowledged but not
  optimized for.
- Exact storage paths remain a `/plan` detail; the binding identity *shape* (git common-dir)
  and concurrency *primitives* (tmp+rename, single-flight) are fixed here.
- Cross-link: [ADR-004](ADR-004-extend-native-memory.md) (the two-store model whose instinct
  store this identity governs), [ADR-013](ADR-013-floor-on-demand-backbone.md) (the floor that
  spawns the observer), spec §5 (storage design), spec Appendix A X4 (full decision log),
  spec §7-(b) (write-atomicity invariant, now recorded in [ADR-006](ADR-006-hook-fail-open-gated-blocking.md)
  clarifying note).
