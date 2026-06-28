---
description: Ingest the next pending repo from repos.jsonl (single-flight, lock-guarded)
---

Ingest the **next pending repo** from the `repos.jsonl` manifest — one repo per run, safe under a
recurring `/loop` AND across concurrent sessions. You are one *tick*. Follow these steps exactly.

**Source of truth:** `repos.jsonl` (one JSON record per repo). `master-repo-list.md` is a generated
view. **Never hand-edit either** — all manifest changes go through `repo_status.py`, which
mutates the record AND re-renders the view atomically (so they can't drift). Commit **both** files
together on every change.

**Constants**
- `T = 60` — staleness threshold (minutes). A lock, or a `claimed` record whose `claimed_at` is
  older than T, is treated as a crashed tick and reclaimed. **Invariant: a single ingest completes
  within T.** Raise T if you ingest very large repos — there is no mid-ingest heartbeat by design.
- Timestamps are ISO-8601 UTC; the CLI stamps them for you.
- **Never `git add -A`.** Stage only the explicit paths named below.

**Record status** (`status` field): `pending` · `claimed` (+`claimed_at`) · `ingested`
(+`ingested_at`) · `off_scope` · `failed` (+`error`).

## Steps

1. **Acquire the lock (single-flight, cross-process).** `LOCK="$(git rev-parse --git-dir)/auto-ingest.lock"`.
   Create it atomically: `mkdir "$LOCK" 2>/dev/null`.
   - **Success** → you hold the lock. Stamp it: `date -u +%Y-%m-%dT%H:%M:%SZ > "$LOCK/started"`.
   - **Fails (exists)** → `ts=$(cat "$LOCK/started" 2>/dev/null)`; compute its age in minutes
     (BSD `date`: `claimed=$(date -u -j -f "%Y-%m-%dT%H:%M:%S" "${ts%Z}" +%s); age=$(( ($(date -u +%s) - claimed)/60 ))`).
     - `age < 60` → another tick is running → output `"in progress (lock held since <ts>) — no-op"`
       and **STOP. Do not touch the lock or any file.**
     - `age >= 60` or no readable stamp → holder crashed → `rm -rf "$LOCK"`, then `mkdir "$LOCK"`
       and stamp it. Proceed.
   You now hold the lock. **Release it (`rm -rf "$LOCK"`) on every exit path below EXCEPT the no-op.**

2. **Crash-recovery (self-healing).** Reclaim any record left `claimed` by a crashed prior tick:
   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/scripts/repo_status.py" reclaim-stale --minutes 60
   ```
   It prints each reclaimed id and resets it to `pending`. If it printed anything, commit the reset:
   `git add repos.jsonl master-repo-list.md && git commit -m "chore: reclaim stale claim(s)"`.
   (Partial files from a crash are left for human cleanup — never auto-retry into an immutable
   `raw/` note.)

3. **Claim the next pending.**
   ```bash
   ID=$(python3 "${CLAUDE_PLUGIN_ROOT}/scripts/repo_status.py" next)
   ```
   - Empty output → release the lock (`rm -rf "$LOCK"`), output `"queue empty"`, **STOP** (`/loop` ends).
   - Else claim it and commit the claim:
     ```bash
     python3 "${CLAUDE_PLUGIN_ROOT}/scripts/repo_status.py" claim "$ID"
     git add repos.jsonl master-repo-list.md && git commit -m "chore: claim $ID for ingest"
     ```
     The repo URL is `https://github.com/$ID`.

4. **Ingest.** Run **steps 1–4** of the `ingest-repo` procedure (`.claude/commands/ingest-repo.md`)
   on `https://github.com/$ID`: orient (DeepWiki — leads only) → verify (real source at a pinned
   SHA) → capture an immutable `raw/<cluster>/<YYYY-MM-DD>-<repo>-reading.md` → compile
   `wiki/<cluster>/` pages with `owner/repo@<SHA>/path#Lx-Ly` permalink citations → append a `log.md`
   entry. **No vendored code.** Do **not** run `ingest-repo`'s own step-5 commit — this command owns
   the finalize (step 5) so the status flip lands in the same commit.

5. **Record the outcome.** (A success ends the tick; off-scope/failure resolve instantly and advance.)
   - **Success** → verify: raw note exists; wiki pages exist; ≥1 `owner/repo@<SHA>` permalink is
     present; `grep -c '```python' <raw-note>` is `0`. Then run the **mandatory lint gate**: the
     deterministic `/lint` checks (broken wikilinks, orphans, citation reconciliation `sources:` ↔
     footnotes both directions, stale SHAs) **plus** `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/check_repo_manifest.py"`; **fix
     any failures before committing** (intentional research-lead links are not failures). Then flip
     the status and commit everything together:
     ```bash
     python3 "${CLAUDE_PLUGIN_ROOT}/scripts/repo_status.py" ingest "$ID"
     git add raw/<cluster>/<file> wiki/<cluster>/<files...> log.md repos.jsonl master-repo-list.md
     git commit -m "feat: ingest $ID"
     ```
     Release the lock (`rm -rf "$LOCK"`) and **STOP** — tick complete.
   - **Off-scope** (`ingest-repo` refuses it as outside agent-harness scope):
     ```bash
     python3 "${CLAUDE_PLUGIN_ROOT}/scripts/repo_status.py" offscope "$ID"
     git add repos.jsonl master-repo-list.md && git commit -m "chore: mark $ID off-scope"
     ```
     then **go back to step 3** (keep the lock).
   - **Failure** (DeepWiki down, fetch/HTTP error, ambiguous repo):
     ```bash
     python3 "${CLAUDE_PLUGIN_ROOT}/scripts/repo_status.py" fail "$ID" --error "<short reason>"
     git add repos.jsonl master-repo-list.md && git commit -m "chore: mark $ID failed: <reason>"
     ```
     then **go back to step 3** (keep the lock).
