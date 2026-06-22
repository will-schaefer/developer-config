---
name: pointer-summary
description: Use when reporting on, summarizing, or reviewing MULTIPLE files (a codebase area, a set of changes, a directory) and you are about to paste file content back to the user. Emit path:line pointers with a one-line "why" each, instead of pasted blocks. Does NOT apply to editing a single file or quoting one short snippet a user explicitly asked to see.
---

# pointer-summary

Report on multiple files with **pointers, not pasted content**. A pointer is cheaper to read and
does not rot when the code changes; a pasted block does both.

## When this fires

- "summarize these files", "what's in this directory", "review this area", "map this subsystem",
  "where does X happen across the codebase" — any multi-file report/summary/review.

## When it does NOT fire

- Editing or writing a single file (just do the edit).
- The user explicitly asked to *see* a specific snippet ("show me lines 10–20 of foo.ts").

## The behavior

For each relevant file, emit one line:

```
path/to/file.ext:LINE — one-line why this matters
```

Rules:
1. **Pointer, never block.** Reference `path:line`; do not paste the code itself.
2. **One-line why per pointer.** The pointer earns its place by saying why it's relevant.
3. **Group when it helps.** Cluster pointers under short headings for large reports.
4. **Link, don't duplicate.** If a fact lives in a doc, point to it rather than restating it.

## Example

Instead of pasting three functions, write:

```
src/auth/login.ts:42 — entry point; validates the session token
src/auth/token.ts:17 — where the token TTL is enforced (the bug lives here)
docs/auth.md:5 — the contract these two implement
```
