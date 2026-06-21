# Domain Review — Scripts / executable code (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **scripts** rubric.
> Neutral: judges a harness's executable code on **general best practice for production scripts** —
> nxtlvl's own lessons (atomic writes, fail-open-but-honest-exits, injection-safe subprocess) are
> cited as *rationale for why a dimension matters*, never as the bar the reviewed harness is scored
> against.

---

## 1. What this domain is — where to look

A harness's **scripts** are the standalone executables the runtime or the harness itself invokes —
the `.py`/`.sh`/`.js`/`.mjs`/`.cjs` programs that do real work outside the model: hook bodies,
installers, validators, build/transpile toolchains, eval runners, MCP servers' glue. This domain
audits *the code as code* — the contracts it honors, the failures it hides, the side effects it
risks — a lens that cuts across `hooks` and `tools` but judges craft, not wiring.

**Scoping boundary** — what is and isn't a "script" here:
- **In scope:** executable files (shebang or invoked by the harness) under `hooks/`, `scripts/`,
  `tools/`, `bin/`, installer/validator code, and the *code body* of hooks/MCP tools.
- **Out of scope:** library/engine internals a script imports but the harness never invokes directly
  (note them as context, don't score them as the surface); markdown/prose; templates (even when
  templated *into* executables).
- **Overlap with `hooks`/`tools`:** when the ask is "how good is this harness's hook *system*" →
  `hooks` (wiring, events, failure posture). When it's "how good is the *code* these scripts are
  made of" → `scripts`. They can both run on the same files with different rubrics.

Read, in order: the entry points the harness actually invokes (manifest/`hooks.json`/`package.json`
scripts) → each executable's input read + output emit + exit path → its write sites and subprocess
calls.

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D3 (observation quality) and D4 (error & exit-code contract)** — a script that
reports nothing useful, or that lies about whether it succeeded, is broken no matter how clean the
rest is. A fatal flaw in either (a silent no-op, a lying clean exit) caps the overall; don't
flat-average it away. D3/D4 are the *most common* caps, not the only ones — a fatal flaw in a
non-dominant dimension also caps when it's genuinely disqualifying (e.g. D5 non-atomic state writes
that corrupt on crash, which is what caps a Trellis-shaped script layer despite a clean D3/D4).

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Input / interface contract** | Are inputs typed, validated, and read from the source the caller actually uses? | Typed args (argparse/Typer with choices, dataclass/Pydantic), explicit per-arg help; reads from the source the harness wires (stdin where the platform delivers stdin). | Grab-bag `get(field, default)` fallback chains; reads `argv[2]` while the platform delivers on stdin → the script never sees its input. |
| 2 | **Deterministic output shape** | Does every codepath emit one stable, parseable envelope? | Uniform record (e.g. `Finding(severity, path, message, fix)` / tagged event) the caller can parse; same shape on success and error. | Five ad-hoc output shapes; decorative ASCII mixed with data; fields the consumer (CC/harness) doesn't recognize. |
| 3 | **Observation quality** ⭐ | When it reports what happened, does it say *both* what-happened and what's-next — or is the signal opaque/muted? | Every finding carries concrete remediation; degraded mode is *announced*, not swallowed; status + next action returned. | Silent no-ops; broad `except: pass` / `safeRequire` muting that turns a broken helper into a generic `OK`. |
| 4 | **Error & exit-code contract** ⭐ | Are exit codes honest — success only when work was really done? | Honest `0`/`1`/`2`; distinct codes for distinct conditions; loud `raise` over a faked result; missing backend → non-zero, never a fabricated success. | Lying clean exit: `exit 0` over empty/missing input, or a "verified" `0` synthesized from a backend that isn't there. |
| 5 | **Side-effect safety & idempotence** | Are writes atomic, destructive ops guarded, and re-runs safe? | All writes atomic (temp-then-`rename`/`os.replace`); path-escape (`..`/absolute) rejected; dangerous flag combos refused; re-run yields the same state. | Bare `write_text`/`writeFileSync` full-file rewrites under concurrent access; no containment guard; a footgun flag silently deletes other data. |
| 6 | **Portability & hygiene** | No hardcoded paths/secrets, shebangs present, subprocess injection-safe, cross-platform? | Dependency-light; shebang + declared deps; subprocess via **argv lists**, never `shell=True`/string-concat/`eval`; no `/Users`/`/home` or secrets in code. | Hardcoded home paths; `shell=True` with interpolated input; `eval`; secrets in source; network-fetch (`npx …@alpha`) on the hot path. |
| 7 | **Cohesion & composition** | One job per script, no duplicated shared logic, honest naming? | One-job modules; shared logic factored to a single source (lazy-imported base class); dispatch is legible. | The same helper copy-pasted ×N; count-inflation from triplication; a mega-script switching on a mode flag. |

---

## 3. What to hunt — the concrete checks

- **The lying-clean-exit audit** (D4) — for every `exit 0` / `sys.exit(0)` / `process.exit(0)`, ask:
  *was real work actually done on this path?* An exit 0 over empty stdin, a skipped step, or a missing
  backend is the single most corrosive script anti-pattern — it reads as "covered everything" when it
  covered nothing. *(Why: a verifier that fabricates a clean exit from a missing backend must instead
  fail loud — a silent pass is worse than a crash.)*
- **The input-source check** (D1) — confirm the script reads from where the caller delivers. The
  classic break: a hook reading `process.argv[2]` while `hooks.json` wires nothing to argv and CC
  delivers JSON on **stdin** → the hook is inert but exits 0 (compounds into a D4 cap).
- **The atomic-write audit** (D5) — grep every write site (`write_text`, `writeFileSync`, `>`,
  `_persist`); flag any full-file rewrite with no temp-then-`rename`. Non-atomic state is corruptible
  on crash/concurrent fire. *(Why: a background log or state file that a second process can interleave
  with loses data silently.)*
- **The injection surface** (D6) — grep for `shell=True`, `os.system`, `eval`, `` `…` ``, and string
  interpolation into a shell. Safe scripts pass untrusted bytes as argv lists or via `jq`/`xargs -0`.
- **Fail-silent handlers** (D3) — find broad catches (`except:`/`catch {}`/`/* non-fatal */`) that
  swallow real errors and degrade to a generic OK with no signal. Distinguish from *honest* fail-open
  (announces the degrade, then continues).
- **Hardcoded paths & secrets** (D6) — grep `/Users/`, `/home/`, `api_key`, `token`, credential
  literals in executable code (not config/prose).
- **Duplication** (D7) — the same logic across N scripts; cross-reference against a single source if
  one exists, and treat count-inflation (a helper triplicated across trees) as a smell.

---

## 4. Partition & signal-vs-demo

- **Partition:** ≲ 4 executables → one deep agent over the whole script surface. A large fleet → one
  agent per script (or per directory/tier), each scoring §2 on the slice it owns; synthesis rolls up.
  For very large corpora, **sample and say so** — `log` the count scored vs. the count skipped so the
  verdict doesn't read as exhaustive when it sampled.
- **Signal vs demo:** teaching/template harnesses ship deliberately-trivial example scripts (an
  in-skill `validate-chart.sh`, a "block `rm -rf`" demo hook) as documentation-by-example. Don't score
  those as craft — note them as demo and judge the load-bearing toolchain. Where a repo is two-tier
  (production toolchain + demo helpers), score the tier a reader would rely on and note the gap.

---

## 5. Lessons & gotchas

- **Script-craft inverts whole-harness reputation.** A harness can read ≈2/5 overall yet ship clean
  script code (its disqualifiers living in markdown/orchestration, not the executables) — and the
  reverse. Score the code in front of you; don't import the harness's reputation into the script score.
- **Fail-open ≠ fail-silent.** Both keep the session alive, but fail-open *announces* the degrade and
  returns honest signal; fail-silent swallows it. The first is correct (D3=5); the second caps D3.
- **An honest crash beats a lying success.** A missing dependency or backend should surface as a
  non-zero exit with a clear message, never a synthesized clean result — the lying exit is the fatal
  D4 flaw that caps the overall.
- **Atomicity is not optional for state.** Any file two processes (or a crashed process) can touch
  must be written temp-then-`rename`. Non-atomic state writes are a recurring D5 cap across harnesses.
- **Cross-check claimed coverage** — a script's docstring or README claiming "validates X" is not
  evidence; trace the codepath. The gap between claimed and shipped behavior is itself a finding.
