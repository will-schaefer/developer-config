# sandbox/ — staging area for nxtlvl harness items

A **scaffolding ground** for skills, agents, and commands that aren't ready to be
live yet. This directory is **not on the harness's discovery path** — nothing here is
loaded, routed to, or executed by the running nxtlvl plugin. That's the point: build
and iterate without polluting the live skill list or tripping the router.

## Why it lives here and not in `plugins/nxtlvl/`

Everything under `plugins/nxtlvl/{skills,agents,commands,hooks}/` is auto-discovered
and loaded by Claude Code. A half-built `SKILL.md` there shows up immediately and a
malformed frontmatter can throw warnings. `sandbox/` is the path the loader *doesn't*
look at — so work-in-progress stays invisible to the harness until you promote it.

## Layout — mirrors the plugin's internal shape

```
sandbox/
  skills/      # build SKILL.md + supporting files here
  agents/      # agent definitions in progress
  commands/    # slash-command definitions in progress
```

Mirroring the target shape makes promotion a pure move — no path rewriting.

## Promotion — the activation step

Promotion is moving a folder from here into the live plugin tree. Use `git mv` so
history follows the files:

```sh
git mv sandbox/skills/<name>   plugins/nxtlvl/skills/<name>
git mv sandbox/agents/<name>   plugins/nxtlvl/agents/<name>
git mv sandbox/commands/<name> plugins/nxtlvl/commands/<name>
```

The move *is* the activation — the harness picks the item up on next load.

## Tracked, not ignored

WIP here is committed to git so it's diffable and reviewable across sessions. For
genuine throwaway experiments, use the existing `*-workspace/` convention instead —
those are gitignored.

## Where this sits in the docs pipeline

`docs/` runs idea → intent → spec → plan → decision. `sandbox/` is the *runnable*
counterpart to that: once an idea is sharp enough to prototype as an actual skill/
agent/command, it gets scaffolded here, then promoted into the harness when it earns
its place.
