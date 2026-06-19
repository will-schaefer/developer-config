---
description: Direct entry to divergent ideation — invoke the idea-refine skill on the main thread to generate and stress-test variants from a rough, unfixed concept.
argument-hint: "[the rough concept to refine] (optional)"
---

# /idea-refine

Thin alias into the **variant-generation** sub-skill of the ideation domain. Use it when the concept itself
is still unfixed and you want divergent options — and a convergent pass — before committing to a direction.

**Invoke the `idea-refine` skill** (Skill tool) on the main thread. By the router's precedence
(`nxtlvl:` → `agent-skills:` → native), the nxtlvl-refined version is used once it's authored; until then
this resolves to the upstream `idea-refine`. It runs on the main thread.

## When to use

- The idea is rough and unfixed; you want to expand options before narrowing.
- You want to stress-test assumptions and explore alternatives before locking a direction.

For the full idea → approved-design front door, use `/brainstorm` (it reaches for this when the concept is
unfixed). For intent extraction, `/interview-me`; to interrogate a settled plan, `/grill-me`.

$ARGUMENTS
