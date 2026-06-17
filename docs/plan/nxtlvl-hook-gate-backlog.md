# nxtlvl — Hook Gate Backlog

> Blocking **gates** only (exit-2 hooks). Observation/context hooks live in the Phase-0 plan.
> Governed by [ADR-006](../decisions/ADR-006-hook-fail-open-gated-blocking.md) (fail-open on
> error, absolute; deliberate blocking permitted but gated) and the reactive intake gate
> ([ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)). Every gate here obeys the
> uniform contract:
>
> - **Errors fail open, always** — no `set -e`, explicit `exit 0` on every path, errors swallowed.
> - **`exit 2` = block** (a *clean decision*, never a crash); stderr = the reason + override.
> - **Every gate ships an env-var kill switch** — disable with no reinstall.
> - A gate is **built in the repo workbench**; install + live-test is a manual step in
>   interactive `claude` (the agent cannot run `/plugin`).

These first two gates pass [ADR-008](../decisions/ADR-008-reactive-growth-intake-gate.md)'s
**universal membership test** ("would I want this no matter what I'm working on this week?") on
the spot — both are pure, task-independent *safety*, not workflow flavor — so they need no logged
near-miss to qualify. ADR-008 governs how *later*, task-flavored gates earn admission.

---

## 1. `dangerous-bash` — STATUS: BUILT (2026-06-17); install + live-test pending (manual)

**Why it passes the membership test:** catastrophic, irreversible shell commands are a hazard
on every task. Highest catastrophe-severity of any candidate gate → first to land.

**Shape:**
- Event `PreToolUse`, **new matcher `Bash`** (separate block from the existing `Skill|Task`).
- Command text at `tool_input.command`.
- **Block (`exit 2`) only high-confidence catastrophic patterns** — conservative, to keep the
  daily driver friction-free. Candidate set (the spawned session finalizes):
  - `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`, recursive-force rm of root-ish paths
  - `git push --force`/`-f` to `main`/`master` (protected-branch force-push)
  - curl/wget piped to a shell (`curl … | sh`, `… | bash`) — network pipe-to-shell
  - `dd of=/dev/…`, `mkfs…`, redirect to a block device (`> /dev/sd…`)
  - `chmod -R 777` on broad paths; fork bomb `:(){ :|:& };:`
  - (`git reset --hard` is destructive-but-common → **warn at most**, don't block)
- **Kill switch:** `NXTLVL_DANGEROUS_BASH=off` → no-op (`exit 0`).
- **Fail-open:** malformed/empty stdin, missing `jq`, any parse error → `exit 0`, no block.
- **Smoke matrix (must pass before handoff):** benign cmd→0 · `rm -rf /`→2 · kill-switch on→0 ·
  malformed JSON→0.

**Open questions — RESOLVED in the build session:**
- *Parse strategy:* **Node** (`plugins/nxtlvl/hooks/dangerous-bash.js`), not bash+jq. `JSON.parse`
  handles quoted/escaped/multiline commands robustly, reuses the `context-alert.js` node-hook
  precedent, and has no jq dependency that could be absent and silently neuter the gate. Sets the
  precedent for the gate family (config-protection next).
- *`git reset --hard` / `git clean -f…`:* **warn** (exit 0 + stderr nudge), never block — per the
  "warn at most" guidance. Demonstrates the non-blocking warn path.
- *stderr wording:* block message names the reason + echoes the (one-lined, ≤400-char) command +
  the `NXTLVL_DANGEROUS_BASH=off` override; warn message is a single-line nudge.

**Build artifacts:**
- `plugins/nxtlvl/hooks/dangerous-bash.js` — `decide(raw, env)` core (exported + unit-tested),
  ordered block detectors, two warn detectors. Whole body fail-open: any throw → exit 0.
- `plugins/nxtlvl/hooks/hooks.json` — new `PreToolUse` block, matcher `Bash`, id `pre:dangerous-bash`.

**Verification (all pass, agent-scriptable):**
- Required smoke matrix: benign→0 · `rm -rf /`→2 · kill-switch→0 · malformed JSON→0 (+ empty
  stdin→0, no-command→0).
- All 16 block patterns→2; both warn patterns→0; 9 precision cases (targeted `rm`, `--force-with-lease`,
  force-push to a feature branch, `dd of=file`, `> /dev/null`, targeted `chmod`, `curl -o`, …)→0.
- **Fault-injection (ADR-006):** a mutant whose `decide()` throws on every call still exits 0 on
  `rm -rf /` — a broken gate never blocks.

**Known, deliberate trade-off:** detection matches the raw command string (no shell-quote parsing),
so `echo 'rm -rf /'` / `git commit -m "fix rm -rf / guard"` will also trip the gate. Accepted on
purpose: stripping quoted strings to avoid that would let the genuinely-catastrophic `bash -c 'rm -rf /'`
slip through — a false-negative is worse than a clearly-messaged, overridable false-positive.

**Remaining (manual, interactive `claude` only):** `/plugin marketplace update nxtlvl-dev` to reinstall,
then live-fire one block (e.g. confirm a real `rm -rf /` attempt is stopped) + the kill switch.

---

## 2. `config-protection` — STATUS: COMMITTED (definite future hook)

**Why it passes the membership test:** stops the agent from *weakening its own quality bar* —
disabling a lint rule / loosening tsconfig to make an error vanish instead of fixing the code.
Task-independent; wanted on every project. (ecc ships this as `pre:config-protection`.)

**Shape (sketch — design pass owed before build):**
- Event `PreToolUse`, matcher `Write|Edit` (this harness has no `MultiEdit`).
- Protected set: linter/formatter/typecheck configs — `.eslintrc*` / `eslint.config.*`,
  `biome.json`, `.prettierrc*` / `prettier.config.*`, `tsconfig*.json`, `ruff.toml` /
  `[tool.ruff]` in `pyproject.toml`, `rustfmt.toml`, clippy config, `.editorconfig`.
- **Block (`exit 2`)** an edit to a protected file; stderr steers: "fix the code, not the config —
  override with the kill switch if this change is legitimate."
- **Kill switch:** `NXTLVL_CONFIG_PROTECTION=off`.
- **Fail-open:** same contract as above.

**Why deferred, not now (sequencing, not doubt):**
1. Let `dangerous-bash` prove the gate mechanism (exit-2 path, kill switch, fault-injection)
   end-to-end first.
2. One real design decision is owed: **block-all edits** (ecc's simple stance) vs.
   **block-on-weakening only** (needs diff inspection — more code, fewer false positives).
   Lower catastrophe-severity than `dangerous-bash`, so it can wait for that decision.

---

## Parking lot (NOT committed — would need the intake gate to log a real near-miss)

- `secrets` gate (block a write/commit containing a key) — strong candidate, but overlaps tooling
  that may already exist; admit on first logged near-miss.
- `doc-file-warning` (warn on scattered ad-hoc `.md`) — cheap, low value; ecc has it.
