# ECC Component Scoping — Agent vs Skill (and Command, Hook, Rule)

> Distilled 2026-06-18 from `reference/ECC-main` (VERSION 2.0.0). Captures the doctrine ECC
> uses to decide *which component type to create*, verified against source (`commands/`,
> `agents/`, `skills/`, `.claude/rules/`) and traced end-to-end on the
> `/go-review → go-reviewer → golang-patterns` chain. Companion to
> [ecc-main-map.md](ecc-main-map.md). **Purpose:** reuse the pattern when building nxtlvl
> components, so the agent-vs-skill choice is made on a principle, not by feel.

---

## 1. The five component types (ECC's stated rule)

From `docs/SKILL-DEVELOPMENT-GUIDE.md:39-47`, verbatim:

| Component | Purpose | Activation |
|-----------|---------|------------|
| **Skill** | Knowledge repository | Context-based (automatic) |
| **Agent** | Task executor | Explicit delegation |
| **Command** | User action | User-invoked (`/command`) |
| **Hook** | Automation | Event-triggered |
| **Rule** | Always-on guidelines | Always active |

The slogan: *"skills are passive knowledge that Claude Code references when relevant"*
(`SKILL-DEVELOPMENT-GUIDE.md:29`). Agents are *"specialized subassistants"* — active
executors. But the slogan under-describes the real decision; see §2.

---

## 2. The operative axis — what *actually* drives agent vs skill

The decision is governed by **three properties only an agent can have** (every agent file's
YAML frontmatter; see `CONTRIBUTING.md:237-244`, `CLAUDE.md`):

1. **Its own context window** — isolation. Delegating moves noisy work off the main thread.
2. **A scoped `tools:` allowlist** — a sandbox. A skill *cannot* be granted or denied tools.
3. **A `model:` tier** (`haiku`/`sonnet`/`opus`) — per-task cost/capability routing.

A **skill has none of these** — no `tools`, no `model`, no isolation. It is text injected into
whoever is already running (`the-shortform-guide.md:15`: skills are *"the primary workflow
surface"*; `:79`: subagents have *"limited scopes… sandboxed with specific tool permissions"*).

**The working question ECC answers:**

- Reusable knowledge / procedure applied **in the current context** → **SKILL**
- Needs **its own context, a tool sandbox, or to run autonomously** → **AGENT**

A second, decisive tell: **if the capability must be tool-restricted** (e.g. a reviewer that
*must not* be able to write files), it *has* to be an agent — that constraint is inexpressible
on a skill. ECC splits `*-reviewer` (read-only: `Read, Grep, Glob, Bash`) from
`*-build-resolver` (`+ Write, Edit`) for exactly this reason.

---

## 3. The pairing pattern — a domain ships *both*, in three layers

ECC rarely picks one type for a real domain. It ships a **layered set**, with a strict
division of labor and a **one-way dependency** (executor → knowledge):

```
COMMAND (entry)  ──spawns──▶  AGENT (executor)  ──consults──▶  SKILLS (knowledge)
 thin wrapper                 isolated, sandboxed              pure reference,
 human-facing spec            does the work                   caller-agnostic
```

- **Command = entry / orchestration.** A thin slash-entry whose job is to delegate. In source
  these are *commands*, not skills (`the-shortform-guide.md`: commands are "legacy slash-entry
  shims"; durable logic lives in skills). Note: installed plugins re-surface commands as
  skills, so `/go-review` appears as `ecc:go-review` at runtime even though the source file is
  `commands/go-review.md`.
- **Agent = isolated executor.** Lean. Holds the *procedure* and *rubric*, not the reference.
- **Skill = knowledge.** Heavy reference; **knows nothing about its callers** (verified: the
  knowledge skills contain zero references to any agent). This is what makes knowledge reusable
  by the command, the agent, *or* the main thread alike.

**The coupling mechanism** is explicit, not magic — subagents do **not** auto-load skills. The
parent injects skill content into the agent's prompt. From `reference/ECC-main/CLAUDE.md`:

> "When spawning subagents, always pass conventions from the respective skill into the agent's
> prompt."

---

## 4. Worked trace — `/go-review`

Sizes tell the story: command **148 lines**, agent **85 lines**, skills **675 + 721 lines**.
Knowledge is factored *out* of the agent into reusable skills.

1. **`/go-review` resolves to the command** (`commands/go-review.md`). Its only job is to
   delegate — `description:` ends *"Invokes the go-reviewer agent"* (`:2`); body: *"This
   command invokes the **go-reviewer** agent"* (`:7`). Footer names what to pass:
   *"Skills: skills/golang-patterns/, skills/golang-testing/"* (`:148`).
2. **Orchestrator spawns the agent and injects the knowledge** (per the CLAUDE.md line above).
3. **Agent runs in an isolated, read-only sandbox** — `tools: ["Read","Grep","Glob","Bash"]`,
   `model: sonnet` (`agents/go-reviewer.md:4-5`). No `Write`/`Edit`: the reviewer *cannot*
   mutate code. Tight "When invoked" loop (`git diff -- '*.go'`, `go vet`, `staticcheck`) +
   CRITICAL/HIGH/MEDIUM rubric (`:19-66`).
4. **Agent defers to the knowledge skill** instead of inlining it — last line: *"For detailed
   Go code examples and anti-patterns, see `skill: golang-patterns`"* (`:85`).
5. **Only the verdict crosses back** — PASS / WARNING / BLOCK (`go-review.md:130-136`). The
   full diff, vet spew, and file reads stayed inside the subagent. Reclaiming that context is
   the entire payoff of making review an agent rather than inlining it.

**Deliberate redundancy, two audiences:** the rubric + approval criteria appear in *both* the
command and the agent. Command's copy = human-facing documentation of what `/go-review` does;
agent's copy = the operative instruction set that drives the model. Same content, different
readers — not a DRY violation.

---

## 5. Decision checklist (the reusable part)

Create an **AGENT** if *any* of these holds:

- [ ] It must run in **isolated context** (long/noisy work you don't want polluting the main thread).
- [ ] It needs a **restricted tool set** (read-only review, or a deliberately narrow write surface).
- [ ] It should run **autonomously or in parallel** as a delegated worker.
- [ ] It warrants a **specific model tier**.

Otherwise create a **SKILL** — reusable knowledge, a checklist, or a procedure the current
agent applies in place.

Then layer the rest by activation:

- **COMMAND** — a user-typed `/entry` point. Keep it thin: detect context, delegate to the
  agent/skill, present results. Don't put durable logic here.
- **HOOK** — *event-triggered* automation (PreToolUse/PostToolUse/Stop/SessionStart). Use when
  the behavior must fire **without being asked**. Blocking hooks (PreToolUse, Stop) must be
  fast (<200ms) and `exit 0` on non-critical errors (`reference/ECC-main/.claude/rules/node.md`).
- **RULE** — *always-on* guidance with no trigger. Use for invariants that should shape every
  action (style, security baselines, ask-vs-proceed posture).

**When a domain has both knowledge *and* a job to do, ship the pair:** skill (knowledge) +
agent (the isolated, tool-scoped worker the command/skill spawns).

---

## 6. Smells (when the choice is wrong)

- **A "skill" that needs to not-touch-files** → should be an agent (tool sandbox is the point).
- **An agent with a 600-line embedded reference** → factor the reference into a skill; keep the
  agent lean (procedure + rubric + a `see skill: …` pointer).
- **A knowledge skill that names its callers** → coupling leak; knowledge should be
  caller-agnostic so anything can consult it.
- **Durable logic living in a command** → move it to a skill; the command is just the entry.
- **A "rule" that only applies sometimes** → it's a skill (context-activated), not a rule
  (always-on).
- **Behavior the user must remember to invoke** that should be automatic → it's a hook, not a
  skill/command.

---

## 7. Applying to nxtlvl (a lens, not a mandate)

Mapping the harness's own pieces onto this model:

| nxtlvl piece | ECC type | Why |
|--------------|----------|-----|
| context-alert ping / backstop | **Hook** | Event-triggered, fires unasked; awareness-only (informs, never steers). |
| dangerous-bash gate | **Hook** (blocking PreToolUse) | Must intercept *before* execution; fast, exit-2 to block, kill switch. |
| task-sizing / ask-vs-proceed posture | **Rule** | Always-on behavior-shaping (per `harness-hooks-inform-not-force`: shaping belongs in rules, not hooks). |
| C&M subsystem procedures | **Skill** | Reusable knowledge/procedure applied in-context. |
| five-axis review (`nxtlvl:review`) | **Command/skill entry → agent** | Entry wraps an isolated reviewer; keep the heavy convention in a skill the agent consults. |
| `/nxtlvl:documentation-and-adrs` | **Command entry** | Thin slash-entry; the ADR format/logic lives in the skill it invokes. |

The portable principle: **isolation + tool sandbox + autonomy → agent; reusable in-context
knowledge → skill; automatic firing → hook; always-on → rule; user-typed entry → command** —
and ship pairs, with knowledge factored out and depended on one-way.
