---
description: Add a GitHub repo URL to the repos.jsonl manifest (verify → canonicalize → dedup → classify → queue)
argument-hint: <github-url> [more-urls…]
---

Add the following repo URL(s) to the `repos.jsonl` manifest: $ARGUMENTS

This is a **seed-list queue operation**, not an ingest. Each repo lands as a `pending` record for
`/auto-ingest` to pick up later. **Source of truth is `repos.jsonl`**; `master-repo-list.md` is a
generated view. Do not hand-edit either — append through `repo_status.py add`, which
canonicalizes the id, dedups, appends, and re-renders the view atomically.

Process **every** URL given (space- or newline-separated). For each one, in order:

1. **Verify (mandatory).** `WebFetch` the URL to confirm it resolves and is **not archived/404**.
   Capture the **canonical `owner/name`**, primary language, and a factual sense of what it is.
   - If the repo was **renamed/transferred**, prefer the canonical (new) path — note the old one in
     the summary (e.g. "formerly awslabs/agent-squad").
   - Ignore any star counts / metrics the fetch returns — the manifest records **no metrics**.

2. **Scope-check.** The list covers **agent harnesses & agentic engineering** only. If a repo is
   off-scope (per `CLAUDE.md` non-goals), do **not** add it — say why and move on.

3. **Classify into exactly one section slug.** Match by **function**, not vendor:
   `harness-meta` (product **is** the harness — wraps/orchestrates/generates coding-agent CLIs, incl.
   task/PM tooling agents drive) · `coding-agents` · `agent-frameworks` · `vendor-sdks` (vendor SDKs,
   runtimes, sandboxes/substrates) · `multi-agent-orch` · `autonomous-experimental` · `memory-context`
   (memory, long-term state, retrieval/graph context, context compression) · `eval-observability`
   (eval, benchmarks, tracing) · `protocols-interop` · `prompt-optimization` · `skills-prompts`
   (general-purpose skill packs & prompt libraries; harness-specific skills go in `harness-meta`) ·
   `awesome-lists` · `guardrails-security` (guardrails, agent/LLM security, policy, governance).
   When two genuinely fit, pick the nearest sibling and **say which call you made** so the user can veto.

4. **Add (handles dedup).**
   ```bash
   python3 "${CLAUDE_PLUGIN_ROOT}/scripts/repo_status.py" add --url "<canonical-url>" --category "<slug>" \
     --summary "<factual one-liner, metric-free>" [--tags "a,b,c"]
   ```
   - Prints `added: …` on success (re-renders the view automatically).
   - Prints `skipped-dup: <id> (...)` and exits non-zero if the canonical id is already present →
     tell the user where it lives; do **not** force a second row (the manifest dedups by `id`).
   - **Renames:** if this URL is a rename of a repo already in the manifest under the old path, the
     ids differ so `add` won't catch it — search `repos.jsonl` for the repo name, and if found, edit
     that record's `id`/`url` in place via a one-off `python3` snippet, then
     `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/render_repo_list.py"`. Never create a duplicate. (Don't set `★`/`referenced` —
     that flag is reserved for repos already cited in the wiki.)

5. **Report, don't commit.** Summarize per URL: added (which slug) / skipped (dup) / updated
   (rename) / refused (off-scope). Leave edits **uncommitted** so adds can be batched — the caller
   commits `repos.jsonl` + `master-repo-list.md` together when ready.
