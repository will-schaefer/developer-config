---
description: Lift a proven project instinct to global scope — only if its effective confidence has reached the 80% promote bar.
argument-hint: [instinct-id]
---

# /promote

Promote a **project-scoped instinct** to **global** so it applies across all your projects — but only if it has earned it. The promote bar is **≥0.8 effective confidence** (time-decayed); a raw confidence that has decayed below 0.8 is refused. Run with no argument to see which project instincts currently qualify.

No LLM judgment is needed. Set `PROMOTE_ID` from `$ARGUMENTS` (the instinct id to promote, or empty to list eligible), then run the `node -e` snippet below; print its output verbatim to the user.

- If the user passed an id: set `PROMOTE_ID=<id>`.
- If the user passed no argument: leave `PROMOTE_ID` empty (the snippet will list eligible project instincts instead).

```bash
CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}" PROMOTE_ID="${PROMOTE_ID:-}" \
  node -e 'const r=process.env.CLAUDE_PLUGIN_ROOT;
const I=require(r+"/lib/instincts");
const {projectIdentity}=require(r+"/lib/project-identity");
const pid=projectIdentity(process.cwd()).key;
const now=Date.now();
const BAR=0.8;
const id=(process.env.PROMOTE_ID||"").trim();
if(!id){
  const elig=I.list({projectId:pid,scope:"project"},undefined,undefined).filter(function(x){return I.effectiveConfidence(x,now)>=BAR;}).sort(function(a,b){return I.effectiveConfidence(b,now)-I.effectiveConfidence(a,now);});
  console.log("Eligible project instincts (effective confidence >= "+(BAR*100)+"%):");
  console.log(elig.length?elig.map(function(x){return "  - "+x.id+"  eff "+(I.effectiveConfidence(x,now)*100).toFixed(0)+"%  ["+(x.domain||"-")+"]";}).join("\n"):"  (none yet — reinforce a project instinct until it reaches the bar)");
  console.log("\nRun /promote <id> to lift one to global.");
  process.exit(0);
}
const inst=I.readById(id,{scope:"project",projectId:pid},undefined,undefined);
if(!inst){console.log("No project-scoped instinct \""+id+"\" in this project. Use /instinct-status to see ids.");process.exit(0);}
const eff=I.effectiveConfidence(inst,now);
if(eff<BAR){console.log("REFUSED: \""+id+"\" effective confidence "+(eff*100).toFixed(0)+"% is below the "+(BAR*100)+"% promote bar. Reinforce it first (it must recur to climb).");process.exit(0);}
const res=I.promote(inst,undefined,undefined);
console.log(res.promoted?("Promoted \""+id+"\" to global.\n  was (project): "+res.from+"\n  now (global):  "+res.to):("\""+id+"\" is already global; nothing to do."));'
```

Present the output as a code block (it is pre-formatted; do not reformat or summarise it).

## What this does

Promote re-scopes a project-scoped instinct to **global** so it applies everywhere. The re-scope is atomic and crash-safe: `lib/instincts.promote` writes the global copy first, then removes the project file. A crash between the two leaves a recoverable duplicate (same id → write overwrites); you cannot lose data.

The **≥0.8 effective-confidence bar** is enforced here in the command, before calling `lib/instincts.promote` (the primitive carries no bar of its own). Effective confidence is the raw stored value with time-decay applied at read time — a project instinct that has faded below 0.8 is **refused**; you need to reinforce it (let it recur) until it climbs back above the bar. This separates proven habits from transient observations.

The effective bar is higher than the recall bar (0.7): a habit must be both strong and fresh to earn global scope.

## Usage

```
/promote <id>
```

Promote the project instinct with the given id to global. The agent sets `PROMOTE_ID` from the argument and runs the snippet. The output will be one of:

- `Promoted "<id>" to global.` — success; file moved from project to global store.
- `REFUSED: "<id>" effective confidence N% is below the 80% promote bar.` — below bar; reinforce first.
- `"<id>" is already global; nothing to do.` — already promoted; no duplicate is created.
- `No project-scoped instinct "<id>" in this project.` — id not found in this project's store.

```
/promote
```

List all project instincts with effective confidence ≥ 80% — a discovery aid to find what is ready to promote. Leave `PROMOTE_ID` empty; the snippet prints the eligible list sorted best-first.

## Related commands

Use `/instinct-status` to see all instinct ids, effective confidence, and raw values. Use `/prune` to drop stale project instincts that have decayed below the recall bar. Use `/evolve` to graduate a cluster of related instincts into a reusable skill, command, or agent.
