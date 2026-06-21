---
description: Dry-run (default) or delete stale pending instincts — those that decayed below the recall bar and never recurred. Pass --confirm to actually remove them.
argument-hint: [--confirm] [--max-age N]
---

# /prune

Sweep the **C&M instinct store** for stale pending instincts and show what would be (or was) removed. **Dry run by default** — nothing is deleted unless you pass `--confirm`.

No LLM judgment is needed. Set env flags from the slash args, then run the `node -e` snippet below; print its output verbatim to the user.

- If the user passed `--confirm`: set `PRUNE_CONFIRM=1`.
- If the user passed `--max-age N`: set `PRUNE_MAX_AGE=N`.
- Otherwise: run as-is (dry run, 30-day default).

```bash
CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}" \
  PRUNE_CONFIRM="${PRUNE_CONFIRM:-}" \
  PRUNE_MAX_AGE="${PRUNE_MAX_AGE:-}" \
  node -e 'const r=process.env.CLAUDE_PLUGIN_ROOT;
const I=require(r+"/lib/instincts");
const {projectIdentity}=require(r+"/lib/project-identity");
const pid=projectIdentity(process.cwd()).key;
const now=Date.now();
const BAR=0.7, DAY=86400000, MAXAGE=Number(process.env.PRUNE_MAX_AGE||30);
const confirm=process.env.PRUNE_CONFIRM==="1";
const cands=I.list({projectId:pid},undefined,undefined).filter(function(x){
  const eff=I.effectiveConfidence(x,now);
  const age=(now-Date.parse(x.updated))/DAY;
  return eff<BAR && (x.reinforcements||0)===0 && age>MAXAGE;
});
if(!cands.length){console.log("No stale pending instincts to prune (eff<"+BAR+", never reinforced, updated >"+MAXAGE+"d ago).");process.exit(0);}
console.log((confirm?"PRUNING ":"DRY RUN — would prune ")+cands.length+" stale pending instinct(s):");
for(const x of cands){console.log("  - "+x.id+"  ["+x.scope+(x.project_id?"/"+x.project_id:"")+"]  eff "+(I.effectiveConfidence(x,now)*100).toFixed(0)+"%  updated "+x.updated);}
if(confirm){let n=0;for(const x of cands){if(I.remove(x,undefined,undefined))n++;}console.log("\nRemoved "+n+" file(s).");}
else{console.log("\nNothing deleted. Re-run with --confirm to delete these.");}'
```

Present the output as a code block (it is pre-formatted; do not reformat or summarise it).

## What this does

An instinct is a prune candidate when **all three** conditions hold:

1. **Below the recall bar** — `effectiveConfidence(x, now) < 0.7`. Decay is applied at read time (no cron, no rewrite); a stale instinct's effective confidence sinks under the bar automatically.
2. **Never reinforced** — `reinforcements === 0`. The pattern was observed once by the observer but never recurred; it never graduated from "tentative" to "habit".
3. **Old enough** — `updated` is more than 30 days ago (default; override with `--max-age N`). Mirrors the observation-log 30-day purge window. If `updated` is missing or unparseable, the instinct is **not pruned** — conservative, never delete on a parse failure.

Decay and staleness are automatic: instincts drift below the bar on their own. `/prune` is just the manual sweep — a way to reclaim disk and signal-clarity by actually removing what has fully faded. Deletion goes through `lib/instincts.remove` (the path-safe primitive), never raw `fs`.

## Usage

```
/prune
```
Dry run — lists candidates, deletes nothing. Review the list before committing.

```
/prune --confirm
```
Delete the listed candidates. The agent sets `PRUNE_CONFIRM=1` on the node invocation. Without `--confirm`, **nothing is ever deleted**.

```
/prune --max-age 60
```
Use 60 days instead of 30 as the age threshold. Can combine with `--confirm`:

```
/prune --max-age 60 --confirm
```

The agent sets `PRUNE_MAX_AGE=60` (and optionally `PRUNE_CONFIRM=1`) on the node invocation.

## Related commands

Use `/instinct-status` to review the full instinct store before pruning, `/promote` to lift a strong project instinct to global scope, and `/evolve` to graduate clusters of related instincts into a reusable skill, command, or agent.
