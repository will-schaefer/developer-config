---
description: Direct entry to the deep interrogation tier — invoke the grill-me skill on the main thread for relentless, branch-by-branch stress-testing of a plan or design.
argument-hint: "[the plan or design to grill] (optional)"
---

# /grill-me

Thin alias into the **deep interrogation** tier of the ideation domain — the high-intensity sibling of
`/interview-me`. Use it when you want a plan or design stress-tested hard, one branch of the decision tree
at a time, until the thinking holds.

**Invoke the `grill-me` skill** (Skill tool) on the main thread. The router's precedence is
`nxtlvl:` → native ([ADR-020](../../../docs/decisions/ADR-020-router-endorses-established-items.md));
`grill-me` is one of its **named interim exceptions** — its nxtlvl-refined body isn't authored yet, so this
resolves to the upstream `grill-me` for now, and that pointer retires once the ◆ version ships. The
interrogation is interactive, so it runs on the main thread — never as an agent.

## When to use

- You have a plan or design and want it relentlessly cross-examined before committing.
- `/interview-me` isn't hard enough — the stakes are high, or the idea keeps shifting under pressure.

For the full idea → approved-design front door, use `/brainstorm`; for lighter intent extraction,
`/interview-me`.

$ARGUMENTS
