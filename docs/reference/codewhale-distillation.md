> **CodeWhale — distillation for nxtlvl.** An open-source (MIT, Rust) terminal coding agent — a TUI/CLI
> driving ~25 model providers through one streaming agent loop. Analyzed 2026-06-21 · 18M · source:
> https://github.com/Hmbown/CodeWhale. LENS: dangerous-bash gate · single-source drift-gate/audit ·
> inform-don't-force/LoopGuard · no-lying-state · C&M state+memory · scoped subagents · MCP-scout
> robustness · cross-harness portability. Method: vendor → parallel read-only fan-out (3 LENS-clustered
> domains) → adopt/adapt/reject synthesis.

This is a **Mode-B** distillation (adopt/adapt/reject ledger), produced by the `nxtlvl:harness-review`
skill. It is the **decision-oriented follow-on** to the neutral
[`codewhale-analysis.md`](codewhale-analysis.md) (Mode-A, same day): the Mode-A asked *"how good is it?"*;
this asks *"what should nxtlvl borrow?"* — re-clustering the fan-out around nxtlvl's decision surfaces and
handing each agent nxtlvl's **locked positions**, then re-verifying every cited line against the clone.
Refines the backlog rows `CW-01…CW-06` and proposes `CW-07…CW-10`.

---

## 1. Spine — the headline finding

**CodeWhale validates nxtlvl by convergence and by counter-example at the same time — so almost nothing
here is a clean Adopt; it is overwhelmingly *corroboration of locked positions* plus two real gap-fillers,
both of which must be Adapted, never copied.** A competent, dogfooded, production coding agent
independently arrived at nxtlvl's architecture on surface after surface: an **objective deny-wins exec gate
with observe-only hooks** (the same single-blocking-gate + inform-don't-force split nxtlvl locked), a
**curated-Markdown memory file — no vector DB, not the transcript** (nxtlvl's exact C&M bet), **scoped
subagents that can only narrow capability**, and **fail-loud secrets**. Convergence by a strong external
team is the strongest validation a reviewed harness can give.

But the same repo is *also* nxtlvl's cleanest counter-example. CodeWhale needed a **363-line CI
drift-checker** (`scripts/check-provider-registry.py`) precisely because it multi-sourced its provider
contract across five hand-synced locations, and it stranded a **complete workflow DSL that nothing
executes** (`crates/whaleflow`, zero dependents) — both are single-sourcing's failure mode, the bandage
and the corpse of a contract that wasn't single-sourced. And the highest-value finding of the whole run is
a **within-one-repo proof that the no-lying-state rule must be uniform**: the very team that fixed a
secret-wipe bug *loud* (`secrets.rs:515`, issue #281) still ships a **non-atomic primary config save**
(`config/lib.rs:2877`) and a **checkpoint that silently nulls corrupt state** (`state/lib.rs:1278`) — three
writers, three durability postures, one codebase. You cannot prove "the rule must be uniform, not
per-component" more concisely than a single excellent team violating it in two crates while honoring it in a
third.

The two genuine gap-fillers — both **Adapt**, both load-bearing-caveated:
1. **The arity table for the dangerous-bash gate** (`CW-01`) — the principled fix for nxtlvl's recorded
   `git branch -f main` false-positive — but **only behind a shell-metacharacter splitter** (`CW-02`),
   which is the one thing CodeWhale itself gets wrong.
2. **The drift-checker as the *shape* for `nxtlvl:audit` §5** (`CW-07`, new) — a working prototype of an
   objective, binary-exit gate that blocks on facts and never on taste — adopted as a *pattern*, while the
   thing it guards (a multi-sourced contract) is exactly what nxtlvl structurally refuses to build.

---

## 2. Exec-safety & audit findings

**The exec gate is the borrowable craft; the registry it sits beside is the cautionary tale.** Evaluation
order in `crates/execpolicy/src/lib.rs:348-475` is **deny-always-wins**, deny surviving even when the same
prefix is also trusted (`:358-372`, regression test `:548-570`), with word-boundary matching (`== rule` or
`rule + ' '`) so `rm` blocks `rm -rf /` but not `rmdir`, and whitespace normalization (`:478-486`) closing
the double-space bypass. Classification runs off a **~211-entry `(prefix, arity)` table**
(`bash_arity.rs:27-259`) that strips flags before counting (`:310-314`) and matches greedy-longest-first
(`:320-332`) — this is what would let nxtlvl classify `git branch -f main` to the canonical `git branch`
(arity 2) instead of substring-matching the `-f`. Wired pre-execution at `crates/core/src/lib.rs:1292`,
refusing on `!decision.allow` (`:1315`).

**The load-bearing gap is real** (`CW-02`): the *only* tokenizer is `command.split_whitespace()`
(`bash_arity.rs:352`) — no `;`/`&&`/`||`/`|`/`$(…)`/backtick awareness. A trusted arity-1 prefix like `make`
classifies `make && rm -rf /` to `make` and waves the whole line through; deny rules are whitespace-only too,
so `;rm` slips a `rm` deny. Adopting the table without first splitting compound commands into segments would
import this injection hole into nxtlvl's one blocking gate.

**Hooks are observe-only** (`hooks/src/lib.rs:306-310`): `emit` does `let _ = sink.emit(...).await` —
errors silently discarded, no exit code, no veto, no kill switch. The *gate* is execpolicy's job; hooks just
report the decision. This is CodeWhale independently reproducing nxtlvl's locked **one-blocking-gate +
everything-else-observational** split.

**Anti-spin LoopGuard** (`loop_guard.rs:17-142`, `CW-06`): `IdenticalToolCall` (threshold 3, or 2 for
read-only/delegated) + `NoProgressToolLoop` (4 delegated / 6 broad-search). **Correction to the Mode-A
framing:** it returns a *typed* `AttemptDecision::Block { kind, message }` (`:70-90`) / `OutcomeDecision::Halt`
(`:102-106`), declared `//! Pure-data guardrails` (`:1`) — not a free-text "error into context." The
*intent* matches inform-don't-force (steer by an agent-directed message, no hard process kill, paginated
reads deliberately spared at `:237-250`), but it is a structured in-band signal the engine chooses to act on.

**Single-source counter-example:** `crates/config/src/provider.rs:1-5` is *metadata-only and says so*
("runtime routing remains in `resolve_runtime_options`"); the live registry is `crates/tui/src/config.rs`,
and `docs/PROVIDERS.md:15-26` lists **five sources that must stay in sync by hand**. The guard is
`scripts/check-provider-registry.py` (363 L, `main() -> int` at `:311`): cross-checks all five, `return 1` +
stderr on drift (`:353-356`), `return 0` + "passed" otherwise — a clean **binary, objective** exit contract.
`crates/whaleflow/src/lib.rs:3-5` is the orphan twin: a full DSL with **no crate dependent** (zero
`Cargo.toml` references it) — built ahead of its executor and never wired. (A literal grep does hit
`whaleflow` as an unrelated UI-filter string key in `tui/views/mod.rs` + the changelog; the architectural
claim is the orphan *crate*, not the string.)

## 3. State, secrets & memory findings

**Fail-loud secrets** (`crates/secrets/src/lib.rs`, `CW-03`): `load_unlocked` rejects world/group-readable
files (`mode & 0o077 != 0`) with `InsecurePermissions` *before reading* (`:456-461`); the #281 fix
propagates read errors via `self.load_unlocked()?` (`:515`) instead of `unwrap_or_default()` — the comment
spells out that the old fallback-to-empty made the next write **"silently wipe every previously stored
secret"** (one `delete` → total wipe), guarded by regressions at `:1379, :1459`. Legacy migration **copies,
never moves** (`:1062`, test asserts "migration copies; it does not delete legacy data").

**The atomic-vs-non-atomic teaching contrast** (`CW-03`) — the run's sharpest single finding: the *same
crate* ships an **atomic** permissions writer `write_permissions_atomic` (`config/lib.rs:3354`:
`NamedTempFile`→chmod `0o600`→`write_all`→`sync_all`→rename) **and** a **non-atomic** primary config save
`ConfigStore::save` (`:2877`) that opens the real path with `.truncate(true)` (`:2911`) + `write_all` in
place — a crash mid-write leaves a truncated, unparseable config. The atomic recipe existed and was *not
reused* for the load-bearing writer. Untrusted project config is handled well by contrast:
`merge_project_overrides` (`:1595`) whitelists model/output/tools and lets approval_policy/sandbox_mode
**tighten but never loosen** (`:2078-2099`, test `:5526`).

**Race-safe durable state** (`crates/state/src/lib.rs`, → `CW-08` new): migrations 1→4 each in their own
transaction under a `PRAGMA user_version` gate (`:314-561`); goal accounting is store-side
`col = col + ?` with **`updated_at = MAX(updated_at, ?)`** (`:805-830`) — no read-modify-write — and an
**adversarial stale-`now` test** asserts a stale timestamp can't move state backwards (`:1909-1916`).
Two silent-absorption snags: `#[serde(flatten)] extras` swallows unknown config keys (`config/lib.rs:660`),
and checkpoints deserialize with `unwrap_or(Value::Null)` (`state/lib.rs:1278`) — corrupt state restores as
empty with no signal. **(Mode-A correction:** the `:1278` null-on-corrupt lives in the **state** crate, not
config as the Mode-A implied.)

**Curated-file memory** (`docs/MEMORY.md`, `CW-04`): a single `~/.codewhale/memory.md` of timestamped
Markdown bullets — **no vector DB, not the transcript** — injected above the prefix-cache boundary, re-read
each turn, 100 KiB cap, opt-in, three write paths (`#` prefix, `/memory`, a model-facing auto-approved
`remember` tool). This is nxtlvl's C&M bet, with one decisive inversion: CodeWhale is **write-heavy by
design** (the model auto-appends), and its own doc admits the failure mode (`:146-149`: the `remember`
description *begs* the model not to dump transient state). nxtlvl's recall-over-write-volume + one-fact-per-
file + curate-hard structurally prevents the drift CodeWhale asks the model to avoid by politeness.
*(Documented contract only — the loader lives in `crates/tui/src/`, not code-verified in this run.)*

## 4. Agents/orchestration & MCP findings

**Profile-built scoped subagents** (`CW-05`): one model-facing `agent` tool; children's tool surface is
built **directly from a role/capability profile** (`worker_profile.rs:149`, `subagent/mod.rs:45`;
`AGENT_RUNTIME.md:88-89` — "built directly from a profile, not build-everything-then-filter"). Cap
`MAX_SUBAGENTS = 20` (`config.rs:23`); the parent **does not barrier** on children (`turn_loop.rs:1109`,
comment `#3216`) and **a child's transcript never flows back** (`AGENT_RUNTIME.md:84-85`). Capability is
narrowed structurally: `derive_child` intersects parent∩child so a **child can only narrow, never widen**
(`worker_profile.rs:191-207`) — but this is a *runtime* intersection; nxtlvl's read-only-by-withheld-tools
reaches the same guarantee *statically and physically* in frontmatter, with no intersection code to get
wrong.

**MCP transport robustness** (→ `CW-09` new): the real client `crates/tui/src/mcp.rs` (5,927 L) is genuinely
hardened — stdio shutdown SIGTERM→grace→SIGKILL backstop with a bounded **stderr ring surfaced into the
error** (`:541-584`), stale-session reconnect-and-retry-once (`:2537`), non-fatal session-ID preflight
(`:1386`), proxy-credential redaction before logging (`redact_proxy_userinfo`, `:1351`), protocol pinned to
`2024-11-05` (`:1490`). One real interop bug-in-waiting: tools surface as single-underscore
`mcp_{server}_{tool}` (`:2145`) vs the CC-standard `mcp__server__tool`.

**CC-plugin-compat boundary** (→ `CW-10` new): `docs/CLAUDE_PLUGIN_COMPAT.md:18-34` ingests only bare
`SKILL.md` bundles and **explicitly drops** `plugin.json`, slash-commands, agents, hooks, dashboard servers,
shared state, and `model: inherit`; a multi-skill repo is **rejected with a message, not silently reduced
to one skill** (`:30-32`). This is a hard-won, explicit answer to nxtlvl's open question *"what is the
runtime-portable unit of a CC plugin?"* — **only the SKILL.md prose travels; router/gates/hooks/MCP wiring
are runtime-bound and do not.**

---

## Adopt / Adapt / Reject ledger

| # | Finding (file:line) | LENS surface | Verdict | Why / how to apply |
|---|---------------------|--------------|---------|--------------------|
| CW-01 | Arity table + flag-strip + greedy-longest classify (`bash_arity.rs:27-259, 304-336`); deny word-boundary (`lib.rs:358-372`) | dangerous-bash gate | **Adapt** | Classify to canonical positional prefix (`git branch -f main`→`git branch`) to kill the recorded false-positive. Port the table+algorithm, not the Rust crate; their tests are a ready spec. |
| CW-02 | `command.split_whitespace()` is the only tokenizer (`bash_arity.rs:352`, `lib.rs:482`) | dangerous-bash gate | **Adopt (as prerequisite)** | A shell-metachar splitter MUST run *before* the arity dict — segment on `;`/`&&`/`\|\|`/`\|`/`$()`/backticks and classify each. CodeWhale's verified hole; CW-01 is unsafe without it. |
| CW-06 | Typed `LoopGuard` Block/Halt with agent-directed message (`loop_guard.rs:70-106`) | inform-don't-force | **Adapt** | If nxtlvl ever wants anti-spin: surface a *typed in-band steering message*, never a hard kill. Lower priority; nxtlvl has no equivalent surface today. (Mode-A's "error into context" framing corrected → typed Block.) |
| CW-07 *(new)* | `check-provider-registry.py` binary drift-checker (`:311, :353-359`) | single-source / `nxtlvl:audit` §5 | **Adopt (pattern)** | Working prototype of the planned objective audit: cross-check N facts, `return 1`+stderr on drift, `return 0` otherwise — blocks on facts, never taste. The shape for ADR-index-matches-disk / resolvable-cross-links. nxtlvl has no drift-checker yet. |
| — | 5-source hand-synced registry (`PROVIDERS.md:15-26`) + orphan `whaleflow` (`lib.rs:3-5`, 0 dependents) | single-source the contract | **Reject (validates)** | The drift-checker is the *bandage* for multi-sourcing; the orphan DSL is the *corpse*. Both validate promote-by-`git mv` (the move is activation → nothing dead sits "installed but unwired"). |
| — | `emit` discards sink errors, no veto/exit (`hooks/lib.rs:306-310`) vs gate at `core/lib.rs:1315` | inform-don't-force | **Reject (validates)** | Independent reproduction of nxtlvl's one-blocking-gate + observe-only-hooks split. Nothing to borrow; strong corroboration. |
| CW-03 | Atomic writer (`config/lib.rs:3354`) vs non-atomic `save` (`:2877`); fail-loud `secrets.rs:515` | no-lying-state | **Adopt** | Standardize the tempfile→chmod→`sync_all`→rename recipe for *every* nxtlvl durable write (hook state, C&M store, counters), and never `unwrap_or_default()` a read before write-back. |
| CW-03 | Same repo ships atomic + non-atomic + silent-null (`config:2877`, `state:1278`) | no-lying-state | **Adapt (doctrine)** | Add as the worked exemplar in nxtlvl's lying-state note: a *within-one-repo* proof the rule must be **uniform, not per-component**. Pairs with TREL-15 / hooks-mastery. |
| CW-08 *(new)* | Race-safe `col=col+?` + `updated_at=MAX(…)` + adversarial stale-`now` test (`state/lib.rs:805-830, 1909`) | C&M state | **Adapt** | The SQL is N/A (nxtlvl C&M is curated files) but the **test discipline transfers**: feed an adversarial stale input, assert state can't regress — apply to bookmark≥10 counter / mutation accounting / observer idempotency. |
| CW-04 | Curated `memory.md`, no DB, prefix-cache placement (`docs/MEMORY.md:60-74`) — *documented contract; loader in `tui/src/`, not code-verified* | C&M memory | **Adapt** | Confirms the curated-file bet. Steal (a) prefix-cache-stable block placement, (b) an explicit "what stays OUT of memory" curation contract (`:183-196`). |
| CW-04 | Write-heavy auto-append `remember` tool + 100 KiB truncate cap (`docs/MEMORY.md:121-149, :76`) — *documented contract, not code-verified* | C&M memory | **Reject (validates)** | The inverse of recall-over-write-volume. CodeWhale's doc *admits* it begs the model not to dump transient state; nxtlvl's one-fact-per-file + MEMORY.md pointer-index structurally prevents the drift instead of asking nicely. Validates D1 / ADR-013/014. |
| CW-05 | Non-barrier parent + transcript-never-returns (`turn_loop.rs:1109`, `AGENT_RUNTIME.md:84`) | scoped subagents | **Adapt** | Make "child transcript never flows back, only a summary" an *explicit invariant* in nxtlvl agent contracts — the engine-level form of pointers-over-dumps. (Async non-barrier half N/A; nxtlvl consumes briefs synchronously.) |
| — | `MAX_SUBAGENTS = 20` (`config.rs:23`); `derive_child` runtime intersection (`worker_profile.rs:191`) | scoped subagents | **Reject (validates)** | 20 is tolerable only because children are non-barriered background summaries; nxtlvl's briefs land in a 150-200K quality-degrading band, so the **6-8 cap** is correct. And withheld-tools-in-frontmatter beats runtime intersection: a *static, physical* guarantee with no code to get wrong. |
| CW-09 *(new)* | stderr-ring-in-error, stale-session retry, proxy redaction (`mcp.rs:541-584, 2537, 1351`) | MCP-scout robustness | **Adapt** | When deepwiki/context7 scouts degrade, surface the **last server stderr line** in the "unavailable" caveat so it's actionable; retry-once-on-stale before degrading; redact any future MCP logging. (Process-lifecycle SIGTERM itself is the CC platform's job.) |
| — | single-underscore `mcp_{server}_{tool}` (`mcp.rs:2145`) | MCP portability | **Reject (anti-pattern)** | nxtlvl's scouts already use correct `mcp__plugin_nxtlvl_*__*`. Note as a portability checkpoint, not a thing to copy. |
| CW-10 *(new)* | Only `SKILL.md` is portable; everything else dropped (`CLAUDE_PLUGIN_COMPAT.md:18-34`) | cross-harness portability | **Adopt (doctrine)** | The explicit answer to "what survives extraction from the nxtlvl plugin": **only skill prose travels** — router/gates/hooks/MCP are runtime-bound. The reject-rather-than-silently-pick-one rule mirrors nxtlvl's fail-loud gates. |

---

## Applying to nxtlvl

**No finding rises to an ADR** — every Adopt fills an implementation-level gap and every Reject validates a
position already locked (single-source, inform-don't-force, no-lying-state, curated-fact memory, scoped
agents, 6-8 cap). The decision set stays uncluttered; these are notes and queued work.

**Worth queuing now (highest leverage first):**
1. **`CW-02` then `CW-01`** — the dangerous-bash gate upgrade, *in that order*. The metachar splitter is the
   prerequisite; the arity-classify is the false-positive fix. This is the one item touching a **live,
   shipped** nxtlvl component (the gate that blocks `git branch -f main` today), so it has the clearest
   payoff. Note this run **sharpened CW-02 from a caveat into a hard ordering dependency**.
2. **`CW-07`** — when `nxtlvl:audit` §5 gets built, `check-provider-registry.py` is the reference shape for
   the objective, binary-exit, facts-not-taste gate. Adopt the *pattern* (cross-check → `exit 1` on drift),
   not the registry it guards.
3. **`CW-03`** — fold the uniform atomic-write + fail-loud-read recipe into the no-lying-state doctrine note,
   with the within-one-repo contrast as the worked exemplar. Low-cost, reinforces TREL-15.

**Needs design before it's actionable:** `CW-08` (port the adversarial-stale-input *test discipline* to C&M
counters), `CW-09` (stderr-tail-in-caveat for the scouts), `CW-04` (prefix-cache placement + an explicit
out-of-memory curation contract in the C&M spec).

**Doctrine to record in the relevant note, not as queued build:** `CW-10` (only SKILL.md prose is the
portable unit of a CC plugin) and the two single-source rejects (`whaleflow` orphan + hand-synced registry)
as recurring-contrast confirmations of promote-by-`git mv`.

**Citation hygiene from this run** (corrections to carry, not to silently absorb):
- Mode-A framed `LoopGuard` as "an error into context"; the clone shows a **typed `Block`/`Halt`** — corrected in `CW-06`.
- Mode-A located the silent-null checkpoint loosely under config; it is **`crates/state/src/lib.rs:1278`**.
- Mode-A claimed MCP **"elicitation half-wired"**; this run found **zero `elicit` references in `crates/tui/src/`** — treat the half-wiring as **unconfirmed in this clone** (the `2024-11-05` pin is real; the elicitation claim is not reproduced).
