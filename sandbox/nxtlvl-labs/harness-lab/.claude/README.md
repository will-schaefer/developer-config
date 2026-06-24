# `.claude/` — lab-as-CC-project (the dogfood mechanism)

`agents-lab` is **not** a standalone plugin. It is a development workspace inside the nxtlvl repo
whose cells graduate **into the nxtlvl plugin**. In-flight cells are dogfooded by treating the lab
as a **live Claude Code project**: when you work with `agents-lab` as your project directory, its
cells are auto-discovered as **project-scoped skills**.

## How it works

`.claude/skills` is a **symlink to `../cells`**. CC scans `.claude/skills/<name>/SKILL.md`, so every
**skill-type cell** (`cells/<name>/SKILL.md`) is exposed as the project skill `/<name>` — with zero
file duplication (`cells/` stays the single source of truth; the cell's `manifest.yaml` / `run.md` /
`evals/` sit alongside `SKILL.md` and are ignored by skill discovery).

- **No install, no marketplace, no second plugin identity.** Project skills load automatically when
  the lab is your working directory and unload when you leave it.
- Project-skill discovery walks **upward** from the cwd, so cells **do not leak** into the main
  Developer session — they're live only while you're working in the lab (`sandbox/` also stays off
  the live nxtlvl plugin's discovery path per the repo `CLAUDE.md`).
- **Agent / command / hook cells:** project discovery for those uses `.claude/agents/` (flat `.md`)
  and `.claude/commands/`, which don't match the nested `cells/<name>/` layout — dogfood those by
  exercising the cell directly until the lab grows per-type wiring. Skill is the common case.

## Graduation

When a cell passes `npm run graduate`, it is promoted by an in-repo move into
`plugins/nxtlvl/<type>/<name>/` (carrying its `evals/`) — becoming part of **the nxtlvl plugin**
itself. There is no intermediate "lab plugin."
