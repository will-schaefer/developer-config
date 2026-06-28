---
description: Direct entry to divergent ideation — invoke the idea-refine skill on the main thread to generate and stress-test variants from a rough, unfixed concept.
argument-hint: "[the rough concept to refine] (optional)"
---

# /idea-refine

Thin alias into the **variant-generation** sub-skill of the ideation domain. Use it when the concept itself
is still unfixed and you want divergent options — and a convergent pass — before committing to a direction.

**Invoke the `idea-refine` skill** (Skill tool) on the main thread. The router's precedence is
`nxtlvl:` → native ([ADR-020](../../../docs/decisions/ADR-020-router-endorses-established-items.md));
`idea-refine` is one of its **named interim exceptions** — its nxtlvl-refined body isn't authored yet, so
this resolves to the upstream `idea-refine` for now, and that pointer retires once the ◆ version ships. It
runs on the main thread.

## When to use

- The idea is rough and unfixed; you want to expand options before narrowing.
- You want to stress-test assumptions and explore alternatives before locking a direction.

For the full idea → approved-design front door, use `/brainstorm` (it reaches for this when the concept is
unfixed). For intent extraction, `/interview-me`; to interrogate a settled plan, `/grill-me`.

$ARGUMENTS
