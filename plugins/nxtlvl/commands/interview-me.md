---
description: Direct entry to intent extraction — invoke the interview-me skill on the main thread to pull out what you actually want (hypothesis + confidence, one question at a time) without the full brainstorming arc.
argument-hint: "[the ask or idea to interrogate] (optional)"
---

# /interview-me

Thin alias into the **intent-extraction** sub-skill of the ideation domain. Use it when you want just the
interview — extract and sharpen intent — not the whole brainstorming front door.

**Invoke the `interview-me` skill** (Skill tool) on the main thread. The router's precedence is
`nxtlvl:` → native ([ADR-020](../../../docs/decisions/ADR-020-router-endorses-established-items.md));
`interview-me` is one of its **named interim exceptions** — its nxtlvl-refined body isn't authored yet, so
this resolves to the upstream `interview-me` for now, and that pointer retires once the ◆ version ships. The
interview is interactive, so it runs on the main thread — never as an agent.

## When to use

- The ask is underspecified ("build me X" with no who / why / when) and you want intent pulled to
  confidence before any design or code.
- You explicitly want to be interviewed or have your thinking stress-tested, short of the full arc.

For the whole idea → approved-design front door, use `/brainstorm` (it composes this skill). To go harder,
use `/grill-me`; for divergent variants on an unfixed concept, `/idea-refine`.

$ARGUMENTS
