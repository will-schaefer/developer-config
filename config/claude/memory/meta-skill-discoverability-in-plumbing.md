---
name: meta-skill-discoverability-in-plumbing
description: "On nxtlvl, router/meta-skills don't fire via description — wire their entry into the floor brief, not the frontmatter."
metadata: 
  node_type: memory
  type: project
  originSessionId: edba7f96-a0bf-48f9-a2a0-6c1d12a120b4
---

A meta/router skill (e.g. `nxtlvl:nxtlvl-router`) cannot be made to auto-trigger by tuning its `description`. The skill-creator triggering optimizer was run on `nxtlvl-router` (2026-06-19): 0% recall across 5 very different descriptions — including a maximally pushy "Use this FIRST…" — every query, every iteration. Routing ("which skill, where do I start, sequence this") is a *native* model capability, so the model answers inline and never reaches for a skill named "router." (The optimizer also under-measures here: it registers the candidate as a `.claude/commands/` entry, not a real skill.)

**Why:** description-based triggering only fires for tasks the model can't handle natively; meta-routing is exactly the thing it handles natively.

**How to apply:** Don't burn iterations optimizing a meta-skill's description, and don't swap in a "pushier" variant on faith — it's an unmeasured change. Put entry/discoverability in the *plumbing* — a SessionStart floor brief or CLAUDE.md line like "at the start of non-trivial work, resolve the entry skill via nxtlvl-router" — which is where [[adrs-advisory-not-canonical]]'s parent ADR-003 ("reconstruct only the plumbing, never the orchestration") says it belongs. The skill's body stays valuable as the reference map that line points at.
