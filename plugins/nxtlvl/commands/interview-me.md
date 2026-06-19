---
description: Direct entry to intent extraction — invoke the interview-me skill on the main thread to pull out what you actually want (hypothesis + confidence, one question at a time) without the full brainstorming arc.
argument-hint: "[the ask or idea to interrogate] (optional)"
---

# /interview-me

Thin alias into the **intent-extraction** sub-skill of the ideation domain. Use it when you want just the
interview — extract and sharpen intent — not the whole brainstorming front door.

**Invoke the `interview-me` skill** (Skill tool) on the main thread. By the router's precedence
(`nxtlvl:` → `agent-skills:` → native), the nxtlvl-refined version is used once it's authored; until then
this resolves to the upstream `interview-me`. The interview is interactive, so it runs on the main thread —
never as an agent.

## When to use

- The ask is underspecified ("build me X" with no who / why / when) and you want intent pulled to
  confidence before any design or code.
- You explicitly want to be interviewed or have your thinking stress-tested, short of the full arc.

For the whole idea → approved-design front door, use `/brainstorm` (it composes this skill). To go harder,
use `/grill-me`; for divergent variants on an unfixed concept, `/idea-refine`.

$ARGUMENTS
