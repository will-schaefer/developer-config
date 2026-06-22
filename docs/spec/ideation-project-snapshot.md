# Spec: Deterministic Project-Snapshot Accelerator for `context-scout`

> Status: **approved** (2026-06-21) · Owner: nxtlvl · Origin: brainstorming session 2026-06-21
>
> A bundled deterministic script that pre-gathers the *mechanical* part of phase-1 context
> gathering, so the read-only [`context-scout`](../../plugins/nxtlvl/agents/context-scout.md)
> spends its judgment only on relevance and semantics. Sibling in spirit to the
> [DeepWiki orientation accelerator](harness-review-deepwiki-orientation.md) — an accelerator
> bolted onto a read-only scout without changing the scout's trust contract.
>
> Anchor intent: [`../intent/personal-harness.md`](../intent/personal-harness.md).
> Domain: ideation ([`nxtlvl-ideation-domain.md`](nxtlvl-ideation-domain.md), context-scout pinned
> at [§ line 115](nxtlvl-ideation-domain.md), brief format at line 229). Composes the
> *search-first / regex-vs-llm* doctrine: deterministic extraction by script, model tokens only on
> judgment.

## Assumptions

Surfaced before any build — correct these now or they become the contract:

1. **Bash + git + standard POSIX tools are available wherever `brainstorming` runs.** The script
   is `bash`, using only `git`, `grep`, `find`, `sort`, `wc`, `printf` — no extra deps, no package
   install. (macOS/Linux dev env.)
2. **The orchestrator runs the script, never the scout.** The `brainstorming` main thread has
   full tools (Bash + Agent spawn); it runs the script, captures stdout, and inlines it into the
   `context-scout` spawn. `context-scout` keeps `Read, Grep, Glob` — **no Bash** — preserving the
   read-only-by-withheld-tools doctrine. This is the load-bearing constraint that made
   "the scout runs the script" structurally impossible and is non-negotiable.
3. **The script takes no free-text / focus argument.** It runs in the repo root (CWD), emits to
   stdout. Area-filtering ("which commits touch *this* idea") is judgment and stays the scout's
   job — so the script has **zero shell-injection surface by construction**.
4. **The collision-safe ADR number** assumes the house convention (`docs/decisions/ADR-NNN-slug.md`)
   and computes the max over the **union of committed (`git ls-tree HEAD -- docs/decisions`) +
   locally-known remote-tracking refs (`git for-each-ref refs/remotes`, last fetch) + working
   tree**. With no remote-tracking refs it degrades to committed+working and says so — it never
   silently undercounts. *(Build delta: the draft specced a live `git ls-remote`; the build
   replaced it with local remote-tracking refs after `ls-remote` added a ~30s/call network-timeout
   hang under the sandbox — where it never authenticates anyway. Last-fetched remote state is
   sufficient to dodge a numbering collision, and the read is instant and can't hang.)*
5. **The scout's *output* contract is unchanged.** It still returns a pointers-over-content brief.
   Only its *input* gains a pre-gathered snapshot. Because the accelerator is **fail-open**, a
   session where the script is absent or errors behaves *exactly* as today.

## Objective

**What:** Add `plugins/nxtlvl/scripts/project-snapshot.sh` — a deterministic, read-only script the
`brainstorming` orchestrator runs at phase-1 ("explore project context") to gather the mechanical
raw-signal set, which it then inlines into the `context-scout` spawn.

**Why:** Phase-1 context gathering today makes `context-scout` re-derive mechanical facts —
`git log`, file sizes, TODO markers, the next ADR number — with model judgment and tool
round-trips. Those are deterministic: a script does them faster, cheaper, and (for the ADR number)
*more correctly* than an LLM globbing the working tree. Hoisting them frees the scout to spend its
turns on the part that actually needs judgment: which signals matter for *this* idea, plus the
prior art / conventions / semantic gaps a script can't see.

**Who:** The harness operator (the user) running `brainstorming` on any project — and the
`context-scout` agent, as the downstream consumer of the snapshot.

**Success looks like:** running `brainstorming` in a code repo pre-computes the snapshot in one
shell call; the scout receives it, *digests* it into pointers (never relays it), and does not
re-derive the mechanical signals; the next-ADR number is correct against the committed+remote tree;
and a non-code idea (or an absent/broken script) degrades silently to today's behavior.

### Core principle

> **A deterministic signal should be gathered deterministically — once, by a script the
> orchestrator runs — and only its *relevance* judged by the model.**

The script produces **raw signal, not conclusions**. It never ranks, never decides what matters,
never writes to the tree. The scout digests it; the script just hands it the rocks to sort.

*(Decision-rule call: this is **not** ADR-worthy. The architectural piece — read-only-by-withheld-
tools — is already doctrine; this is an additive, fail-open accelerator for one agent, reversible
by deleting one script + reverting two contract edits. The verified facts live here, in the spec.
If the "orchestrator-runs-script → passes to read-only-scout" pattern later recurs across
`idea-critic` / `doubt-reviewer`, that recurrence is when it graduates.)*

## Tech Stack

- `bash` script in `plugins/nxtlvl/scripts/` (convention precedent: `install-nxtlvl.sh`).
- `git` (`log`, `diff --stat`, `ls-tree`, `ls-remote`, `status --porcelain`), plus `grep`, `find`,
  `sort`, `wc`, `printf`. No runtime/language deps, no network beyond `git ls-remote`.
- Consumed by Markdown prompt artifacts: `context-scout.md` (agent) and `brainstorming/SKILL.md`
  (skill) — no code calls it but the orchestrator's `Bash` tool.

## Commands

```
Run:        bash plugins/nxtlvl/scripts/project-snapshot.sh
Lint:       shellcheck plugins/nxtlvl/scripts/project-snapshot.sh
Smoke (this repo):     bash plugins/nxtlvl/scripts/project-snapshot.sh        # expect next ADR = 031
Smoke (neutral):       ( cd "$TMPDIR" && mkdir notes && echo x > notes/a.md && bash <path>/project-snapshot.sh )  # expect neutral snapshot (no test-harness/markers, "Largest files" heading)
Smoke (empty):         ( cd "$TMPDIR/empty" && bash <path>/project-snapshot.sh )  # expect one-line "empty tree — nothing to snapshot", exit 0
```

## Project Structure

```
plugins/nxtlvl/
  scripts/
    install-nxtlvl.sh           → existing (convention precedent for bundled scripts)
    project-snapshot.sh         → NEW: deterministic phase-1 signal gatherer
  agents/context-scout.md       → EDIT: add "## Pre-gathered snapshot" input contract
                                   (digest-not-relay, do-not-re-derive); update self-check
  skills/brainstorming/SKILL.md → EDIT: phase-1 "explore project context" runs the script,
                                   inlines stdout into the context-scout spawn
docs/
  spec/ideation-project-snapshot.md  → this spec
```

No ADR file (see decision-rule call above). No new user-facing command/router row — this is an
internal accelerator behind an existing seam.

## Code Style

Match `install-nxtlvl.sh` idiom. **Not** blanket `set -e` — that would fight fail-open; instead
`set -uo pipefail` with each probe degrading *independently* to a `— none —` line so one failure
never aborts the snapshot. No `eval`; no external free-text expanded into a command.

```bash
# each probe degrades independently — one failure never aborts the whole snapshot.
# tree reads are scoped to docs/decisions (pathspec) and use LOCAL remote-tracking
# refs — never a live `git ls-remote` (which hangs ~30s on a sandbox network timeout).
adr_next() {
  local max remote_refs r
  remote_refs=$(git for-each-ref --format='%(refname)' refs/remotes 2>/dev/null)
  max=$( { git ls-tree -r --name-only HEAD -- docs/decisions 2>/dev/null
           for r in $remote_refs; do git ls-tree -r --name-only "$r" -- docs/decisions 2>/dev/null; done
           ls docs/decisions/ 2>/dev/null
         } | grep -oE 'ADR-[0-9]{3}' | grep -oE '[0-9]{3}' | sort -n | tail -1 )
  printf 'ADR-%03d (committed+remote-tracking+working)\n' "$(( 10#${max:-000} + 1 ))"
}
```

**Performance is a contract, not a nicety** *(build finding)*: the first working build took **57s**
on this repo because (a) two live `git ls-remote` calls each blocked ~28s, (b) `largest_files`
spawned ~684 per-file `grep`+`wc` subprocesses, and (c) tree/`status` reads walked the **519 MB
tracked `reference/` vendored-harness tree**. Fixes — local refs (a), one batched `xargs wc -l`
(b), git-index-first + `reference/` in the exclude set + pathspec-scoped `ls-tree` (c) — brought it
to **~4.9s** (residual is one unavoidable `git status` scan). The exclude set is therefore:
lockfiles, sourcemaps, minified bundles, common binaries, **and vendored dirs
(`reference/`, `vendor/`, `node_modules/`, `dist/`, `build/`, `.next/`, `target/`, `.venv/`)**.

Output is plain Markdown-ish text under `##` section headers, scannable — it is *input* the scout
digests, so verbosity is fine; what must stay tight is the scout's *output*.

## Testing Strategy

No unit harness exists for prompt artifacts; the script itself is concretely testable.

1. **`shellcheck` clean** — zero warnings.
2. **In-repo smoke** — run here; assert every section prints, next ADR = **031** (max is ADR-030),
   repo identity shows `main` + dirty.
3. **Non-code degradation** — (a) a non-code tree *with content* (a dir of `.md`) emits the neutral
   snapshot: code-only probes absent, "Largest files" / "File types & size shape" headings, neutral
   subtitle; (b) a *truly empty* dir emits the one-line "empty tree — nothing to snapshot" and
   **exit 0**.
4. **Fail-open** — with the script absent / `chmod 000` / a repo with no remote: the orchestrator
   still spawns the scout, which falls back to its current Grep/Glob gather; no-remote run notes the
   ADR degradation rather than undercounting.
5. **Injection-safety (by inspection)** — confirm no free-text argument is accepted, no `eval`, no
   unquoted expansion of any external value.
6. **Dogfood** — run a real `brainstorming` session in this repo; confirm the scout *receives* the
   snapshot, digests it to pointers, and does **not** re-derive commits / file sizes / ADR number.

## Boundaries

- **Always:** fail-open (snapshot is an accelerator, never a dependency); emit raw signal the scout
  digests; honest exit codes; **tree-shape conditional** — a code tree gets the full snapshot, a
  non-code tree *with content* gets a neutral snapshot (code-only probes omitted, neutral labels),
  only a truly empty tree gets the one-line bail (see Revision 2026-06-21); fully deterministic
  (no model calls, no randomness, no network beyond `git ls-remote`).
- **Ask first:** adding any probe that reaches the network beyond `git ls-remote`; changing the
  scout's *output* contract; raising default N for top-lists.
- **Never:** accept or interpolate a free-text / focus argument into the shell; write to the tree;
  make the scout *depend* on the snapshot; print a partial snapshot as if complete (no lying
  clean-exit); grant the scout Bash.

## Success Criteria

1. `project-snapshot.sh` exists, `shellcheck`-clean, deterministic, accepts no free-text input.
2. In a git/code repo it emits, in sections: **repo identity** (branch, clean/dirty, ahead/behind);
   **recent commits** + `git diff --stat`; **docs inventory** (`docs/spec/` + `docs/decisions/`
   paths + titles); **largest source files** (lines, with excludes: lockfiles, generated, vendored,
   `node_modules`); **TODO/FIXME/HACK** count + top-N files; **next collision-safe ADR number**
   (committed+remote+working union); **language/size shape** (file count, top dirs, primary
   extensions); **test-harness presence**.
3. Tree-shape conditional (see Revision 2026-06-21): a **code** tree gets the full snapshot; a
   **non-code tree with content** (notes, prose, a git repo of markdown) gets a **neutral** snapshot
   — repo identity, recent commits, docs inventory, largest *files*, file-types/size shape, and
   next-ADR *only if* `docs/decisions/` exists — omitting the pure-code probes (test harness,
   TODO/FIXME/HACK markers) and labeling file shape neutrally; only a **truly empty** tree emits the
   one-line "empty tree — nothing to snapshot" and exits 0.
4. `context-scout.md` documents the `## Pre-gathered snapshot` input: **digest, don't relay**;
   **don't re-derive** the mechanical signals; *output* contract unchanged (pointers-over-content);
   self-check updated.
5. `brainstorming/SKILL.md` phase-1 runs the script and inlines stdout into the scout spawn under a
   `## Pre-gathered snapshot` heading.
6. Fail-open verified: absent / errored script → scout still runs via its Grep/Glob fallback.
7. The emitted next-ADR number matches a hand-check against the committed+remote tree (**031** today).
8. No new router/index row needed (internal accelerator); confirmed, not forgotten.

## Resolved Decisions (was Open Questions)

Settled at approval (2026-06-21):

1. **Top-N for largest-files and TODO-files lists** — **10** each. ✅
2. **"Recent commits" depth** — **15** (`git log --oneline -15`). ✅
3. **Largest-files metric** — **lines** (best reflects the size-as-smell heuristic), not bytes. ✅
4. **Untracked files** — **include a short `git status --porcelain` untracked count**, since
   work-in-flight is exactly the live state the scout wants. ✅

## Revision 2026-06-21 — neutral snapshot for non-code trees

**What changed:** the original "code-conditional" boundary (a non-code tree emits one line and
exits 0) is superseded by a **tree-shape conditional**: a code tree still gets the full snapshot; a
non-code tree *with content* now gets a **neutral** snapshot (the lean set — repo identity, recent
commits, docs inventory, largest *files*, file-types/size shape, next-ADR only when
`docs/decisions/` exists — with the pure-code probes omitted and domain-neutral labels); only a
*truly empty* tree gets the one-line bail (now "empty tree — nothing to snapshot").

**Why the original call is honored, not ignored:** the original rationale for bailing on non-code
trees was that a *code-shaped* snapshot would "narrow context-scout's domain-agnostic mandate." A
**neutral** snapshot removes that objection at the root — it carries no code framing — while still
handing the scout a deterministic head start on a non-code idea, which is squarely in the
brainstorming front door's mandate (software, writing, strategy, research, a decision). The change
is small and reversible (one middle branch + two parameterized probe labels); code-mode output is
**byte-identical** to before (verified by diff), so no code-tree session is affected. Still not
ADR-worthy by the original reasoning above.
