---
name: documentation-and-adrs
description: nxtlvl documentation & ADRs — record the *why* behind decisions, APIs, and shipped features, with my house ADR format and the ADR-worthy threshold baked in. Use when making an architectural decision, writing or superseding an ADR, documenting a public API, or capturing context future engineers and agents will need. Self-contained; the canonical threshold and format live in ~/.claude/rules/decisions.md.
---

# Documentation & ADRs (nxtlvl)

Vendored from `agent-skills:documentation-and-adrs` and refined for fit (see `docs/decisions/ADR-003`). **Self-contained** — it does *not* call the upstream skill. The ADR threshold and format are governed by my global decision rule (`~/.claude/rules/decisions.md`); this skill operationalizes them, with the house format baked directly into the template below.

Document decisions, not just code. Code shows *what* was built; documentation explains *why it was built this way* and *what alternatives were rejected*. That *why* — context, constraints, trade-offs — is what future humans and agents cannot recover from the code alone.

**Use when:** making a significant architectural decision; choosing between competing approaches; adding or changing a public API; shipping a feature that changes user-facing behavior; onboarding people or agents; or explaining the same thing repeatedly. **Don't** document obvious code, restate what the code already says, or write docs for throwaway prototypes.

## Architecture Decision Records

ADRs are the highest-value documentation. They capture the reasoning behind significant technical decisions so they aren't re-litigated six months later.

### When to write one — the ADR-worthy test (rule §1)

Record an ADR **only** when a decision is *both*:

- **architectural** — it shapes structure, boundaries, or a hard constraint; and
- **expensive to reverse** — re-litigating it later costs real work.

Don't dilute the set: verified platform/implementation **facts** → the **spec**; **methodology / sequencing / task order** → the **plan**; a resolved **open question** that just folds into an existing ADR → **amend that ADR** (keep the set curated). An ADR is for the decisions the project *is*, not every choice made along the way.

### Made → recorded (rule §2)

Before recording, sharpen the decision if needed: underspecified intent → `/interview-me` (surface) / `/grill-me` (stress-test); needs a written contract → `/spec`; needs breakdown → `/plan`. Skip any step that's already sharp. Then record with the format below.

### House ADR format (rule §3 — baked in)

Store ADRs in `docs/decisions/` as sequential `ADR-NNN-slug.md` files, each with **YAML frontmatter** then a body:

```markdown
---
id: ADR-NNN
title: "Short imperative statement of the decision"
status: Accepted        # Proposed | Accepted | Superseded
date: 2026-06-17        # clean ISO
# implementation: ...   # add when Accepted but the build is deferred
# superseded-by: ADR-MMM  # add when superseded
---

# ADR-NNN: Short imperative statement of the decision

## Context
The forces at play — requirements, constraints, what makes this hard.

## Decision
What we're doing, stated plainly.

## Alternatives Considered
### <Option>
- Pros: …
- Cons: …
- Rejected: why this lost.

## Consequences
What this commits us to — the follow-on effects, good and bad. Cross-link related ADRs.
```

Maintain a `README.md` index table in `docs/decisions/` (ADR # · decision · status), and cross-link related ADRs in the body.

### Lifecycle (rule §3)

```
PROPOSED → ACCEPTED → SUPERSEDED
```

Superseded ADRs are **kept, never deleted** — set `status: Superseded` and add a live `superseded-by:`. When a decision changes, write a new ADR that references and supersedes the old one. A project's own `./.claude/CLAUDE.md` or `./CLAUDE.md` (read last, wins) may rebind the `docs/decisions/` location, opt out of ADRs, or add conventions.

## Inline documentation

Comment the *why*, not the *what*:

```typescript
// BAD — restates the code
// Increment counter by 1
counter += 1;

// GOOD — explains non-obvious intent
// Sliding window: reset at the window boundary, not on a fixed schedule,
// so bursts at window edges can't bypass the rate limit.
if (now - windowStart > WINDOW_SIZE_MS) { counter = 0; windowStart = now; }
```

Don't comment self-explanatory code, don't leave `TODO`s for things you should just do now, and don't leave commented-out code (git has the history). Do document real gotchas where they bite — and link the ADR that explains the design:

```typescript
/**
 * IMPORTANT: call before first render. After hydration this causes a flash of
 * unstyled content because the theme context isn't available during SSR.
 * See docs/decisions/ADR-003 for the rationale.
 */
```

## API, README, and changelog

- **Public APIs** — document with types and doc comments (params, returns, throws, an example) for typed languages; OpenAPI/Swagger for REST. The doc is the first test of the design.
- **README** — every project: one-paragraph what-it-does, quick start, a commands table, an architecture overview that links to ADRs.
- **Changelog** — for shipped features, group Added / Fixed / Changed under a dated version.

## Documentation for agents

- **CLAUDE.md / rules files** — project conventions so agents follow them.
- **Specs** — kept current so agents build the right thing.
- **ADRs** — so agents (and future-you) understand why past decisions were made and don't re-decide.
- **Inline gotchas** — keep agents out of known traps.

## nxtlvl conventions

- **Pointers over dumped content** — reference `file:line` and link; don't paste large blocks back.
- **Surface assumptions** — state what you assumed about intent or environment, so a wrong assumption is visible rather than silent.

## Verification

- [ ] ADRs exist for decisions that pass the ADR-worthy test (§1) — and *only* those.
- [ ] Each ADR has valid frontmatter, resolvable cross-links, and a matching `README.md` index row; no numbering gaps or dupes; superseded ADRs carry a live `superseded-by:`.
- [ ] README covers quick start, commands, and an architecture overview.
- [ ] Public APIs have param/return/throws docs; known gotchas are documented where they bite.
- [ ] No commented-out code or stale TODOs remain; rules files (CLAUDE.md etc.) are current.

$ARGUMENTS
