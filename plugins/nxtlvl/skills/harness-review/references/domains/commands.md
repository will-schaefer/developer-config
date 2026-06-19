# Domain Review — Slash commands (Mode C rubric)

> Per-domain specialist rubric for the **`harness-review` skill**, Mode C. `SKILL.md` is the spine;
> [`../domain-review.md`](../domain-review.md) is the framework; this file owns the **commands** rubric.
> Neutral: judges a harness's slash commands on **general best practice for slash-command design** —
> nxtlvl's own lessons (component-scoping, thin-wrapper-over-skill, terse momentum-friendly invocation)
> are cited as *rationale for why a checkpoint matters*, never as the bar the reviewed harness is
> scored against.

---

## 1. What this domain is — where to look

A harness's **slash commands** are the thin, user-facing entry points the runtime exposes as
`/name` — the surface a person types to start work. A good command owns *invocation* (a name, its
arguments, a one-line job) and **delegates the actual work** to a skill (a procedure on the main
thread) or an agent (autonomous work in its own context); it should not re-embed the logic that
belongs in a skill. Read, in order:

- **The command definitions** — `commands/*.md` (command frontmatter: `name`, `description`,
  `argument-hint`) and any command entries in a plugin manifest. This is ground truth for *what the
  user can invoke and how*.
- **Each command body** — the prose/instructions the command expands to. Confirm whether it
  *delegates* (launches a skill / spawns an agent) or *inlines* a procedure. Trust the body over the
  description.
- **The neighbouring skills & agents** — to judge thin-wrapper discipline you must know what a
  command *should* delegate to. A command that re-implements a skill that exists next door is the
  classic finding. *(Cross-check naming against the harness's namespace — collisions hide here.)*

---

## 2. The specialist rubric  (score each 1–5, justify with `file:line`)

**Dominant dimensions: D1 (naming & namespacing) and D4 (discoverability & usage clarity)** — a
command nobody can find or invoke correctly is dead on arrival no matter how clean its body. A fatal
flaw in either caps the overall; don't flat-average it away.

| # | Dimension | The question it answers | What a 5 looks like | The failure mode (a 1) |
|---|-----------|-------------------------|---------------------|------------------------|
| 1 | **Naming & namespacing** ⭐ | Is the name discoverable, predictable, and collision-free? | The name says what it does, follows a consistent verb/noun convention, and is namespaced (e.g. `plugin:command`) so it can't clash with another harness's commands. | An opaque or cute name that hides the job; a bare global name that collides with a built-in or sibling plugin. |
| 2 | **Argument design** | Can a user invoke it correctly on the first try? | Clear, minimal arguments with sensible defaults and an `argument-hint`; the common case needs no flags; optional refinement is obvious. | Positional-soup args with no hint; required flags for the common path; ambiguous parsing where order silently changes behavior. |
| 3 | **Thin-wrapper-over-skill discipline** | Does the command delegate, or duplicate logic that belongs in a skill/agent? | The command owns only invocation and hands off to a skill (main-thread procedure) or an agent (autonomous work); the procedure lives in one place. | The body re-implements a procedure that already exists as a skill, so logic drifts in two places and the command becomes a maintenance liability. |
| 4 | **Discoverability & usage clarity** ⭐ | Can the user find it and know how to call it? | `description` states the job in one line; usage/help is clear; the command is easy to surface (named for the job, listed where users look). | No usable description; the user must read the body to learn what it does or how to invoke it; effectively undiscoverable. |
| 5 | **Idempotence / safety** | Is re-running it safe? | Re-invoking produces no surprising or destructive side effect; any mutating command says so and is guarded. | A re-run silently duplicates work, overwrites, or destroys state with no warning; running it twice is dangerous. |
| 6 | **Clarity & maintainability** | Is the definition readable and does it match behavior? | One clear job; legible body; `description`/`argument-hint` match what the command actually does. | Bloated body switching on hidden modes; description drifted from behavior; a newcomer can't trace command → delegate → effect. |

---

## 3. What to hunt — the concrete checks

- **The delegation test** — for each command, open the body and ask: does it *launch a skill / spawn
  an agent*, or does it *inline a procedure*? Inlined logic that duplicates an existing skill is a D3
  finding. *(Why it matters: the component-scoping doctrine puts the procedure in a skill and the
  autonomous work in an agent; a command is the thin entry point, not the place the work lives.)*
- **The argument-hint audit** — grep frontmatter for `argument-hint`; for each command without one,
  ask whether a first-time user could invoke it correctly. Check that defaults cover the common case
  and that args aren't an unparseable positional soup (D2).
- **The namespace sweep** — list every command name and check for collisions with built-ins, with
  sibling plugins, and within the harness; confirm names follow one convention and *say what they do*
  (D1). *(Why: a non-namespaced command can shadow or be shadowed silently.)*
- **The re-run check** — for any command that writes, commits, deletes, or otherwise mutates, ask
  *what happens if I run it twice?* No guard / no warning on a destructive repeat is a D5 hit.
- **Discoverability** — does `description` let a user find and understand the command without reading
  its body? A command named for its job with a one-line description scores D4 = 5; one you must
  open to understand scores low. *(Why: terse, momentum-friendly invocation is the point of a
  command — if you have to study it, it isn't serving that.)*
- **Description-vs-body drift** — confirm the `description`/`argument-hint` match what the body
  actually does; drift is a D6 finding and often hides a stale command.

---

## 4. Partition & signal-vs-demo

- **Partition:** ≲ 4 commands → one deep agent over the whole `commands/` tree. More → one agent per
  **command-group** (by namespace or by the skill/agent they front), each scoring §2 and reporting
  the commands it owns; synthesis rolls up. Always read the neighbouring skills/agents first and pass
  them as shared context so the delegation test (D3) is judgeable.
- **Signal vs demo:** tutorial/teaching harnesses ship a deliberately-trivial example command (a
  `/hello` that just prints) to demonstrate the command format. Don't score that as craft — note it
  as demo and judge the *real* commands.

---

## 5. Lessons & gotchas

- **A command is a wrapper, not a home for logic.** The most common and most damaging finding is a
  command that re-embeds a skill's procedure. Score the delegation, not the prose: if the work could
  (and should) live in a skill the body inlines instead, that's a D3 cap even if the command reads
  cleanly.
- **The name is half the product.** A command that does the right thing under a name nobody guesses
  is barely better than one that doesn't exist — discoverability and naming dominate (D1/D4) because
  a command's whole reason to exist is fast, correct invocation.
- **Judge invocation ergonomics from the caller's seat.** A sensible default + an `argument-hint`
  often matters more than a powerful flag set; the test is "can a user get it right the first time,"
  not "is every option exposed."
- **Namespacing is a correctness property, not cosmetics.** An un-namespaced command can silently
  collide; treat a missing namespace as a latent D1 bug in any multi-plugin environment, not a style
  nit.
- **Don't reward a long body.** A big command body is usually a smell, not effort — it tends to mean
  inlined logic (D3) or hidden modes (D6). Brevity that delegates beats a self-contained monolith.
