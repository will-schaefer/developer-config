---
description: List graduation candidates (default dry-run) or author evolved artifacts from strong instinct clusters. Pass --generate to dispatch the evolver agent and write artifacts to .claude/evolved/ for review.
argument-hint: [--generate]
---

# /evolve

Run the deterministic **`lib/evolve`** clustering engine to surface graduation candidates from the C&M instinct store, then (on `--generate`) dispatch the **`nxtlvl:evolver`** agent to author each artifact in isolated context.

**Dry run by default** — the command reads nothing and writes nothing unless you pass `--generate`.

## What this does

Strong instincts that share a normalized trigger cluster automatically. The clustering engine partitions each cluster into exactly one type:

- **AGENT** — 3+ strong instincts, avgConfidence ≥ 0.75 → a multi-instinct specialist agent.
- **SKILL** — 2+ strong instincts below the agent threshold → a reusable playbook skill.
- **COMMAND** — 1 strong singleton instinct whose domain is `workflow` → a single workflow command.

This is deterministic — no LLM, no file writes — so the dry run is completely safe to run at any time. The evolver agent does the authoring; the command is cheap orchestration.

## Step 1 — always: run the candidate snippet

Run the snippet below unconditionally — it emits the enriched JSON that drives both modes.

```bash
CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}" node -e 'const r=process.env.CLAUDE_PLUGIN_ROOT;
const E=require(r+"/lib/evolve");
const I=require(r+"/lib/instincts");
const {projectIdentity}=require(r+"/lib/project-identity");
const pid=projectIdentity(process.cwd()).key;
const out=E.evolve({projectId:pid},undefined,undefined);
const byId={};
for(const x of I.list({projectId:pid},undefined,undefined)){byId[x.id]=x;}
const cands=out.candidates.map(function(c){return {type:c.type,triggerKey:c.triggerKey,size:c.size,avgConfidence:Number(c.avgConfidence.toFixed(3)),domains:c.domains,members:c.instinctIds.map(function(id){const m=byId[id]||{};return {id:m.id,trigger:m.trigger,domain:m.domain,action:m.action,evidence:m.evidence,scope:m.scope};})};});
console.log(JSON.stringify({considered:out.considered,total:out.total,candidates:cands},null,2));'
```

Parse the JSON (`{ considered, total, candidates }`).

## Step 2 — branch on the flag

### Default (no `--generate`) — dry run, writes nothing

Present a readable summary of the candidates. For each candidate, show:

- **Type** (`AGENT` / `SKILL` / `COMMAND`), the `triggerKey`, cluster size, and `avgConfidence`.
- **Member instincts** — each member's `id` and `trigger`.

If `candidates` is empty, say so clearly — for example:

> No graduation candidates yet — strong clusters form as instincts reinforce.

End with:

> Re-run `/evolve --generate` to author the artifacts above.

### `--generate` — dispatch the evolver, write nothing yourself

For **each** candidate in `candidates`, dispatch **`nxtlvl:evolver`** using the Agent tool:

```
subagent_type: "nxtlvl:evolver"
```

Pass the candidate's enriched JSON object verbatim in the dispatch prompt — include the `type`, `triggerKey`, `size`, `avgConfidence`, `domains`, and the full `members` array (each with `id`, `trigger`, `domain`, `action`, `evidence`, `scope`). Also pass the current project root path.

**Do not author anything in this command.** The command is cheap orchestration; the evolver does the writing.

After each evolver returns, relay its report to the user:
- Status
- Artifact path written (inside `.claude/evolved/`)
- Source instinct ids

Note that artifacts land in `.claude/evolved/` (staging, off the discovery path) for the user to review and promote manually. Claude Code discovers `.claude/skills/`, `.claude/commands/`, and `.claude/agents/` — not `.claude/evolved/...` — so nothing goes live until the user moves it.

## Usage

```
/evolve
```
Dry run — lists graduation candidates, writes nothing. Safe to run any time.

```
/evolve --generate
```
Authors each candidate via the evolver subagent. Artifacts written to `.claude/evolved/<type>s/…` for review.

## How it works

The `lib/evolve` engine is deterministic: same instinct store → same candidates every time. The evolver writes real artifacts (not stubs) by distilling the cluster's `action` and `evidence` into a coherent body. Artifacts stay in `.claude/evolved/` until you decide to promote them.

## Related commands

Use `/instinct-status` to review the full store before evolving, `/prune` to remove stale instincts, and `/promote` to lift a strong project instinct to global scope.
