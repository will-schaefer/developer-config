# Domain Review — Memory / state (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **memory/state**
> rubric. Neutral: judges a harness's memory subsystem on **general best practice for agent memory** —
> nxtlvl's own lessons (curated-fact recall over narrative worklog, honest-by-construction confidence,
> fail-closed scrub inside a fail-open hook) are cited as *rationale for why a dimension matters*,
> never as the bar the reviewed harness is scored against.
>
> **Subsystem, not component type.** Memory spans hooks (capture), agents (an observer/distiller),
> scripts (recall/eviction code), and files (the store). Score it as one subsystem on the dimensions
> below; where a single component dominates (e.g. a capture hook), you may borrow that component's
> rubric for its slice, but the verdict is about the *memory subsystem as a whole*.

---

## 1. What this domain is — where to look

A harness's **memory/state** is whatever persists facts across turns or sessions and surfaces them
back into context: a learned-fact store, a session bookmark, a durable observation log, a curated
notes index. The defining question is not "does it store?" but "does it *recall* — does a fact
written once reliably surface when it's relevant later?"

Read, in order:
- **The store** — where facts live (`~/.claude/.../memory/`, an `*.jsonl` log, a SQLite/`.rvf`
  container, per-fact markdown). Can you `cat` a raw record and verify the state, or is it opaque?
- **The write path** — the capture/distill code: what gets written, by whom (a dumb async hook vs. a
  model in the loop), whether secrets are scrubbed, and what happens on a write/scrub error.
- **The read path** — the recall code: does it actually retrieve into the briefing/session, with a
  quality gate and scope filter, or is it write-only accumulation?
- **The provenance fields** — does each fact carry `source`/`confidence`/`scope`/timestamp, and are
  human-typed facts kept distinct from machine-inferred ones?

*What counts as memory:* learned facts/instincts, bookmarks, durable observation logs, curated
indexes. *What doesn't:* hook config, agent prompts, git history, raw transcripts (unless explicitly
persisted *for recall*).

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D1 (recall fitness) and D2 (degraded-mode honesty)** — a store that never
surfaces what it holds isn't memory (it's a worklog), and a store that reports confidence while
serving noise is *worse* than one that doesn't work. A fatal flaw in either caps the overall; don't
flat-average it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Recall fitness** ⭐ | Is it optimized to *retrieve*, not just capture? Does a stored fact resurface when relevant? | Quality-gated, best-first injection into the briefing; scope-filtered; over-budget items are *named*, never silently dropped. | Write-only accumulation, or a narrative worklog written far more than read — nothing retrieves a past fact into a new session. |
| 2 | **Degraded-mode honesty** ⭐ | When the real backend is absent, does it fail loud — or fabricate confidence? | Confidence is stored at write and only *decays* on read; fallbacks self-label; missing engine → honest degrade, announced. | Hash-faked "embeddings" reporting `active: true`; `quality *= 1.05` on read; "72% proficient" while serving worse-than-grep. |
| 3 | **Write / capture quality** | Is the write path trustworthy — scrubbed, bounded, safe to fail? | Dumb async capture (no model in the write path); secrets scrubbed on input *and* output; scrub error → drop the record (fail-closed) inside a fail-open hook. | Synchronous/model-gated capture that blocks the session; secrets written raw; scrub error passes the record through. |
| 4 | **Provenance & citation** | Can you trace a fact's lineage and tell human-typed from machine-learned? | Each fact carries `source`/`confidence`/`scope`/timestamp; human and inferred facts in separate stores or gated by a required `source`. | No lineage; human and learned facts indistinguishable; confidence with no origin. |
| 5 | **Freshness & eviction** | Does stale data decay/purge, or accumulate forever? | Read-time staleness check; tunable decay; size/age-gated purge with atomic, truncation-safe archiving. | Unbounded growth; no decay or purge; truncation corrupts the store. |
| 6 | **Scope & access contract** | Is read access scoped per consumer, and enforced — not just asked for? | Facts carry `scope` (project/global); recall filters by it; read-only consumers *lack* the write tool rather than being told not to write. | All consumers see all memory; scope is prose-only ("please don't"); unscoped grants. |
| 7 | **Storage substrate honesty** | Does the store deliver what it claims — legible and real, or opaque with false claims? | Human-readable files (JSONL/markdown), atomic writes; claimed features match what runs. | Opaque binary/`.rvf` stub claiming ANN/"neural" features that are actually Jaccard + a constant; debunked benchmarks repeated as fact. |
| 8 | **Composition & routing** | Do capture/distill/recall stay separate, with a single source of truth? | Clean phases (dumb capture → one-shot off-session distiller → gated recall); files are the interface; no router that merely prints advice it can't enforce. | Phases fused (model in every step); a regex "router" that emits steering text the model may ignore; duplicated dispatch. |

---

## 3. What to hunt — the concrete checks

- **The recall test** (D1) — trace whether anything actually *reads* the store back into context (a
  SessionStart briefing, an in-session injection). A store with a rich write path and no read path is
  a worklog; score D1 ≤ 2. Check for a quality gate (e.g. confidence ≥ threshold) and whether
  over-budget facts are *named* vs. silently truncated.
- **The "does memory lie" audit** (D2) — grep the read path for `*=`/`+=` on a confidence/quality
  field (confidence should move only at write, on evidence — decay-on-read is fine). Check whether a
  fallback (missing ONNX/SDK/backend) still reports `active`/a score. A subsystem that serves noise
  while claiming to learn is the fatal D2 flaw. *(Why: a memory that can silently become noise while
  claiming confidence corrupts every downstream decision.)*
- **The scrub contract** (D3) — find the secret scrubber; confirm it runs on input *and* output, and
  that a scrub *exception* drops the record rather than writing it raw. Confirm the capture hook
  fails open (error → exit 0) — fail-open hook and fail-closed scrub are independent and both required.
- **Provenance separation** (D4) — is there a `source` field, and are human-saved facts kept apart
  from inferred ones (separate store or a write gate)? An observer writing into human memory is a smell.
- **Substrate reality** (D7) — can you read a raw record in a text editor? Does a claimed "vector
  DB"/"HNSW"/"neural distillation" resolve to real code, or to a hash function and a constant
  multiplier? Cross-check any performance claim against upstream — debunked numbers often survive in
  plugin READMEs.
- **Eviction safety** (D5) — find the purge/archive code; confirm writes are atomic and truncation
  preserves the unconsumed tail.
- **Scope enforcement** (D6) — confirm facts carry a `scope` (project/global) and that recall *filters*
  by it in code, not just in prose. Check whether read-only consumers physically *lack* the write tool
  vs. being asked not to write — an unscoped grant or a prose-only "please don't" is a D6 fail.
- **Phase separation** (D8) — confirm capture, distill, and recall are distinct modules with files as
  the interface (the model called only in the distill phase); a "router" that merely prints advice it
  can't enforce, or phases fused into one model-in-the-loop step, is a D8 fail.

---

## 4. Partition & signal-vs-demo

- **Partition:** the natural split is by *phase* — one agent on the write path (capture + scrub), one
  on the read path (recall + scope), one on the store + eviction + substrate claims. ≲ a couple of
  small files → a single deep agent. Always read the store format first and pass it to every agent.
- **Signal vs demo:** example/seed memory shipped to demonstrate the API (a sample instinct, a stub
  store with three fake facts) is not the subsystem — judge the machinery, note the seed data. A
  README's confident description of "self-learning memory" is rhetoric until the recall path is traced.

---

## 5. Lessons & gotchas

- **Curated-fact recall vs. narrative worklog is the central bet.** One-fact-per-file with a pointer
  index optimizes *recall* (a fact resurfaces in a new session); a per-developer journal optimizes
  *provenance* (a great audit trail, poor recall — written far more than read). Both are legitimate,
  but they solve different problems; score against what the subsystem *claims* to be, and flag a
  recall claim backed only by a worklog.
- **A memory that lies is the worst failure mode.** Rank degraded-mode dishonesty above every other
  flaw — fabricated similarity, multiplied confidence, a fallback reporting `active`. It is worse than
  a store that plainly doesn't work, because it corrupts decisions silently. This is why D2 caps.
- **Confidence moves only on evidence.** Stored confidence may decay on read (time), but it must never
  *climb* on a schedule or a constant multiplier. An auto-incrementing score disconnected from outcome
  is a D2 cap.
- **Fail-open hook, fail-closed scrub.** "Fail open" means *never halt the session*; it does **not**
  mean *write the record through on a scrub error*. The two contracts are independent — a subsystem
  that conflates them leaks secrets.
- **Files are the platform.** Prefer legible files + atomic writes over a custom DB; a binary store
  that claims advanced retrieval it can't deliver scores worse than plain markdown that recalls.
